/**
 * Serves and builds the derived show data (scripts/site-data.mjs).
 *
 * - build:  writes shows-lite.json and show-notes.json into <outDir>.
 * - dev:    serves both, regenerated whenever public/shows.json changes, so
 *           `npm run dev` loads data exactly the way the live site does.
 */

import { statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildSiteData, LITE_FILE, NOTES_FILE } from './site-data.mjs';

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
        if (name !== LITE_FILE && name !== NOTES_FILE) return next();
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
