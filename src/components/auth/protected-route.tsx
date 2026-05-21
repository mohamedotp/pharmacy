"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children, requireSuperAdmin = false }: { children: React.ReactNode, requireSuperAdmin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, fetchProfile, isLoading } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // If user is missing from state, try fetching from session
      if (!user) {
        await fetchProfile();
      }
      setChecking(false);
    };
    checkAuth();
  }, [user, fetchProfile]);

  useEffect(() => {
    if (!checking) {
      if (!useAuthStore.getState().user) {
        router.replace("/login");
      } else if (requireSuperAdmin && !useAuthStore.getState().user?.is_super_admin) {
        router.replace("/dashboard");
      }
    }
  }, [checking, router, requireSuperAdmin, pathname]);

  if (checking || isLoading || (!user && !checking)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={40} className="animate-spin text-[#002B5B]" />
      </div>
    );
  }

  return <>{children}</>;
}
