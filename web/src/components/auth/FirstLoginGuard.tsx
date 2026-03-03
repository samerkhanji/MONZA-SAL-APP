"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/contexts/UserContext";

export function FirstLoginGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile) return;
    if (!profile.must_change_password) return;
    if (pathname === "/change-password") return;
    router.replace("/change-password");
  }, [loading, profile, pathname, router]);

  return <>{children}</>;
}

