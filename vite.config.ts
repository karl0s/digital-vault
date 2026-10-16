import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { thumbnails } from './scripts/vite-plugin-thumbs.mjs';
import { siteData } from './scripts/vite-plugin-site-data.mjs';
import { showPages } from './scripts/vite-plugin-show-pages';

// https://vitejs.dev/config/
export default defineConfig({
  // thumbnails(): 640px WebP card images, built from public/images into
  // dist/thumbs/ — see scripts/thumbs.mjs.
  // siteData(): the trimmed show list the site loads, and its Notes, derived
  // from public/shows.json — see scripts/site-data.mjs.
  // showPages(): a page per show at show/<ShowID>/, so a pasted link previews
  // that show — see scripts/show-pages.ts.
  plugins: [react(), thumbnails(), siteData(), showPages()],
  // The site is served from https://karl0s.github.io/digital-vault/.
  base: '/digital-vault/',
});
