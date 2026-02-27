import { db, id } from "../db.ts";
import { recordKarmaEvent } from "../services/karma.ts";
import { captureEvent } from "../services/posthog.ts";

/**
 * Creates an organization for the authenticated user.
 * The userId is extracted from the user token by main.ts and passed
 * via a custom header since the handler signature uses orgId (which
 * doesn't exist yet for first-time users).
 *
 * This endpoint is special: it's the only userToken endpoint where
 * orgId may be empty (the user has no org yet).
 */
export const createOrganization = async (
  req: Request,
  _params: Record<string, string>,
  _orgId: string,
): Promise<Response> => {
  // We need the userId to link the org. Extract from the token again.
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

  // Check if user already has an org
  const { organizations: existing } = await db.query({
    organizations: { $: { where: { "members.id": userId } } },
  });
  if (existing.length > 0) {
    return Response.json({
      data: { id: existing[0].id, name: existing[0].name, alreadyExisted: true },
    });
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
  ]);

  // Seed with welcome karma (money_paid event as signup bonus)
  await recordKarmaEvent(orgId, "money_paid", {
    reason: "welcome_bonus",
    description: "Welcome to AgentMail! Here's 100 karma to get started.",
  });

  captureEvent(orgId, "organization_created", { userId, name });

  return Response.json({
    data: { id: orgId, name, alreadyExisted: false },
  });
};
