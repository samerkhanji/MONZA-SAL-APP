"use client";

import { useState, useMemo } from "react";
import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Car,
  FileText,
  Users,
  UserPlus,
  Wrench,
  Package,
  History,
  Settings,
  Menu,
  Lock,
  Download,
  ClipboardList,
  RefreshCw,
  WifiOff,
  Bell,
  BarChart3,
  FileCheck,
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
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/NotificationBell";
import { useInstall } from "@/lib/contexts/InstallContext";
import { clearAuthSessionMarkers } from "@/lib/auth-session";
import { cn } from "@/lib/utils";

const BASE_NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  ownerOnly?: boolean;
  assistantDashboard?: boolean;
  children?: Array<{ href: string; label: string; icon: typeof Package }>;
}> = [
  { href: "/assistant-dashboard", label: "Assistant Dashboard", icon: BarChart3, assistantDashboard: true },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/requests",
    label: "Request Center",
    icon: ClipboardList,
    children: [
      { href: "/requests", label: "All Requests", icon: ClipboardList },
      { href: "/requests/pending", label: "Pending Requests", icon: FileCheck },
    ],
  },
  { href: "/cars", label: "Inventory", icon: Car },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  {
    href: "/garage",
    label: "Garage",
    icon: Wrench,
    children: [
      { href: "/garage", label: "Jobs", icon: Wrench },
      { href: "/garage/inventory", label: "Parts Inventory", icon: Package },
      { href: "/garage/history", label: "Garage History", icon: History },
    ],
  },
  { href: "/settings", label: "Settings", icon: Settings },
];

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/assistant-dashboard")) return "Assistant Dashboard";
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/cars/add")) return "Add Car";
  if (pathname.startsWith("/cars/") && pathname !== "/cars") return "Car Details";
  if (pathname.startsWith("/cars")) return "Car Inventory";
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/customers")) return "Customers";
  if (pathname.startsWith("/requests/pending")) return "Pending Requests";
  if (pathname.startsWith("/requests")) return "Request Center";
  if (pathname.startsWith("/garage/jobs/")) return "Job Details";
  if (pathname.startsWith("/garage/inventory")) return "Parts Inventory";
  if (pathname.startsWith("/garage/history")) return "Garage History";
  if (pathname.startsWith("/garage")) return "Garage";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Monza S.A.L.";
}


export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    profile,
    loading,
    noProfile,
    connectionError,
    retryConnection,
    canSeeDashboard,
    canSeeCars,
    canSeeDocuments,
    canSeePartsInventory,
    canSeeGarageJobs,
    canSeeSettings,
    isRequestAssistant,
    isOwner,
  } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const navItems = useMemo(() => BASE_NAV_ITEMS.filter((item) => {
    if (item.assistantDashboard) {
      return isRequestAssistant || isOwner;
    }
    if (item.href === "/dashboard") {
      if (!canSeeDashboard) return false;
      if (isRequestAssistant && !isOwner) return false;
      return true;
    }
    if (item.href === "/cars" && !canSeeCars) return false;
    if (item.href === "/documents" && !canSeeDocuments) return false;
    if (item.href === "/customers") return true;
    if (item.href === "/requests") return true;
    if (item.href === "/garage") return canSeeGarageJobs;
    if (item.children) {
      const visibleChildren = item.children.filter((child) => {
        if (child.href === "/garage/inventory") return canSeePartsInventory;
        if (child.href === "/garage/history") return canSeeGarageJobs;
        if (child.href === "/garage") return canSeeGarageJobs;
        if (child.href === "/requests/pending") return canSeeSettings;
        return true;
      });
      if (visibleChildren.length === 0) return false;
    }
    return true;
  }), [
    isRequestAssistant,
    isOwner,
    canSeeDashboard,
    canSeeCars,
    canSeeDocuments,
    canSeePartsInventory,
    canSeeGarageJobs,
    canSeeSettings,
  ]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuthSessionMarkers();
    window.location.href = "/";
  }

  const displayName = profile?.full_name ?? "User";
  const displayRole = profile?.role
    ? USER_ROLE_LABELS[profile.role]
    : "Signed in";
  const avatarInitial = (profile?.full_name?.[0] ?? "U").toUpperCase();

  const { showInstallOption, triggerInstall } = useInstall();

  const renderSidebarContent = () => (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="flex h-14 items-center border-b shrink-0 px-4 pt-safe md:justify-center md:px-0 md:group-hover:justify-start md:group-hover:px-4 lg:justify-start lg:px-4">
        <Link href="/dashboard" className="flex items-center justify-center md:justify-center lg:justify-start">
          <img
            src="/images/sidebar-logo-light.png"
            alt="Monza S.A.L."
            className="h-10 max-h-10 w-auto object-contain brightness-0 invert"
          />
        </Link>
      </div>
      <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto overflow-x-hidden p-2 lg:p-4">
        {navItems.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          if (hasChildren) {
            return (
              <div key={item.href} className="space-y-1">
                <Link
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:justify-center md:px-2 md:group-hover:justify-start md:group-hover:px-3 lg:justify-start lg:px-3",
                    pathname === item.href
                      ? "border-l-4 border-l-primary bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  title={undefined}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="md:hidden md:group-hover:inline lg:inline">{item.label}</span>
                </Link>
                <div className="ml-4 space-y-0.5 border-l border-border pl-3 md:hidden md:group-hover:block lg:block">
                  {item.children!.filter((child) => {
                    if (child.href === "/garage/inventory") return canSeePartsInventory;
                    if (child.href === "/garage/history") return canSeeGarageJobs;
                    if (child.href === "/garage") return canSeeGarageJobs;
                    if (child.href === "/requests/pending") return canSeeSettings;
                    return true;
                  }).map((child) => {
                    const isPendingRequestsTab =
                      child.href === "/requests/pending" && pathname.startsWith("/requests/pending");
                    const childActive =
                      isPendingRequestsTab ||
                      pathname === child.href ||
                      (child.href !== "/garage" && child.href !== "/requests" && pathname.startsWith(child.href.split("?")[0] + "/"));
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                          childActive
                            ? "font-medium border-l-2 border-l-primary bg-sidebar-accent/50 text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <child.icon className="size-3.5 shrink-0 opacity-70" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:justify-center md:px-2 md:group-hover:justify-start md:group-hover:px-3 lg:justify-start lg:px-3",
                    isActive
                      ? "border-l-4 border-l-primary bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
              title={item.label}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="md:hidden md:group-hover:inline lg:inline">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col border-t shrink-0 p-4 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:items-center md:p-2 md:group-hover:items-stretch md:group-hover:p-4 lg:items-stretch lg:p-4">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium md:flex md:group-hover:hidden lg:hidden">
          {avatarInitial}
        </div>
        <div className="md:hidden md:group-hover:block lg:block">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="text-xs text-muted-foreground">{displayRole}</p>
        </div>
      </div>
    </div>
  );

  if (connectionError && !loading) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <WifiOff className="size-16 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Connection failed</h1>
        <p className="max-w-md text-center text-muted-foreground">
          Unable to connect to the server. Please check your internet connection
          and try again.
        </p>
        <Button onClick={retryConnection}>
          <RefreshCw className="mr-2 size-4" />
          Retry
        </Button>
        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    );
  }

  if (noProfile && !loading) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
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
      {/* Tablet: collapsed icon-only, expand on hover (md) | Desktop: full sidebar (lg) */}
      <aside className="group hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:block md:w-16 md:hover:w-56 lg:w-56">
        {renderSidebarContent()}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex h-14 min-h-14 items-center gap-2 border-b border-border bg-background px-4 md:px-6">
          {/* Mobile: menu button top-left */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-ml-1 size-11 shrink-0 md:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 max-w-[85vw] max-h-[100dvh] border-sidebar-border bg-sidebar p-0 sm:max-w-sm">
              {renderSidebarContent()}
            </SheetContent>
          </Sheet>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
            {getPageTitle(pathname)}
          </h1>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                  {avatarInitial}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {showInstallOption && (
                <DropdownMenuItem onClick={() => triggerInstall()}>
                  <Download className="mr-2 size-4" />
                  Install App
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/settings?tab=notifications">
                  <Bell className="mr-2 size-4" />
                  Notification preferences
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                <Lock className="mr-2 size-4" />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 bg-background">{children}</main>
      </div>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  );
}
