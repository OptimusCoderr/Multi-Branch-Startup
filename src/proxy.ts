import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// This is a cheap, edge-safe presence check on the session cookie — it is
// NOT the authorization boundary. It only decides routing/UX (bounce
// obviously-signed-out visitors before they see a protected page). Real
// authentication and permission checks always happen server-side against
// the database in requireMembership()/requirePermission(), because this
// middleware can't safely make DB-backed authorization decisions.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/products",
  "/warehouses",
  "/branches",
  "/stock",
  "/transfers",
  "/sales",
  "/staff",
  "/settings",
  "/billing-required",
];
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  // Deliberately does NOT bounce a signed-in-looking visitor away from
  // /sign-in or /sign-up back to /dashboard: cookie *presence* isn't
  // validity — after a staff member is suspended/removed, their session
  // rows are deleted server-side (staff-service.ts) but their browser
  // still holds the now-orphaned cookie. Doing that bounce here previously
  // created a genuine infinite redirect loop: /dashboard's real
  // DB-backed session check would fail and send them back to /sign-in,
  // which this middleware would then bounce straight back to /dashboard
  // based on the same stale cookie. Letting /sign-in always render is safe
  // and breaks the loop; requireSession()/requireMembership() are still
  // what actually decide access on every protected page.
  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
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
    "/sales/:path*",
    "/staff/:path*",
    "/settings/:path*",
    "/billing-required",
  ],
};
