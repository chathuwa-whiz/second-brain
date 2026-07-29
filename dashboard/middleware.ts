export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/actions/:path*", "/api/actions/:path*"],
};
