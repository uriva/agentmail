import type { KarmaEventType } from "./types.ts";

const KARMA_AMOUNTS: Record<KarmaEventType, number> = {
  email_sent: -1,
  email_received: 2,
  account_created: -10,
  account_deleted: 5,
  money_paid: 100,
};

const INITIAL_KARMA = KARMA_AMOUNTS.money_paid;

const formatKarma = (amount: number): string =>
  amount > 0 ? `+${amount}` : `${amount}`;

export { formatKarma, INITIAL_KARMA, KARMA_AMOUNTS };
