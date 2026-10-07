/**
 * Serves and builds the derived show data (scripts/site-data.mjs).
 *
 * - build:  writes shows-lite.json, show-notes.json and shows.json into <outDir>,
 *           the last over the copy of public/shows.json Vite made, so private
 *           fields never deploy.
 * - dev:    serves all three, regenerated whenever public/shows.json changes, so
 *           `npm run dev` loads data exactly the way the live site does.
 */

import { statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildSiteData, LITE_FILE, NOTES_FILE, SHOWS_FILE } from './site-data.mjs';

export function siteData() {
  let root = '';
  let outDir = '';
  let isBuild = false;

  return {
    name: 'vault-site-data',

    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
    },

    configureServer(server) {
      let cached = { mtime: 0, files: {} };
      server.middlewares.use((req, res, next) => {
        const name = (req.url || '').split('?')[0].split('/').pop();
        if (![LITE_FILE, NOTES_FILE, SHOWS_FILE].includes(name)) return next();
        const mtime = statSync(join(root, 'public/shows.json')).mtimeMs;
        if (mtime !== cached.mtime) cached = { mtime, files: buildSiteData(root) };
        res.setHeader('Content-Type', 'application/json');
        res.end(cached.files[name]);
      });
    },

    // Also fires when the dev server shuts down; only a build writes files.
    closeBundle() {
      if (!isBuild) return;
      for (const [name, body] of Object.entries(buildSiteData(root))) {
        writeFileSync(join(outDir, name), body);
      }
    },
  };
}
