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
import { handleInbound } from "../src/handlers/inbound.ts";
import { notifyQuotaExceeded } from "../src/services/quotaNotifier.ts";

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

  await t.step("Daily send limit enforcement for trial account", async () => {
    const trialOrgId = id();
    const trialAccountId = id();
    // deno-lint-ignore no-explicit-any
    const txOps: any[] = [
      db.tx.organizations[trialOrgId]!.update({
        name: "Trial Limits Org",
        createdAt: Date.now(),
        balance: 0,
        trialUsed: true,
        admin: false,
      }),
      db.tx.accounts[trialAccountId]!.update({
        address: `trial-${trialAccountId}@theagentmail.net`,
        displayName: "Trial Bot",
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        isFrozen: false,
        sendsThisMonth: 20,
        sendPeriodStart: Date.now(),
      }),
      db.tx.accounts[trialAccountId]!.link({ organization: trialOrgId }),
    ];

    // Seed 20 outbound messages today
    const msgIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const mId = id();
      msgIds.push(mId);
      txOps.push(
        db.tx.messages[mId]!.update({
          from: `trial-${trialAccountId}@theagentmail.net`,
          to: ["dest@example.com"],
          subject: `Msg ${i}`,
          direction: "outbound",
          status: "sent",
          timestamp: Date.now(),
        }),
        db.tx.messages[mId]!.link({ account: trialAccountId }),
      );
    }
    await db.transact(txOps);

    const req = new Request("http://localhost/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: ["someone@example.com"],
        subject: "Over daily limit",
        text: "Test",
      }),
    });

    const res = await sendMessage(req, { accountId: trialAccountId }, trialOrgId);
    assertEquals(res.status, 429);
    const json = await res.json();
    assertEquals(json.code, "DAILY_SEND_LIMIT_REACHED");

    // Clean up
    // deno-lint-ignore no-explicit-any
    const deleteOps: any[] = msgIds.map((mId) => db.tx.messages[mId]!.delete());
    deleteOps.push(
      db.tx.accounts[trialAccountId]!.delete(),
      db.tx.organizations[trialOrgId]!.delete(),
    );
    await db.transact(deleteOps);
  });

  await t.step("Inbound drops emails for frozen mailbox", async () => {
    const frozenAccountId = id();
    const frozenOrgId = id();
    await db.transact([
      db.tx.organizations[frozenOrgId]!.update({
        name: "Frozen Inbound Org",
        createdAt: Date.now(),
        balance: 0,
        trialUsed: true,
        admin: false,
      }),
      db.tx.accounts[frozenAccountId]!.update({
        address: `frozen-${frozenAccountId}@theagentmail.net`,
        createdAt: Date.now(),
        expiresAt: Date.now() - 1000,
        isFrozen: true,
      }),
      db.tx.accounts[frozenAccountId]!.link({ organization: frozenOrgId }),
    ]);

    const inboundReq = new Request("http://localhost/v1/inbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "sender@example.com",
        to: [`frozen-${frozenAccountId}@theagentmail.net`],
        subject: "Hello frozen account",
        text: "Should be dropped",
      }),
    });

    const inboundRes = await handleInbound(inboundReq, {}, frozenOrgId);
    assertEquals(inboundRes.status, 200);

    const { messages } = await db.query({
      messages: {
        $: { where: { "account.id": frozenAccountId } },
      },
    });
    assertEquals(messages.length, 0);

    await db.transact([
      db.tx.accounts[frozenAccountId]!.delete(),
      db.tx.organizations[frozenOrgId]!.delete(),
    ]);
  });

  await t.step("Inbound daily limit drops emails when exceeded", async () => {
    const cappedAccountId = id();
    const cappedOrgId = id();
    // deno-lint-ignore no-explicit-any
    const txOps: any[] = [
      db.tx.organizations[cappedOrgId]!.update({
        name: "Capped Inbound Org",
        createdAt: Date.now(),
        balance: 0,
        trialUsed: true,
        admin: false,
      }),
      db.tx.accounts[cappedAccountId]!.update({
        address: `capped-${cappedAccountId}@theagentmail.net`,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        isFrozen: false,
      }),
      db.tx.accounts[cappedAccountId]!.link({ organization: cappedOrgId }),
    ];

    // Seed 50 inbound messages today
    const msgIds: string[] = [];
    for (let i = 0; i < 50; i++) {
      const mId = id();
      msgIds.push(mId);
      txOps.push(
        db.tx.messages[mId]!.update({
          from: "sender@example.com",
          to: [`capped-${cappedAccountId}@theagentmail.net`],
          subject: `Inbound Msg ${i}`,
          direction: "inbound",
          status: "received",
          timestamp: Date.now(),
        }),
        db.tx.messages[mId]!.link({ account: cappedAccountId }),
      );
    }
    await db.transact(txOps);

    const inboundReq = new Request("http://localhost/v1/inbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "sender@example.com",
        to: [`capped-${cappedAccountId}@theagentmail.net`],
        subject: "Hello capped account",
        text: "Should be dropped due to daily limit",
      }),
    });

    const inboundRes = await handleInbound(inboundReq, {}, cappedOrgId);
    assertEquals(inboundRes.status, 200);

    // Should only have the initial 50 messages, the 51st was dropped
    const { messages } = await db.query({
      messages: {
        $: { where: { "account.id": cappedAccountId } },
      },
    });
    assertEquals(messages.length, 50);

    // deno-lint-ignore no-explicit-any
    const deleteOps: any[] = msgIds.map((mId) => db.tx.messages[mId]!.delete());
    deleteOps.push(
      db.tx.accounts[cappedAccountId]!.delete(),
      db.tx.organizations[cappedOrgId]!.delete(),
    );
    await db.transact(deleteOps);
  });

  await t.step("Quota notification sends at most 1 email per period", async () => {
    const notifyOrgId = id();
    const notifyAccountId = id();
    await db.transact([
      db.tx.organizations[notifyOrgId]!.update({
        name: "Notify Org",
        createdAt: Date.now(),
        balance: 0,
        trialUsed: true,
      }),
    ]);

    const first = await notifyQuotaExceeded({
      orgId: notifyOrgId,
      accountAddress: `notify-${notifyAccountId}@theagentmail.net`,
      accountId: notifyAccountId,
      quotaType: "daily_receive",
      limit: 50,
      billingEmail: "delivered@resend.dev",
      isPaying: false,
    });
    assertEquals(first, true);

    const second = await notifyQuotaExceeded({
      orgId: notifyOrgId,
      accountAddress: `notify-${notifyAccountId}@theagentmail.net`,
      accountId: notifyAccountId,
      quotaType: "daily_receive",
      limit: 50,
      billingEmail: "delivered@resend.dev",
      isPaying: false,
    });
    assertEquals(second, false);

    const { karmaEvents } = await db.query({
      karmaEvents: {
        $: { where: { "organization.id": notifyOrgId } },
      },
    });
    // deno-lint-ignore no-explicit-any
    const deleteOps: any[] = karmaEvents.map((e) => db.tx.karmaEvents[e.id]!.delete());
    deleteOps.push(db.tx.organizations[notifyOrgId]!.delete());
    await db.transact(deleteOps);
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
