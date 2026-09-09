import { pipe, reduce } from "gamla";
import { db, id } from "../db.ts";
import type { KarmaBalance, KarmaEventType } from "../types.ts";
import { captureEvent } from "./posthog.ts";
import { KARMA_AMOUNTS } from "../karma-constants.ts";

const sumAmounts = reduce(
  (acc: number, event: { amount: number }) => acc + event.amount,
  () => 0,
);

const getKarmaEvents = (orgId: string) =>
  db
    .query({ karmaEvents: { $: { where: { "organization.id": orgId } } } })
    .then(({ karmaEvents }) => karmaEvents);

const isOrgAdmin = (orgId: string): Promise<boolean> =>
  db
    .query({ organizations: { $: { where: { id: orgId } } } })
    .then(({ organizations }) => Boolean(organizations[0]?.admin));

const getBalance = (orgId: string): Promise<KarmaBalance> =>
  Promise.all([getKarmaEvents(orgId), isOrgAdmin(orgId)]).then(
    ([events, isAdmin]) => {
      const calculated = sumAmounts(events) as number;
      return {
        balance: isAdmin ? (calculated > 100 ? calculated : 100) : calculated,
        events: events.map((e) => ({
          id: e.id,
          type: e.type as KarmaEventType,
          amount: e.amount,
          timestamp: e.timestamp,
          metadata: e.metadata as Record<string, unknown> | undefined,
        })),
      };
    },
  );

const recordKarmaEvent = (
  orgId: string,
  type: KarmaEventType,
  metadata?: Record<string, unknown>,
): Promise<void> =>
  isOrgAdmin(orgId).then((isAdmin) => {
    const eventId = id();
    const amount = isAdmin ? 0 : KARMA_AMOUNTS[type];
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
  });

const requireKarma =
  (minimumNeeded: number) => (orgId: string): Promise<void> =>
    isOrgAdmin(orgId).then((isAdmin) =>
      isAdmin ? undefined : getBalance(orgId).then(({ balance }) => {
        if (balance < minimumNeeded) {
          throw { status: 402, error: "Insufficient karma", code: "KARMA_LOW" };
        }
      })
    );

const requireKarmaForSend = requireKarma(1);
const requireKarmaForAccountCreation = requireKarma(10);

export {
  getBalance,
  recordKarmaEvent,
  requireKarmaForAccountCreation,
  requireKarmaForSend,
};
