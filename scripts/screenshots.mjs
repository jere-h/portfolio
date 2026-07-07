#!/usr/bin/env node
/**
 * Capture a thumbnail screenshot of each project's live demo into
 * public/thumbnails/<repo>.png (the path the cards read from).
 *
 * Several demos open on an empty landing state, so this drives each app to a
 * content-rich view first (makes selections, loads a demo profile, opens the
 * core screen) via the per-repo recipes in PREP below. Edit those if an app's
 * UI changes.
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

/** Click a button by exact label if it is present and visible. */
async function clickButton(page, name) {
  try {
    const btn = page.getByRole("button", { name, exact: true }).first();
    if ((await btn.count()) && (await btn.isVisible())) {
      await btn.click();
      await page.waitForTimeout(450);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

// Per-repo steps to reach a screenshot-worthy state. Default: just settle.
const PREP = {
  "undergrad-paths-map": async (page) => {
    // Select a coherent set of courses so the career-path network lights up.
    const picks = [
      "Intro to Programming",
      "Data Structures and Algorithms",
      "Intro to Statistics",
      "Linear Algebra",
      "Principles of Economics",
    ];
    for (const name of picks) {
      const chip = page.locator("#filter-list button.chip", { hasText: name }).first();
      if (await chip.count()) {
        await chip.click().catch(() => {});
        await page.waitForTimeout(180);
      }
    }
    await page.waitForTimeout(1300);
  },
  "skin-concept-arena": async (page) => {
    // Dismiss the intro tour, load sample data, open the head-to-head Arena.
    await clickButton(page, "Skip tour");
    await clickButton(page, "Try a demo profile");
    await clickButton(page, "Skip tour");
    await clickButton(page, "Arena");
    await page.waitForTimeout(1400);
  },
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const repo of REPOS) {
  const url = `https://${OWNER}.github.io/${repo}/`;
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  }
  await page.waitForTimeout(1500);
  if (PREP[repo]) await PREP[repo](page);
  else await page.waitForTimeout(1500);

  const file = path.join(OUT, `${repo}.png`);
  await page.screenshot({ path: file, type: "png", clip: { x: 0, y: 0, ...VIEWPORT } });
  console.log(`  ${repo}.png  (${Math.round(fs.statSync(file).size / 1024)} KB)`);
  await ctx.close();
}
await browser.close();
console.log("done");
