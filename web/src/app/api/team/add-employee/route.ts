import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
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
  const ASSIGNABLE_ROLES = new Set([
    "assistant",
    "sales_ops",
    "garage_manager",
    "garage_staff",
    "khalil_hybrid",
    "it",
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
      capabilities,
      is_active = true,
      employment_status = "active",
    } = body;

    if (!email || !full_name) {
      return NextResponse.json(
        { error: "Email and full name are required" },
        { status: 400 }
      );
    }

    // Clamp to allowed roles; silently default to assistant if unknown/owner supplied.
    const user_role: string = ASSIGNABLE_ROLES.has(rawRole) ? rawRole : "assistant";

    const tempPassword = crypto.randomUUID() + "A1!";

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone: phone || null,
        job_title: job_title || null,
        department: department || null,
        role: user_role ? "assistant" : "assistant",
        user_role: user_role || "assistant",
        capabilities: Array.isArray(capabilities) ? capabilities : [],
        is_active,
        employment_status: employment_status || "active",
      },
    });

    if (authError) {
      console.error("[add-employee] auth.admin.createUser failed:", {
        message: authError.message,
        code: (authError as { code?: string }).code,
        status: (authError as { status?: number }).status,
      });
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const roleMap: Record<string, string> = {
      owner: "owner",
      assistant: "assistant",
      sales_ops: "sales",
      garage_manager: "garage_manager",
      garage_staff: "garage_manager",
      khalil_hybrid: "assistant",
      it: "assistant",
    };
    const profileData = {
      id: authUser.user.id,
      full_name,
      email,
      phone: phone || null,
      role: roleMap[user_role || "assistant"] ?? "assistant",
      job_title: job_title || null,
      department: department || null,
      user_role: user_role || "assistant",
      capabilities: Array.isArray(capabilities) ? capabilities : [],
      is_active,
      employment_status: employment_status || "active",
      created_by: user.id,
    };

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (profileError) {
      console.error("[add-employee] profiles upsert failed:", profileError.message);
      return NextResponse.json(
        { error: profileError.message },
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
