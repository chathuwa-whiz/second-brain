export { default } from "next-auth/middleware";

/*
  Everything except the login page and the auth endpoints requires a session.
  Listed explicitly rather than as a catch-all so adding a public page later is
  a deliberate decision rather than an accident of regex.
*/
export const config = {
  matcher: [
    "/",
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
  ],
};
