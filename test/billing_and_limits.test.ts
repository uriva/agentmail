import { assertEquals, assertRejects } from "jsr:@std/assert";
import { db, id } from "../src/db.ts";
import { runBillingRenewalCheck } from "../src/services/billingCron.ts";
import { createAccount } from "../src/handlers/accounts.ts";
import { sendMessage } from "../src/handlers/messages.ts";
import {
  handleLookupMailbox,
  handleLookupUser,
  handleSupportPrompt,
} from "../src/handlers/supportBot.ts";

Deno.env.set("DENO_ENV", "test");

Deno.test("Billing & account expiration flow", async (t) => {
  const testUserId = id();
  const testOrgId = id();
  const testAccountId = id();

  // Setup test user and organization
  await db.transact([
    db.tx.$users[testUserId]!.update({
      email: `test-${testUserId}@example.com`,
      phoneVerified: false,
    }),
    db.tx.organizations[testOrgId]!.update({
      name: "Test Billing Org",
      createdAt: Date.now(),
      balance: 0,
      trialUsed: false,
      admin: false,
    }),
    db.tx.organizations[testOrgId]!.link({
      billingUser: testUserId,
      members: testUserId,
    }),
  ]);

  await t.step("Account creation rejects unverified phone for free trial", async () => {
    const req = new Request("http://localhost/v1/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: `bot-${testUserId}` }),
    });

    const res = await createAccount(req, {}, testOrgId);
    assertEquals(res.status, 403);
    const json = await res.json();
    assertEquals(json.code, "PHONE_VERIFICATION_REQUIRED");
  });

  await t.step("Non-admin cannot create reserved address", async () => {
    const req = new Request("http://localhost/v1/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: `support-${testUserId}` }),
    });

    const res = await createAccount(req, {}, testOrgId);
    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.code, "RESERVED_ADDRESS");
  });

  await t.step("Admin can create reserved address", async () => {
    await db.transact([
      db.tx.organizations[testOrgId]!.update({ admin: true }),
    ]);

    const req = new Request("http://localhost/v1/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: `support-test-${testUserId}` }),
    });

    const res = await createAccount(req, {}, testOrgId);
    assertEquals(res.status, 201);
    const json = await res.json();
    assertEquals(json.data.address, `support-test-${testUserId}@theagentmail.net`);

    // Reset admin status for subsequent tests
    await db.transact([
      db.tx.organizations[testOrgId]!.update({ admin: false }),
    ]);
  });

  await t.step("Account creation succeeds once phone is verified", async () => {
    await db.transact([
      db.tx.$users[testUserId]!.update({ phoneVerified: true }),
    ]);

    const req = new Request("http://localhost/v1/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: `bot-${testUserId}` }),
    });

    const res = await createAccount(req, {}, testOrgId);
    assertEquals(res.status, 201);
    const json = await res.json();
    assertEquals(json.data.address, `bot-${testUserId}@theagentmail.net`);
    assertEquals(Boolean(json.data.expiresAt), true);

    const { organizations } = await db.query({
      organizations: { $: { where: { id: testOrgId } } },
    });
    assertEquals(organizations[0].trialUsed, true);
  });

  await t.step("Second account creation requires $1 balance", async () => {
    const req = new Request("http://localhost/v1/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: `bot2-${testUserId}` }),
    });

    const res = await createAccount(req, {}, testOrgId);
    assertEquals(res.status, 402);
    const json = await res.json();
    assertEquals(json.code, "INSUFFICIENT_BALANCE");
  });

  await t.step("Renewal cron freezes expired mailbox when balance is 0", async () => {
    const expiredTimestamp = Date.now() - 1000;
    await db.transact([
      db.tx.accounts[testAccountId]!.update({
        address: `test-${testAccountId}@theagentmail.net`,
        displayName: "Expired Bot",
        createdAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
        expiresAt: expiredTimestamp,
        isFrozen: false,
        sendsThisMonth: 10,
        sendPeriodStart: Date.now() - 31 * 24 * 60 * 60 * 1000,
      }),
      db.tx.accounts[testAccountId]!.link({ organization: testOrgId }),
    ]);

    // Run cron
    await runBillingRenewalCheck();

    const { accounts } = await db.query({
      accounts: { $: { where: { id: testAccountId } } },
    });
    assertEquals(accounts[0].isFrozen, true);
  });

  await t.step("Frozen account cannot send emails", async () => {
    const req = new Request("http://localhost/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: ["someone@example.com"],
        subject: "Hello",
        text: "Test body",
      }),
    });

    const res = await sendMessage(req, { accountId: testAccountId }, testOrgId);
    assertEquals(res.status, 402);
    const json = await res.json();
    assertEquals(json.code, "ACCOUNT_EXPIRED");
  });

  await t.step("Renewal cron renews mailbox when organization has balance", async () => {
    // Add $5 to org balance
    await db.transact([
      db.tx.organizations[testOrgId]!.update({ balance: 5 }),
    ]);

    // Run cron
    await runBillingRenewalCheck();

    const { accounts, organizations } = await db.query({
      accounts: { $: { where: { id: testAccountId } } },
      organizations: { $: { where: { id: testOrgId } } },
    });

    assertEquals(organizations[0].balance, 4); // Deducted $1
    assertEquals(accounts[0].isFrozen, false); // Unfrozen
    assertEquals(accounts[0].sendsThisMonth, 0); // Reset sends
    assertEquals(accounts[0].expiresAt! > Date.now(), true); // Extended
  });

  await t.step("Support bot prompt returns dynamic prompt text", async () => {
    const req = new Request("http://localhost/v1/support/prompt", {
      method: "GET",
    });
    const res = await handleSupportPrompt(req);
    assertEquals(res.status, 200);
    const text = await res.text();
    assertEquals(text.includes("support@theagentmail.net"), true);
  });

  await t.step("Support bot tools lookup user and mailbox information", async () => {
    // Test lookup_user
    const userReq = new Request("http://localhost/v1/support/tools/lookup-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          params: { email: `test-${testUserId}@example.com` },
        },
      }),
    });
    const userRes = await handleLookupUser(userReq);
    assertEquals(userRes.status, 200);
    const userData = await userRes.json();
    assertEquals(userData.found, true);
    assertEquals(userData.organization.balanceDollars, 4);

    // Test lookup_mailbox
    const boxReq = new Request("http://localhost/v1/support/tools/lookup-mailbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          params: { address: `bot-${testUserId}@theagentmail.net` },
        },
      }),
    });
    const boxRes = await handleLookupMailbox(boxReq);
    assertEquals(boxRes.status, 200);
    const boxData = await boxRes.json();
    assertEquals(boxData.found, true);
    assertEquals(boxData.isFrozen, false);
  });

  // Cleanup test entities
  const { accounts: orgAccounts } = await db.query({
    accounts: { $: { where: { "organization.id": testOrgId } } },
  });
  // deno-lint-ignore no-explicit-any
  const deleteOps: any[] = orgAccounts.map((a) => db.tx.accounts[a.id]!.delete());
  deleteOps.push(db.tx.organizations[testOrgId]!.delete());
  deleteOps.push(db.tx.$users[testUserId]!.delete());
  await db.transact(deleteOps);
});
