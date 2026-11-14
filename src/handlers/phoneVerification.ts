import { db } from "../db.ts";
import {
  checkSlidingWindowLimit,
  isAllowedSignupEmail,
  normalizeE164Phone,
} from "../security.ts";
import { captureEvent } from "../services/posthog.ts";
import {
  checkTwilioVerification,
  startTwilioVerification,
} from "../services/twilio.ts";

const getUserIdFromToken = async (req: Request): Promise<string | null> => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const user = await db.auth.verifyToken(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
};

const isPhoneUsedByAnotherUser = async (
  normalizedPhone: string,
  currentUserId: string,
): Promise<boolean> => {
  const { $users: verifiedUsers } = await db.query({
    $users: { $: { where: { phoneVerified: true } } },
  });
  return verifiedUsers.some(
    (u) =>
      u.id !== currentUserId &&
      typeof u.phone === "string" &&
      normalizeE164Phone(u.phone) === normalizedPhone,
  );
};

const sendPhoneCode = async (req: Request): Promise<Response> => {
  const userId = await getUserIdFromToken(req);
  if (!userId) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { $users: callerRows } = await db.query({
    $users: { $: { where: { id: userId } } },
  });
  const callerEmail = callerRows[0]?.email ?? "";
  if (!isAllowedSignupEmail(callerEmail)) {
    return Response.json(
      {
        error:
          "Please sign in with a supported personal email provider before verifying a phone number.",
        code: "EMAIL_PROVIDER_NOT_ALLOWED",
      },
      { status: 403 },
    );
  }

  if (
    !checkSlidingWindowLimit({
      key: `sms-send:${userId}`,
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
    })
  ) {
    return Response.json(
      {
        error: "Too many verification SMS requests. Please try again later.",
        code: "RATE_LIMITED",
      },
      { status: 429 },
    );
  }

  const { phone } = (await req.json()) as { phone?: string };
  const normalizedPhone = typeof phone === "string"
    ? normalizeE164Phone(phone)
    : null;
  if (!normalizedPhone) {
    return Response.json(
      {
        error: "Valid international phone number (E.164) is required",
        code: "BAD_REQUEST",
      },
      { status: 400 },
    );
  }

  if (await isPhoneUsedByAnotherUser(normalizedPhone, userId)) {
    return Response.json(
      {
        error: "This phone number is already linked to another account",
        code: "PHONE_ALREADY_USED",
      },
      { status: 400 },
    );
  }

  await startTwilioVerification(normalizedPhone);
  captureEvent(userId, "phone_code_sent", {});

  return Response.json({
    data: { success: true, message: "Verification code sent" },
  });
};

const verifyPhoneCode = async (req: Request): Promise<Response> => {
  const userId = await getUserIdFromToken(req);
  if (!userId) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (
    !checkSlidingWindowLimit({
      key: `sms-verify:${userId}`,
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
    })
  ) {
    return Response.json(
      {
        error: "Too many verification attempts. Please wait 15 minutes.",
        code: "RATE_LIMITED",
      },
      { status: 429 },
    );
  }

  const { phone, code } = (await req.json()) as {
    phone?: string;
    code?: string;
  };
  const normalizedPhone = typeof phone === "string"
    ? normalizeE164Phone(phone)
    : null;
  const trimmedCode = typeof code === "string" ? code.trim() : "";

  if (!normalizedPhone || !/^\d{4,10}$/.test(trimmedCode)) {
    return Response.json(
      {
        error: "Valid phone number and verification code are required",
        code: "BAD_REQUEST",
      },
      { status: 400 },
    );
  }

  if (await isPhoneUsedByAnotherUser(normalizedPhone, userId)) {
    return Response.json(
      {
        error: "This phone number is already linked to another account",
        code: "PHONE_ALREADY_USED",
      },
      { status: 400 },
    );
  }

  const isApproved = await checkTwilioVerification(
    normalizedPhone,
    trimmedCode,
  );
  if (!isApproved) {
    return Response.json(
      { error: "Invalid or expired verification code", code: "INVALID_CODE" },
      { status: 400 },
    );
  }

  await db.transact([
    db.tx.$users[userId]!.update({
      phone: normalizedPhone,
      phoneVerified: true,
    }),
  ]);

  captureEvent(userId, "phone_verified", {});

  return Response.json({
    data: { success: true, phoneVerified: true, phone: normalizedPhone },
  });
};

const getPhoneStatus = async (req: Request): Promise<Response> => {
  const userId = await getUserIdFromToken(req);
  if (!userId) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { $users: users } = await db.query({
    $users: { $: { where: { id: userId } } },
  });
  const user = users[0];

  return Response.json({
    data: {
      phone: user?.phone || null,
      phoneVerified: Boolean(user?.phoneVerified),
    },
  });
};

export { getPhoneStatus, sendPhoneCode, verifyPhoneCode };
