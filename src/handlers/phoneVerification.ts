import { db } from "../db.ts";
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

const sendPhoneCode = async (req: Request): Promise<Response> => {
  const userId = await getUserIdFromToken(req);
  if (!userId) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { phone } = (await req.json()) as { phone?: string };
  if (!phone || phone.trim().length < 7) {
    return Response.json(
      { error: "Valid phone number is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const formattedPhone = phone.trim();

  // Ensure phone number is not already used by another verified account
  const { $users: existingUsers } = await db.query({
    $users: { $: { where: { phone: formattedPhone, phoneVerified: true } } },
  });
  if (existingUsers.some((u) => u.id !== userId)) {
    return Response.json(
      {
        error: "This phone number is already linked to another account",
        code: "PHONE_ALREADY_USED",
      },
      { status: 400 },
    );
  }

  await startTwilioVerification(formattedPhone);

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

  const { phone, code } = (await req.json()) as {
    phone?: string;
    code?: string;
  };
  if (!phone || !code) {
    return Response.json(
      { error: "Phone and verification code are required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const formattedPhone = phone.trim();

  // Ensure phone number is not already used by another verified account
  const { $users: existingUsers } = await db.query({
    $users: { $: { where: { phone: formattedPhone, phoneVerified: true } } },
  });
  if (existingUsers.some((u) => u.id !== userId)) {
    return Response.json(
      {
        error: "This phone number is already linked to another account",
        code: "PHONE_ALREADY_USED",
      },
      { status: 400 },
    );
  }

  const isApproved = await checkTwilioVerification(formattedPhone, code.trim());
  if (!isApproved) {
    return Response.json(
      { error: "Invalid or expired verification code", code: "INVALID_CODE" },
      { status: 400 },
    );
  }

  await db.transact([
    db.tx.$users[userId]!.update({
      phone: formattedPhone,
      phoneVerified: true,
    }),
  ]);

  return Response.json({
    data: { success: true, phoneVerified: true, phone: formattedPhone },
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
