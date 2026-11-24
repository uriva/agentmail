import { db, id } from "../db.ts";
import { trackBackgroundTask } from "./posthog.ts";
import { emailDomain, sendEmail } from "./resend.ts";

export type BlockReason = "trial_verification" | "outbound_spam";

const blockWarningCooldownMs = 24 * 60 * 60 * 1000;

const buildBlockEmail = ({
  accountAddress,
  blockReason,
  detail,
}: {
  accountAddress: string;
  blockReason: BlockReason;
  detail?: string;
}): { subject: string; text: string } =>
  blockReason === "trial_verification"
    ? {
      subject: `[AgentMail] Verification email blocked on ${accountAddress}`,
      text: `Hi there,

An incoming signup, OTP, or account activation email${
        detail ? ` from ${detail}` : ""
      } was blocked on your free trial mailbox (${accountAddress}).

Free trial mailboxes exclude signup and verification emails to prevent burner abuse. To unlock them immediately, top up $5 (5 mailbox-months, never expires) in your dashboard:
https://theagentmail.net/app

Once topped up, future verification emails will be delivered normally.

Thanks,
The AgentMail Team`,
    }
    : {
      subject: `[AgentMail] Outbound email blocked for ${accountAddress}`,
      text: `Hi there,

An outbound email from ${accountAddress}${
        detail ? ` (subject: "${detail}")` : ""
      } was blocked by our real-time spam and phishing filter.

Please review your agent's activity to make sure it is behaving as expected. If you believe this was a false positive, reply directly to this email and we'll look into it.

Thanks,
The AgentMail Team`,
    };

const runNotifyMessageBlocked = async ({
  orgId,
  accountAddress,
  accountId,
  blockReason,
  billingEmail,
  detail,
}: {
  orgId: string;
  accountAddress: string;
  accountId: string;
  blockReason: BlockReason;
  billingEmail?: string;
  detail?: string;
}): Promise<boolean> => {
  if (!billingEmail || billingEmail.endsWith("@example.com")) return false;

  const now = Date.now();
  const since = now - blockWarningCooldownMs;

  try {
    const { karmaEvents } = await db.query({
      karmaEvents: {
        $: {
          where: {
            "organization.id": orgId,
            type: "block_warning_email",
            timestamp: { $gte: since },
          },
        },
      },
    });

    const alreadySent = (karmaEvents ?? []).some(
      // deno-lint-ignore no-explicit-any
      (e: any) =>
        e.metadata?.accountId === accountId &&
        e.metadata?.blockReason === blockReason,
    );
    if (alreadySent) return false;

    const eventId = id();
    await db.transact([
      db.tx.karmaEvents[eventId]!.update({
        type: "block_warning_email",
        amount: 0,
        timestamp: now,
        metadata: {
          accountId,
          accountAddress,
          blockReason,
          ...(detail ? { detail } : {}),
        },
      }),
      db.tx.karmaEvents[eventId]!.link({ organization: orgId }),
    ]);

    const { subject, text } = buildBlockEmail({
      accountAddress,
      blockReason,
      detail,
    });

    await sendEmail({
      from: `AgentMail <support@${emailDomain}>`,
      to: [billingEmail],
      subject,
      text,
    });

    return true;
  } catch (err) {
    console.error("[notifyMessageBlocked] Error sending notification:", err);
    return false;
  }
};

export const notifyMessageBlocked = (
  params: Parameters<typeof runNotifyMessageBlocked>[0],
): Promise<boolean> => trackBackgroundTask(runNotifyMessageBlocked(params));
