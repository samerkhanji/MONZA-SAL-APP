import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16+: the `middleware` file convention is deprecated in favor of `proxy`.
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
export async function proxy(request: NextRequest) {
  const p = request.nextUrl.pathname;
  if (p.startsWith("/_next/") || p === "/_next") {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|manifest.json|sw.js|offline.html|icons/|images/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf)$).*)",
  ],
};
