import { callDecisionModel } from "ai-utils";
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

const outboundQuestions = {
  email_classification: {
    type: "choice" as const,
    instructions:
      "Classify whether this outgoing email is legitimate or abusive/spam/phishing. Choose 'allow' for legitimate personal, transactional, notification, or genuine business communications. Choose 'block' for phishing, credential harvesting, scams, unsolicited mass spam/cold pitches, unauthorized vulnerability scans, or deceptive content.",
    criteria: {
      allow:
        "Legitimate email: standard business, personal, notification, or genuine correspondence.",
      block:
        "Abusive email: phishing, scam, credential harvesting, mass cold-sales spam, unsolicited commercial blast, or malicious outreach.",
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
  if (!Deno.env.get("JEV_API_KEY")) return { allowed: true };
  try {
    const answers = await callDecisionModel(
      {
        to: params.to,
        subject: params.subject,
        body: (params.text || params.html || params.subject || "").slice(0, 4000),
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
      captureEvent(orgId, "outbound_email_blocked_by_jev", {
        subject: params.subject,
        to: params.to,
      });
    }
    return result;
  } catch (err) {
    console.error("JEV scan failed, allowing email fallback:", err);
    return { allowed: true };
  }
};

const scanInboundEmail = async (
  params: InboundScanParams,
  orgId?: string,
): Promise<ScanResult> => {
  if (!Deno.env.get("JEV_API_KEY")) return { allowed: true };
  try {
    const answers = await callDecisionModel(
      {
        from: params.from,
        to: params.to,
        subject: params.subject,
        body: (params.text || params.html || params.subject || "").slice(0, 4000),
      },
      inboundQuestions,
    );
    const classification = answers.email_classification;
    const result = parseScanAnswer(
      classification && classification.type === "choice"
        ? classification.choice
        : undefined,
    );
    if (!result.allowed && orgId) {
      captureEvent(orgId, "inbound_email_blocked_by_jev", {
        from: params.from,
        subject: params.subject,
        to: params.to,
      });
    }
    return result;
  } catch (err) {
    console.error("JEV inbound scan failed, allowing email fallback:", err);
    return { allowed: true };
  }
};

export { scanInboundEmail, scanOutboundEmail };
export type { InboundScanParams, ScanParams, ScanResult };
