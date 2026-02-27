import { pipe, reduce } from "gamla";
import { db, id } from "../db.ts";
import type { KarmaEventType, KarmaBalance } from "../types.ts";
import { captureEvent } from "./posthog.ts";

const KARMA_AMOUNTS: Record<KarmaEventType, number> = {
  email_sent: -1,
  email_received: 2,
  account_created: -10,
  account_deleted: 5,
  money_paid: 100,
};

const sumAmounts = reduce(
  (acc: number, event: { amount: number }) => acc + event.amount,
  () => 0,
);

const getKarmaEvents = (orgId: string) =>
  db
    .query({ karmaEvents: { $: { where: { "organization.id": orgId } } } })
    .then(({ karmaEvents }) => karmaEvents);

const getBalance = (orgId: string): Promise<KarmaBalance> =>
  getKarmaEvents(orgId).then((events) => ({
    balance: sumAmounts(events) as number,
    events: events.map((e) => ({
      id: e.id,
      type: e.type as KarmaEventType,
      amount: e.amount,
      timestamp: e.timestamp,
      metadata: e.metadata as Record<string, unknown> | undefined,
    })),
  }));

const recordKarmaEvent = (
  orgId: string,
  type: KarmaEventType,
  metadata?: Record<string, unknown>,
): Promise<void> => {
  const eventId = id();
  const amount = KARMA_AMOUNTS[type];
  return db
    .transact([
      db.tx.karmaEvents[eventId]!.update({
        type,
        amount,
        timestamp: Date.now(),
        metadata: metadata ?? {},
      }),
      db.tx.karmaEvents[eventId]!.link({ organization: orgId }),
    ])
    .then(() => {
      captureEvent(orgId, "karma_event", { type, amount, metadata });
    });
};

const requireKarma =
  (minimumNeeded: number) =>
  (orgId: string): Promise<void> =>
    getBalance(orgId).then(({ balance }) => {
      if (balance < minimumNeeded) {
        throw { status: 402, error: "Insufficient karma", code: "KARMA_LOW" };
      }
    });

const requireKarmaForSend = requireKarma(1);
const requireKarmaForAccountCreation = requireKarma(10);

export {
  getBalance,
  recordKarmaEvent,
  requireKarmaForSend,
  requireKarmaForAccountCreation,
  KARMA_AMOUNTS,
};
