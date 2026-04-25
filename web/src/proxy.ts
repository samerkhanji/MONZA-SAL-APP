import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16+: the `middleware` file convention is deprecated in favor of `proxy`.
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
// Paths that must be reachable without auth (PWA shell, manifest, SW).
// Belt + suspenders: also listed in `config.matcher` below, but matcher
// regex behavior is fragile, so short-circuit here too.
const PUBLIC_FILES = new Set([
  "/offline.html",
  "/manifest.json",
  "/sw.js",
  "/favicon.ico",
]);

export async function proxy(request: NextRequest) {
  const p = request.nextUrl.pathname;
  if (p.startsWith("/_next/") || p === "/_next") {
    return NextResponse.next();
  }
  if (PUBLIC_FILES.has(p)) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|manifest.json|sw.js|offline.html|icons/|images/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf)$).*)",
  ],
};
