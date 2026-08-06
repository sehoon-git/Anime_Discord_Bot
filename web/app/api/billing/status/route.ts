import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { getMissingRequiredConsents } from "@/app/lib/consent";
import { getBillingStatusForUser } from "@/app/lib/billing";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const billing = await getBillingStatusForUser(
      session.user.email,
      session.user.name,
    );
    const missingConsents = await getMissingRequiredConsents(billing.userId);
    if (missingConsents.length > 0) return Response.json({ ok: false, error: "REQUIRED_CONSENT_MISSING", missingConsents }, { status: 403 });

    return Response.json(billing);
  } catch (error) {
    console.error("[billing][status]", error);

    return Response.json(
      { error: "Billing status unavailable" },
      { status: 500 },
    );
  }
}
