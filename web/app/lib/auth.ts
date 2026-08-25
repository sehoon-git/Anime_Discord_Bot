import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isEmailBanned } from "@/app/lib/moderation";

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
      return !(await isEmailBanned(user.email));
    },
    async jwt({ token }) {
      if (typeof token.email !== "string") return token;
      if (await isEmailBanned(token.email)) {
        token.email = undefined;
        token.name = undefined;
        token.picture = undefined;
      }
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
};
