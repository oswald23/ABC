# Confident Mind Coach (Web)

A local-first, PWA web app for daily confidence training inspired by *The Confident Mind*.

## Stack
- Next.js (App Router), React 18
- Tailwind CSS
- localforage (IndexedDB)
- Recharts (trend chart)
- OpenAI (optional, BYO key) for the Coach
- PWA + Notifications

## Getting Started
1. **Install**
```bash
npm install
npm run dev
```
2. Open http://localhost:3000

## OpenAI (optional)
- Set `OPENAI_API_KEY` in **Vercel → Project → Settings → Environment Variables**.
- The Coach page will fall back to a rule-based coach if the key is missing.

## Zapier (optional, free)
Create single-step zaps:
- Trigger: **Schedule by Zapier** (daily/weekly)
- Action: **Email by Zapier** (send yourself Nightcap / Weekly Review prompts)
*(Webhooks is premium; not used here.)*

## Deploy on Vercel
- Push to GitHub
- Import in Vercel, set `OPENAI_API_KEY` (optional)
- Build & deploy

## PWA
- App is installable (manifest + SW).
- Notifications use the Web Notifications API.
