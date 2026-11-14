import type { InstantRules } from "@instantdb/admin";
import type { AppSchema } from "./instant.schema.ts";

const readOnlyOrgMemberAllow = {
  view: "auth.id != null && auth.id in data.ref('organization.members.id')",
  create: "false",
  update: "false",
  delete: "false",
} as const;

const rules = {
  $default: {
    allow: {
      $default: "false",
    },
  },
  attrs: {
    allow: {
      $default: "false",
      create: "false",
    },
  },
  $users: {
    allow: {
      view:
        "auth.id != null && (auth.id == data.id || auth.id in data.ref('organizations.members.id'))",
      create: "data.email != null && !data.email.endsWith('@theagentmail.net')",
      update: "false",
    },
    fields: {
      phone: "auth.id != null && auth.id == data.id",
    },
  },
  organizations: {
    allow: {
      view: "auth.id != null && auth.id in data.ref('members.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
    fields: {
      processedCheckoutSessions: "false",
    },
  },
  accounts: {
    allow: {
      ...readOnlyOrgMemberAllow,
    },
  },
  apiKeys: {
    allow: {
      ...readOnlyOrgMemberAllow,
    },
    fields: {
      keyHash: "false",
    },
  },
  karmaEvents: {
    allow: {
      ...readOnlyOrgMemberAllow,
    },
  },
  messages: {
    allow: {
      view:
        "auth.id != null && auth.id in data.ref('account.organization.members.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  attachments: {
    allow: {
      view:
        "auth.id != null && auth.id in data.ref('message.account.organization.members.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
    fields: {
      storageKey: "false",
    },
  },
  webhookSubscriptions: {
    allow: {
      view:
        "auth.id != null && auth.id in data.ref('account.organization.members.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
    fields: {
      secret: "false",
    },
  },
} satisfies InstantRules<AppSchema>;

export default rules;
