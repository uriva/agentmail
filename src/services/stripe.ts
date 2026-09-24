import Stripe from "stripe";
import { db } from "../db.ts";
import { captureEvent } from "./posthog.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY || "dummy_key");

const TOPUP_AMOUNT_DOLLARS = 5;
const AGENTMAIL_PRICE_ID = "price_1UJ8BkHiG8UAKPQvUc3tTdJN";

const createTopupCheckoutSession = async ({
  orgId,
  userEmail,
  successUrl,
  cancelUrl,
}: {
  orgId: string;
  userEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<string> => {
  const session = await stripe.checkout.sessions.create({
    customer_email: userEmail || undefined,
    client_reference_id: orgId,
    metadata: {
      orgId,
      product: "agentmail",
      type: "balance_topup",
      amount: String(TOPUP_AMOUNT_DOLLARS),
    },
    payment_intent_data: {
      description: "AgentMail Prepaid Balance ($5.00)",
      metadata: {
        product: "agentmail",
        orgId,
      },
    },
    mode: "payment",
    line_items: [
      {
        price: AGENTMAIL_PRICE_ID,
        quantity: 1,
      },
    ],
    success_url:
      successUrl ??
        "https://theagentmail.net/app?checkout=success&session_id={CHECKOUT_SESSION_ID}",
    cancel_url: cancelUrl ?? "https://theagentmail.net/app?checkout=cancelled",
  });

  if (!session.url) {
    throw {
      status: 500,
      error: "Failed to generate Stripe checkout URL",
      code: "STRIPE_ERROR",
    };
  }

  return session.url;
};

const applyCheckoutSession = async (
  sessionId: string,
): Promise<{
  success: boolean;
  orgId?: string;
  newBalance?: number;
  alreadyApplied?: boolean;
}> => {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return { success: false };
  }

  const orgId = session.metadata?.orgId || session.client_reference_id;
  if (!orgId) {
    return { success: false };
  }

  const { organizations } = await db.query({
    organizations: { $: { where: { id: orgId } } },
  });
  const org = organizations[0];
  if (!org) {
    return { success: false };
  }

  const processed = Array.isArray(org.processedCheckoutSessions)
    ? (org.processedCheckoutSessions as string[])
    : [];

  if (processed.includes(sessionId)) {
    return {
      success: true,
      orgId,
      newBalance: org.balance ?? 0,
      alreadyApplied: true,
    };
  }

  const amountDollars = Number(session.metadata?.amount ?? TOPUP_AMOUNT_DOLLARS);
  const currentBalance = org.balance ?? 0;
  const newBalance = currentBalance + amountDollars;

  await db.transact([
    db.tx.organizations[orgId]!.update({
      balance: newBalance,
      processedCheckoutSessions: [...processed, sessionId],
    }),
  ]);

  captureEvent(orgId, "balance_topup", {
    amount: amountDollars,
    newBalance,
    sessionId,
  });

  return {
    success: true,
    orgId,
    newBalance,
    alreadyApplied: false,
  };
};

export { applyCheckoutSession, createTopupCheckoutSession, stripe };
