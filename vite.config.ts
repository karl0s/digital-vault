import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { thumbnails } from './scripts/vite-plugin-thumbs.mjs';

// https://vitejs.dev/config/
export default defineConfig({
  // thumbnails(): 640px WebP card images, built from public/images into
  // dist/thumbs/ — see scripts/thumbs.mjs.
  plugins: [react(), thumbnails()],
  // IMPORTANT: Set this to your GitHub repository name if deploying to GitHub Pages
  // For example, if your repo is "https://github.com/username/concert-archive"
  // Change this to: base: '/concert-archive/'
  // If deploying to a custom domain or username.github.io, keep it as '/'
  base: '/digital-vault/',
});
