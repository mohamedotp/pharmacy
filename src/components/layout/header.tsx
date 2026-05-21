"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Search, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QuickDispenseModal } from "@/components/pos/quick-dispense-modal";
import { useAuthStore } from "@/store/auth-store";
import { supabase } from "@/lib/supabase";

export function Header() {
  const [isQuickDispenseOpen, setIsQuickDispenseOpen] = useState(false);
  const { user, pharmacy, fetchProfile } = useAuthStore();
  const [alertCount, setAlertCount] = useState<number | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const pharmacyId = pharmacy?.id ?? user?.pharmacy?.id;
    if (!pharmacyId) return;

    const fetchAlertCount = async () => {
      // Low stock count
      const { data: products } = await supabase
        .from("products")
        .select("stock_quantity, min_stock_alert")
        .eq("pharmacy_id", pharmacyId);
      const lowStockCount = (products || []).filter(
        (p) => p.stock_quantity <= (p.min_stock_alert ?? 10)
      ).length;

      // Expiring batches count (within 30 days)
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);
      const { data: batches } = await supabase
        .from("product_batches")
        .select("id")
        .lte("expiry_date", in30Days.toISOString().split("T")[0])
        .gt("quantity", 0);

      setAlertCount(lowStockCount + (batches?.length ?? 0));
    };

    fetchAlertCount();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAlertCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [pharmacy, user]);

  const getRoleLabel = (roleName: string) => {
    const labels: Record<string, string> = {
      admin: "مدير الصيدلية",
      pharmacist: "صيدلي",
      cashier: "كاشير",
      delivery: "مندوب توصيل",
    };
    return labels[roleName] || roleName;
  };

  const getInitials = (name: string) => {
    if (!name) return "يو";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const displayName = user?.full_name || "مستخدم";
  const displayRole = user?.is_super_admin 
    ? "مدير النظام" 
    : user?.role?.name 
      ? getRoleLabel(user.role.name) 
      : "موظف";

  return (
    <>
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-30 sticky top-0">
        {/* Navigation Links (Right in RTL) */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-6 text-sm font-bold text-slate-400">
            <Link href="/dashboard" className="text-primary border-b-2 border-primary pb-5 pt-5 cursor-pointer">الرئيسية</Link>
            <Link href="/dashboard/urgent-requests" className="cursor-pointer hover:text-slate-800 transition-colors">الطلبات العاجلة</Link>
            <Link href="/dashboard/notifications" className="cursor-pointer hover:text-slate-800 transition-colors">التنبيهات</Link>
          </div>
        </div>

        {/* Search Bar (Middle) */}
        <div className="flex-1 max-w-xl mx-12">
          <div className="relative group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
            <Input 
              placeholder="بحث متقدم (F1)..." 
              className="w-full bg-slate-50/50 border-slate-200 pr-12 h-11 focus-visible:ring-primary/20 rounded-xl transition-all"
            />
          </div>
        </div>

        {/* Actions & User Profile (Left in RTL) */}
        <div className="flex items-center gap-6">
          <Button 
            onClick={() => setIsQuickDispenseOpen(true)}
            className="bg-[#002B5B] hover:bg-[#003d82] text-white px-6 h-10 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/10"
          >
            صرف سريع
          </Button>

          <div className="flex items-center gap-4 border-l border-slate-100 pl-6">
            <Link href="/dashboard/notifications" className="text-slate-400 hover:text-slate-600 transition-colors relative">
              <Bell size={22} />
              {alertCount !== null && alertCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] flex items-center justify-center rounded-full border-2 border-white font-black px-0.5">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </Link>
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <HelpCircle size={22} />
            </button>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 pr-2 pl-4 py-1.5 rounded-2xl border border-slate-100">
            <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
              {user?.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={displayName} className="object-cover" />
              ) : (
                <AvatarFallback className="bg-primary text-white text-xs">{getInitials(displayName)}</AvatarFallback>
              )}
            </Avatar>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-slate-800 leading-none">{displayName}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">{displayRole}</p>
            </div>
          </div>
        </div>
      </header>

      <QuickDispenseModal 
        isOpen={isQuickDispenseOpen} 
        onClose={() => setIsQuickDispenseOpen(false)} 
      />
    </>
  );
}

// Helper Button component for the header
function Button({ children, onClick, className }: any) {
  return (
    <button onClick={onClick} className={`inline-flex items-center justify-center whitespace-nowrap text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${className}`}>
      {children}
    </button>
  );
}

