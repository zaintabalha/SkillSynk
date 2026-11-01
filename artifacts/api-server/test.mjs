import { build } from "esbuild";
import { spawnSync } from "node:child_process";

const output = "node_modules/.cache/room-tests.mjs";
await build({
  entryPoints: ["src/tests/room-interactions.test.ts"],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["express", "drizzle-orm", "pg-native", "pino", "@google/genai", "zod", "@clerk/express"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const result = spawnSync(process.execPath, [output], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
