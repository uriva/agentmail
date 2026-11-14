import { normalizeE164Phone } from "../security.ts";

const readTwilioConfig = () => {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const apiKeySid = Deno.env.get("TWILIO_API_KEY_SID") || accountSid;
  const apiKeySecret = Deno.env.get("TWILIO_API_KEY_SECRET") || authToken;
  const verifyServiceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID") ?? "";
  return {
    apiKeySid,
    apiKeySecret,
    verifyServiceSid,
    configured: Boolean(apiKeySid && apiKeySecret && verifyServiceSid),
  };
};

const isDevOrTestEnv = (): boolean => {
  const env = Deno.env.get("DENO_ENV");
  return env === "development" || env === "test";
};

const startTwilioVerification = async (to: string): Promise<boolean> => {
  const formattedTo = normalizeE164Phone(to);
  if (!formattedTo) {
    throw {
      status: 400,
      error: "Invalid phone number format",
      code: "BAD_REQUEST",
    };
  }

  const cfg = readTwilioConfig();
  if (!cfg.configured) {
    if (isDevOrTestEnv()) {
      return true;
    }
    throw {
      status: 503,
      error: "Phone verification service is temporarily unavailable",
      code: "SMS_UNAVAILABLE",
    };
  }

  const url =
    `https://verify.twilio.com/v2/Services/${cfg.verifyServiceSid}/Verifications`;
  const headers = new Headers({
    Authorization: "Basic " + btoa(`${cfg.apiKeySid}:${cfg.apiKeySecret}`),
    "Content-Type": "application/x-www-form-urlencoded",
  });

  const body = new URLSearchParams({
    To: formattedTo,
    Channel: "sms",
  });

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    throw {
      status: 400,
      error: "SMS delivery failed. Please verify the phone number.",
      code: "SMS_FAILED",
    };
  }

  return true;
};

const checkTwilioVerification = async (
  to: string,
  code: string,
): Promise<boolean> => {
  const formattedTo = normalizeE164Phone(to);
  if (!formattedTo) return false;

  const cfg = readTwilioConfig();
  if (!cfg.configured) {
    return isDevOrTestEnv() && code === "123456";
  }

  const url =
    `https://verify.twilio.com/v2/Services/${cfg.verifyServiceSid}/VerificationCheck`;
  const headers = new Headers({
    Authorization: "Basic " + btoa(`${cfg.apiKeySid}:${cfg.apiKeySecret}`),
    "Content-Type": "application/x-www-form-urlencoded",
  });

  const body = new URLSearchParams({
    To: formattedTo,
    Code: code,
  });

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as { status?: string };
  return result?.status === "approved";
};

export { checkTwilioVerification, startTwilioVerification };
