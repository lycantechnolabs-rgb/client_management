import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe slice of the auth config — no Prisma, no Node APIs.
 * Middleware builds its session from this, so the token -> session mapping
 * MUST live here as well as on the server. Without it `session.user.role` is
 * undefined in middleware and the role checks bounce between portals.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  trustHost: true,
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? "";
        session.user.role = (token.role as string) ?? "";
        session.user.clientId = (token.clientId as string | null) ?? null;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
