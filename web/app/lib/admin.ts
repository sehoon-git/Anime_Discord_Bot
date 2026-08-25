import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";

function configuredAdminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function isAdminEmail(email?: string | null) {
  return Boolean(email && configuredAdminEmails().has(email.trim().toLowerCase()));
}

export async function requireAdminEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  return isAdminEmail(email) ? email : null;
}

export function hasConfiguredAdmins() {
  return configuredAdminEmails().size > 0;
}
