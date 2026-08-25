import type { NextAuthOptions } from "next-auth";
import { headers } from "next/headers";
import GoogleProvider from "next-auth/providers/google";
import { getActiveEmailBan, getActiveIpBan, getClientIp, isEmailBanned, recordUserIp } from "@/app/lib/moderation";

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
      return !(await isEmailBanned(user.email)) && !(ipAddress && await getActiveIpBan(ipAddress));
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
