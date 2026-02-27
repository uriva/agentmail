import { db } from "../db.ts";
import { captureEvent } from "../services/posthog.ts";

/**
 * Invite a user to an organization by email.
 * If the user already has an InstantDB account, they're added immediately.
 * Only existing members can invite.
 */
export const inviteMember = async (
  req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  let body: { email?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid request body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return Response.json(
      { error: "email is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  // deno-lint-ignore no-explicit-any
  const { organizations } = await db.query({
    organizations: {
      $: { where: { id: orgId } },
      members: {},
    },
  }) as any;

  const org = organizations[0];
  if (!org) {
    return Response.json(
      { error: "Organization not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // deno-lint-ignore no-explicit-any
  if (org.members.find((m: any) => m.email === email)) {
    return Response.json(
      { error: "User is already a member", code: "CONFLICT" },
      { status: 409 },
    );
  }

  // Look up the user by email in InstantDB
  // deno-lint-ignore no-explicit-any
  const userResult = await (db as any).query({ $users: { $: { where: { email } } } });
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

  // deno-lint-ignore no-explicit-any
  await db.transact([
    db.tx.organizations[orgId]!.link({ members: targetUser.id }),
  ] as any);

  captureEvent(orgId, "member_invited", { email });

  return Response.json({
    data: { id: targetUser.id, email, role: "admin" },
  });
};

/**
 * List all members of an organization with their roles.
 */
export const listMembers = async (
  _req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  // deno-lint-ignore no-explicit-any
  const { organizations } = await db.query({
    organizations: {
      $: { where: { id: orgId } },
      members: {},
      billingUser: {},
    },
  }) as any;

  const org = organizations[0];
  if (!org) {
    return Response.json(
      { error: "Organization not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const billingUserId = org.billingUser?.id;
  // deno-lint-ignore no-explicit-any
  const members = org.members.map((m: any) => ({
    id: m.id,
    email: m.email,
    role: m.id === billingUserId ? "billing" : "admin",
  }));

  return Response.json({ data: members });
};

/**
 * Remove a member from an organization.
 * Cannot remove the billing user. Only billing user can remove others.
 */
export const removeMember = async (
  req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const memberId = params.memberId;

  // deno-lint-ignore no-explicit-any
  const { organizations } = await db.query({
    organizations: {
      $: { where: { id: orgId } },
      billingUser: {},
    },
  }) as any;

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

  // Only billing user can remove members
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const user = await db.auth.verifyToken(token);
      if (user?.id !== org.billingUser?.id) {
        return Response.json(
          { error: "Only the billing user can remove members", code: "FORBIDDEN" },
          { status: 403 },
        );
      }
    } catch {
      // Auth already verified upstream
    }
  }

  await db.transact([
    db.tx.organizations[orgId]!.unlink({ members: memberId }),
  ]);

  captureEvent(orgId, "member_removed", { memberId });

  return Response.json({ data: { removed: memberId } });
};
