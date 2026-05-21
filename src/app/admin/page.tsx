"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  PlusSquare,
  Building2,
  Users,
  Plus,
  Loader2,
  LogOut,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Phone,
  MapPin,
  Search,
  MoreVertical,
  RefreshCw,
  Shield,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore, Pharmacy } from "@/store/auth-store";

interface PharmacyWithStats extends Pharmacy {
  users_count?: number;
}

interface NewPharmacyForm {
  pharmacy_name: string;
  pharmacy_username: string;
  phone: string;
  address: string;
  admin_email: string;
  admin_full_name: string;
  admin_username: string;
  admin_password: string;
  plan: string;
}

const emptyForm: NewPharmacyForm = {
  pharmacy_name: "",
  pharmacy_username: "",
  phone: "",
  address: "",
  admin_email: "",
  admin_full_name: "",
  admin_username: "",
  admin_password: "",
  plan: "basic",
};



export default function AdminPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [pharmacies, setPharmacies] = useState<PharmacyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewPharmacyForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const fetchPharmacies = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pharmacies")
      .select("*")
      .order("created_at", { ascending: false });
    setPharmacies(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user && user.is_super_admin) {
      fetchPharmacies();
    }
  }, [user]);

  const togglePharmacy = async (id: string, currentStatus: boolean) => {
    await supabase.from("pharmacies").update({ is_active: !currentStatus }).eq("id", id);
    fetchPharmacies();
  };

  const createPharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      // 1. Create pharmacy record
      const { data: pharmacy, error: pharmErr } = await supabase
        .from("pharmacies")
        .insert({
          name: form.pharmacy_name,
          username: form.pharmacy_username,
          phone: form.phone || null,
          address: form.address || null,
          plan: form.plan,
        })
        .select()
        .single();

      if (pharmErr) throw new Error(pharmErr.message);

      // 2. Create auth user + profile via edge function
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-pharmacy-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            username: form.admin_username,
            password: form.admin_password,
            full_name: form.admin_full_name,
            pharmacy_id: pharmacy.id,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "فشل إنشاء المستخدم");

      setShowModal(false);
      setForm(emptyForm);
      fetchPharmacies();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "حدث خطأ أثناء الإنشاء");
    } finally {
      setCreating(false);
    }
  };


  const filtered = pharmacies.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.username.toLowerCase().includes(search.toLowerCase())
  );

  const planColors: Record<string, string> = {
    basic: "bg-slate-100 text-slate-600",
    pro: "bg-blue-100 text-blue-700",
    enterprise: "bg-purple-100 text-purple-700",
  };

  return (
    <ProtectedRoute requireSuperAdmin>
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Top bar */}
      <header className="bg-[#002B5B] text-white px-6 py-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <PlusSquare size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-black text-lg leading-none">PharmacyOS</h1>
            <p className="text-blue-300 text-xs">لوحة تحكم المشرف العام</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
            <Shield size={14} className="text-cyan-300" />
            <span className="text-sm font-bold">{user?.username}</span>
          </div>
          <button
            onClick={() => { logout(); router.replace("/login"); }}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-2 text-sm font-bold transition-colors"
          >
            <LogOut size={16} />
            خروج
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "إجمالي الصيدليات", value: pharmacies.length, icon: Building2, color: "text-blue-600 bg-blue-50" },
            { label: "صيدليات نشطة", value: pharmacies.filter((p) => p.is_active).length, icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
            { label: "صيدليات موقوفة", value: pharmacies.filter((p) => !p.is_active).length, icon: XCircle, color: "text-rose-600 bg-rose-50" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon size={22} />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                <p className="text-slate-500 text-sm">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pharmacies Table */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="text-xl font-black text-slate-900">الصيدليات المسجلة</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث..."
                  className="pr-9 pl-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20 w-48"
                />
              </div>
              <button onClick={fetchPharmacies} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                <RefreshCw size={16} className="text-slate-500" />
              </button>
              <button
                id="add-pharmacy-btn"
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-[#002B5B] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#003d82] transition-colors"
              >
                <Plus size={16} />
                صيدلية جديدة
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-slate-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Building2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">لا توجد صيدليات بعد</p>
              <p className="text-sm mt-1">اضغط "صيدلية جديدة" لإضافة أول صيدلية</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map((ph) => (
                <div key={ph.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#002B5B] to-[#0a4a8a] flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                      {ph.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">{ph.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${planColors[ph.plan] ?? planColors.basic}`}>
                          {ph.plan}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${ph.is_active ? "bg-emerald-400" : "bg-rose-400"}`} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-slate-400 text-xs">
                        <span>@{ph.username}</span>
                        {ph.phone && <span className="flex items-center gap-1"><Phone size={10} />{ph.phone}</span>}
                        {ph.address && <span className="flex items-center gap-1"><MapPin size={10} />{ph.address}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePharmacy(ph.id, ph.is_active)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                        ph.is_active
                          ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                          : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      {ph.is_active ? "إيقاف" : "تفعيل"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Pharmacy Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-l from-[#002B5B] to-[#0a4a8a] p-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 size={22} className="text-white" />
                  <h2 className="text-white font-black text-xl">صيدلية جديدة</h2>
                </div>
                <button
                  onClick={() => { setShowModal(false); setForm(emptyForm); setCreateError(null); }}
                  className="text-white/60 hover:text-white transition-colors text-xl font-bold"
                >✕</button>
              </div>
            </div>

            <form onSubmit={createPharmacy} className="p-6 space-y-5">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">معلومات الصيدلية</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">اسم الصيدلية *</label>
                    <input
                      required value={form.pharmacy_name}
                      onChange={(e) => setForm({ ...form, pharmacy_name: e.target.value })}
                      placeholder="مثال: صيدلية الأمل"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">اسم المستخدم (للصيدلية) *</label>
                    <input
                      required value={form.pharmacy_username}
                      onChange={(e) => setForm({ ...form, pharmacy_username: e.target.value.toLowerCase().replace(/\s/g, "") })}
                      placeholder="مثال: amal_pharmacy"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20"
                      style={{ direction: "ltr" }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">رقم الهاتف</label>
                      <input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="01XXXXXXXXX"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">الخطة</label>
                      <select
                        value={form.plan}
                        onChange={(e) => setForm({ ...form, plan: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20"
                      >
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">العنوان</label>
                    <input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="العنوان التفصيلي"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">حساب مدير الصيدلية</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">الاسم الكامل *</label>
                      <input
                        required value={form.admin_full_name}
                        onChange={(e) => setForm({ ...form, admin_full_name: e.target.value })}
                        placeholder="اسم المدير"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">اسم المستخدم *</label>
                      <input
                        required value={form.admin_username}
                        onChange={(e) => setForm({ ...form, admin_username: e.target.value.toLowerCase().replace(/\s/g, "") })}
                        placeholder="username"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20"
                        style={{ direction: "ltr" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">كلمة المرور *</label>
                    <div className="relative">
                      <input
                        required value={form.admin_password}
                        onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                        type={showPw ? "text" : "password"}
                        placeholder="كلمة مرور قوية"
                        minLength={8}
                        className="w-full px-4 py-3 pl-12 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20"
                        style={{ direction: "ltr" }}
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {createError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-600 text-sm">
                  {createError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setForm(emptyForm); setCreateError(null); }}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-[#002B5B] text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-[#003d82] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  إنشاء الصيدلية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}
