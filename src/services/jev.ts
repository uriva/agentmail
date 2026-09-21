import { captureEvent } from "./posthog.ts";

const jevApiUrl = "https://api.typesafe.ai/v1/systemone";
const jevApiKey = Deno.env.get("JEV_API_KEY");
const jevTimeoutMs = 3500;

type ScanParams = {
  readonly to: readonly string[];
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
};

type ScanResult = {
  readonly allowed: boolean;
  readonly reason?: string;
};

const buildPayload = ({ to, subject, text, html }: ScanParams) => ({
  model: "jev-latest",
  state: {
    to,
    subject,
    body: (text || html || subject || "").slice(0, 4000),
  },
  questions: {
    email_classification: {
      type: "choice",
      instructions:
        "Classify whether this outgoing email is legitimate or abusive/spam/phishing. Choose 'allow' for legitimate personal, transactional, notification, or genuine business communications. Choose 'block' for phishing, credential harvesting, scams, unsolicited mass spam/cold pitches, unauthorized vulnerability scans, or deceptive content.",
      criteria: {
        allow:
          "Legitimate email: standard business, personal, notification, or genuine correspondence.",
        block:
          "Abusive email: phishing, scam, credential harvesting, mass cold-sales spam, unsolicited commercial blast, or malicious outreach.",
      },
    },
  },
});

const parseJevResponse = (data: {
  answers?: { email_classification?: { choice?: string } };
}): ScanResult =>
  data.answers?.email_classification?.choice === "block"
    ? {
      allowed: false,
      reason: "Message rejected: content flagged as abusive, spam, or phishing",
    }
    : { allowed: true };

const scanOutboundEmail = (
  params: ScanParams,
  orgId?: string,
): Promise<ScanResult> =>
  jevApiKey
    ? fetch(jevApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jevApiKey}`,
      },
      body: JSON.stringify(buildPayload(params)),
      signal: AbortSignal.timeout(jevTimeoutMs),
    })
      .then((res) => (res.ok ? res.json() : { answers: {} }))
      .then(parseJevResponse)
      .then((result) => {
        if (!result.allowed && orgId) {
          captureEvent(orgId, "outbound_email_blocked_by_jev", {
            subject: params.subject,
            to: params.to,
          });
        }
        return result;
      })
      .catch((err) => {
        console.error("JEV scan failed, allowing email fallback:", err);
        return { allowed: true };
      })
    : Promise.resolve({ allowed: true });

export { scanOutboundEmail };
export type { ScanParams, ScanResult };
