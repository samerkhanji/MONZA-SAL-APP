"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase";

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
  canEditInventory: boolean;
  canDelete: boolean;
  canSeeSettings: boolean;
  canUploadDocuments: boolean;
  canManageParts: boolean;
  canManageGarage: boolean;
  noProfile: boolean;
}

const UserContext = createContext<UserContextType>({
  profile: null,
  loading: true,
  canEditInventory: false,
  canDelete: false,
  canSeeSettings: false,
  canUploadDocuments: false,
  canManageParts: false,
  canManageGarage: false,
  noProfile: false,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);

  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProfile(null);
      setNoProfile(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      setProfile(null);
      setNoProfile(true);
    } else {
      setProfile(data as UserProfile);
      setNoProfile(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const role = profile?.role;
  const capabilities = profile?.capabilities ?? [];
  const canEditInventory = role === "owner" || role === "sales";
  const canDelete = role === "owner";
  const canSeeSettings = role === "owner";
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

  return (
    <UserContext.Provider
      value={{
        profile,
        loading,
        canEditInventory,
        canDelete,
        canSeeSettings,
        canUploadDocuments,
        canManageParts,
        canManageGarage,
        noProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
