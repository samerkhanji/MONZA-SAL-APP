"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase";
import { handleSessionExpiredError, isConnectionError } from "@/lib/auth-utils";
import type { AppRole } from "@/lib/permissions";
import {
  canEditDmsWarrantyOnCar,
  canEditMonzaWarrantyOnCar,
  canEditPdiStatusOnCar,
  canOpenCarEditDialog,
} from "@/lib/car-field-permissions";

export type UserRole =
  | "owner"
  | "sales"
  | "garage_manager"
  | "assistant";

export type UserCapability =
  | "garage"
  | "vehicle_software"
  | "cashier"
  | "events_ops";

export interface UserProfile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  user_role?: AppRole | null;
  capabilities: UserCapability[];
  is_active: boolean;
  employment_status?: string | null;
  must_change_password?: boolean;
  onboarding_completed?: boolean;
  onboarding_completed_at?: string | null;
  preferred_language?: string | null;
  last_active_at?: string | null;
}

export interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  connectionError: boolean;
  retryConnection: () => void;
  refreshProfile: () => Promise<void>;
  canEditInventory: boolean;
  canDelete: boolean;
  canSeeSettings: boolean;
  canSeeProfileSettings: boolean;
  canSeeMyRequests: boolean;
  canSeeAllRequests: boolean;
  canUploadDocuments: boolean;
  canManageParts: boolean;
  canManageGarage: boolean;
  noProfile: boolean;
  isRequestAssistant: boolean;
  isRequestManagement: boolean;
  isSamer: boolean;
  isKareem: boolean;
  isHoussam: boolean;
  isMark: boolean;
  isKhalil: boolean;
  isOwner: boolean;
  appRole: AppRole | null;
  canSeeDashboard: boolean;
  canSeeCars: boolean;
  canSeeDocuments: boolean;
  canSeePartsInventory: boolean;
  canSeeGarageJobs: boolean;
  canSeeGarageHistory: boolean;
  /** Phase 3.2 — Monza vehicle/battery warranty fields on cars */
  canEditMonzaWarrantyOnCar: boolean;
  /** Phase 3.2 — DMS warranty fields on cars */
  canEditDmsWarrantyOnCar: boolean;
  /** Phase 3.3 — pdi_status on cars */
  canEditPdiStatusOnCar: boolean;
  /** Open Edit car dialog (full or partial save) */
  canOpenCarEditDialog: boolean;
}

const UserContext = createContext<UserContextType>({
  profile: null,
  loading: true,
  connectionError: false,
  retryConnection: () => {},
  refreshProfile: async () => {},
  canEditInventory: false,
  canDelete: false,
  canSeeSettings: false,
  canSeeProfileSettings: false,
  canSeeMyRequests: false,
  canSeeAllRequests: false,
  canUploadDocuments: false,
  canManageParts: false,
  canManageGarage: false,
  noProfile: false,
  isRequestAssistant: false,
  isRequestManagement: false,
  isSamer: false,
  isKareem: false,
  isHoussam: false,
  isMark: false,
  isKhalil: false,
  isOwner: false,
  appRole: null,
  canSeeDashboard: false,
  canSeeCars: false,
  canSeeDocuments: false,
  canSeePartsInventory: false,
  canSeeGarageJobs: false,
  canSeeGarageHistory: false,
  canEditMonzaWarrantyOnCar: false,
  canEditDmsWarrantyOnCar: false,
  canEditPdiStatusOnCar: false,
  canOpenCarEditDialog: false,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  const loadProfile = useCallback(async () => {
    setConnectionError(false);
    const supabase = createClient();
    let user: { id: string } | null = null;
    let authError: unknown = null;

    try {
      const result = await supabase.auth.getUser();
      user = result.data?.user ?? null;
      authError = result.error;
    } catch (err) {
      authError = err;
    }

    if (authError) {
      const handled = await handleSessionExpiredError(authError);
      if (handled) return;
      if (isConnectionError(authError)) {
        setConnectionError(true);
        setProfile(null);
        setNoProfile(false);
        setLoading(false);
        return;
      }
    }

    if (!user) {
      setProfile(null);
      setNoProfile(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError && isConnectionError(profileError)) {
        setConnectionError(true);
        setProfile(null);
        setNoProfile(false);
      } else if (profileError || !data) {
        setProfile(null);
        setNoProfile(true);
      } else {
        setProfile(data as UserProfile);
        setNoProfile(false);
      }
    } catch (err) {
      if (isConnectionError(err)) {
        setConnectionError(true);
        setProfile(null);
        setNoProfile(false);
      } else {
        setProfile(null);
        setNoProfile(true);
      }
    }
    setLoading(false);
  }, []);

  const retryConnection = useCallback(() => {
    setLoading(true);
    loadProfile();
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const lang = (profile?.preferred_language ?? "en").trim() || "en";
    document.documentElement.lang = lang;
  }, [profile?.preferred_language]);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        const path = typeof window !== "undefined" ? window.location.pathname : "";
        const isLoginPage = path === "/login" || path === "/";
        const isAuthEmailFlow =
          path === "/auth/callback" ||
          path.startsWith("/auth/callback/") ||
          path === "/auth/confirm" ||
          path.startsWith("/auth/confirm/") ||
          path === "/reset-password" ||
          path.startsWith("/reset-password/");
        if (!isLoginPage && !isAuthEmailFlow) {
          window.location.href = "/login";
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const role = profile?.role;
  const capabilities = profile?.capabilities ?? [];
  const appRole: AppRole | null =
    profile?.user_role ??
    (role === "sales"
      ? "sales_ops"
      : role === "garage_manager"
        ? "garage_manager"
        : role === "assistant"
          ? "assistant"
          : role === "owner"
            ? "owner"
            : null);

  const isRequestAssistant = appRole === "assistant";
  const canEditInventory = appRole === "owner" || appRole === "sales_ops";
  const canDelete = appRole === "owner";
  const canSeeSettings = appRole === "owner";
  const canSeeProfileSettings = !!profile;
  const canSeeMyRequests = !!profile;
  const canSeeAllRequests = appRole === "owner" || isRequestAssistant;
  const canUploadDocuments =
    appRole === "owner" ||
    appRole === "sales_ops" ||
    appRole === "garage_manager" ||
    capabilities.includes("garage");
  const canManageParts =
    appRole === "owner" ||
    appRole === "garage_manager" ||
    capabilities.includes("garage");
  const canManageGarage =
    appRole === "owner" ||
    appRole === "garage_manager" ||
    capabilities.includes("garage");

  const isRequestManagement = appRole === "owner";
  const isSamer = false;
  const isKareem = false;
  const isHoussam = false;
  const isMark = appRole === "garage_manager";
  const isKhalil = appRole === "khalil_hybrid";
  const isOwner = appRole === "owner";

  const canSeeDashboard = appRole === "owner";
  const canSeeCars =
    appRole === "owner" ||
    appRole === "assistant" ||
    appRole === "khalil_hybrid" ||
    appRole === "it" ||
    appRole === "sales_ops";
  const canSeeDocuments =
    appRole === "owner" ||
    appRole === "assistant" ||
    appRole === "khalil_hybrid" ||
    appRole === "it" ||
    appRole === "garage_manager" ||
    appRole === "sales_ops";
  const canSeePartsInventory =
    appRole === "owner" ||
    appRole === "assistant" ||
    appRole === "khalil_hybrid" ||
    appRole === "it" ||
    appRole === "garage_manager" ||
    appRole === "garage_staff";
  const canSeeGarageJobs =
    appRole === "owner" ||
    appRole === "assistant" ||
    appRole === "garage_manager" ||
    appRole === "garage_staff";
  const canSeeGarageHistory =
    appRole === "owner" ||
    appRole === "assistant" ||
    appRole === "garage_manager" ||
    appRole === "sales_ops";

  const canEditMonzaWarrantyOnCarFlag = canEditMonzaWarrantyOnCar(
    appRole,
    profile?.full_name
  );
  const canEditDmsWarrantyOnCarFlag = canEditDmsWarrantyOnCar(appRole);
  const canEditPdiStatusOnCarFlag = canEditPdiStatusOnCar(appRole);
  const canOpenCarEditDialogFlag = canOpenCarEditDialog(
    appRole,
    profile?.full_name
  );

  return (
    <UserContext.Provider
      value={{
        profile,
        loading,
        connectionError,
        retryConnection,
        refreshProfile,
        canEditInventory,
        canDelete,
        canSeeSettings,
        canSeeProfileSettings,
        canSeeMyRequests,
        canSeeAllRequests,
        canUploadDocuments,
        canManageParts,
        canManageGarage,
        noProfile,
        isRequestAssistant,
        isRequestManagement,
        isSamer,
        isKareem,
        isHoussam,
        isMark,
        isKhalil,
        isOwner,
        appRole,
        canSeeDashboard,
        canSeeCars,
        canSeeDocuments,
        canSeePartsInventory,
        canSeeGarageJobs,
        canSeeGarageHistory,
        canEditMonzaWarrantyOnCar: canEditMonzaWarrantyOnCarFlag,
        canEditDmsWarrantyOnCar: canEditDmsWarrantyOnCarFlag,
        canEditPdiStatusOnCar: canEditPdiStatusOnCarFlag,
        canOpenCarEditDialog: canOpenCarEditDialogFlag,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
