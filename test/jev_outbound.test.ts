import { assertEquals } from "@std/assert";
import { isDecisionModelAvailable } from "ai-utils";
import { scanOutboundEmail } from "../src/services/jev.ts";

Deno.test({
  name: "scanOutboundEmail allows contextual 1:1 technical outreach while blocking phishing and bulk spam",
  ignore: !isDecisionModelAvailable(),
  fn: async () => {
    const contextualPeerOutreach = await scanOutboundEmail({
      to: ["dev@example.com"],
      subject: "Baileys #2901 (getUSyncDevices session churn & group sender keys)",
      text: [
        "Hey Alex,",
        "",
        "Saw your writeup on Baileys #2901. Catching that assertSessions(lids, true) was closing device 0 sessions on every send and leaving stale pendingPreKey sessions on disk (plus the libsignal decryptWithSessions mutation without rollback) is a sharp diagnosis of the group decryption bug.",
        "",
        "Having to maintain custom protocol patches every time session behavior shifts gets exhausting fast. If you ever want to offload the WhatsApp transport layer instead of babysitting library internals, we run ExampleCloud (https://example.com): each line gets its own isolated container pinned to a static residential proxy with full group read/write, webhooks, and REST API for $10/month flat (7-day trial, no per-message fees).",
        "",
        "Either way, appreciate you documenting that fix so clearly.",
        "",
        "Best,",
        "Jordan",
      ].join("\n"),
    });
    assertEquals(contextualPeerOutreach.allowed, true);

    const phishingAttempt = await scanOutboundEmail({
      to: ["victim@example.com"],
      subject: "URGENT: Your Microsoft 365 password expires in 2 hours",
      text:
        "Security Alert: Unusual sign-in detected. Immediately verify your credentials and enter your password + 2FA code at http://m365-login-verify-security.xyz/auth or your mailbox will be permanently deleted.",
    });
    assertEquals(phishingAttempt.allowed, false);

    const bulkSpamBlast = await scanOutboundEmail({
      to: ["info@example.com"],
      subject: "MAKE $10,000 PER DAY GUARANTEED CRYPTO CASINO BONUS!!!",
      text:
        "CONGRATULATIONS WINNER!! Claim your 500% offshore crypto casino bonus + 1,000,000 B2B email leads list for $29 right now at http://mega-crypto-leads-blast.biz — ACT FAST!!",
    });
    assertEquals(bulkSpamBlast.allowed, false);

    const genericSeoSpam = await scanOutboundEmail({
      to: ["webmaster@example.com"],
      subject: " Rank #1 on Google in 48 Hours - Cheap Backlinks Package ",
      text:
        "Dear Sir/Madam Website Owner, We noticed your website has low traffic and poor SEO score! Buy 50,000 DA90 guest post backlinks + 10,000 Instagram followers for only $19 today! Reply YES to unsubscribe or order now.",
    });
    assertEquals(genericSeoSpam.allowed, false);
  },
});
