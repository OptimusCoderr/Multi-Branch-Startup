import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// This is a cheap, edge-safe presence check on the session cookie — it is
// NOT the authorization boundary. It only decides routing/UX (bounce
// obviously-signed-out visitors before they see a protected page). Real
// authentication and permission checks always happen server-side against
// the database in requireMembership()/requirePermission(), because this
// middleware can't safely make DB-backed authorization decisions.
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/products", "/warehouses", "/branches", "/stock", "/transfers"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Only redirect on GET: /sign-up's second step (naming the company) is a
  // same-URL Server Action POST made *after* the session cookie already
  // exists, and must be allowed to reach the action rather than being
  // bounced to /dashboard.
  if (AUTH_PAGES.includes(pathname) && hasSessionCookie && request.method === "GET") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/products/:path*",
    "/warehouses/:path*",
    "/branches/:path*",
    "/stock/:path*",
    "/transfers/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
