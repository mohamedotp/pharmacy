"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, PlusSquare, Loader2, Shield, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError, user } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace(user.is_super_admin ? "/admin" : "/dashboard");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const ok = await login(username.trim(), password);
    if (ok) {
      const currentUser = useAuthStore.getState().user;
      router.replace(currentUser?.is_super_admin ? "/admin" : "/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#001428] via-[#002B5B] to-[#0a4a8a] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full -translate-y-48 translate-x-24 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-400/10 rounded-full translate-y-40 -translate-x-20 blur-3xl" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
              <PlusSquare size={26} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-black text-2xl tracking-tight">PharmacyOS</h1>
              <p className="text-blue-300 text-xs font-medium">نظام إدارة الصيدليات السحابي</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-white font-black text-4xl leading-tight mb-4">
              إدارة صيدليتك
              <br />
              <span className="text-cyan-300">بكفاءة عالية</span>
            </h2>
            <p className="text-blue-200/80 text-base leading-relaxed max-w-md">
              منصة SaaS متكاملة تتيح لك إدارة المخزون، المبيعات، الوصفات، والتقارير من مكان واحد
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {[
              "إدارة المخزون والأدوية بشكل ذكي",
              "نقطة بيع متطورة مع إدارة الوردية",
              "تقارير مالية تفصيلية فورية",
              "قاعدة بيانات الدواء الشاملة Drug Eye",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-cyan-400/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                </div>
                <span className="text-blue-100 text-sm font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-blue-400/60 text-xs">
            © 2026 PharmacyOS · جميع الحقوق محفوظة
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 bg-[#002B5B] rounded-xl flex items-center justify-center">
              <PlusSquare size={20} className="text-white" />
            </div>
            <h1 className="text-[#002B5B] font-black text-xl">PharmacyOS</h1>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-900 mb-2">تسجيل الدخول</h2>
            <p className="text-slate-500 text-sm">أدخل اسم المستخدم وكلمة المرور للمتابعة</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700">
                اسم المستخدم
              </label>
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                autoComplete="username"
                required
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20 focus:border-[#002B5B] transition-all"
                style={{ direction: "ltr", textAlign: "left" }}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3.5 pl-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20 focus:border-[#002B5B] transition-all"
                  style={{ direction: "ltr", textAlign: "left" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <AlertCircle size={18} className="text-rose-500 flex-shrink-0" />
                <p className="text-rose-600 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full bg-[#002B5B] hover:bg-[#003d82] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-blue-900/20 text-base mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  جاري التحقق...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </button>
          </form>

          {/* Security note */}
          <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
            <Shield size={14} />
            <p className="text-xs">اتصال آمن ومشفر · بيانات معزولة لكل صيدلية</p>
          </div>
        </div>
      </div>
    </div>
  );
}
