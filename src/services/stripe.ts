import Stripe from "stripe";
import { db } from "../db.ts";
import { withKeyedLock } from "../security.ts";
import { captureEvent } from "./posthog.ts";

const topupAmountDollars = 5;
const agentmailPriceId = "price_1UJ8BkHiG8UAKPQvUc3tTdJN";
const defaultSuccessUrl =
  "https://theagentmail.net/app?checkout=success&session_id={CHECKOUT_SESSION_ID}";
const defaultCancelUrl = "https://theagentmail.net/app?checkout=cancelled";

const stripeCell: { key: string; client: Stripe }[] = [];

export const getStripe = (): Stripe => {
  const key = Deno.env.get("STRIPE_SECRET_KEY") || "dummy_key";
  if (stripeCell[0]?.key === key) return stripeCell[0].client;
  const client = new Stripe(key);
  stripeCell[0] = { key, client };
  return client;
};

const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export const resolveAllowedCheckoutReturnUrl = (
  rawUrl: string | undefined,
  fallbackUrl: string,
): string => {
  if (!rawUrl) return fallbackUrl;
  const normalized = rawUrl.replace(
    "{CHECKOUT_SESSION_ID}",
    "__CHECKOUT_SESSION_ID__",
  );
  const parsed = (() => {
    try {
      return new URL(normalized);
    } catch {
      return null;
    }
  })();
  if (
    !parsed ||
    parsed.protocol !== "https:" ||
    (parsed.hostname !== "theagentmail.net" &&
      parsed.hostname !== "www.theagentmail.net")
  ) {
    throw {
      status: 400,
      error: "Redirect URL must be on https://theagentmail.net",
      code: "INVALID_REDIRECT_URL",
    };
  }
  return parsed
    .toString()
    .replace("__CHECKOUT_SESSION_ID__", "{CHECKOUT_SESSION_ID}");
};

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
  const validatedSuccess = resolveAllowedCheckoutReturnUrl(
    successUrl,
    defaultSuccessUrl,
  );
  const validatedCancel = resolveAllowedCheckoutReturnUrl(
    cancelUrl,
    defaultCancelUrl,
  );

  const session = await getStripe().checkout.sessions.create({
    customer_email: userEmail || undefined,
    client_reference_id: orgId,
    metadata: {
      orgId,
      product: "agentmail",
      type: "balance_topup",
      amount: String(topupAmountDollars),
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
        price: agentmailPriceId,
        quantity: 1,
      },
    ],
    success_url: validatedSuccess,
    cancel_url: validatedCancel,
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
  expectedOrgId?: string,
): Promise<{
  success: boolean;
  orgId?: string;
  newBalance?: number;
  alreadyApplied?: boolean;
}> => {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (
    session.payment_status !== "paid" ||
    (session.mode && session.mode !== "payment") ||
    (session.metadata?.product && session.metadata.product !== "agentmail")
  ) {
    return { success: false };
  }

  const orgId = session.metadata?.orgId || session.client_reference_id;
  if (!orgId || (expectedOrgId && orgId !== expectedOrgId)) {
    return { success: false };
  }

  return withKeyedLock(`org:${orgId}`, async () => {
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

    const amountDollars = typeof session.amount_total === "number" &&
        session.amount_total > 0
      ? Math.floor(session.amount_total / 100)
      : Number(session.metadata?.amount ?? topupAmountDollars);
    if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
      return { success: false };
    }

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
  });
};

export { applyCheckoutSession, createTopupCheckoutSession, stripe };
