import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, static images
     * - PWA: manifest.json, sw.js, icons/*, images/*
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
