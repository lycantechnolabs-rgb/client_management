import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email or phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const identifier = parsed.data.email.trim().toLowerCase();

        // Throttle by IP and by account. Without this an attacker can grind
        // passwords at whatever rate the network allows — Argon2 makes each
        // guess costly, but not costly enough to rely on alone.
        // The per-account limit is the one that stops credential stuffing. The
        // per-IP limit is only a coarse backstop and is deliberately loose:
        // most mobile users in India sit behind carrier-grade NAT, so a whole
        // town can share one address. A tight IP limit would lock out growers
        // who have done nothing wrong.
        const ip = clientIp(request.headers);
        // Both counters in flight together: they are independent keys, and
        // against a remote store two sequential round trips would double the
        // latency on every single login.
        const [perIp, perAccount] = await Promise.all([
          rateLimit(`login:ip:${ip}`, 50, 10 * 60_000),
          rateLimit(`login:acct:${identifier}`, 5, 15 * 60_000),
        ]);

        if (!perIp.allowed || !perAccount.allowed) {
          await db.auditLog.create({
            data: {
              action: "LOGIN_THROTTLED",
              entity: "User",
              meta: JSON.stringify({ identifier, ip }),
            },
          });
          return null;
        }

        // Growers may know their phone number better than their email,
        // so either works as the login identifier.
        const user = await db.user.findFirst({
          where: {
            OR: [{ email: identifier }, { phone: identifier }],
          },
        });

        if (!user || !user.isActive) return null;

        const ok = await verify(user.passwordHash, parsed.data.password);
        if (!ok) return null;

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await db.auditLog.create({
          data: { userId: user.id, action: "LOGIN", entity: "User", entityId: user.id },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clientId: user.clientId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    // Keep the shared session mapping from authConfig; only add the
    // database-backed jwt step, which cannot run on the edge.
    ...authConfig.callbacks,

    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = user.role;
        token.clientId = user.clientId ?? null;
        token.mustChangePassword = user.mustChangePassword ?? false;
        return token;
      }

      // Revalidate on every request. The Credentials provider forces JWT
      // sessions, so this is what makes "deactivate a client" take effect
      // immediately instead of at token expiry.
      if (token.uid) {
        const fresh = await db.user.findUnique({
          where: { id: token.uid as string },
          select: {
            role: true,
            clientId: true,
            isActive: true,
            mustChangePassword: true,
            name: true,
          },
        });

        if (!fresh || !fresh.isActive) return null;

        token.role = fresh.role;
        token.clientId = fresh.clientId;
        token.mustChangePassword = fresh.mustChangePassword;
        token.name = fresh.name;
      }

      return token;
    },
  },
});
