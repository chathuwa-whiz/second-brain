export { default } from "next-auth/middleware";

/*
  Everything except public pages (login, verify-email) and auth endpoints requires a session.
*/
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
