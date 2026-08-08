import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests run in Node, against the modules' pure and server-side logic.
 *
 * Two aliases carry their weight here:
 *
 *   * `server-only` is stubbed out. It exists to make a *build* fail when a
 *     server module is pulled into a client bundle; under Vitest there is no
 *     bundle to protect, and leaving it in would stop `queries.ts` and
 *     `service.ts` being importable by the very tests that check their scoping.
 *   * `next/server` is pinned to its file. next-auth imports it extensionless,
 *     which Node's ESM resolver will not resolve, and `lib/dal.ts` pulls
 *     next-auth in transitively from almost everywhere.
 */
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": here("./tests/stubs/server-only.ts"),
      "next/server": here("./node_modules/next/server.js"),
    },
  },
  test: {
    // next-auth is left to Node's resolver by default, which never sees the
    // alias above; inlining it puts the import back through Vite.
    server: { deps: { inline: [/next-auth/, /@auth\//] } },
    environment: "node",
    globals: false,
    include: ["lib/**/*.test.ts", "modules/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules/**", "mobile/**", "lib/generated/**"],
  },
});
