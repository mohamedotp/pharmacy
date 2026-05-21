import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";

export interface Pharmacy {
  id: string;
  name: string;
  username: string;
  phone?: string;
  clinic_numbers?: string;
  address?: string;
  logo_url?: string;
  is_active: boolean;
  plan: string;
  created_at: string;
  license_number?: string;
  email?: string;
  printer_type?: string;
  paper_size?: string;
  receipt_header?: string;
  receipt_footer_ar?: string;
  receipt_footer_en?: string;
  notify_expiry?: boolean;
  notify_low_stock?: boolean;
  notify_daily_report?: boolean;
  low_stock_days?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  full_name: string;
  is_super_admin: boolean;
  pharmacy_id: string | null;
  avatar_url?: string | null;
  role?: { id: string; name: string } | null;
  pharmacy?: Pharmacy | null;
}

interface AuthState {
  user: AuthUser | null;
  pharmacy: Pharmacy | null;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  clearError: () => void;
}

// Map username → fake email for Supabase auth
const usernameToEmail = (username: string) => {
  const normalized = username.trim().replace(/\s+/g, '').toLowerCase();
  return normalized.includes("@") ? normalized : `${normalized}@pharmacyos.admin`;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      pharmacy: null,
      isLoading: false,
      error: null,

      clearError: () => set({ error: null }),

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const email = usernameToEmail(username);
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            set({ error: "اسم المستخدم أو كلمة المرور غير صحيحة", isLoading: false });
            return false;
          }

          if (!data.user) {
            set({ error: "حدث خطأ أثناء تسجيل الدخول", isLoading: false });
            return false;
          }

          // Fetch user profile
          const { data: profile, error: profileError } = await supabase
            .from("users")
            .select(`
              id, email, username, full_name, is_super_admin, pharmacy_id, avatar_url,
              role:roles(id, name),
              pharmacy:pharmacies(id, name, username, phone, clinic_numbers, address, logo_url, is_active, plan, created_at, license_number, email, printer_type, paper_size, receipt_header, receipt_footer_ar, receipt_footer_en, notify_expiry, notify_low_stock, notify_daily_report, low_stock_days)
            `)
            .eq("id", data.user.id)
            .single();

          if (profileError || !profile) {
            set({ error: "لم يتم العثور على ملف المستخدم", isLoading: false });
            await supabase.auth.signOut();
            return false;
          }

          const pharmacy = Array.isArray(profile.pharmacy)
            ? profile.pharmacy[0] ?? null
            : profile.pharmacy ?? null;

          // Block inactive pharmacy users
          if (!profile.is_super_admin && pharmacy && !pharmacy.is_active) {
            set({ error: "هذا الحساب موقوف. تواصل مع الإدارة", isLoading: false });
            await supabase.auth.signOut();
            return false;
          }

          const userRole = Array.isArray(profile.role) ? profile.role[0] : profile.role;
          const authUser: AuthUser = {
            id: profile.id,
            email: profile.email,
            username: profile.username ?? username,
            full_name: profile.full_name,
            is_super_admin: profile.is_super_admin ?? false,
            pharmacy_id: profile.pharmacy_id ?? null,
            avatar_url: profile.avatar_url ?? null,
            role: userRole ?? null,
            pharmacy,
          };

          set({ user: authUser, pharmacy: pharmacy ?? null, isLoading: false });
          return true;
        } catch {
          set({ error: "حدث خطأ غير متوقع", isLoading: false });
          return false;
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, pharmacy: null });
      },

      fetchProfile: async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          set({ user: null, pharmacy: null });
          return;
        }

        const { data: profile } = await supabase
          .from("users")
          .select(`
            id, email, username, full_name, is_super_admin, pharmacy_id, avatar_url,
            role:roles(id, name),
            pharmacy:pharmacies(id, name, username, phone, clinic_numbers, address, logo_url, is_active, plan, created_at, license_number, email, printer_type, paper_size, receipt_header, receipt_footer_ar, receipt_footer_en, notify_expiry, notify_low_stock, notify_daily_report, low_stock_days)
          `)
          .eq("id", authUser.id)
          .single();

        if (!profile) return;

        const pharmacy = Array.isArray(profile.pharmacy)
          ? profile.pharmacy[0] ?? null
          : profile.pharmacy ?? null;

        const userRole = Array.isArray(profile.role) ? profile.role[0] : profile.role;
        set({
          user: {
            id: profile.id,
            email: profile.email,
            username: profile.username ?? "",
            full_name: profile.full_name,
            is_super_admin: profile.is_super_admin ?? false,
            pharmacy_id: profile.pharmacy_id ?? null,
            avatar_url: profile.avatar_url ?? null,
            role: userRole ?? null,
            pharmacy,
          },
          pharmacy: pharmacy ?? null,
        });
      },
    }),
    {
      name: "pharmacy-auth",
      partialize: (state) => ({ user: state.user, pharmacy: state.pharmacy }),
    }
  )
);
