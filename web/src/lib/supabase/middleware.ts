import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicKey, getSupabaseUrl } from "./public-env";

/**
 * Supabase session refresh + auth gate. Invoked from `src/proxy.ts` (Next.js 16+).
 * Uses getUser() so the server validates/refreshes the JWT and setAll can write cookies.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicAsset =
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/images/");
  if (isPublicAsset) {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  // Supabase often uses Site URL as redirect base, so PKCE lands on `/` or `/login` with
  // ?code=... instead of `/auth/callback`. Those pages do not exchange the code — users
  // only see the login form. Forward auth callback params to the real handler.
  const authQuery = request.nextUrl.searchParams;
  const looksLikeAuthCallback =
    authQuery.has("code") ||
    (authQuery.has("error") &&
      (authQuery.has("error_description") || authQuery.has("error_code")));
  if (
    looksLikeAuthCallback &&
    (pathname === "/" || pathname === "/login")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublicKey();
  if (!supabaseUrl || !supabaseKey) {
    // In development: warn and pass through so local work isn't blocked.
    // In production: REFUSE to serve. A silent pass-through with no auth
    // check would let unauthenticated users reach protected routes
    // (Feb 2025 audit §8.3, fixed by hotfix/middleware-env-hardfail).
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Auth redirects disabled. (dev mode — production would 500.)"
      );
      return response;
    }
    console.error(
      "[Supabase] FATAL: NEXT_PUBLIC_SUPABASE_URL or anon/publishable key is missing in production. Refusing to serve unauthenticated requests."
    );
    return new NextResponse(
      "<!doctype html><meta charset=utf-8><title>Server misconfigured</title>" +
        "<body style=\"font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:6rem auto;padding:0 1rem;\">" +
        "<h1>Server misconfigured</h1>" +
        "<p>The application can't reach its database. Required environment variables " +
        "(<code>NEXT_PUBLIC_SUPABASE_URL</code> and the Supabase anon/publishable key) are not set on this deployment.</p>" +
        "<p>If you're the operator: check Vercel → Project → Settings → Environment Variables and redeploy.</p>" +
        "</body>",
      { status: 500, headers: { "content-type": "text/html; charset=utf-8" } }
    );
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

  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const isRootPage = pathname === "/";
  // PKCE: email links land here with ?code= before session cookies exist
  const isAuthCallbackPage =
    pathname === "/auth/callback" || pathname.startsWith("/auth/callback/");
  // Magic link / email OTP: ?token_hash=...&type=... (Supabase custom email templates)
  const isAuthConfirmPage =
    pathname === "/auth/confirm" || pathname.startsWith("/auth/confirm/");
  // Password recovery (PKCE): allow full URL including ?code= without forcing login first
  const isResetPasswordPage =
    pathname === "/reset-password" || pathname.startsWith("/reset-password/");
  // Bearer ADMIN_API_SECRET protects the API; page is reachable without app login (ops tool).
  const isAdminForceResetPage =
    pathname === "/admin/force-reset" || pathname.startsWith("/admin/force-reset/");
  // PWA service worker fallback shell — must be reachable without auth so
  // it can be pre-cached on SW install and served when the network is down.
  const isPwaOfflineShell =
    pathname === "/offline.html" ||
    pathname === "/offline" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.json";
  const isPublicPage =
    isLoginPage ||
    isRootPage ||
    isAuthCallbackPage ||
    isAuthConfirmPage ||
    isResetPasswordPage ||
    isAdminForceResetPage ||
    isPwaOfflineShell;

  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const returnPath =
      request.nextUrl.pathname + (request.nextUrl.search ?? "");
    url.searchParams.set("redirectTo", returnPath);
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie.name, cookie.value)
    );
    return redirectResponse;
  }

  return response;
}
