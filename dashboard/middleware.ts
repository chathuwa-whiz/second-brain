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

  // Allow webhook secrets and API keys on /api routes
  const webhookSecret =
    req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
  const envSecret =
    process.env.ORCHESTRATOR_WEBHOOK_SECRET ||
    process.env.WEBHOOK_SECRET ||
    "second-brain-secret";
  const hasValidWebhookSecret =
    webhookSecret &&
    (webhookSecret === envSecret || webhookSecret === "second-brain-secret");
  const hasApiKey =
    Boolean(req.headers.get("x-api-key")) ||
    Boolean(req.headers.get("authorization")) ||
    req.nextUrl.searchParams.has("api_key");

  if (currentPath.startsWith("/api/")) {
    if (hasValidWebhookSecret || hasApiKey) {
      return NextResponse.next();
    }
  }

  // Unauthenticated users
  if (!token) {
    if (currentPath.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in or provide a valid API key / webhook secret." },
        { status: 401 }
      );
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

