import { db } from "../db.ts";
import { emailDomain } from "../services/resend.ts";
import { captureEvent } from "../services/posthog.ts";

const maxMembersPerOrg = 20;

const verifyCallerUserId = async (req: Request): Promise<string | null> => {
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

export const inviteMember = async (
  req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const callerUserId = await verifyCallerUserId(req);
  if (!callerUserId) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const body: { email?: string } | null = await req.json().catch(() => null);
  if (!body) {
    return Response.json(
      { error: "Invalid request body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || email.endsWith(`@${emailDomain.toLowerCase()}`)) {
    return Response.json(
      { error: "Valid external email is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const { organizations } = await db.query({
    organizations: {
      $: { where: { id: orgId } },
      members: {},
      billingUser: {},
    },
  });

  const org = organizations[0];
  if (!org) {
    return Response.json(
      { error: "Organization not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (org.billingUser?.id !== callerUserId) {
    return Response.json(
      {
        error: "Only the billing user can add organization members",
        code: "FORBIDDEN",
      },
      { status: 403 },
    );
  }

  if ((org.members?.length ?? 0) >= maxMembersPerOrg) {
    return Response.json(
      { error: "Organization member limit reached", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  if (org.members.find((m) => m.email === email)) {
    return Response.json(
      { error: "User is already a member", code: "CONFLICT" },
      { status: 409 },
    );
  }

  const userResult = await db.query({
    $users: { $: { where: { email } } },
  });
  const targetUser = userResult?.$users?.[0];

  if (!targetUser) {
    return Response.json(
      {
        error: "No user found with that email. They need to sign up first.",
        code: "NOT_FOUND",
      },
      { status: 404 },
    );
  }

  await db.transact([
    db.tx.organizations[orgId]!.link({ members: targetUser.id }),
  ]);

  captureEvent(orgId, "member_invited", { email });

  return Response.json({
    data: { id: targetUser.id, email, role: "admin" },
  });
};

export const listMembers = async (
  _req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const { organizations } = await db.query({
    organizations: {
      $: { where: { id: orgId } },
      members: {},
      billingUser: {},
    },
  });

  const org = organizations[0];
  if (!org) {
    return Response.json(
      { error: "Organization not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const billingUserId = org.billingUser?.id;
  const members = org.members.map((m) => ({
    id: m.id,
    email: m.email,
    role: m.id === billingUserId ? "billing" : "admin",
  }));

  return Response.json({ data: members });
};

export const removeMember = async (
  req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const memberId = params.memberId;
  if (!memberId) {
    return Response.json(
      { error: "memberId is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const callerUserId = await verifyCallerUserId(req);
  if (!callerUserId) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { organizations } = await db.query({
    organizations: {
      $: { where: { id: orgId } },
      billingUser: {},
    },
  });

  const org = organizations[0];
  if (!org) {
    return Response.json(
      { error: "Organization not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (org.billingUser?.id === memberId) {
    return Response.json(
      { error: "Cannot remove the billing user", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  if (org.billingUser?.id !== callerUserId) {
    return Response.json(
      {
        error: "Only the billing user can remove members",
        code: "FORBIDDEN",
      },
      { status: 403 },
    );
  }

  await db.transact([
    db.tx.organizations[orgId]!.unlink({ members: memberId }),
  ]);

  captureEvent(orgId, "member_removed", { memberId });

  return Response.json({ data: { removed: memberId } });
};
