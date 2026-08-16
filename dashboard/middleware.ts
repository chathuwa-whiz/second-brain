import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "secondbrain.xubi.org";

    const basePath = process.env.NEXT_BASE_PATH || "/secondbrain";
    const currentPath = req.nextUrl.pathname;
    const currentSearch = req.nextUrl.search;

    const callbackUrl = encodeURIComponent(`${currentPath}${currentSearch}`);
    const loginUrl = `${proto}://${host}${basePath}/login?callbackUrl=${callbackUrl}`;

    return NextResponse.redirect(loginUrl);
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
    "/modules/:path*",
    "/settings/:path*",
    "/api/actions/:path*",
    "/api/jobs/:path*",
    "/api/stats/:path*",
    "/api/resumes/:path*",
    "/api/user/:path*",
  ],
};

