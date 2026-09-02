import type { NextAuthOptions } from "next-auth";
import { headers } from "next/headers";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/app/lib/db";
import { getActiveEmailBan, getActiveIpBan, getClientIp, recordUserIp } from "@/app/lib/moderation";

async function recordUserLogin(email: string, name?: string | null) {
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at DESC);
  `);
  await db.query(
    `INSERT INTO users (email, name, last_login_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (email)
     DO UPDATE SET
       name = COALESCE(EXCLUDED.name, users.name),
       last_login_at = NOW(),
       updated_at = NOW()`,
    [email, name ?? null],
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const ipAddress = getClientIp(await headers());
      const ban = (await getActiveEmailBan(user.email)) ?? (ipAddress ? await getActiveIpBan(ipAddress) : null);
      if (ban) {
        const params = new URLSearchParams({ reason: ban.reason });
        if (ban.expiresAt) params.set("expiresAt", ban.expiresAt);
        return `/account-restricted?${params.toString()}`;
      }
      try {
        await recordUserLogin(user.email, user.name);
      } catch (error) {
        // Do not block a legitimate sign-in solely because activity tracking
        // is temporarily unavailable.
        console.error("[auth][record-user-login]", error);
      }
      return true;
    },
    async jwt({ token }) {
      if (typeof token.email !== "string") return token;
      const ipAddress = getClientIp(await headers());
      const ban = (await getActiveEmailBan(token.email)) ?? (ipAddress ? await getActiveIpBan(ipAddress) : null);
      if (ban) {
        token.banReason = ban.reason;
        token.banExpiresAt = ban.expiresAt;
      } else {
        token.banReason = undefined;
        token.banExpiresAt = undefined;
        if (ipAddress) {
          try {
            await recordUserIp(token.email, ipAddress);
          } catch (error) {
            console.error("[auth][record-user-ip]", error);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      const banReason = typeof token.banReason === "string" ? token.banReason : undefined;
      if (banReason) {
        session.user = undefined;
        (session as typeof session & { banReason?: string; banExpiresAt?: string | null }).banReason = banReason;
        (session as typeof session & { banReason?: string; banExpiresAt?: string | null }).banExpiresAt = typeof token.banExpiresAt === "string" ? token.banExpiresAt : null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
};
