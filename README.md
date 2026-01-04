# QQQ Top 10 Tools (React + Vite)

This repo builds a static site (GitHub Pages) that:
- Shows latest QQQ holdings (Top 20 view)
- Uses Top 10 holdings for allocation + rebalancing
- Lets you add custom stocks (saved in your browser)
- Keeps QQQ holdings up-to-date via a daily GitHub Action that updates `public/qqq-holdings.json`

## Run locally

1. Install Node.js 20+
2. In the repo folder:
   npm install
   npm run dev

## Deploy to GitHub Pages

This repo includes `.github/workflows/deploy.yml` which:
- Builds on every push to `main`
- Deploys to GitHub Pages automatically

In GitHub:
1. Settings → Pages
2. Build and deployment → Source: **GitHub Actions**

Then push to `main`.

## Dynamic holdings updates

The workflow `.github/workflows/update_qqq_holdings.yml` runs daily and updates:
- `public/qqq-holdings.json`

You can also run it manually:
Actions → "Update QQQ holdings JSON" → Run workflow
