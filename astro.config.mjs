// @ts-check
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Stale-page guard, build half: copy the build stamp Base.astro baked into
// the HTML (<meta name="build-id">) out to version.json. The inline script in
// Base.astro fetches that file on every visit, cache-bypassed, and forces a
// fresh navigation when a cached page no longer matches - so visitors always
// end up on the latest deploy. Reading the stamp back out of the built HTML
// (rather than generating it here too) keeps the pair identical by construction.
const versionStamp = {
  name: 'version-stamp',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const html = fs.readFileSync(fileURLToPath(new URL('index.html', dir)), 'utf8');
      const m = html.match(/<meta name="build-id" content="([^"]+)"/);
      if (!m) throw new Error('[version-stamp] no build-id meta tag in built index.html');
      fs.writeFileSync(
        fileURLToPath(new URL('version.json', dir)),
        JSON.stringify({ build: m[1] }),
      );
    },
  },
};

// Project site: served at https://jere-h.github.io/portfolio/
// `site` + `base` make Astro emit correct asset/link URLs under the /portfolio/ prefix.
export default defineConfig({
  site: 'https://jere-h.github.io',
  base: '/portfolio',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [versionStamp],
  vite: {
    plugins: [tailwindcss()],
  },
});
