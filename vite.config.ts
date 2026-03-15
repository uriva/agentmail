import tailwindcss from "@tailwindcss/vite";
import deno from "@deno/vite-plugin";
import preact from "@preact/preset-vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "./web",
  envDir: "..",
  server: { port: 3000 },
  plugins: [
    tailwindcss(),
    preact({
      prerender: {
        enabled: true,
        prerenderScript: resolve(__dirname, "web/src/prerender.tsx"),
        renderTarget: "#root",
        additionalPrerenderRoutes: ["/docs", "/pricing", "/privacy", "/terms"],
      },
    }),
    deno(),
  ],
  build: { sourcemap: true },
  resolve: {
    alias: {
      "@instantdb/react": "@instantdb/react",
      "@instantdb/core": "@instantdb/core",
      preact: "preact",
      "@preact/signals": "@preact/signals",
    },
  },
});
