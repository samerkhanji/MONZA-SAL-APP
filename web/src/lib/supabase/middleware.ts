import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicAsset =
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/images/");
  if (isPublicAsset) {
    return NextResponse.next({ request });
  }

  const response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Auth redirects disabled."
      );
    }
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Supabase] Auth getUser failed:", err);
    }
    user = null;
  }

  const isLoginPage = pathname === "/login";
  const isRootPage = pathname === "/";
  const isResetPasswordPage = pathname === "/reset-password";
  const isPublicPage = isLoginPage || isRootPage || isResetPasswordPage;

  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie.name, cookie.value)
    );
    return redirectResponse;
  }

  return response;
}
