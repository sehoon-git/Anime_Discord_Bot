"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type BannedSession = {
  banReason?: string;
  banExpiresAt?: string | null;
};

const allowedPaths = new Set(["/support", "/account-restricted"]);

export default function BannedSessionGate() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const handled = useRef(false);
  const restriction = session as (typeof session & BannedSession) | null;

  useEffect(() => {
    if (status !== "authenticated" || !restriction?.banReason || handled.current) return;
    handled.current = true;
    const banReason = restriction.banReason;
    const banExpiresAt = restriction.banExpiresAt;

    void signOut({ redirect: false }).then(() => {
      if (allowedPaths.has(pathname)) return;
      const params = new URLSearchParams({ reason: banReason });
      if (banExpiresAt) params.set("expiresAt", banExpiresAt);
      router.replace(`/account-restricted?${params.toString()}`);
    });
  }, [pathname, restriction?.banExpiresAt, restriction?.banReason, router, status]);

  return null;
}
