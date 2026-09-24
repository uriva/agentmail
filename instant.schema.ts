import { i } from "@instantdb/admin";

const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed(),
      phone: i.string().optional().indexed(),
      phoneVerified: i.boolean().optional(),
    }),
    organizations: i.entity({
      name: i.string(),
      createdAt: i.number().indexed(),
      admin: i.boolean().optional(),
      balance: i.number().optional(),
      trialUsed: i.boolean().optional(),
      processedCheckoutSessions: i.json().optional(),
    }),
    apiKeys: i.entity({
      keyHash: i.string().unique(),
      prefix: i.string(),
      name: i.string(),
      createdAt: i.number().indexed(),
      lastUsedAt: i.number().optional(),
    }),
    accounts: i.entity({
      address: i.string().unique().indexed(),
      displayName: i.string().optional(),
      createdAt: i.number().indexed(),
      expiresAt: i.number().optional().indexed(),
      isFrozen: i.boolean().optional(),
      sendsThisMonth: i.number().optional(),
      sendPeriodStart: i.number().optional(),
      warningEmailSentAt: i.number().optional(),
    }),
    messages: i.entity({
      from: i.string().indexed(),
      to: i.json(),
      cc: i.json().optional(),
      bcc: i.json().optional(),
      subject: i.string(),
      bodyText: i.string().optional(),
      bodyHtml: i.string().optional(),
      direction: i.string().indexed(),
      status: i.string().indexed(),
      headers: i.json().optional(),
      timestamp: i.number().indexed(),
      externalId: i.string().optional(),
      inReplyTo: i.string().optional(),
      references: i.string().optional(),
    }),
    attachments: i.entity({
      filename: i.string(),
      contentType: i.string(),
      size: i.number(),
      storageKey: i.string(),
      createdAt: i.number().indexed(),
    }),
    karmaEvents: i.entity({
      type: i.string().indexed(),
      amount: i.number(),
      timestamp: i.number().indexed(),
      metadata: i.json().optional(),
    }),
    webhookSubscriptions: i.entity({
      url: i.string(),
      secret: i.string(),
      active: i.boolean(),
      createdAt: i.number().indexed(),
    }),
  },
  links: {
    orgAccounts: {
      forward: {
        on: "accounts",
        has: "one",
        label: "organization",
        onDelete: "cascade",
      },
      reverse: { on: "organizations", has: "many", label: "accounts" },
    },
    orgApiKeys: {
      forward: {
        on: "apiKeys",
        has: "one",
        label: "organization",
        onDelete: "cascade",
      },
      reverse: { on: "organizations", has: "many", label: "apiKeys" },
    },
    orgKarmaEvents: {
      forward: {
        on: "karmaEvents",
        has: "one",
        label: "organization",
        onDelete: "cascade",
      },
      reverse: { on: "organizations", has: "many", label: "karmaEvents" },
    },
    accountMessages: {
      forward: {
        on: "messages",
        has: "one",
        label: "account",
        onDelete: "cascade",
      },
      reverse: { on: "accounts", has: "many", label: "messages" },
    },
    messageAttachments: {
      forward: {
        on: "attachments",
        has: "one",
        label: "message",
        onDelete: "cascade",
      },
      reverse: { on: "messages", has: "many", label: "attachments" },
    },
    apiKeyAccount: {
      forward: {
        on: "apiKeys",
        has: "one",
        label: "account",
        onDelete: "cascade",
      },
      reverse: { on: "accounts", has: "many", label: "apiKeys" },
    },
    accountWebhooks: {
      forward: {
        on: "webhookSubscriptions",
        has: "one",
        label: "account",
        onDelete: "cascade",
      },
      reverse: { on: "accounts", has: "many", label: "webhooks" },
    },
    userOrganizations: {
      forward: {
        on: "$users",
        has: "many",
        label: "organizations",
      },
      reverse: { on: "organizations", has: "many", label: "members" },
    },
    orgBilling: {
      forward: {
        on: "organizations",
        has: "one",
        label: "billingUser",
      },
      reverse: { on: "$users", has: "many", label: "billingOrgs" },
    },
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
