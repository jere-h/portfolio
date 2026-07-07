// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Project site: served at https://jere-h.github.io/portfolio/
// `site` + `base` make Astro emit correct asset/link URLs under the /portfolio/ prefix.
export default defineConfig({
  site: 'https://jere-h.github.io',
  base: '/portfolio',
  output: 'static',
  trailingSlash: 'ignore',
  vite: {
    plugins: [tailwindcss()],
  },
});
