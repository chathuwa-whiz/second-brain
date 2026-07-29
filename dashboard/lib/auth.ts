import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Single-user auth: the "user database" is one username/password pair in env
// vars. This is intentionally minimal for a personal tool — swap for a real
// user table + hashed passwords if this ever needs more than one user.
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const expectedUser = process.env.DASHBOARD_USERNAME;
        const expectedPass = process.env.DASHBOARD_PASSWORD;

        if (!expectedUser || !expectedPass) {
          throw new Error(
            "DASHBOARD_USERNAME / DASHBOARD_PASSWORD not set in environment"
          );
        }

        if (
          credentials?.username === expectedUser &&
          credentials?.password === expectedPass
        ) {
          return { id: "1", name: expectedUser };
        }
        return null;
      },
    }),
  ],
};
