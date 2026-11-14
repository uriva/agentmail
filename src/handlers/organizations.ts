import { db, id } from "../db.ts";
import { isAllowedSignupEmail, withKeyedLock } from "../security.ts";
import { captureEvent } from "../services/posthog.ts";

const resolveUserId = async (req: Request): Promise<string | null> => {
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

export const createOrganization = async (
  req: Request,
  _params: Record<string, string>,
  _orgId: string,
): Promise<Response> => {
  const userId = await resolveUserId(req);
  if (!userId) {
    return Response.json(
      { error: "Invalid or missing authorization", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  return withKeyedLock(`create-org:${userId}`, async () => {
    const { $users: users } = await db.query({
      $users: { $: { where: { id: userId } } },
    });
    const userRecord = users[0];
    if (!userRecord || !isAllowedSignupEmail(userRecord.email ?? "")) {
      return Response.json(
        {
          error: "Please sign up with a supported personal email provider.",
          code: "EMAIL_PROVIDER_NOT_ALLOWED",
        },
        { status: 403 },
      );
    }

    if (!userRecord.phoneVerified) {
      return Response.json(
        {
          error: "Phone verification is required to create an organization.",
          code: "PHONE_VERIFICATION_REQUIRED",
        },
        { status: 403 },
      );
    }

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

    const body: { name?: string } = await req.json().catch(() => ({}));
    const name = (body.name?.trim() || "My Organization").slice(0, 100);
    const orgId = id();

    await db.transact([
      db.tx.organizations[orgId]!.update({
        name,
        createdAt: Date.now(),
      }),
      db.tx.organizations[orgId]!.link({ members: userId }),
      db.tx.organizations[orgId]!.link({ billingUser: userId }),
    ]);

    captureEvent(orgId, "organization_created", { userId, name });

    return Response.json({
      data: { id: orgId, name },
    });
  });
};

export const listOrganizations = async (
  req: Request,
  _params: Record<string, string>,
  _orgId: string,
): Promise<Response> => {
  const userId = await resolveUserId(req);
  if (!userId) {
    return Response.json(
      { error: "Invalid or missing authorization", code: "UNAUTHORIZED" },
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

export const renameOrganization = async (
  req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const body: { name?: string } | null = await req.json().catch(() => null);
  const name = body?.name?.trim().slice(0, 100);
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
