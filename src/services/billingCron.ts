import { db } from "../db.ts";
import { emailDomain, sendEmail } from "./resend.ts";
import { captureEvent } from "./posthog.ts";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const runBillingRenewalCheck = async (): Promise<void> => {
  const now = Date.now();
  const { organizations } = await db.query({
    organizations: {
      accounts: {},
      billingUser: {},
    },
  });

  for (const org of organizations) {
    if (org.admin) continue;

    let balance = org.balance ?? 0;
    const billingEmail = org.billingUser?.email;
    const accounts = org.accounts ?? [];

    for (const acc of accounts) {
      const expiresAt = acc.expiresAt ?? 0;

      if (acc.isFrozen || expiresAt <= now) {
        if (balance >= 1) {
          balance -= 1;
          const newExpiresAt = now + THIRTY_DAYS_MS;
          await db.transact([
            db.tx.organizations[org.id]!.update({ balance }),
            db.tx.accounts[acc.id]!.update({
              expiresAt: newExpiresAt,
              isFrozen: false,
              sendsThisMonth: 0,
              sendPeriodStart: now,
              warningEmailSentAt: 0,
            }),
          ]);
          captureEvent(org.id, "mailbox_renewed", {
            address: acc.address,
            remainingBalance: balance,
          });
        } else if (!acc.isFrozen) {
          await db.transact([
            db.tx.accounts[acc.id]!.update({ isFrozen: true }),
          ]);
          captureEvent(org.id, "mailbox_frozen", { address: acc.address });

          if (billingEmail) {
            await sendEmail({
              from: `AgentMail <support@${emailDomain}>`,
              to: [billingEmail],
              subject:
                `[AgentMail] Mailbox ${acc.address} has expired and is paused`,
              text: `Hi there,

Your agent mailbox ${acc.address} has expired and has been paused because your account balance is $0.00.

Outbound email sending has been paused. Inbound messages will continue to be received during a grace period.

To reactivate your mailbox, top up your balance ($5 covers 5 mailbox-months):
https://theagentmail.net/app

Thanks,
The AgentMail Team`,
            }).catch((err) =>
              console.error("[billingCron] Failed to send frozen email:", err)
            );
          }
        }
      } else if (expiresAt - now <= THREE_DAYS_MS && balance < 1) {
        const lastWarning = acc.warningEmailSentAt ?? 0;
        if (now - lastWarning > THREE_DAYS_MS && billingEmail) {
          await db.transact([
            db.tx.accounts[acc.id]!.update({ warningEmailSentAt: now }),
          ]);

          const daysLeft = Math.max(
            1,
            Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)),
          );
          await sendEmail({
            from: `AgentMail <support@${emailDomain}>`,
            to: [billingEmail],
            subject:
              `[AgentMail] Mailbox ${acc.address} expires in ${daysLeft} days`,
            text: `Hi there,

Your agent mailbox ${acc.address} is scheduled to expire in ${daysLeft} day${
              daysLeft === 1 ? "" : "s"
            }, and your balance is currently $0.00.

To avoid any interruption to your agent, please top up your balance:
https://theagentmail.net/app

Thanks,
The AgentMail Team`,
          }).catch((err) =>
            console.error("[billingCron] Failed to send warning email:", err)
          );
        }
      }
    }
  }
};

export { runBillingRenewalCheck };
