import Stripe from "stripe";
import { db } from "../db.ts";
import {
  applyCheckoutSession,
  createTopupCheckoutSession,
  stripe,
} from "../services/stripe.ts";

const createCheckout = async (
  req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const body = (await req.json().catch(() => ({}))) as {
    successUrl?: string;
    cancelUrl?: string;
  };

  const { organizations } = await db.query({
    organizations: {
      $: { where: { id: orgId } },
      billingUser: {},
    },
  });
  const org = organizations[0];
  const userEmail = org?.billingUser?.email;

  const checkoutUrl = await createTopupCheckoutSession({
    orgId,
    userEmail,
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
  });

  return Response.json({ data: { checkoutUrl } });
};

const syncCheckout = async (
  req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const { sessionId } = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
  };
  if (!sessionId) {
    return Response.json(
      { error: "sessionId is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const result = await applyCheckoutSession(sessionId);
  if (!result.success) {
    return Response.json(
      { error: "Checkout session not completed or invalid", code: "PAYMENT_NOT_FOUND" },
      { status: 400 },
    );
  }

  const { organizations } = await db.query({
    organizations: { $: { where: { id: orgId } } },
  });
  const org = organizations[0];

  return Response.json({
    data: {
      success: true,
      balance: org?.balance ?? 0,
      alreadyApplied: result.alreadyApplied,
    },
  });
};

const getBillingBalance = async (
  _req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const { organizations } = await db.query({
    organizations: { $: { where: { id: orgId } } },
  });
  const org = organizations[0];
  if (!org) {
    return Response.json(
      { error: "Organization not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return Response.json({
    data: {
      balance: org.balance ?? 0,
      admin: Boolean(org.admin),
    },
  });
};

const handleStripeWebhook = async (req: Request): Promise<Response> => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!sig || !webhookSecret) {
    return Response.json(
      { error: "Missing stripe-signature or webhook secret" },
      { status: 400 },
    );
  }

  try {
    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await applyCheckoutSession(session.id);
    }
    return Response.json({ received: true });
  } catch (err: unknown) {
    console.error("[stripe-webhook] Error verifying webhook:", err);
    return Response.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }
};

export { createCheckout, getBillingBalance, handleStripeWebhook, syncCheckout };
