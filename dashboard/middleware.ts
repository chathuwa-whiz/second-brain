import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.nextUrl.protocol ? req.nextUrl.protocol.replace(":", "") : "http");
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.host;

  const basePath = process.env.NEXT_BASE_PATH || "";
  const currentPath = req.nextUrl.pathname;
  const currentSearch = req.nextUrl.search;

  // Unauthenticated users
  if (!token) {
    if (currentPath.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }
    const callbackUrl = encodeURIComponent(`${currentPath}${currentSearch}`);
    const loginUrl = `${proto}://${host}${basePath}/login?callbackUrl=${callbackUrl}`;
    return NextResponse.redirect(loginUrl);
  }

  // Admin route protection: verify role == 'admin'
  const isAdminRoute = currentPath === "/admin" || currentPath.startsWith("/admin/");
  const isAdminApiRoute = currentPath.startsWith("/api/admin");

  if (isAdminRoute || isAdminApiRoute) {
    const userRole = (token as any)?.role;
    if (userRole !== "admin") {
      if (isAdminApiRoute) {
        return NextResponse.json(
          { error: "Forbidden. Administrator privileges required." },
          { status: 403 }
        );
      }
      const homeUrl = `${proto}://${host}${basePath}/?error=admin_required`;
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/onboarding",
    "/approvals/:path*",
    "/activity/:path*",
    "/jobs/:path*",
    "/resumes/:path*",
    "/tasks/:path*",
    "/modules/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/admin",
    "/api/admin/:path*",
    "/api/actions/:path*",
    "/api/jobs/:path*",
    "/api/stats/:path*",
    "/api/resumes/:path*",
    "/api/user/:path*",
  ],
};

