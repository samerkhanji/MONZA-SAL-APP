import { NextRequest, NextResponse } from "next/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { APP_CAPABILITIES } from "@/lib/permissions";
import { toPublicApiError } from "@/lib/server/api-error";
import type { Database } from "@/lib/supabase/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];
type ProfileUpsert = Database["public"]["Tables"]["profiles"]["Insert"];

export async function POST(request: NextRequest) {
  const adminClient = tryCreateAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const serverClient = await createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await serverClient
    .from("profiles")
    .select("user_role")
    .eq("id", user.id)
    .single();

  if (profile?.user_role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can add employees" },
      { status: 403 }
    );
  }

  // Roles that can be assigned via this endpoint; owner accounts require manual Supabase promotion.
  const ASSIGNABLE_ROLES = new Set<UserRole>([
    "assistant",
    "sales_ops",
    "garage_manager",
    "garage_staff",
    "hybrid",
    "it",
  ]);

  const isAssignableRole = (s: string): s is UserRole =>
    (ASSIGNABLE_ROLES as Set<string>).has(s);

  // Allowlist of capability strings the UI may toggle, derived from the
  // canonical AppCapability enum (mirrors public.user_capability DB enum).
  const ALLOWED_CAPABILITIES = new Set<string>(APP_CAPABILITIES);

  const ALLOWED_EMPLOYMENT_STATUSES = new Set([
    "active",
    "inactive",
    "suspended",
    "terminated",
    "on_leave",
  ]);

  try {
    const body = await request.json();
    const {
      email,
      full_name,
      phone,
      job_title,
      department,
      user_role: rawRole,
      capabilities: rawCapabilities,
      is_active = true,
      employment_status: rawEmploymentStatus,
    } = body;

    if (!email || !full_name) {
      return NextResponse.json(
        { error: "Email and full name are required" },
        { status: 400 }
      );
    }

    // Reject unknown / privilege-escalating roles outright (M2 — was silent
    // downgrade-to-assistant, which masked client bugs and made auditing harder).
    if (typeof rawRole !== "string" || !isAssignableRole(rawRole)) {
      return NextResponse.json(
        {
          error: `user_role must be one of: ${[...ASSIGNABLE_ROLES].join(", ")}. Owner accounts must be promoted manually.`,
        },
        { status: 400 }
      );
    }
    const user_role: UserRole = rawRole;

    // Sanitize capabilities: strip anything not in the allowlist.
    const capabilities: string[] = Array.isArray(rawCapabilities)
      ? rawCapabilities
          .filter((c): c is string => typeof c === "string" && ALLOWED_CAPABILITIES.has(c))
      : [];

    const employment_status = ALLOWED_EMPLOYMENT_STATUSES.has(rawEmploymentStatus)
      ? rawEmploymentStatus
      : "active";

    const is_active_bool = typeof is_active === "boolean" ? is_active : true;

    const tempPassword = crypto.randomUUID() + "A1!";

    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone: phone || null,
        job_title: job_title || null,
        department: department || null,
        user_role,
        is_active: is_active_bool,
        employment_status,
      },
    });

    if (authError) {
      // H3: do NOT log Supabase auth error details to console — they leak
      // user-enumeration signal (status 422 vs 400 etc.) into shared logs.
      // Surface a generic message so an "email already registered" failure is
      // indistinguishable from any other creation failure.
      return NextResponse.json(
        { error: "Unable to create employee with the provided details." },
        { status: 400 }
      );
    }

    const profileData: ProfileUpsert = {
      id: authUser.user.id,
      full_name,
      email,
      phone: phone || null,
      job_title: job_title || null,
      department: department || null,
      user_role,
      capabilities: capabilities as ProfileUpsert["capabilities"],
      is_active: is_active_bool,
      employment_status,
      created_by: user.id,
    };

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (profileError) {
      return NextResponse.json(
        { error: toPublicApiError(profileError) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id: authUser.user.id,
      email,
      message:
        "Employee created. Ask them to use 'Forgot password' on the login page to set their own password.",
    });
  } catch (err) {
    console.error("Add employee error:", err);
    return NextResponse.json(
      { error: "Failed to add employee" },
      { status: 500 }
    );
  }
}
