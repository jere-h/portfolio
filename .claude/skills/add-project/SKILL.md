---
name: add-project
description: Add a project card to the portfolio site. Use when the user asks to add a project, add a card, or add a site/app/URL to the portfolio (e.g. "add https://jere-h.github.io/<repo>/ as a card", "add another project"). Handles config, thumbnail capture, rebuild, and verification.
---

# Add a project card to the portfolio

Add one new project card to the site. Input: the project's repo name or live
demo URL (convention: `https://jere-h.github.io/<repo>/`). Cards default to
the non-featured "Selected work" grid; only set `featured: true` if the user
asks for a featured card.

## Steps

1. **Learn what the project is.** Fetch the live demo URL (WebFetch) and read
   its title/content so you can write an accurate card. If the demo URL 404s,
   stop and tell the user.

2. **Register the project in `src/config.ts`** — the single source of truth.
   Append to the `projects` array (order = render order):
   - `repo`: the GitHub repo name
   - `title`: display title (match the app's own title unless told otherwise)
   - `description`: one sentence, same voice as the existing entries
   - `featured`: `false` unless the user says featured

3. **Add the repo to `REPOS` in `scripts/screenshots.mjs`.** If the app opens
   on an empty/landing state, also add a `PREP` recipe that drives it to a
   content-rich view (see existing recipes). Apps that render content on load
   need no recipe.

4. **Capture the thumbnail.** Requires `playwright-core` (install with
   `npm install --no-save playwright-core` if missing) and the Chromium at
   `/opt/pw-browsers/chromium` (or set `CHROME_PATH`):

   ```
   node scripts/screenshots.mjs <repo>
   ```

   The arg limits capture to the new repo so existing thumbnails stay
   untouched. The script is already proxy-aware: behind a TLS-intercepting
   proxy (HTTPS_PROXY set) it routes page loads through Playwright's
   Node-side fetch because the egress gateway resets Chromium's own TLS
   handshakes — don't debug Chromium TLS errors, the script handles it.
   **View the generated `public/thumbnails/<repo>.png`** and confirm it shows
   the app's actual content, not a blank or error page; adjust the `PREP`
   recipe and re-run if not.

5. **Keep `src/data/repos.json` consistent.** The build fetches GitHub
   metadata and rewrites this cache itself when api.github.com is reachable.
   If the build logs `HTTP 403 ... no cache available` for the new repo
   (sandboxed sessions), manually append a placeholder entry mirroring the
   existing ones (`description/language/homepage/updatedAt: null`, zeros).

6. **Rebuild and sync the deployed root** (GitHub Pages serves the repo
   root):

   ```
   NODE_USE_ENV_PROXY=1 npm run deploy
   ```

   `NODE_USE_ENV_PROXY=1` lets the build's GitHub API fetch use the proxy;
   the build still succeeds on cached/placeholder data if the API is blocked.

7. **Verify.** Confirm `index.html` at the repo root now contains the new
   card and `thumbnails/<repo>.png` exists at the root. For a visual check,
   serve the repo root under the `/portfolio/` base path (symlink the repo
   into a temp dir as `portfolio/`, `python3 -m http.server`) and screenshot
   the card — `file://` breaks the base-path-absolute asset URLs.

8. **Commit everything and push** to the designated branch: source changes
   (`src/config.ts`, `src/data/repos.json`, `scripts/screenshots.mjs` if
   changed, `public/thumbnails/`) plus the regenerated root artifacts
   (`index.html`, `_astro/`, `thumbnails/`) — the deployed site lives in the
   repo, so a build that isn't committed isn't deployed.
