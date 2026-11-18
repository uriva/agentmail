import { assert, assertEquals } from "@std/assert";
import { db, id } from "../src/db.ts";
import { handleRequest } from "../src/main.ts";
import { isTransientQueryError } from "../web/src/db.ts";

Deno.env.set("DENO_ENV", "test");

const sha256Hex = async (raw: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

Deno.test("GET /v1/accounts/usage returns accurate daily and 30-day send/receive counts per mailbox and enforces org auth", async () => {
  const orgId = id();
  const otherOrgId = id();
  const activeAccId = id();
  const stalePeriodAccId = id();
  const otherOrgAccId = id();
  const orgKeyRaw = `am_org_${id()}`;
  const scopedKeyRaw = `am_acc_${id()}`;
  const now = Date.now();
  const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;
  const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;

  await db.transact([
    db.tx.organizations[orgId]!.update({
      name: "Usage Org",
      createdAt: now,
      balance: 5,
      trialUsed: true,
    }),
    db.tx.organizations[otherOrgId]!.update({
      name: "Other Org",
      createdAt: now,
      balance: 5,
      trialUsed: true,
    }),
    db.tx.apiKeys[id()]!
      .update({
        keyHash: await sha256Hex(orgKeyRaw),
        prefix: "am_org_",
        name: "Org Key",
        createdAt: now,
      })
      .link({ organization: orgId }),
    db.tx.accounts[activeAccId]!
      .update({
        address: `active-${activeAccId}@theagentmail.net`,
        createdAt: now,
        sendsThisMonth: 14,
        sendPeriodStart: now - 2 * 24 * 60 * 60 * 1000,
      })
      .link({ organization: orgId }),
    db.tx.apiKeys[id()]!
      .update({
        keyHash: await sha256Hex(scopedKeyRaw),
        prefix: "am_acc_",
        name: "Scoped Key",
        createdAt: now,
      })
      .link({ organization: orgId, account: activeAccId }),
    db.tx.accounts[stalePeriodAccId]!
      .update({
        address: `stale-${stalePeriodAccId}@theagentmail.net`,
        createdAt: thirtyOneDaysAgo,
        sendsThisMonth: 42,
        sendPeriodStart: thirtyOneDaysAgo,
      })
      .link({ organization: orgId }),
    db.tx.accounts[otherOrgAccId]!
      .update({
        address: `other-${otherOrgAccId}@theagentmail.net`,
        createdAt: now,
        sendsThisMonth: 9,
        sendPeriodStart: now,
      })
      .link({ organization: otherOrgId }),
    db.tx.messages[id()]!
      .update({
        from: `active-${activeAccId}@theagentmail.net`,
        to: ["a@example.com", "b@example.com"],
        cc: ["c@example.com"],
        subject: "Multi recipient today",
        direction: "outbound",
        status: "sent",
        timestamp: now,
      })
      .link({ account: activeAccId }),
    db.tx.messages[id()]!
      .update({
        from: `active-${activeAccId}@theagentmail.net`,
        to: ["old@example.com"],
        subject: "Outbound 5 days ago",
        direction: "outbound",
        status: "sent",
        timestamp: fiveDaysAgo,
      })
      .link({ account: activeAccId }),
    db.tx.messages[id()]!
      .update({
        from: "sender@example.com",
        to: [`active-${activeAccId}@theagentmail.net`],
        subject: "Inbound today",
        direction: "inbound",
        status: "received",
        timestamp: now,
      })
      .link({ account: activeAccId }),
    db.tx.messages[id()]!
      .update({
        from: "sender@example.com",
        to: [`active-${activeAccId}@theagentmail.net`],
        subject: "Inbound 5 days ago",
        direction: "inbound",
        status: "received",
        timestamp: fiveDaysAgo,
      })
      .link({ account: activeAccId }),
    db.tx.messages[id()]!
      .update({
        from: "sender@example.com",
        to: [`active-${activeAccId}@theagentmail.net`],
        subject: "Inbound 31 days ago",
        direction: "inbound",
        status: "received",
        timestamp: thirtyOneDaysAgo,
      })
      .link({ account: activeAccId }),
    db.tx.messages[id()]!
      .update({
        from: "sender@example.com",
        to: [`other-${otherOrgAccId}@theagentmail.net`],
        subject: "Other org inbound",
        direction: "inbound",
        status: "received",
        timestamp: now,
      })
      .link({ account: otherOrgAccId }),
  ]);

  const unauthRes = await handleRequest(
    new Request("http://localhost/v1/accounts/usage"),
  );
  assertEquals(unauthRes.status, 401);

  const scopedRes = await handleRequest(
    new Request("http://localhost/v1/accounts/usage", {
      headers: { Authorization: `Bearer ${scopedKeyRaw}` },
    }),
  );
  assertEquals(scopedRes.status, 403);

  const okRes = await handleRequest(
    new Request("http://localhost/v1/accounts/usage", {
      headers: { Authorization: `Bearer ${orgKeyRaw}` },
    }),
  );
  assertEquals(okRes.status, 200);
  const body = await okRes.json();

  assertEquals(body.data[activeAccId], {
    sendsToday: 3,
    sendsThisMonth: 14,
    receivesToday: 1,
    receivesThisMonth: 2,
  });
  assertEquals(body.data[stalePeriodAccId], {
    sendsToday: 0,
    sendsThisMonth: 0,
    receivesToday: 0,
    receivesThisMonth: 0,
  });
  assertEquals(otherOrgAccId in body.data, false);
});

Deno.test("Dashboard handle-receive regression: AccountsList avoids joining messages in InstantDB useQuery and db.ts classifies handle-receive timeouts as transient", async () => {
  assertEquals(
    isTransientQueryError({ message: "Operation timed out: handle-receive" }),
    true,
  );
  assertEquals(
    isTransientQueryError(new Error("NetworkError when attempting to fetch")),
    true,
  );
  assertEquals(
    isTransientQueryError({ message: "Permission denied: not allowed" }),
    false,
  );
  assertEquals(isTransientQueryError(null), false);

  const dashboardCode = await Deno.readTextFile("web/src/dashboard.tsx");
  assertEquals(dashboardCode.includes("messages: {}"), false);
  assert(dashboardCode.includes("/v1/accounts/usage"));

  const messagesListCode = await Deno.readTextFile(
    "web/src/AccountMessagesList.tsx",
  );
  assert(messagesListCode.includes("fields:"));
});
