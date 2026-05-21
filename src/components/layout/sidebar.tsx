"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileText,
  Users,
  Settings,
  LogOut,
  PlusSquare,
  ClipboardList,
  Eye,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

const menuItems = [
  { name: "لوحة التحكم", icon: LayoutDashboard, href: "/dashboard" },
  { name: "نقطة البيع", icon: ShoppingCart, href: "/dashboard/pos" },
  { name: "الوصفات الطبية", icon: ClipboardList, href: "/dashboard/prescriptions" },
  { name: "المخزون", icon: Package, href: "/dashboard/inventory" },
  { name: "المرضى", icon: Users, href: "/dashboard/patients" },
  { name: "التقارير", icon: FileText, href: "/dashboard/reports" },
  { name: "Drug Eye", icon: Eye, href: "/dashboard/drug-eye" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, pharmacy, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const pharmacyName = pharmacy?.name ?? user?.pharmacy?.name ?? "صيدلية الشفاء";
  const pharmacyInitial = pharmacyName.charAt(0);

  return (
    <aside className="w-64 bg-white border-l border-slate-200 flex flex-col h-full hidden md:flex sticky top-0">
      <div className="p-6 flex flex-col items-center border-b border-slate-50">
        <div className="w-16 h-16 bg-[#002B5B] rounded-2xl flex items-center justify-center text-white mb-3 shadow-xl shadow-blue-900/20">
          <span className="text-2xl font-black">{pharmacyInitial}</span>
        </div>
        <h1 className="text-lg font-black text-[#002B5B] tracking-tight text-center leading-tight">
          {pharmacyName}
        </h1>
        {/* <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
          نظام إدارة الصيدلية
        </p> */}
        {user && (
          <div className="mt-2 bg-slate-50 rounded-lg px-3 py-1.5 text-center">
            <p className="text-xs font-bold text-slate-600">{user.full_name}</p>
            {user.is_super_admin && (
              <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                Super Admin
              </span>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between group px-4 py-3.5 rounded-xl transition-all duration-300 ${isActive
                  ? 'bg-primary/5 text-primary border-r-4 border-primary shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
            >
              <div className="flex items-center gap-4">
                <item.icon size={22} className={isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'} />
                <span className={`font-bold text-sm ${isActive ? 'text-primary' : ''}`}>{item.name}</span>
              </div>
            </Link>
          );
        })}

        {/* Admin link for super admin */}
        {user?.is_super_admin && (
          <Link
            href="/admin"
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 mt-2 ${
              pathname === "/admin"
                ? "bg-purple-50 text-purple-700 border-r-4 border-purple-500"
                : "text-purple-500 hover:bg-purple-50"
            }`}
          >
            <Building2 size={22} />
            <span className="font-bold text-sm">إدارة الصيدليات</span>
          </Link>
        )}
      </nav>

      <div className="p-5 space-y-3">
        <Link href="/dashboard/purchases">
          <Button className="w-full bg-[#002B5B] hover:bg-[#003d82] text-white py-5 rounded-xl font-bold shadow-lg shadow-blue-900/10 text-sm">
            طلب توريد جديد
          </Button>
        </Link>

        <div className="pt-3 border-t border-slate-100 space-y-1">
          <Link href="/dashboard/settings" className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-slate-800 transition-colors font-bold text-xs">
            <Settings size={18} />
            <span>الإعدادات</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-rose-400 hover:text-rose-600 transition-colors font-bold text-xs"
          >
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
