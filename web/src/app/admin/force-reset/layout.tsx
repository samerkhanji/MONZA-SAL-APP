import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUserAndRole } from "@/lib/server/session-app-role";

export const metadata: Metadata = {
  title: "Admin — Force password reset",
  robots: { index: false, follow: false },
};

/**
 * Server-side gate: only a signed-in owner may reach this page. The
 * /api/admin/force-reset-password route enforces the same check
 * independently — this layer keeps non-owners from ever seeing the form.
 */
export default async function AdminForceResetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUserAndRole();
  if (!session) redirect("/login");
  if (session.appRole !== "owner") redirect("/");
  return children;
}
