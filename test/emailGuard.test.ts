import { assertEquals } from "@std/assert";
import { isDecisionModelAvailable } from "@uriv/chaff";
import {
  isLikelyVerificationEmail,
  scanInboundEmail,
  scanOutboundEmail,
} from "../src/services/emailGuard.ts";

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

Deno.test("isLikelyVerificationEmail detects signup, activation, and OTP emails without false positives", () => {
  assertEquals(
    isLikelyVerificationEmail({
      subject: "Activate Your Apollo Account",
      text: "Click here to activate your Apollo account and start prospecting.",
    }),
    true,
  );
  assertEquals(
    isLikelyVerificationEmail({
      subject: "Your verification code: 481516",
      text: "Enter 481516 to finish signing up for GitHub.",
    }),
    true,
  );
  assertEquals(
    isLikelyVerificationEmail({
      subject: "Re: Deploy status for Friday",
      text: "Hey, all checks are green and ready to merge.",
    }),
    false,
  );
});

Deno.test({
  name: "scanInboundEmail classifies signup/OTP emails separately from normal correspondence",
  ignore: !isDecisionModelAvailable(),
  fn: async () => {
    const apolloActivation = await scanInboundEmail({
      from: "support@apollo.io",
      to: ["bot@theagentmail.net"],
      subject: "Activate Your Apollo Account",
      text:
        "Welcome to Apollo! Click https://app.apollo.io/confirm?token=abc to confirm your email address and activate your account.",
    });
    assertEquals(apolloActivation.allowed, true);
    assertEquals(apolloActivation.isVerification, true);

    const githubOtp = await scanInboundEmail({
      from: "noreply@github.com",
      to: ["bot@theagentmail.net"],
      subject: "GitHub — Your verification code: 481516",
      text: "Use verification code 481516 to complete your GitHub sign-up.",
    });
    assertEquals(githubOtp.allowed, true);
    assertEquals(githubOtp.isVerification, true);

    const normalMail = await scanInboundEmail({
      from: "alex@company.com",
      to: ["bot@theagentmail.net"],
      subject: "Re: Q4 roadmap notes",
      text: "Thanks for sending the summary! Let's catch up Tuesday afternoon.",
    });
    assertEquals(normalMail.allowed, true);
    assertEquals(normalMail.isVerification, false);
  },
});
