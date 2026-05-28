"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAuthenticated, getCurrentUserFromToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { OnboardingStatusResponse, UserRole } from "@/types";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }

    // Verificar onboarding (exceto para superAdmin e pagina de onboarding)
    const user = getCurrentUserFromToken();
    const isOnboardingPage = pathname?.startsWith("/onboarding");

    if (user && user.role !== UserRole.SUPER_ADMIN && !isOnboardingPage) {
      const cached = sessionStorage.getItem("onboarding_status");
      if (cached === "completed") {
        setChecked(true);
        return;
      }

      api.get<OnboardingStatusResponse>("/onboarding/status/")
        .then((status) => {
          if (status.onboarding_status === "completed") {
            sessionStorage.setItem("onboarding_status", "completed");
            setChecked(true);
          } else {
            router.push("/onboarding");
          }
        })
        .catch(() => {
          setChecked(true);
        });
    } else {
      setChecked(true);
    }
  }, [router, pathname]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg-subtle">
        <div className="spinner-emotioncare" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return <>{children}</>;
}
