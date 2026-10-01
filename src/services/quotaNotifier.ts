import { db, id } from "../db.ts";
import { emailDomain, sendEmail } from "./resend.ts";

export type QuotaType =
  | "daily_send"
  | "monthly_send"
  | "daily_receive"
  | "monthly_receive";

export const notifyQuotaExceeded = async ({
  orgId,
  accountAddress,
  accountId,
  quotaType,
  limit,
  billingEmail,
  isPaying,
}: {
  orgId: string;
  accountAddress: string;
  accountId: string;
  quotaType: QuotaType;
  limit: number;
  billingEmail?: string;
  isPaying: boolean;
}): Promise<boolean> => {
  if (!billingEmail || billingEmail.endsWith("@example.com")) return false;

  const now = Date.now();
  const periodDurationMs = quotaType.startsWith("daily")
    ? 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000;
  const since = now - periodDurationMs;

  try {
    const { karmaEvents } = await db.query({
      karmaEvents: {
        $: {
          where: {
            "organization.id": orgId,
            type: "quota_warning_email",
            timestamp: { $gte: since },
          },
        },
      },
    });

    const alreadySent = (karmaEvents ?? []).some(
      // deno-lint-ignore no-explicit-any
      (e: any) =>
        e.metadata?.accountId === accountId &&
        e.metadata?.quotaType === quotaType,
    );
    if (alreadySent) return false;

    const eventId = id();
    await db.transact([
      db.tx.karmaEvents[eventId]!.update({
        type: "quota_warning_email",
        amount: 0,
        timestamp: now,
        metadata: {
          accountId,
          accountAddress,
          quotaType,
          limit,
        },
      }),
      db.tx.karmaEvents[eventId]!.link({ organization: orgId }),
    ]);

    const typeDesc = quotaType === "daily_send"
      ? `daily send limit (${limit} emails/day)`
      : quotaType === "monthly_send"
      ? `monthly send limit (${limit.toLocaleString()} emails/month)`
      : quotaType === "daily_receive"
      ? `daily receive limit (${limit} emails/day)`
      : `monthly receive limit (${limit.toLocaleString()} emails/month)`;

    const impactDesc = quotaType.includes("receive")
      ? "Incoming emails will be dropped cleanly until the quota resets so they do not impact mailbox reliability."
      : "Outgoing messages from this mailbox are currently paused until the quota resets.";

    const actionText = isPaying
      ? "If your agent requires higher volume, reply directly to this email to discuss custom limits."
      : "To upgrade to paid limits (1,000 sends & 1,000 receives/mo, capped at 200/day), top up your balance ($1/month per mailbox) at https://theagentmail.net/app";

    await sendEmail({
      from: `AgentMail <support@${emailDomain}>`,
      to: [billingEmail],
      subject: `[AgentMail] Quota reached for ${accountAddress}`,
      text: `Hi there,

Your agent mailbox ${accountAddress} has reached its ${typeDesc}.

${impactDesc}

Daily quotas reset automatically at 00:00 UTC.

${actionText}

Thanks,
The AgentMail Team`,
    });

    return true;
  } catch (err) {
    console.error("[notifyQuotaExceeded] Error sending notification:", err);
    return false;
  }
};
