// Bundles the MCP server into a single self-contained bin. Everything is
// inlined (SDK included) so the published package has zero runtime deps —
// no upstream packaging flaw can break a cold npx install. The banner gives
// CJS modules inside the ESM bundle a real require().
import { build } from "esbuild";

await build({
  entryPoints: ["index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist/index.js",
  banner: {
    js: [
      "#!/usr/bin/env node",
      "import { createRequire as __createRequire } from 'node:module';",
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  logLevel: "info",
});
