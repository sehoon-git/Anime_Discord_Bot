import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { addTestCredits, getBillingStatusForUser } from "@/app/lib/billing";

export const dynamic = "force-dynamic";

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return session.user;
}

export async function GET() {
  const user = await currentUser();
  if (!user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const billing = await getBillingStatusForUser(user.email, user.name);
    return Response.json({ ok: true, credits: billing.credits, usage: billing.usage });
  } catch (error) {
    console.error("[billing][credits][GET]", error);
    return Response.json({ error: "Credit status unavailable" }, { status: 500 });
  }
}

export async function POST() {
  const user = await currentUser();
  if (!user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const billing = await getBillingStatusForUser(user.email, user.name);
    const balance = await addTestCredits(billing.userId, 100);
    return Response.json({ ok: true, mode: "test", added: 100, balance });
  } catch (error) {
    console.error("[billing][credits][POST]", error);
    return Response.json({ error: "Credit top-up failed" }, { status: 500 });
  }
}
