# General & Coding Style

- Minimal comments; prefer functional programming with `gamla` (`pipe`, `map`,
  `filter`).
- Use `const` (camelCase), arrow functions (without braces when possible),
  destructured parameters, ternaries over `if/else` returns, static top-of-file
  imports, and `export const` (no `export default`).
- Avoid `let`, `for`/`while` loops, classes, `switch`/`case`, parameter default
  values (use currying or constants), `try`/`catch` unless necessary, and `as`
  type assertions.
- Keep functions at the module level and avoid enlarging existing functions.
- Trust strict types; no defensive programming.

# Deno & Deployment

- Dependencies live in `deno.json` (no `package.json`).
- `src/main.ts` auto-deploys to Deno Deploy on push to `main` via GitHub
  integration. Do not create GitHub Actions deploy workflows or run
  `deno deploy` manually.
