import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Set this to your GitHub repository name if deploying to GitHub Pages
  // For example, if your repo is "https://github.com/username/concert-archive"
  // Change this to: base: '/concert-archive/'
  // If deploying to a custom domain or username.github.io, keep it as '/'
  base: '/',
});