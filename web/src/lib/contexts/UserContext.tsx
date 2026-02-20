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
  capabilities: UserCapability[];
  is_active: boolean;
}

export interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  connectionError: boolean;
  retryConnection: () => void;
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
  canSeeDashboard: boolean;
  canSeeCars: boolean;
  canSeeDocuments: boolean;
  canSeePartsInventory: boolean;
  canSeeGarageJobs: boolean;
  canSeeGarageHistory: boolean;
}

const UserContext = createContext<UserContextType>({
  profile: null,
  loading: true,
  connectionError: false,
  retryConnection: () => {},
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
  canSeeDashboard: false,
  canSeeCars: false,
  canSeeDocuments: false,
  canSeePartsInventory: false,
  canSeeGarageJobs: false,
  canSeeGarageHistory: false,
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

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        const path = typeof window !== "undefined" ? window.location.pathname : "";
        const isLoginPage = path === "/login" || path === "/";
        if (!isLoginPage) {
          window.location.href = "/login";
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const role = profile?.role;
  const capabilities = profile?.capabilities ?? [];
  const nameLower = (profile?.full_name ?? "").toLowerCase();
  const isRequestAssistant =
    nameLower.includes("lara") || nameLower.includes("samaya");
  const canEditInventory = role === "owner" || role === "sales";
  const canDelete = role === "owner";
  const canSeeSettings = role === "owner";
  const canSeeProfileSettings = !!profile;
  const canSeeMyRequests = !!profile;
  const canSeeAllRequests = role === "owner" || isRequestAssistant;
  const canUploadDocuments =
    role === "owner" ||
    role === "sales" ||
    role === "garage_manager" ||
    capabilities.includes("garage");
  const canManageParts =
    role === "owner" ||
    role === "garage_manager" ||
    capabilities.includes("garage");
  const canManageGarage =
    role === "owner" ||
    role === "garage_manager" ||
    capabilities.includes("garage");

  const isRequestManagement = role === "owner";
  const isSamer = nameLower.includes("samer");
  const isKareem = nameLower.includes("kareem");
  const isHoussam = nameLower.includes("houssam");
  const isMark = nameLower.includes("mark");
  const isKhalil = nameLower.includes("khalil");
  const isOwner = role === "owner";

  const canSeeDashboard = isOwner || role === "assistant" || isRequestAssistant;
  const canSeeCars =
    isRequestAssistant || isKhalil || isOwner;
  const canSeeDocuments = true;
  const canSeePartsInventory =
    isMark || isRequestAssistant || isKhalil || isOwner;
  const canSeeGarageJobs = isMark || isRequestAssistant || isOwner;
  const canSeeGarageHistory = isRequestAssistant || isOwner;

  return (
    <UserContext.Provider
      value={{
        profile,
        loading,
        connectionError,
        retryConnection,
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
        canSeeDashboard,
        canSeeCars,
        canSeeDocuments,
        canSeePartsInventory,
        canSeeGarageJobs,
        canSeeGarageHistory,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
