# Lead Platform — Project Context

## What This Is
A lead distribution marketplace for real estate investors. Buyers find motivated seller leads (inherited, foreclosure, divorce, etc.), purchase them exclusively or shared (up to 3 buyers), and have them routed to their CRM/GHL automatically.

## Two User Types
- **Admin** — manages lead inventory, pricing, distribution engine, subscriptions, wallets
- **Buyer** — funds wallet, subscribes, browses marketplace, buys leads, tracks deals

## Two Plans (simplified — client confirmed)
- **Free Plan** — browse only, buy manually from marketplace
- **Pro Plan** — $49/month, includes $100 in monthly lead credits, 10% off all purchases, early marketplace access

## Two Purchase Types (simplified — client confirmed)
- **Exclusive** — 1 buyer only, higher price
- **Non Exclusive** — up to 3 buyers, lower price per buyer; show 3-dot slot indicator (green/yellow/gray)

## Lead Sources
- **Inbound** — website/form submissions, webhook ingestion from landing pages
- **Outbound** — vendor ping/post from call centers and partner sources

## Tech Stack
| Layer | Tech |
|---|---|
| Frontend | Next.js 14 App Router, React Query, inline CSS-in-JS (no Tailwind) |
| Backend | NestJS (Node.js), PostgreSQL (Supabase), TypeORM |
| Payments | Stripe (wallet top-ups + subscriptions) |
| CRM delivery | GoHighLevel webhook, generic HTTPS webhook |
| Infrastructure | Render (API), Vercel (web) |

## Key File Locations
```
apps/web/src/app/(dashboard)/
  marketplace/page.tsx      ← lead marketplace with filters
  leads/page.tsx            ← my purchased leads + pipeline
  settings/page.tsx         ← account control center
  wallet/page.tsx           ← wallet, top-up, auto-reload
  subscriptions/page.tsx    ← plan billing
  distribution/page.tsx     ← auto-buy rules
  market-alerts/page.tsx    ← notifications
  onboarding/page.tsx       ← setup wizard
  admin/console/page.tsx    ← admin dashboard (14 tabs)

apps/web/src/lib/
  leads-api.ts              ← marketplace, my-leads, purchase API calls
  wallet-api.ts             ← wallet, top-up, auto-reload
  subscriptions-api.ts      ← plans and billing
  distribution-api.ts       ← auto-buy rules
  admin-api.ts              ← all admin API calls

apps/api/src/
  leads/                    ← leads.service.ts, marketplace.controller.ts
  admin/                    ← admin.controller.ts, admin-ingestion.service.ts
  ping/                     ← vendor ping/post routing
  stripe/                   ← stripe.service.ts
  subscriptions/            ← subscriptions.service.ts
  entities/                 ← all TypeORM entities (lead.entity.ts has `source` field)
```

## Lead Entity Has a `source` Field
`lead.entity.ts` already has `source: string` — populated from ingestion. The marketplace filter DTO (`list-marketplace-leads.dto.ts`) does NOT yet filter by source. This is a small backend addition needed.

## Admin Console Tabs (current, needs cleanup)
overview | inventory | ingestion | duplicates | grading | distribution | pings | pricing | wallet | subscriptions | customers | integrations | notifications | audit

## Inbound Lead Capture — NOT YET WIRED
The admin ingestion service handles CSV uploads only. There is NO public webhook endpoint for website forms or landing pages to POST leads in real-time. This is the biggest missing piece for inbound lead flow.

## Vendor Ping/Post — WORKING
`apps/api/src/ping/` handles outbound vendor routing (vendors ping the platform, platform posts back confirmed leads). This covers the "outbound" source.

## What the Client Wants Simplified (key reminders)
1. No "Shared" language anywhere — always "Non Exclusive"
2. No "Premium", "Exclusive plan", "Semi-exclusive" in buyer-facing UI
3. Auto-reload toggle must be clearly on/off with a saved-card requirement
4. Setup flow: only show Free Plan and Pro Plan options
5. Account Control Center: 4 clean cards (Add Cash, Billing, Automation, Notifications)
6. Market alerts: multi-market, include SMS option
7. CRM section: Connected / Not Connected status, Send Test Lead button

## What's Done vs Pending
See `memory/project-client-changes.md` for the full breakdown.
