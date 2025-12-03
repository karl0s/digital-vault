# GitHub Pages Deployment Guide

## Understanding the Build Process

### Why You Can't Upload Raw Files

Your project uses **React + Vite + TypeScript + Tailwind**, which means:

1. **TypeScript files** (`.tsx`) need to be compiled to JavaScript
2. **JSX syntax** needs to be converted to regular JavaScript
3. **ES modules** need to be bundled together
4. **Tailwind CSS** needs to be processed into actual CSS
5. **Import statements** need to be resolved

Your `index.html` is just a **template** that loads your TypeScript entry point. Browsers can't run TypeScript directly!

### How It Works Locally

When you run `npm run dev`:
- **Vite's dev server** transforms TypeScript → JavaScript in real-time
- **Hot module replacement** updates code without refreshing
- **Module bundling** resolves all your imports

### The Build Process

When you run `npm run build`:
- Creates a `dist/` folder with **production-ready static files**
- All TypeScript is compiled to JavaScript
- All imports are bundled into a few optimized files
- Tailwind CSS is compiled and minified
- Assets are optimized and hashed for caching

The `dist/` folder contains **self-contained HTML/CSS/JS** that works in any browser!

---

## Deployment Steps

### Step 1: Configure Your Repository Settings

1. Go to your GitHub repository
2. Click **Settings** → **Pages** (in the left sidebar)
3. Under "Build and deployment":
   - **Source**: Select "GitHub Actions" (not "Deploy from a branch")
4. Save the settings

### Step 2: Update Base Path (If Needed)

If your repository URL is like `https://github.com/username/repo-name`:

**Edit `vite.config.ts`:**
```typescript
base: '/repo-name/',  // Change 'repo-name' to your actual repo name
```

**If using a custom domain or `username.github.io`:**
```typescript
base: '/',  // Keep as is
```

### Step 3: Deploy

**Option A: Automatic Deployment (Recommended)**

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Setup GitHub Pages deployment"
   git push origin main
   ```

2. **GitHub Actions will automatically:**
   - Install dependencies
   - Run `npm run build`
   - Deploy the `dist/` folder to GitHub Pages

3. **Monitor the deployment:**
   - Go to the **Actions** tab in your repository
   - Watch the "Deploy to GitHub Pages" workflow
   - Once complete, your site will be live!

4. **Access your site at:**
   - `https://username.github.io/repo-name/` (project page)
   - OR `https://username.github.io/` (user/org page)
   - OR your custom domain if configured

**Option B: Manual Build & Deploy**

If you prefer not to use GitHub Actions:

1. **Build locally:**
   ```bash
   npm run build
   ```

2. **The `dist/` folder contains your static site**

3. **Deploy the `dist/` folder contents** using:
   - GitHub Pages (enable "Deploy from a branch" and push `dist/` to `gh-pages` branch)
   - Netlify drag-and-drop
