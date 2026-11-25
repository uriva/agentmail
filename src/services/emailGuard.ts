import { callDecisionModel, isDecisionModelAvailable } from "@uriv/chaff";
import { captureEvent } from "./posthog.ts";

type ScanParams = {
  readonly to: readonly string[];
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
};

type InboundScanParams = {
  readonly from: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
};

type ScanResult = {
  readonly allowed: boolean;
  readonly reason?: string;
};

type InboundScanResult = ScanResult & {
  readonly isVerification: boolean;
};

const verificationPatterns: readonly RegExp[] = [
  /\b(verification|verify|confirm|confirmation|activation|activate)\b.{0,30}\b(code|email|account|address|link)\b/i,
  /\b(code|link)\b.{0,20}\b(verify|confirm|activate|sign[- ]?in|log[- ]?in|reset)\b/i,
  /\b(one[- ]?time|otp|2fa|two[- ]?factor|passcode|magic[- ]?link|security code|login code|sign[- ]?in code|reset your password|confirm your sign[- ]?up)\b/i,
  /\bactivate your\b.{0,40}\baccount\b/i,
  /\b(verify|confirm) your\b.{0,40}\b(email|account|address)\b/i,
];

const isLikelyVerificationEmail = ({
  subject,
  text,
  html,
}: Pick<InboundScanParams, "subject" | "text" | "html">): boolean => {
  const haystack = `${subject}\n${text ?? ""}\n${html ?? ""}`;
  return verificationPatterns.some((pattern) => pattern.test(haystack));
};

const outboundQuestions = {
  email_classification: {
    type: "choice" as const,
    instructions:
      "Classify whether this outgoing email is legitimate correspondence or abusive spam/phishing. Choose 'allow' for legitimate personal, transactional, notification, customer support, or individualized 1:1 business/technical correspondence (including respectful, context-specific B2B or developer outreach that engages with the recipient's specific work, issue, or company). Choose 'block' for phishing, credential harvesting, scams, malware, extortion, deceptive impersonation, generic untargeted mass-spam blasts, or unauthorized vulnerability scans.",
    criteria: {
      allow:
        "Legitimate email: personal, transactional, notification, support, or genuine individualized business/technical correspondence (even if introducing a relevant product or service).",
      block:
        "Abusive email: phishing, scam, credential harvesting, deceptive impersonation, generic untargeted bulk spam blast, extortion, or malicious content.",
    },
  },
};

const inboundQuestions = {
  email_classification: {
    type: "choice" as const,
    instructions:
      "Classify whether this incoming email is legitimate or abusive spam/phishing. Choose 'allow' for legitimate personal, transactional, notification, service, verification code, newsletter, or genuine correspondence. Choose 'block' for phishing, malicious content, scams, extortion, credential harvesting, or mass unsolicited commercial spam.",
    criteria: {
      allow:
        "Legitimate email: standard business, personal, notification, verification code, newsletter, or genuine correspondence.",
      block:
        "Abusive spam or phishing: scams, extortion, credential theft, malware/phishing links, or mass cold-spam blasts.",
    },
  },
  verification_or_signup: {
    type: "choice" as const,
    instructions:
      "Classify whether this incoming email is an account verification, activation, sign-up confirmation, magic login link, one-time passcode (OTP), or password reset email from a third-party service. Choose 'yes' if the email contains a verification/OTP/2FA code, sign-up or account activation link, email confirmation link, magic sign-in link, or password reset code/link. Choose 'no' for regular human correspondence, receipts, alerts, newsletters, or general notifications without a verification/activation code or link.",
    criteria: {
      yes:
        "Account signup confirmation, account activation link, email verification, OTP/2FA/passcode, magic sign-in link, or password reset email.",
      no:
        "Regular conversation, support thread, alert, receipt, newsletter, or notification without a signup/verification code or link.",
    },
  },
};

const sampleBoundedText = (raw: string, maxChars: number): string =>
  raw.length <= maxChars
    ? raw
    : `${raw.slice(0, Math.floor(maxChars * 0.6))}\n...\n${
      raw.slice(-Math.floor(maxChars * 0.4))
    }`;

const combineScanBody = ({
  subject,
  text,
  html,
}: {
  subject: string;
  text?: string;
  html?: string;
}): string => {
  const parts = [
    text ? `TEXT:\n${sampleBoundedText(text, 4000)}` : "",
    html ? `HTML:\n${sampleBoundedText(html, 4000)}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : subject.slice(0, 1000);
};

const parseScanAnswer = (choice?: string): ScanResult =>
  choice === "block"
    ? {
      allowed: false,
      reason: "Message rejected: content flagged as abusive, spam, or phishing",
    }
    : { allowed: true };

const scanOutboundEmail = async (
  params: ScanParams,
  orgId?: string,
): Promise<ScanResult> => {
  if (!isDecisionModelAvailable()) {
    return { allowed: true };
  }
  try {
    const answers = await callDecisionModel(
      {
        to: params.to,
        subject: params.subject,
        body: combineScanBody(params),
      },
      outboundQuestions,
    );
    const classification = answers.email_classification;
    const result = parseScanAnswer(
      classification && classification.type === "choice"
        ? classification.choice
        : undefined,
    );
    if (!result.allowed && orgId) {
      captureEvent(orgId, "outbound_email_blocked", {
        reason: "spam_or_phishing",
        recipientCount: params.to.length,
      });
    }
    return result;
  } catch (err) {
    console.error("Outbound email guard failed:", err);
    return Deno.env.get("DENO_ENV") === "test" ? { allowed: true } : {
      allowed: false,
      reason: "Temporary content safety check failure; please retry shortly",
    };
  }
};

const scanInboundEmail = async (
  params: InboundScanParams,
  orgId?: string,
): Promise<InboundScanResult> => {
  if (!isDecisionModelAvailable()) {
    return { allowed: true, isVerification: isLikelyVerificationEmail(params) };
  }
  try {
    const answers = await callDecisionModel(
      {
        from: params.from,
        to: params.to,
        subject: params.subject,
        body: combineScanBody(params),
      },
      inboundQuestions,
    );
    const classification = answers.email_classification;
    const verification = answers.verification_or_signup;
    const result = parseScanAnswer(
      classification && classification.type === "choice"
        ? classification.choice
        : undefined,
    );
    const isVerification = verification?.type === "choice"
      ? verification.choice === "yes"
      : isLikelyVerificationEmail(params);
    if (!result.allowed && orgId) {
      captureEvent(orgId, "inbound_email_blocked", {
        reason: "spam_or_phishing",
        isVerification,
        recipientCount: params.to.length,
      });
    }
    return { ...result, isVerification };
  } catch (err) {
    console.error("Inbound email guard failed, allowing email fallback:", err);
    return { allowed: true, isVerification: isLikelyVerificationEmail(params) };
  }
};

export {
  combineScanBody,
  isLikelyVerificationEmail,
  scanInboundEmail,
  scanOutboundEmail,
};
export type { InboundScanParams, InboundScanResult, ScanParams, ScanResult };
