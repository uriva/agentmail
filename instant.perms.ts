import type { InstantRules } from "@instantdb/admin";

const rules = {
  attrs: {
    allow: {
      // All mutations go through the admin SDK (server-side API).
      // Client-side writes are blocked by default.
      $default: "false",
    },
  },
  // Users can read data that belongs to their organizations.
  organizations: {
    allow: {
      view: "auth.id in data.ref('members.id')",
    },
  },
  accounts: {
    allow: {
      view: "auth.id in data.ref('organization.members.id')",
    },
  },
  apiKeys: {
    allow: {
      view: "auth.id in data.ref('organization.members.id')",
    },
  },
  karmaEvents: {
    allow: {
      view: "auth.id in data.ref('organization.members.id')",
    },
  },
  messages: {
    allow: {
      view: "auth.id in data.ref('account.organization.members.id')",
    },
  },
  attachments: {
    allow: {
      view: "auth.id in data.ref('message.account.organization.members.id')",
    },
  },
  webhookSubscriptions: {
    allow: {
      view: "auth.id in data.ref('account.organization.members.id')",
    },
  },
} satisfies InstantRules;

export default rules;
