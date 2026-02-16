"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Car,
  FileText,
  Users,
  Wrench,
  Settings,
  Menu,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { USER_ROLE_LABELS } from "@/lib/constants/user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const BASE_NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  ownerOnly?: boolean;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cars", label: "Inventory", icon: Car },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/garage", label: "Garage", icon: Wrench },
  { href: "/settings", label: "Settings", icon: Settings, ownerOnly: true },
];

function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/cars/add")) return "Add Car";
  if (pathname.startsWith("/cars/") && pathname !== "/cars") return "Car Details";
  if (pathname.startsWith("/cars")) return "Car Inventory";
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/customers")) return "Customers";
  if (pathname.startsWith("/garage")) return "Garage";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Monza CRM";
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, loading, canSeeSettings, noProfile } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = BASE_NAV_ITEMS.filter(
    (item) => !item.ownerOnly || canSeeSettings
  );

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const displayName = profile?.full_name ?? "User";
  const displayRole = profile?.role
    ? USER_ROLE_LABELS[profile.role]
    : "Signed in";
  const avatarInitial = (profile?.full_name?.[0] ?? "U").toUpperCase();

  const SidebarContent = () => (
    <div className="flex h-full w-56 flex-col border-r bg-muted/30">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">Monza</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <p className="truncate text-sm font-medium">{displayName}</p>
        <p className="text-xs text-muted-foreground">{displayRole}</p>
      </div>
    </div>
  );

  if (noProfile && !loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-xl font-semibold">Profile not found</h1>
        <p className="max-w-md text-center text-muted-foreground">
          Your account exists but no profile has been set up yet. Please contact
          your administrator to get access.
        </p>
        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r bg-muted/30 md:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-4 md:hidden"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-56 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background pl-14 pr-4 md:pl-6 md:pr-6">
          <h1 className="text-lg font-semibold">
            {getPageTitle(pathname)}
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                  {avatarInitial}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleSignOut}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Main content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
