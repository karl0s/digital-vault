/**
 * Card thumbnails — a 640px-wide WebP of every show's slot-1 image.
 *
 *   node scripts/thumbs.mjs      (normally run for you: see vite-plugin-thumbs.mjs)
 *
 * Cards are at most ~255 CSS px wide, so even on a 3x phone they never show
 * more than ~580 real pixels — yet they used to download the full original
 * (720–1920 px). A 640px copy has more pixels than any card displays, at
 * WebP quality 90 with sharp-YUV chroma (stage lighting is full of saturated
 * reds, which plain 4:2:0 subsampling smears). Measured 2026-10-02 on 120
 * images: 65 KB -> 35 KB on average, and HD sources decode to a ninth of the
 * memory. Originals are untouched and still serve the drawer and viewer.
 *
 * Build output only. Thumbnails live in node_modules/.cache/vault-thumbs/ and
 * are copied into dist/thumbs/ at build time — never into public/, where
 * `git add -f public/` would sweep them into the repo. Incremental: each
 * source is hashed, and only new or changed images are re-encoded. Changing
 * THUMB below regenerates everything.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const THUMB = { width: 640, quality: 90, effort: 6, smartSubsample: true };
export const CACHE_DIR = 'node_modules/.cache/vault-thumbs';

const SOURCE = /^(.+)_01\.jpg$/;

/** Bring the thumbnail cache in line with public/images. Returns counts and the cache dir. */
export async function generateThumbs(root, log = console.log) {
  const src = join(root, 'public/images');
  const out = join(root, CACHE_DIR);
  mkdirSync(out, { recursive: true });

  const indexPath = join(out, 'index.json');
  const settings = JSON.stringify(THUMB);
  let done = {};
  try {
    const saved = JSON.parse(readFileSync(indexPath, 'utf8'));
    if (saved.settings === settings) done = saved.files;
  } catch { /* first run, or unreadable: rebuild */ }

  const wanted = {};
  const todo = [];
  for (const file of readdirSync(src)) {
    if (!SOURCE.test(file)) continue;
    const name = file.replace(/\.jpg$/, '.webp');
    const hash = createHash('sha1').update(readFileSync(join(src, file))).digest('hex');
    wanted[name] = hash;
    if (done[name] !== hash || !existsSync(join(out, name))) todo.push({ file, name, hash });
  }

  // A thumbnail whose original is gone would otherwise ship forever.
  let removed = 0;
  for (const name of readdirSync(out)) {
    if (name.endsWith('.webp') && !(name in wanted)) { rmSync(join(out, name)); removed++; }
  }

  const next = Object.fromEntries(Object.entries(done).filter(([name, hash]) => wanted[name] === hash));
  let failed = 0;
  if (todo.length) log(`thumbnails: encoding ${todo.length} of ${Object.keys(wanted).length}…`);
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const { file, name, hash } = todo[i++];
      try {
        await sharp(join(src, file))
          .resize({ width: THUMB.width, withoutEnlargement: true, kernel: 'lanczos3' })
          .webp({ quality: THUMB.quality, effort: THUMB.effort, smartSubsample: THUMB.smartSubsample })
          .toFile(join(out, name));
        next[name] = hash;
      } catch (err) {
        // Left out of the index, so the next run retries it. The page falls
        // back to the original for any card whose thumbnail is missing.
        failed++;
        log(`thumbnails: could not encode ${file}: ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: availableParallelism() }, worker));

  writeFileSync(indexPath, JSON.stringify({ settings, files: next }));
  const made = todo.length - failed;
  log(`thumbnails: ${made} made, ${Object.keys(wanted).length - todo.length} unchanged, ${removed} removed${failed ? `, ${failed} FAILED` : ''}`);
  return { dir: out, made, removed, failed };
}

// CLI
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  generateThumbs(root).then(r => process.exit(r.failed ? 1 : 0));
}
