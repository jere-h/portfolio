# Portfolio

Jeremy Huang's personal portfolio. Astro + Tailwind CSS, TypeScript, fully
static, deployed to GitHub Pages at
[jere-h.github.io/portfolio](https://jere-h.github.io/portfolio/).

It pulls live GitHub metadata (stars, forks, language, last-updated) for the
featured repos at build time, with a committed JSON cache as a fallback so the
site still builds offline or when rate-limited.

## Local development

Requires Node 18.20+ (built and tested on Node 22).

```bash
npm install       # install dependencies
npm run dev       # start the dev server (http://localhost:4321/portfolio)
npm run build     # production build -> dist/
npm run preview   # preview the production build locally
```

## Editing content

All content lives in [`src/config.ts`](src/config.ts). You do not touch the
components to change what is shown.

### Projects

Every project is a card in a single horizontal, swipeable **carousel** - a
trading-card-style deck where the centered card sits flat and full size while
its neighbours scale down, dim, and rotate away in 3D. Featured picks lead,
then the rest, all on one row. The deck loops endlessly, so there's always a
card on either side. Adding a project is now just one more card, not more page
to scroll.

`projects` is an ordered array. The order in the file **is** the order in the
deck (featured first, then the rest, each group in array order). Each entry:

```ts
{
  repo: "undergrad-paths-map",   // GitHub repo name under github.com/jere-h/
  title: "Open Doors",            // display title (overrides the GitHub name)
  description: "An interactive map that ...", // overrides the GitHub description
  featured: true,                 // true = leads the deck, with a "Featured" badge
}
```

- **Add a project:** append (or insert) an object to `projects`. It becomes a
  new card in the deck. Its live-demo button points at
  `https://jere-h.github.io/<repo>/` automatically, and its Code button at
  `https://github.com/jere-h/<repo>`.
- **Remove a project:** delete its object.
- **Reorder:** move objects up or down within their group (featured / not).
- **Feature / unfeature:** flip `featured`. Featured projects sort to the front
  of the deck and get a "Featured" badge; the rest follow.

The carousel is a native CSS scroll-snap row, so swipe, trackpad, keyboard
(arrow keys), and the side arrows/dots all navigate it - and it stays fully
scrollable with JavaScript off. The endless loop, coverflow rotation, and
dimming are a progressive enhancement (`src/scripts/carousel.ts`); the
coverflow motion switches off for visitors who prefer reduced motion.

`title` and `description` in this file always win over whatever GitHub returns.
The live language dot and "updated N ago" date come from the build-time fetch,
described below.

### Project thumbnails

Each card shows a screenshot of the project's live demo. Images live in
`public/thumbnails/<repo>.png` and are committed. To point a project at a
different image, set its optional `thumbnail` field in `config.ts` (a path
under `public/`, or an absolute URL). To regenerate the default screenshots
from the live demos:

```bash
npm i -D playwright-core   # one-off; not a runtime dependency
node scripts/screenshots.mjs
```

If an image is missing, the card falls back to a warm gradient, so the layout
never breaks.

### Personal info

`profile` in the same file holds name, tagline, bio, location, avatar URL,
email, and the hero social links (GitHub + email).

## Build-time GitHub fetch and the cache

On every `npm run build`, [`src/lib/github.ts`](src/lib/github.ts) fetches fresh
metadata for the five repos in `config.ts` from the public GitHub REST API
(`https://api.github.com/repos/jere-h/<repo>`) and writes it to
[`src/data/repos.json`](src/data/repos.json). If the API is unreachable or
rate-limited, the build falls back to the values already in that JSON file, so a
build never fails on the network. **The cache is committed**, so whatever was
fetched on the last successful networked build is what ships.

To refresh the numbers, run a build on a machine with network access and commit
the updated `src/data/repos.json`.

### GITHUB_TOKEN (optional)

Unauthenticated GitHub API requests are limited to 60/hour per IP. To raise the
limit, set a token in the environment before building. A token is never required
and is never stored in the repo.

```bash
GITHUB_TOKEN=ghp_yourtoken npm run build
```

A classic token with no scopes (or a fine-grained token with public read access)
is enough, since only public repo metadata is read.

## Design system

A "warm-editorial" house style with one accent (warm rose `#e8557f`), one
radius scale, and one light/dark theme pair. The theme defaults to the
visitor's system preference, can be toggled manually, and the choice is
persisted in `localStorage`. Tokens live in
[`src/styles/global.css`](src/styles/global.css) and are wired into the Tailwind
theme. Motion is a gentle IntersectionObserver entrance reveal that collapses to
static content when the visitor prefers reduced motion or has JavaScript off.

## Deploying to GitHub Pages (deploy from a branch)

This repo is set up to serve the built site straight from the `main` branch
root. `npm run deploy` builds the site and copies the output to the repo root
(`index.html`, `_astro/`, `favicon.svg`) next to a `.nojekyll` file (needed so
GitHub serves Astro's `_astro/` folder).

**One-time setup in the GitHub UI:**

1. Push the built site to `main` (root must contain `index.html`, `_astro/`, and
   `.nojekyll`).
2. Go to **Settings -> Pages**.
3. Under **Build and deployment -> Source**, choose **Deploy from a branch**.
4. Set **Branch** to **`main`** and the folder to **`/ (root)`**, then **Save**.
5. Wait for the first deploy; the site goes live at
   `https://jere-h.github.io/portfolio/`.

**Publishing an update:**

```bash
npm run deploy      # astro build + copy output to repo root + .nojekyll
git add -A
git commit -m "Update site"
git push
```

GitHub redeploys automatically on each push to `main`.

> Note: because Pages serves from the branch root, the generated `index.html`
> and `_astro/` files are committed to the repo. The `dist/` build folder and
> `node_modules/` are gitignored; the root-level built files are what get
> served.

## Project structure

```
src/
  config.ts            # projects + personal info (edit this)
  data/repos.json      # committed GitHub metadata cache
  lib/
    github.ts          # build-time fetch + cache fallback
    format.ts          # language colors, relative dates, count formatting
  styles/global.css    # design tokens + base styles
  components/           # Hero, ProjectCard, ThemeToggle, Icon, ...
  scripts/
    carousel.ts         # coverflow deck: drag, snap, dots, arrows, keys
    pointer.ts          # fine-pointer glow / tilt / magnetic buttons
    ...
  layouts/Base.astro    # <head>, theme init, reveal script, skip link
  pages/index.astro     # the single page (hero + project carousel)
scripts/sync-root.mjs  # copies dist/ to repo root for the Pages deploy
```

## Accessibility

Semantic landmarks, a skip-to-content link, keyboard-navigable controls with
visible focus rings, `aria-label`s on icon-only controls, tap targets of at
least 44px, body text at 16px or larger, and WCAG AA color contrast in both
themes. The theme toggle exposes its state via `aria-pressed`.
