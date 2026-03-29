# Newleey Lead Distribution Marketplace — Phase Breakdown

## Phase 1 — Foundation & Core Buyer Experience (COMPLETED)

**Goal:** Functional auth, onboarding, wallet, and buyer dashboard wired to real backend APIs.

### What was delivered

| Area | Details |
|------|---------|
| **Database & Schema** | Full PostgreSQL schema via TypeORM migration: `users`, `wallet_accounts`, `wallet_transactions`, `subscriptions`, `onboarding_progress`, `leads`, `lead_assignments`, `lead_price_history`, `distribution_rules`, `integrations`, `market_alerts`, `notification_logs`, `audit_logs`. All enums (roles, statuses, providers). |
| **Authentication** | Email/password register & login (bcrypt + JWT 7-day tokens). `GET /auth/me` loads user from DB (returns `full_name`, `company_name`, `email`, `role`). JWT strategy, guards, DTOs with validation. |
| **Onboarding Funnel** | 9-step guided wizard: welcome, how it works, plan selection, wallet funding, auto-buy settings, markets & filters, CRM selection, resources, completion. Backend persists step progress, completed steps, and JSON form data. Skip & resume flow (clears `completed_at`, resumes at saved step). Initial wallet credit on completion (idempotent, amount-validated). |
| **Wallet System** | Wallet account per user (bigint cents). Dev top-up endpoint (`POST /wallet/me/topup`) with atomic balance update + ledger transaction. Transaction history with pagination. Frontend: balance display, top-up UI with presets & custom amount, transaction list with filters, sparkline chart, auto-reload settings (UI only — Stripe not wired). |
| **Customer Dashboard** | Real data via React Query: wallet balance, monthly spend (from debits), lead purchase count (from `reference_type`), auto-buy status (from onboarding data), 7-day transaction chart, activity feed from wallet transactions, CRM integration status from onboarding. |
| **Marketplace** | Static/mock UI: lead cards with filters (market, type, exclusivity, price range), mock buy flow. No backend wiring yet. |
| **Navbar** | Shared across dashboard routes. Live wallet balance, user avatar from `full_name`/email, onboarding status pill (complete / resume setup / not started). Logout clears token. |
| **Frontend Architecture** | Next.js 15, React Query (`QueryClientProvider`), centralized API client (`apiGet`/`apiPost`/`apiPatch` with JWT Bearer), token management (`localStorage`), shared query keys, `RequireAuth` guard. |
| **Backend Architecture** | NestJS with modular structure (Auth, Wallet, Onboarding modules). TypeORM with PostgreSQL, global ValidationPipe, CORS, environment config. `WalletService` exported for cross-module use. |

### PRD sections addressed in Phase 1
- Module 1 (Authentication) — email/password login, profile fields, role-based access
- Module 2 (Onboarding Funnel) — all 9 steps, skip/resume, guided setup
- Module 3 (Wallet System) — funding, balance display, transaction history, auto-reload UI
- Module 5 (Marketplace) — browse UI only (mock data)
- Module 11 (Customer Dashboard) — wallet balance, leads purchased, auto-buy status, activity
- Module 16 (Tech Stack) — Next.js, NestJS, PostgreSQL, React Query

### What is NOT done in Phase 1
- Stripe payment integration (wallet uses dev top-up)
- Subscription billing
- Real lead inventory and marketplace purchases
- Lead distribution engine / merry-go-round
- Twilio, GoHighLevel, CRM integrations (UI placeholders only)
- Admin dashboard
- Email verification, forgot password
- Notifications system
- Google OAuth

---

## Phase 2 — Lead Distribution, Marketplace & Stripe (Target: 60% complete)

**Goal:** Working lead flow end-to-end: admin can add leads, distribution engine assigns them, buyers can purchase from marketplace, Stripe handles real payments.

> **Client feedback:** Phase 2 must include the complete workflow for lead distribution and lead flow.

### Deliverables

| Area | Details |
|------|---------|
| **Lead CRUD & Admin Panel** | Admin module: create/edit/archive leads. Lead entity fully wired: source, market, type, exclusivity, quality score, pricing. Lead status lifecycle (new → available → reserved → sold → distributed → archived). Admin dashboard: lead inventory, pricing controls, basic metrics (leads sold, wallet deposits, revenue). |
| **Lead Distribution Engine (Merry-Go-Round)** | Background job / queue: when a new lead enters, check eligible auto-buy buyers by market, type, wallet balance, caps. Rotation order with priority by subscription tier. Attempt auto-purchase → charge wallet → assign lead → log transaction. If no buyer qualifies, push lead to marketplace. Buyer distribution settings: max leads per day/week/month, max spend per day/week/month, min wallet balance, participation toggle, cooldown. |
| **Marketplace — Real Backend** | `GET /leads/marketplace` with filters (market, type, exclusivity, price range, age). `POST /leads/:id/buy` — atomic: check balance, reserve, charge wallet, assign, create transaction. Lead detail page with pricing history. Shared / semi-exclusive / exclusive display and pricing. |
| **Stripe Integration** | Stripe Checkout / Payment Intents for wallet top-ups. Saved payment methods (`stripe_payment_method_id` on wallet). Auto-reload: when balance drops below threshold, charge saved card automatically. Webhook handler for payment success/failure. Replace dev top-up with real Stripe flow. |
| **Subscription System** | Stripe subscriptions for plan tiers (Basic, Pro, Market-Specific, Premium). Recurring billing, plan limits, included credits. Subscription status management (active, paused, cancelled, past_due). Priority in distribution based on plan tier. |
| **Lead Assignment & History** | `lead_assignments` table wired: buyer, lead, purchase type (auto_buy / manual / subscription), charge amount, timestamps. `GET /leads/me` — buyer's purchased leads with status, sync status. Lead detail with assignment history. |
| **Wallet Enhancements** | Debit transactions for lead purchases. Refund/credit by admin. Wallet balance checks before any purchase. |

### PRD sections addressed in Phase 2
- Module 3 (Wallet) — Stripe funding, auto-reload, saved methods, debit for purchases
- Module 4 (Subscription Marketplace) — plans, billing, limits
- Module 5 (Individual Lead Marketplace) — real browse, filter, buy
- Module 6 (Lead Distribution Engine) — merry-go-round, rotation, caps, auto-buy
- Module 7 (Lead Detail & Lifecycle) — statuses, assignment tracking
- Module 12 (Admin Dashboard) — lead inventory, pricing, distribution controls, wallet adjustments

---

## Phase 3 — Integrations, Notifications & Communication

**Goal:** Connect external systems (Twilio, GoHighLevel, CRMs), add notifications, and close the loop on lead lifecycle.

### Deliverables

| Area | Details |
|------|---------|
| **Twilio Integration** | Assign Twilio numbers to users/campaigns. Track SMS and call activity tied to lead IDs. Log communication events in lead timeline. Click-to-call from lead detail. Opt-out / DNC compliance handling. Engagement metrics on dashboard. |
| **GoHighLevel Integration** | Push purchased/distributed leads into GHL subaccounts. Tag leads by plan, market, source, purchase type. Trigger workflows for email/SMS follow-up. Sync disposition updates back to platform. Onboarding email automations for new customers. |
| **CRM Integrations** | Direct integrations for major CRMs (field mapping, lead delivery). Webhook support for custom CRMs. Zapier / Make support. CSV export. API access documentation. Reference section with setup guides, field mapping, troubleshooting. |
| **Notifications System** | Customer notifications: welcome, wallet funded, subscription confirmed, new lead delivered, low balance alert, auto-reload success/failure, integration reminders, onboarding progress. Market alerts: subscribe to new leads by state/county/ZIP/type/exclusivity/price/age. Delivery channels: email, SMS, in-app, push. User controls: instant, batched, digest, DND, max per day. Internal notifications: payment failed, sync failed, lead stuck, high-value lead sold. |
| **Email Verification & Password Reset** | Email verification flow on signup. Forgot password / reset password. |
| **Google OAuth** | Optional Google login alongside email/password. |

### PRD sections addressed in Phase 3
- Module 8 (Twilio Integration)
- Module 9 (GoHighLevel Integration)
- Module 10 (CRM Integrations)
- Module 13 (Notifications and Emails)
- Module 1 (Authentication) — email verification, forgot password, Google login
- Module 15 (Permissions & Compliance) — DNC, consent, audit logs

---

## Phase 4 — Polish, Intelligence & Scale

**Goal:** AI-powered features, advanced analytics, team permissions, and production hardening.

### Deliverables

| Area | Details |
|------|---------|
| **AI Lead Scoring** | Quality scoring model for incoming leads. Smart recommendations: suggest leads to buyers based on history. Predictive pricing based on market demand. |
| **Advanced Analytics** | Cohort reporting (buyer retention, spend over time). Admin metrics: MRR, one-time revenue, delivery success rate, contact rate, subscription churn, top buyers by spend. Lead conversion funnel analytics. |
| **Advanced Routing** | Rainfall pricing automation (price decreases over time if unsold). Advanced skip logic, retry windows, aging rules, markdown schedules. Replacement logic for bad leads. |
| **Team & Permissions** | Team / Support / Sales roles with scoped access. Account health monitoring for support staff. Multi-user organizations. |
| **Support Center** | Support tickets system. Knowledge base / FAQ. Onboarding tutorial videos. |
| **Recovery Flows** | Abandoned cart / unused balance recovery. Re-engagement campaigns for inactive users. |
| **Production Hardening** | Redis for queues / rotation / caching. Rate limiting, security headers. Infrastructure: Vercel/AWS frontend, AWS/Railway backend, S3 for media. Monitoring, logging, error tracking. Load testing. |

### PRD sections addressed in Phase 4
- Module 14 (Revenue Model) — breakage, add-on services
- Module 15 (Permissions & Compliance) — advanced roles, audit logs, secure storage
- Module 16 (Tech Stack) — Redis, background jobs, infrastructure
- Phase 2–3 from PRD MVP scope (advanced routing, AI scoring, recovery)

---

## Summary

| Phase | Scope | Cumulative Progress |
|-------|-------|-------------------|
| **Phase 1** (Done) | Auth, onboarding, wallet, dashboard, mock marketplace | ~30% |
| **Phase 2** (Next) | Lead distribution engine, real marketplace, Stripe, subscriptions, admin panel | ~60% |
| **Phase 3** | Twilio, GHL, CRM integrations, notifications, email verification | ~85% |
| **Phase 4** | AI scoring, analytics, advanced routing, teams, support, production | 100% |

---

*Generated from PRD: "Lead Distribution Marketplace PRD" (14 pages) — matched against current codebase state as of Phase 1 completion.*
