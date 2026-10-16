/**
 * Serves and builds the page per show (scripts/show-pages.ts).
 *
 * - build: writes <outDir>/show/<ShowID>/index.html for every visible record,
 *          and 404.html, which sends an old show link on to the site.
 * - dev:   serves /show/<ShowID>/ on request, so a copied link works on
 *          `npm run dev` as it does on the live site.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { buildShowPages, notFoundPage, showPageFor, SHOW_DIR } from './show-pages';

export function showPages(): Plugin {
  let root = '';
  let outDir = '';
  let isBuild = false;
  let base = '/';
  const route = new RegExp(`/${SHOW_DIR}/([0-9a-f]{12})(/)?(?:index\\.html)?(?:[?#].*)?$`);

  return {
    name: 'vault-show-pages',

    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
      base = config.base;
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = route.exec(req.url || '');
        if (!m) return next();
        // GitHub Pages adds the slash too; relative links in the page need it.
        if (!m[2]) {
          res.statusCode = 301;
          res.setHeader('Location', (req.url || '').replace(m[1], `${m[1]}/`));
          return res.end();
        }
        const html = await showPageFor(root, m[1]);
        if (!html) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    },

    // Also fires when the dev server shuts down; only a build writes files.
    async closeBundle() {
      if (!isBuild) return;
      const pages = await buildShowPages(root);
      for (const [path, html] of pages) {
        const file = join(outDir, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html);
      }
      // GitHub Pages serves this for any missing path. A link to a show
      // since re-keyed, merged or hidden lands in the site (which drops an
      // unknown ID) instead of GitHub's bare 404; anything else, the home page.
      writeFileSync(join(outDir, '404.html'), notFoundPage(base));
      console.log(`show pages: ${pages.size} written to ${SHOW_DIR}/, and 404.html`);
    },
  };
}
