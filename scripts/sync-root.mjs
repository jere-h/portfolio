#!/usr/bin/env node
/**
 * Copy the Astro build output (dist/) to the repository root.
 *
 * GitHub Pages is configured as "Deploy from a branch -> main / (root)", so the
 * generated HTML/assets must live at the repo root. This script refreshes only
 * the files that the build produces; it never touches source, LICENSE, etc.
 *
 * It also writes a `.nojekyll` file so GitHub serves Astro's `_astro/`
 * directory (Jekyll would otherwise ignore folders starting with an
 * underscore).
 *
 * Run via `npm run sync-root`, or `npm run deploy` (build + sync).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

if (!fs.existsSync(dist)) {
  console.error(
    "[sync-root] dist/ not found. Run `npm run build` first (or use `npm run deploy`).",
  );
  process.exit(1);
}

const entries = fs.readdirSync(dist);
let copied = 0;

for (const name of entries) {
  const from = path.join(dist, name);
  const to = path.join(root, name);
  // Replace the matching root entry so stale hashed assets don't accumulate.
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  copied += 1;
}

// Disable Jekyll so `_astro/` is served.
fs.writeFileSync(path.join(root, ".nojekyll"), "");

console.log(
  `[sync-root] copied ${copied} top-level entr${copied === 1 ? "y" : "ies"} from dist/ to repo root, wrote .nojekyll`,
);
