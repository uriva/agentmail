const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_API_KEY_SID =
  Deno.env.get("TWILIO_API_KEY_SID") ?? TWILIO_ACCOUNT_SID;
const TWILIO_API_KEY_SECRET =
  Deno.env.get("TWILIO_API_KEY_SECRET") ?? TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SERVICE_SID =
  Deno.env.get("TWILIO_VERIFY_SERVICE_SID") ?? "";

const hasTwilioConfig = () =>
  Boolean(
    TWILIO_API_KEY_SID &&
      TWILIO_API_KEY_SECRET &&
      TWILIO_VERIFY_SERVICE_SID,
  );

const authHeader = () =>
  "Basic " + btoa(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`);

const formatPhone = (to: string): string =>
  to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;

const startTwilioVerification = async (to: string): Promise<boolean> => {
  const formattedTo = formatPhone(to);
  if (!hasTwilioConfig()) {
    console.log(`[Dev Phone Verify] Mock SMS sent to ${formattedTo}`);
    return true;
  }

  const url =
    `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`;
  const headers = new Headers({
    Authorization: authHeader(),
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
    const errText = await response.text();
    throw {
      status: 400,
      error: `SMS delivery failed: ${errText}`,
      code: "SMS_FAILED",
    };
  }

  return true;
};

const checkTwilioVerification = async (
  to: string,
  code: string,
): Promise<boolean> => {
  const formattedTo = formatPhone(to);
  if (!hasTwilioConfig()) {
    return code === "123456" || code.length === 6;
  }

  const url =
    `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`;
  const headers = new Headers({
    Authorization: authHeader(),
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
