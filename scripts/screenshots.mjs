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
  "fifteen-percent",
  "skin-concept-arena",
  "travel-encounters-playbook",
  "the-ordeal",
  "blunt-boot-2026",
];

// Pass repo names as CLI args to refresh only those thumbnails, e.g.
//   node scripts/screenshots.mjs blunt-boot-2026
const only = process.argv.slice(2);
const repos = only.length ? only : REPOS;

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

/** Click the first visible button / link / control matching a text regexp. */
async function clickText(page, re, timeout = 2500) {
  const el = page.locator("button,a,[role=button]").filter({ hasText: re }).first();
  if (await el.count()) {
    await el.click({ timeout }).catch(() => {});
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

// Per-repo steps to reach a screenshot-worthy state. Each drives the app to a
// view that actually shows what it does, rather than an empty landing.
// Default: just settle. Returns nothing; the caller screenshots the viewport.
const PREP = {
  "undergrad-paths-map": async (page) => {
    // Select a coherent set of courses so the career-path network lights up,
    // then scroll down so the chart fills the frame (the "Open Doors" title
    // sits right above the card, so it is dropped from the shot).
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
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(500);
  },
  "idea-collider": async (page) => {
    // Start the deck, then reveal the connection between the two concepts.
    await clickText(page, /Start swiping/);
    await clickText(page, /^Reveal$/);
    await page.waitForTimeout(700);
  },
  "skin-concept-arena": async (page) => {
    // Dismiss the intro tour, load sample data, open the head-to-head Arena.
    await clickButton(page, "Skip tour");
    await clickButton(page, "Try a demo profile");
    await clickButton(page, "Skip tour");
    await clickButton(page, "Arena");
    await page.waitForTimeout(1400);
  },
  "travel-encounters-playbook": async (page) => {
    // Open a specific scenario so the interaction outline shows.
    await clickText(page, /Tokyo/);
    await clickText(page, /Convenience Store/);
    await page.waitForTimeout(700);
  },
  "the-ordeal": async (page) => {
    // Play a scenario to the end so the verdict screen shows.
    await clickText(page, /The dashboard nobody used/);
    for (let i = 0; i < 3; i++) {
      const choice = page.locator("button").filter({ hasText: /.{15,}/ }).first();
      if (await choice.count()) {
        await choice.click().catch(() => {});
        await page.waitForTimeout(700);
      }
    }
    await page.waitForTimeout(700);
  },
};

// Sandboxed environments route outbound HTTPS through a TLS-intercepting
// proxy that Chromium neither picks up from the environment nor completes a
// handshake with (the egress gateway resets Chromium's ClientHello). When
// HTTPS_PROXY is set, launch through the proxy and serve every request via
// Playwright's Node-side fetch, which tunnels correctly and trusts the proxy
// CA via NODE_EXTRA_CA_CERTS.
const proxy = process.env.HTTPS_PROXY
  ? { server: process.env.HTTPS_PROXY }
  : undefined;

async function routeViaNodeFetch(ctx) {
  if (!proxy) return;
  await ctx.route("**/*", async (route) => {
    try {
      const resp = await route.fetch();
      await route.fulfill({ response: resp });
    } catch {
      await route.abort();
    }
  });
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, proxy });
for (const repo of repos) {
  const url = `https://${OWNER}.github.io/${repo}/`;
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await routeViaNodeFetch(ctx);
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
