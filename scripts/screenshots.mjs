#!/usr/bin/env node
/**
 * Capture a thumbnail screenshot of each project's live demo into
 * public/thumbnails/<repo>.png (the path the cards read from).
 *
 * Run manually when you want to refresh the card images:
 *   node scripts/screenshots.mjs
 *
 * Requires a Chromium binary and outbound network access to the live demos.
 * In this repo's dev container Playwright's browser lives at
 * $PLAYWRIGHT_BROWSERS_PATH; elsewhere, install `playwright-core` and point
 * CHROME_PATH at a Chrome/Chromium executable. This is a maintenance tool, not
 * part of the site build; the generated .png files are committed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "public", "thumbnails");
fs.mkdirSync(OUT, { recursive: true });

// Keep in sync with src/config.ts (repo -> live demo).
const OWNER = "jere-h";
const REPOS = [
  "undergrad-paths-map",
  "idea-collider",
  "skin-concept-arena",
  "travel-encounters-playbook",
  "the-ordeal",
];

const CHROME =
  process.env.CHROME_PATH ||
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const VIEWPORT = { width: 1200, height: 800 }; // 3:2, matches the card aspect

// Route through the session's outbound HTTPS proxy when one is configured
// (the browser, unlike curl, does not pick this up from the environment).
const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy || "";
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
});
for (const repo of REPOS) {
  const url = `https://${OWNER}.github.io/${repo}/`;
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    // fall back to a looser wait for apps that keep a socket open
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  }
  await page.waitForTimeout(2500); // let fonts/first paint settle
  const file = path.join(OUT, `${repo}.png`);
  await page.screenshot({
    path: file,
    type: "png",
    clip: { x: 0, y: 0, ...VIEWPORT },
  });
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`  ${repo}.png  (${kb} KB)`);
  await ctx.close();
}
await browser.close();
console.log("done");
