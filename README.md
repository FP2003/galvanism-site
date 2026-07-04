# Galvanism — F.C.B. Command

Campaign management tool for the **Galvanism** tabletop RPG (the F.C.B. / Supercity S.F. cyberpunk setting). Admin (DM) bookkeeping + self-serve player interfaces.

- Strategy & design system: [`PRODUCT.md`](PRODUCT.md), [`DESIGN.md`](DESIGN.md)
- Feature scope & world: [`info/`](info/) — see [`info/roadmap.md`](info/roadmap.md) for the phased build plan
- **Current status:** Phase 0 (foundation) — see below

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — design tokens live in [`src/app/globals.css`](src/app/globals.css) `@theme`, sourced from `DESIGN.md`
- **next/font** — Rajdhani (display), Chakra Petch (title/label), Inter (body), JetBrains Mono (data)
- **lucide-react** — icon set
- Hosting: **Vercel**; database (Phase 1): **Vercel Postgres / Neon**

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
npm run lint
```

> **Note:** if a rebuild ever serves an empty stylesheet locally, delete the build
> cache and rebuild: `rm -rf .next && npm run build`. (Stale Turbopack cache can
> emit an empty CSS chunk on incremental builds; clean builds — including
> Vercel's — are unaffected.)

## Deploying to Vercel

The project is deploy-ready with **no configuration** — Vercel auto-detects Next.js. No environment variables are required in Phase 0 (no database yet).

**One-time setup (requires your Vercel account — do this interactively):**

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In the [Vercel dashboard](https://vercel.com/new), **Import** the repo. Framework preset resolves to *Next.js* automatically; leave build/output settings at their defaults.
3. Deploy. Every push to `main` then ships a production deployment; pull requests get preview URLs.

Or via CLI:

```bash
npm i -g vercel
vercel            # links the project and creates a preview deployment
vercel --prod     # production deployment
```

## What exists in Phase 0

The two base UI patterns the rest of the app is built from, running on mock data
([`src/lib/mock-data.ts`](src/lib/mock-data.ts)) — no database yet:

- **Ops Terminal** (`/`, `/roster`) — scan-friendly overview dashboards.
- **Case File** (`/roster/[slug]`) — dossier-style detail records.

Navigation items for later phases (Missions, Facilities, Requisitions, Ballots,
Registry) render disabled and labelled with their roadmap phase.
