import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getUserByEmail, getOrCreateOAuthUser } from "./db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: "consent",
                access_type: "offline",
                response_type: "code",
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter both email and password.");
        }

        const email = credentials.email.trim().toLowerCase();
        const password = credentials.password;

        // Legacy / Admin fallback if configured in environment
        const expectedUser = process.env.DASHBOARD_USERNAME;
        const expectedPass = process.env.DASHBOARD_PASSWORD;
        if (
          expectedUser &&
          expectedPass &&
          (email === expectedUser.toLowerCase() || email === `${expectedUser.toLowerCase()}@local`) &&
          password === expectedPass
        ) {
          let legacyUser = await getUserByEmail(email);
          if (!legacyUser) {
            legacyUser = await getUserByEmail(expectedUser.toLowerCase());
          }
          if (legacyUser) {
            return {
              id: legacyUser.id,
              name: legacyUser.name || expectedUser,
              email: legacyUser.email,
              image: legacyUser.image,
              role: legacyUser.role,
            };
          }
          return {
            id: "system-admin-1",
            name: expectedUser,
            email: `${expectedUser}@local`,
            role: "admin",
          };
        }

        const user = await getUserByEmail(email);

        if (!user || !user.password_hash) {
          throw new Error("Invalid email or password.");
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          throw new Error("Invalid email or password.");
        }

        return {
          id: user.id,
          name: user.name || user.email.split("@")[0],
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && user.email) {
        try {
          const dbUser = await getOrCreateOAuthUser({
            name: profile?.name || user.name,
            email: user.email,
            image: (profile as any)?.picture || user.image,
            provider: "google",
            providerAccountId: account.providerAccountId,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at,
            idToken: account.id_token,
            scope: account.scope,
          });
          user.id = dbUser.id;
          user.name = dbUser.name;
          (user as any).role = dbUser.role;
          return true;
        } catch (err) {
          console.error("Google OAuth signIn callback error:", err);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "user";
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = token.name as string;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },
};
