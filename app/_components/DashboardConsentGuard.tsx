"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardConsentGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("discord-anime-ai-consent") !== "accepted") {
      router.replace("/consent");
    }
  }, [router]);

  return children;
}
