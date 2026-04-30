# General

Avoid commenting unless necessary.

Prefer functional programming, use gamla functions when applicable. Prefer point
free pipelines using gamla `pipe` if applicable over chaining dot notation or
reassigning.

Constant naming should be in normal case, e.g. `const myConstant = 1;`

Avoid `let`, prefer `const`.

Avoid nesting functions, prefer putting in the module level, possible with
currying.

Factor out logic, preferrable to module level functions. When adding logic,
function bodies typically should not enlarge. New logic can be encapsulated in a
new function, or refactor such that the old functions are even smaller than
before.

Avoid dynamic imports, use static imports instead.

Place imports at the top of the file.

Don't use `export default`, prefer `export const`

Avoid default values for parameters. If something is recurring use currying or a
constant instead.

Avoid using `try`/`catch` unless necessary.

Do not use `as` for type assertions unless explicitly sanctioned by the user.

Don't use `case`, prefer an `if` with early return.

Use arrow functions instead of the `function` keyword. Prefer arrow functions
without braces if possible.

Avoid for loops, while loops, and classes.

Prefer destructuring in function signature.

Prefer ternary over `if (x) { return y; } else { return z; };`.

If a type is inferrable from the function, prefer not to annotate it.

No defensive programming, assume inputs are correct unless there is a good
reason not to. Trust the types.

# Deno

This is a Deno project. Dependencies are in `deno.json`, there is no
`package.json`.

**Deployment & CI/CD:**
The server (`src/main.ts`) is deployed to Deno Deploy via Deno Deploy's native GitHub integration.
- Pushing to `main` triggers an automatic deployment directly from Deno Deploy.
- **DO NOT** try to set up or generate GitHub Actions workflows for deployment.
- **DO NOT** run `deno deploy` or `deployctl` locally to push updates.
- If a recently pushed feature is not showing up, check the Deno Deploy dashboard logs, as the automated build may have failed there.

# Project structure

```
src/
  main.ts           - Server entrypoint, routing, auth, static file serving
  db.ts             - InstantDB client
  types.ts          - Shared types (API inputs, responses, errors)
  handlers/
    accounts.ts     - Account CRUD, Forward Email alias management
    messages.ts     - Send/list/get messages
    inbound.ts      - Forward Email webhook handler, signature verification
    webhooks.ts     - Webhook subscription CRUD
    apiKeys.ts      - API key management
    attachments.ts  - Attachment URL generation
    karma.ts        - Karma balance
    organizations.ts - Org management
    members.ts      - Org member management
  services/
    forwardEmail.ts - Forward Email API wrapper
    webhookDelivery.ts - Webhook delivery with retries
    karma.ts        - Karma accounting
    storage.ts      - GCS file storage
    posthog.ts      - Analytics
web/                - Preact frontend (Vite build)
sdk/                - TypeScript SDK
instant.schema.ts   - InstantDB schema
```

# Inbound email gotchas

Forward Email sends a mailparser-style payload. Watch out for:

- `html` can be `false` (boolean) when there is no HTML body. Always check
  `typeof email.html === "string"` before using it.
- `from` and `to` can be structured objects (`{ value: [{ address, name }] }`)
  instead of plain strings. The `normalizePayload` function in `inbound.ts`
  handles this.
- Attachments come as `{ content: { type: "Buffer", data: [...] } }` and need to
  be converted to base64.
