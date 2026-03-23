import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Bypass auth for all Next internals (matcher should already skip these; keep in sync).
  const p = request.nextUrl.pathname;
  if (p.startsWith("/_next/") || p === "/_next") {
    return NextResponse.next();
  }
  return updateSession(request);
}

// Exclude all of `/_next/*` (not only static/image). Dev HMR uses `/_next/webpack-hmr`
// (or turbopack); running auth middleware there breaks the WebSocket upgrade → reload loop.
export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|manifest.json|sw.js|icons/|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
