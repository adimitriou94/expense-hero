# CAPVO Expense Tracker -- App Analysis Report

## 1. Τι Κάνει η Εφαρμογή

Το **CAPVO** ("Track. Understand. Control.") είναι μια **mobile-first εφαρμογή προσωπικών οικονομικών** για tracking εξόδων, budget, και χρηματοοικονομική νοημοσύνη. Γραμμένη 100% στα ελληνικά.

## 2. Tech Stack

| Στρώση | Τεχνολογία |
|--------|------------|
| **Frontend** | Vanilla JavaScript (ES6+), χωρίς framework. Καθαρό HTML/CSS/JS. |
| **Styling** | Plain CSS σε 4 αρχεία (core, components, pages, mobile) |
| **PWA** | Service worker, manifest.webmanifest, icon assets |
| **Backend/DB** | Supabase (PostgreSQL) μέσω CDN client |
| **Auth** | Supabase Auth + Google OAuth, PKCE flow |
| **Serverless** | Cloudflare Workers (worker.js) για Telegram webhook, sync, holidays |
| **AI** | Cloudflare Workers AI (OpenAI Whisper) για voice-to-text από Telegram |
| **External APIs** | Telegram Bot API, nager.date (αργίες Ελλάδας), Google Fonts |
| **Hosting** | GitHub Pages (adimitriou94.github.io) |

**Δεν υπάρχει build system** — καθαρά static αρχεία, χωρίς webpack/Vite/npm.

## 3. Core Features

1. **Dashboard** — Monthly budget balance, spent vs income, progress bar, salary tracking, quick-add expense
2. **Transactions (Κινήσεις)** — Daily expenses list with search, filters (expenses, fixed, cards, wallets, savings, income, 7-day), category organization
3. **Wallets (Λογαριασμοι)** — Multi-account management (bank, cash, prepaid, savings, investment). Wallet transfers between accounts
4. **Income (Εξτρα Εσοδα)** — Extra income sources with donut charts
5. **Cards & Debts (Καρτες & Οφειλες)** — Credit card/loan management with installment plans (ατοκες δοσεις), payment scheduling, payoff calculators
6. **Advisor (Συμβουλος)** — Financial intelligence engine: 0-100 health score, card debt advice, 50/30/20 rule analysis, daily recommendations
7. **Reports (Στατιστικα)** — Month KPIs, category breakdown, merchant analysis, insights
8. **Archive (Αρχειο)** — Historical budget cycles
9. **Settings** — Telegram sync, backup/export/import (JSON), budget configuration
10. **Goals/Savings (Στοιχοι)** — Savings goals with targets and tracking
11. **Telegram Bot** — Send expenses via text/voice to @myexpense_hero_tracker_bot. Cloudflare Whisper for voice transcription. Fuzzy category matching

## 4. Project Structure

```
Application/
  index.html                    # Single HTML SPA shell (~2000 lines)
  manifest.webmanifest          # PWA manifest (v1.15.8)
  service-worker.js             # App-shell caching
  worker.js                     # Cloudflare Worker (Telegram webhook, sync)

  css/
    capvo-core.css              # Variables, reset, app shell, branding
    capvo-components.css        # Auth, Telegram wizard, Quick Add
    capvo-pages.css             # All page layouts
    capvo-mobile.css            # Mobile overrides

  js/
    config.js                   # Supabase URL, anon key, Worker URL ⚠️ local-only (gitignored)
    config.example.js           # Template (safe)

    js/app/                     # Core modules (loaded in order) — 27 split files
      00a-supabase.js           # Supabase client, constants
      00b-state.js              # Global D state, wallet/category helpers, debounce, SPA nav
      00c1-budget-cycle.js      # Budget cycle manager
      00c2-holiday-salary.js    # Holiday salary / 13th-month
      00c3-fixed-budget.js      # Fixed budget config
      01-ui-selection-toast.js  # Bulk select, toast, confirm
      02a-data-fetch.js         # Supabase fetch
      02b-data-save.js          # Supabase save/delete
      02c-wallet-settings.js    # Wallet balance, fixed expense payments
      03a-dashboard.js          # Dashboard render
      03b-transactions.js       # Transaction list render
      03c1-income-sources.js    # Income page render
      03c2-savings-goals.js     # Savings goals render
      04a-reports.js            # Reports/statistics
      04b-archive.js            # Archive/history
      05-income-pickers.js      # Income picker UI
      06a-modal-ui.js           # Modal open/close, helpers
      06b-save-actions.js       # Validate/save/delete actions
      06c-nav-auth.js           # Navigation router, auth, Telegram
      06d1-misc-ui.js           # Quick add, misc UI
      06d2a-onboarding-flow.js  # Onboarding wizard flow
      06d2b-onboarding-render.js # Onboarding wizard render
      06d3-finishing.js         # Finishing touches
      07a-add-center-core.js    # Quick/Manual tabs, pickers, form
      07b-add-center-txcomplete.js # Transaction completion
      07c-add-center-v4v5.js    # V4 Premium + V5 Hotfix
      08-auth-bootstrap.js      # Auth bootstrap, initApp guard

    cards.js                    # Credit card & debt planner
    sync.js                     # Telegram sync, expense parsing
    advisor.js                  # Financial advisor engine
    wallets.js                  # Wallet UI, transfers

    js/legacy/
      app.monolith.backup.js    # Full monolith backup (~5217 lines)
      06-modals-nav-auth.js.backup
```

## 5. Data Flow

### Auth Flow
1. Google Sign-In → Supabase PKCE OAuth
2. Telegram linking wizard
3. User sends `/code` to bot → gets 6-digit code
4. Frontend POSTs to Worker `/verify-link` → Worker validates via Supabase → updates profile

### Expense Entry Flow
1. User types "καφες 3" or uses voice
2. `parseExpense()` in sync.js extracts amount, matches category via fuzzy keyword matching
3. Expense saved to `D.months[YYYY-MM].daily` and persisted to Supabase

### Telegram Sync
1. User sends message → Cloudflare Worker webhook → Supabase `telegram_messages` (pending)
2. Frontend calls Worker `/sync` → gets pending messages
3. User reviews in modal, confirms → expenses saved to Supabase

### Budget Calculation
- Balance = wallet balances - fixed payments - card payments - daily expenses - savings
- Daily allowance = remaining / remaining days
- Advisor computes health score (0-100)

## 6. Supabase Tables

- `expenses`, `income_sources`, `fixed_expenses`, `fixed_expense_payments`
- `credit_cards`, `credit_card_transactions`, `credit_card_installment_plans/items`
- `wallets`, `wallet_transfers`, `savings_goals`, `savings_transactions`
- `budget_cycles`, `budget_cycle_incomes`, `budget_cycle_carryovers`
- `user_preferences`, `expense_categories`, `telegram_messages`, `telegram_link_requests`, `profiles`

## 7. Architectural Notes

- **Phase 2 wallet model**: Wallets replaced old abstract income-source budget model
- **No-framework SPA**: All DOM manipulation via vanilla `document.getElementById` + `innerHTML`
- **Greek market focus**: Categories, payment sources optimized for Greece (Ticket Restaurant, vouchers, Greek holidays, Greek Orthodox Easter)
- **Data ownership migrated** from Telegram chat ID → Supabase auth user_id (v1.1.0)
- **Version 1.15.10**, deployed to GitHub Pages
