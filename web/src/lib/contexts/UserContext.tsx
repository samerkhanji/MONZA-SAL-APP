"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase";
import { handleSessionExpiredError, isConnectionError } from "@/lib/auth-utils";
import type { AppRole, AppCapability } from "@/lib/permissions";
import {
  hasCapability as hasCapabilityFn,
  hasAnyCapability as hasAnyCapabilityFn,
} from "@/lib/permissions";
import {
  canEditDmsWarrantyOnCar,
  canEditMonzaWarrantyOnCar,
  canEditPdiStatusOnCar,
  canOpenCarEditDialog,
} from "@/lib/car-field-permissions";

export type UserRole =
  | "owner"
  | "hybrid"
  | "khalil_hybrid"
  | "sales"
  | "sales_ops"
  | "garage_manager"
  | "garage_staff"
  | "assistant"
  | "it";

/**
 * Re-export from @/lib/permissions for components still importing the
 * old name. Source of truth lives in permissions.ts.
 */
export type UserCapability = AppCapability;

export interface UserProfile {
  id: string;
  full_name: string;
  phone: string | null;
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
  /** Phase 3 — capability checks. Bound to current profile's capabilities. */
  hasCapability: (cap: AppCapability) => boolean;
  hasAnyCapability: (caps: AppCapability[]) => boolean;
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
  isHybrid: boolean;
  canAssistantDashboard: boolean;
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
  hasCapability: () => false,
  hasAnyCapability: () => false,
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
  isHybrid: false,
  canAssistantDashboard: false,
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
      } else if (event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        // Password / email / metadata change → pull fresh profile
        // so FirstLoginGuard etc. don't act on a stale must_change_password flag.
        void loadProfile();
      }
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const capabilities = profile?.capabilities ?? [];
  const appRole: AppRole | null = profile?.user_role ?? null;

  const isRequestAssistant = appRole === "assistant";
  const canEditInventory =
    appRole === "owner" ||
    appRole === "sales_ops" ||
    appRole === "sales";
  const canDelete = appRole === "owner";
  const canSeeSettings = appRole === "owner";
  const canSeeProfileSettings = !!profile;
  const canSeeMyRequests = !!profile;
  const canSeeAllRequests = appRole === "owner" || isRequestAssistant;
  const canUploadDocuments =
    appRole === "owner" ||
    appRole === "sales_ops" ||
    appRole === "sales" ||
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
  // Identifies Houssam (a specific approver). We avoid hard-coding a profile
  // ID at build time -- prefer matching by full_name, with optional override
  // via NEXT_PUBLIC_HOUSSAM_PROFILE_ID for environments where the display name
  // changes. Returns false when neither identifier matches so the gated UI
  // simply does not render.
  const houssamProfileIdEnv =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_HOUSSAM_PROFILE_ID
      : undefined;
  const isHoussam =
    (!!houssamProfileIdEnv && profile?.id === houssamProfileIdEnv) ||
    profile?.full_name === "Houssam";
  const isMark = appRole === "garage_manager";
  const isKhalil = appRole === "hybrid" || appRole === "khalil_hybrid";
  const isOwner = appRole === "owner";
  const isHybrid = appRole === "hybrid" || appRole === "khalil_hybrid";
  const canAssistantDashboard = isRequestAssistant || isOwner || isHybrid;

  const canSeeDashboard = appRole === "owner";
  const canSeeCars =
    appRole === "owner" ||
    appRole === "assistant" ||
    appRole === "hybrid" ||
    appRole === "khalil_hybrid" ||
    appRole === "it" ||
    appRole === "sales_ops" ||
    appRole === "sales";
  const canSeeDocuments =
    appRole === "owner" ||
    appRole === "assistant" ||
    appRole === "hybrid" ||
    appRole === "khalil_hybrid" ||
    appRole === "it" ||
    appRole === "garage_manager" ||
    appRole === "sales_ops" ||
    appRole === "sales";
  const canSeePartsInventory =
    appRole === "owner" ||
    appRole === "assistant" ||
    appRole === "hybrid" ||
    appRole === "khalil_hybrid" ||
    appRole === "it" ||
    appRole === "garage_manager" ||
    appRole === "garage_staff";
  const canSeeGarageJobs =
    appRole === "owner" ||
    appRole === "assistant" ||
    appRole === "hybrid" ||
    appRole === "khalil_hybrid" ||
    appRole === "garage_manager" ||
    appRole === "garage_staff";
  const canSeeGarageHistory =
    appRole === "owner" ||
    appRole === "assistant" ||
    appRole === "hybrid" ||
    appRole === "khalil_hybrid" ||
    appRole === "garage_manager" ||
    appRole === "sales_ops" ||
    appRole === "sales";

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

  // Capability-checking helpers bound to the current profile.
  // Phase 3 callers can use `useUser().hasCapability("garage")` instead of
  // hard-coding role lists, gradually replacing role-based gating.
  const hasCapability = useCallback(
    (cap: AppCapability) => hasCapabilityFn(profile, cap),
    [profile]
  );
  const hasAnyCapability = useCallback(
    (caps: AppCapability[]) => hasAnyCapabilityFn(profile, caps),
    [profile]
  );

  // Memoize the provider value so the ~70 consumers of useUser() only
  // re-render when an underlying piece of state actually changes. Without
  // useMemo, every auth event (e.g. TOKEN_REFRESHED) re-renders UserProvider
  // and forces every consumer to re-render even though their slice is
  // unchanged.
  const value = useMemo<UserContextType>(
    () => ({
      profile,
      loading,
      connectionError,
      retryConnection,
      refreshProfile,
      hasCapability,
      hasAnyCapability,
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
      isHybrid,
      canAssistantDashboard,
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
    }),
    [
      profile,
      loading,
      connectionError,
      retryConnection,
      refreshProfile,
      hasCapability,
      hasAnyCapability,
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
      isHybrid,
      canAssistantDashboard,
      appRole,
      canSeeDashboard,
      canSeeCars,
      canSeeDocuments,
      canSeePartsInventory,
      canSeeGarageJobs,
      canSeeGarageHistory,
      canEditMonzaWarrantyOnCarFlag,
      canEditDmsWarrantyOnCarFlag,
      canEditPdiStatusOnCarFlag,
      canOpenCarEditDialogFlag,
    ]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
