import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Force password reset",
  robots: { index: false, follow: false },
};

export default function AdminForceResetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
