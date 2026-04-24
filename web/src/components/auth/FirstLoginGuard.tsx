"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/contexts/UserContext";

/**
 * Redirects to /change-password when the current user's profile has
 * must_change_password = true. Uses strict equality (=== true) so an
 * undefined/null value (e.g. during initial profile load or after a
 * fresh password reset) does not trigger a redirect loop.
 *
 * The /change-password page itself lives outside (dashboard) so this
 * guard never fires there — the page handles its own bailout when
 * the flag is already cleared.
 */
export function FirstLoginGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile) return;
    // Only redirect on an explicit TRUE. Anything else (undefined, null,
    // false) means "don't bother the user".
    if (profile.must_change_password !== true) return;
    if (pathname === "/change-password") return;
    router.replace("/change-password");
  }, [loading, profile, pathname, router]);

  return <>{children}</>;
}
