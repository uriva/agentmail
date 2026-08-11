import { db, id } from "../db.ts";
import { recordKarmaEvent } from "../services/karma.ts";
import { captureEvent } from "../services/posthog.ts";

/**
 * Creates a new organization for the authenticated user.
 * The user becomes both the billing user and a member.
 * Limited to 1 org per user by default. Email support for more.
 */
export const createOrganization = async (
  req: Request,
  _params: Record<string, string>,
  _orgId: string,
): Promise<Response> => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json(
      { error: "Missing authorization", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const token = authHeader.slice(7);
  let userId: string;
  try {
    const user = await db.auth.verifyToken(token);
    if (!user?.id) throw new Error("No user");
    userId = user.id;
  } catch {
    return Response.json(
      { error: "Invalid token", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  // Check if user already owns an org (billing user)
  const { organizations: existing } = await db.query({
    organizations: { $: { where: { "billingUser.id": userId } } },
  });
  if (existing.length > 0) {
    return Response.json(
      {
        error:
          "You already have an organization. To create additional organizations, email support@theagentmail.net",
        code: "FORBIDDEN",
      },
      { status: 403 },
    );
  }

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine, we'll use a default name
  }

  const name = body.name?.trim() || "My Organization";
  const orgId = id();

  await db.transact([
    db.tx.organizations[orgId]!.update({
      name,
      createdAt: Date.now(),
    }),
    db.tx.organizations[orgId]!.link({ members: userId }),
    db.tx.organizations[orgId]!.link({ billingUser: userId }),
  ]);

  // Seed with welcome karma (10 karma welcome bonus)
  const welcomeEventId = id();
  await db.transact([
    db.tx.karmaEvents[welcomeEventId]!.update({
      type: "money_paid",
      amount: 10,
      timestamp: Date.now(),
      metadata: {
        reason: "welcome_bonus",
        description: "Welcome to AgentMail! Here is 10 welcome karma.",
      },
    }),
    db.tx.karmaEvents[welcomeEventId]!.link({ organization: orgId }),
  ]);

  captureEvent(orgId, "organization_created", { userId, name });

  return Response.json({
    data: { id: orgId, name },
  });
};

/**
 * Lists organizations the authenticated user belongs to.
 */
export const listOrganizations = async (
  req: Request,
  _params: Record<string, string>,
  _orgId: string,
): Promise<Response> => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json(
      { error: "Missing authorization", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const token = authHeader.slice(7);
  let userId: string;
  try {
    const user = await db.auth.verifyToken(token);
    if (!user?.id) throw new Error("No user");
    userId = user.id;
  } catch {
    return Response.json(
      { error: "Invalid token", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { organizations } = await db.query({
    organizations: {
      $: { where: { "members.id": userId } },
      billingUser: {},
    },
  });

  return Response.json({
    data: organizations.map((org) => ({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      isBilling: org.billingUser?.id === userId,
    })),
  });
};

/**
 * Rename an organization. Any member can rename.
 * orgId comes from X-Org-Id header via auth.
 */
export const renameOrganization = async (
  req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid request body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const name = body.name?.trim();
  if (!name) {
    return Response.json(
      { error: "name is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  await db.transact([
    db.tx.organizations[orgId]!.update({ name }),
  ]);

  return Response.json({ data: { id: orgId, name } });
};
