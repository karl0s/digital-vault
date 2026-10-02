/**
 * Puts the card thumbnails (scripts/thumbs.mjs) where the site can reach them.
 *
 * - build:  brings the cache up to date, then copies it into <outDir>/thumbs/.
 * - dev:    brings the cache up to date in the background and serves
 *           /thumbs/* from it. Until a thumbnail exists the request 404s and
 *           the card falls back to the original (LazyImage's fallbackSrc), so
 *           the first `npm run dev` after new images just looks the same.
 */

import { cpSync, createReadStream, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CACHE_DIR, generateThumbs } from './thumbs.mjs';

export function thumbnails() {
  let root = '';
  let outDir = '';
  let isBuild = false;

  return {
    name: 'vault-thumbnails',

    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
    },

    configureServer(server) {
      const log = msg => server.config.logger.info(msg);
      generateThumbs(root, log).catch(err => server.config.logger.warn(`thumbnails: ${err.message}`));

      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (!/\/thumbs\/[^/]*$/.test(path)) return next();
        const name = path.match(/\/thumbs\/([\w-]+\.webp)$/)?.[1];
        const file = name && join(root, CACHE_DIR, name);
        // A real 404, not Vite's SPA fallback (index.html with a 200), so the
        // card's fallback to the original is a plain image error.
        if (!file || !existsSync(file)) { res.statusCode = 404; res.end(); return; }
        res.setHeader('Content-Type', 'image/webp');
        createReadStream(file).pipe(res);
      });
    },

    // Also fires when the dev server shuts down; only a build ships thumbnails.
    async closeBundle() {
      if (!isBuild) return;
      const { dir } = await generateThumbs(root);
      const dest = join(outDir, 'thumbs');
      mkdirSync(dest, { recursive: true });
      cpSync(dir, dest, { recursive: true, filter: src => !src.endsWith('index.json') });
    },
  };
}
