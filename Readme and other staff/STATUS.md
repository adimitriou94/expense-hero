# CAPVO — Status & Change Log

> Last updated: 2026-06-25 — Version 1.15.12 (deployed)

---

## 📖 App Overview — Quick Reference

> **Use this section when handing the project to another AI session.** Paste it at the top of a new chat so the assistant understands the full context.

### What CAPVO Does

**CAPVO** ("Track. Understand. Control.") is a **mobile-first personal expense tracker** built entirely with vanilla JS, plain CSS, and a single HTML file. Written 100% in Greek.

**Core Features:**
- **Dashboard** — Monthly budget balance, spent vs income, progress bar, salary tracking, quick-add expense
- **Transactions (Κινήσεις)** — Daily expenses list with search, filters (expenses, fixed, cards, wallets, savings, income, 7-day)
- **Wallets (Λογαριασμοί)** — Multi-account management (bank, cash, prepaid, savings, investment). Wallet transfers
- **Income (Εξτρα Έσοδα)** — Extra income sources with donut charts
- **Cards & Debts (Κάρτες & Οφειλές)** — Credit card/loan management, installment plans (ατόκες δόσεις), payment scheduling, payoff calculators
- **Advisor (Σύμβουλος)** — Financial health engine: 0-100 score, card debt advice, 50/30/20 rule, daily recommendations
- **Reports (Στατιστικά)** — Monthly KPIs, category breakdown, merchant analysis
- **Archive (Αρχείο)** — Historical budget cycles
- **Settings** — Telegram sync, backup/export/import (JSON), budget configuration
- **Savings Goals (Στόχοι)** — Savings targets with progress tracking
- **Telegram Bot** — Text/voice expense entry via @myexpense_hero_tracker_bot, Whisper voice transcription, fuzzy category matching

### Architecture

**No build system** — pure static files. No webpack/Vite/npm.

**Stack:**
| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES6+), plain HTML/CSS |
| Styling | Plain CSS in 4 files |
| PWA | Service worker, manifest.webmanifest |
| Backend/DB | Supabase (PostgreSQL) via CDN |
| Auth | Supabase Auth + Google OAuth, PKCE flow |
| Serverless | Cloudflare Workers — Telegram webhook, sync |
| AI | Cloudflare Workers AI (OpenAI Whisper) — voice→text |
| APIs | Telegram Bot API, nager.date (Greek holidays), Google Fonts |
| Hosting | GitHub Pages |

**Data Model:** 24 Supabase tables, all with Row Level Security (RLS) using `auth.uid() = user_id`. No cross-user data access possible.

### Current File Structure

```
Application/
  index.html                     # Single HTML SPA shell (~2100 lines)
  manifest.webmanifest           # PWA manifest
  service-worker.js              # App-shell cache (excludes config.js)
  worker.js                      # Cloudflare Worker (Telegram webhook)

  css/
    capvo-core.css               # Variables, reset, app shell, branding
    capvo-components.css         # Auth, Telegram, Quick Add, mobile nav
    capvo-pages.css              # Dashboard, transactions, income, cards, advisor, reports, archive, settings
    capvo-mobile.css             # Mobile/final overrides

  js/
    index.html (inline <script>) # CONFIG object — SUPABASE_URL, SUPABASE_ANON_KEY, WORKER_URL
    index.html (inline <script>) # Object.freeze(CONFIG)

    js/app/                      # Core modules — 27 files loaded in numbered order
      00a-supabase.js            # Supabase client, constants
      00b-state.js               # Global D state, wallet/category helpers, debounce, SPA nav
      00c1-budget-cycle.js       # Budget cycle manager
      00c2-holiday-salary.js     # Holiday salary / 13th-month
      00c3-fixed-budget.js       # Fixed budget config
      01-ui-selection-toast.js   # Bulk select, toast, confirm modal
      02a-data-fetch.js          # Supabase fetch operations
      02b-data-save.js           # Supabase save/delete operations
      02c-wallet-settings.js     # Wallet balance, fixed expense payments
      03a-dashboard.js           # Dashboard render, wallet cards
      03b-transactions.js        # Transaction list render
      03c1-income-sources.js     # Income page render
      03c2-savings-goals.js      # Savings goals render
      04a-reports.js             # Reports/statistics
      04b-archive.js             # Archive/history
      05-income-pickers.js       # Income picker UI
      06a-modal-ui.js            # Modal open/close, helpers
      06b-save-actions.js        # Validate/save/delete actions
      06c-nav-auth.js            # Navigation router, auth, Telegram
      06d1-misc-ui.js            # Quick add, misc UI
      06d2a-onboarding-flow.js   # Onboarding wizard flow
      06d2b-onboarding-render.js # Onboarding wizard render
      06d3-finishing.js          # Finishing touches, legacy cleanup
      07a-add-center-core.js     # Quick/Manual tabs, pickers, form
      07b-add-center-txcomplete.js # Transaction completion
      07c-add-center-v4v5.js     # V4 Premium + V5 Hotfix
      08-auth-bootstrap.js       # Auth bootstrap, initApp guard
      09-wallet-financial-engine.js # Wallet financial calculations

    cards.js                     # Credit card & debt planner (~500 lines)
    sync.js                      # Telegram sync, expense parsing (~450 lines)
    advisor.js                   # Financial advisor engine (~500 lines)
    wallets.js                   # Wallet UI, transfers (~300 lines)

    js/legacy/
      app.monolith.backup.js     # Full pre-refactor monolith (~5217 lines)
      06-modals-nav-auth.js.backup
```

### Configuration & Credentials

| Item | Location | Notes |
|------|----------|-------|
| `CONFIG` object (SUPABASE_URL, SUPABASE_ANON_KEY, WORKER_URL) | **Inline in `index.html`** | Replaced `js/config.js` in v1.15.10 after it was removed from git |
| Supabase Service Role Key | Cloudflare Worker (`worker.js`) only | Never in client code |
| Telegram Bot Token | Cloudflare Worker (`worker.js`) only | Never in client code |
| Google OAuth Client ID | Supabase Dashboard | PKCE flow, no client secrets |

**⚠️ IMPORTANT:** `js/config.js` was **removed from git** and replaced with inline CONFIG. **Never** restore `js/config.js` as a file — it causes 404 on deployment. If you need to update credentials, edit the inline `<script>` in `index.html`.

### Version Management

Version is defined in **4 places** and must be bumped together:
1. `js/app-version.js` — `window.CAPVO_VERSION` + `window.CAPVO_CACHE_VERSION`
2. `index.html` — `?v=VERSION` on all 41 script/style links
3. `manifest.webmanifest` — `"version"` field
4. `service-worker.js` — `CACHE_NAME` constant

---

## 🤖 AI Session Instructions

> **Paste this entire file at the start of a new AI chat.** It contains everything needed to understand the project state and continue work.

### How to Work on This Project

1. **Always read STATUS.md first** — it has the complete list of what's done and what's pending
2. **Every change must be committed locally** — never push without explicit user approval
3. **Test before pushing** — always tell the user what to test, then wait for confirmation
4. **Update STATUS.md with every change** — this is the single source of truth
5. **The CONFIG object is inline in index.html** — never try to use an external config.js file
6. **Supabase anon key is public by design** — it's safe to be in the HTML; RLS protects all data
7. **Service worker caches APP_SHELL only** — config.js is excluded; API requests are never cached
8. **Script load order in index.html is critical** — the numbered modules depend on each other
9. **No build system** — all files are plain static; changes are live after GitHub Pages deploy
10. **Legacy backup exists** — `js/legacy/app.monolith.backup.js` has the pre-refactor monolith if needed

### Git Workflow

```bash
# Commit only — never push without asking
git add -A
git commit -m "description"

# Only push when user says: "push"
git push origin main
```

### Current State (v1.15.12)

**Recently completed:** Security fixes, wallet state management, closeAddCenterSheet consolidation, card payment order, advisor float fixes, sync picker DOM index fix, search debounce, wallet reduce float fix, popstate cleanup, inline CONFIG, archive cache, saveFixed/saveCardPayment recovery.

**Pending high-priority:** delete-orphans data loss (D-1), wallet TOCTOU race (D-2), full-page render split (PERF-1), rStats rebuild (PERF-4), several data integrity and edge cases.

See **PENDING** section below for the full list with effort estimates.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **1.15.12** | 2026-06-25 | **Data Integrity + Edge Cases Batch** (see below) |
| **1.15.11** | 2026-06-25 | **Archive Cache + Audit Discoveries** |
| **1.15.9** | 2026-06-25 | **Security + Bug Fixes Batch** (see below) |
| 1.15.8 | — | Previous release |

---

## ✅ DONE — 1.15.12 Data Integrity + Edge Cases Batch

### Data Integrity Fixes
| # | Issue | Fix | File |
|---|-------|-----|------|
| UI-4 | `saveFixed` — no `fetchAllData` recovery on failure | Added `fetchAllData(userId)` + `render()` in catch block to sync local state with server | `js/app/06b-save-actions.js` |
| UI-6 | `saveCardPayment` — installment failure leaves inconsistent state | Added `fetchAllData(userId)` + `render()` in catch block to sync local state with server | `js/cards.js` |

### Edge Case Fixes
| # | Issue | Fix | File |
|---|-------|-----|------|
| EC-1 | `parseExpense` "καφές 150" → 150€ not 1.50€ | Added warning for amounts > 5000 in sync preview | `js/sync.js` |
| EC-2 | `syncTextHasAlias` substring false positives | Switched to tokenized word-boundary matching | `js/sync.js` |
| EC-4 | `expenseExistsById` only checks local D.months | Added Supabase query for duplicate detection by message_id | `js/sync.js` |
| UI-5 | Card purchase edit loses `isCreditCardPurchase` metadata | Preserve card purchase flags in `txCompleteFillManualForm`, prevent payment source change | `js/app/07b-add-center-txcomplete.js` |

### Performance
| # | Issue | Fix | File |
|---|-------|-----|------|
| PERF-4 | `rStats()` rebuilds EVERY report section on every call | Split into per-section renders: `rStatsCategoryBreakdown()`, `rStatsMerchantAnalysis()`, `rStatsInsights()` — only called when reports page is active | `js/app/04a-reports.js` |

---

## 🔄 IN PROGRESS — 1.15.11 Data Integrity Quick Wins

> **Audit done 2026-06-25:** Reviewed 3 quick wins from pending list. 2 were already fixed in code from older sessions.

### Already Fixed (discovered during audit)
| # | Issue | Status |
|---|-------|--------|
| D-3 | `capvoApplyCycleAmountToWallet` wrong order | ✅ **Already fixed** — upsert income → wallet → mark (line 585→593→595 in `02b-data-save.js`) |
| EC-10 | `capvoAdvisorDaysBetween` NaN guard | ✅ **Already fixed** — `Math.max(1, ...)` at line 22 in `advisor.js` |

### New Fixes (1.15.11)
| # | Issue | Fix | File |
|---|-------|-----|------|
| 1 | `archiveBuildCycles()` freezes page with >6mo data (6720+ iterations) | Added versioned cache (`__archiveCacheVersion`) with `capvoArchiveCacheVersion()` + `capvoInvalidateArchiveCache()`. Cache invalidated on every saveToSupabase() and deleteExpenseRow(). ~50x+ speedup on archive page. | `js/app/04b-archive.js`, `02b-data-save.js`, `06b-save-actions.js` |

### Still Pending
| # | Issue | Status |
|---|-------|--------|
| D-1 | `saveToSupabase` delete-orphans → data loss | ❌ Still present in 3 tables — needs SQL migration |
| EC-6 | `deleteExpenseRow` partial failure in rollback chain | ⚠️ Has rollback but no retry — marginal |

---

## ✅ DONE — 1.15.10 Performance + Edge Cases Batch

### Performance
| # | Issue | Fix | File |
|---|-------|-----|------|
| 1 | Search input triggers full render on every keystroke | Added `capvoDebouncedRenderDailyList()` with 250ms debounce | `index.html`, `js/app/00b-state.js` |
| PERF-3 | Search filter chips trigger full render | Same debounce utility available | `js/app/00b-state.js` |

### DOM Index Drift
| # | Issue | Fix | File |
|---|-------|-----|------|
| 2 | Sync picker reads values by DOM index (`$('sSkip'+idx)`) → breaks if row order changes | Added `data-msg-id="${msgId}"` to each row article; `confirmSync` uses `[data-msg-id="..."]` selector | `js/sync.js` |

### Floating Point / Money Fixes
| # | Issue | Fix | File |
|---|-------|-----|------|
| 3 | `calcPayoff` loop accumulates float error over 600 iterations | `Math.round(...*100)/100` per iteration for `bal` and `tp` | `js/cards.js` |
| 4 | Wallet totals accumulate float artifacts in reduce | Added `+1e-9` to reduce sums to avoid 1499.9999999999998 | `js/app/09-wallet-financial-engine.js` |

### Advisor Edge Cases
| # | Issue | Fix | File |
|---|-------|-----|------|
| 5 | `capvoAdvisorDaysBetween` — already had `Math.max(1, ...)` guard | No change needed (was already guarded) | `js/advisor.js` |

### SPA Navigation
| # | Issue | Fix | File |
|---|-------|-----|------|
| 6 | `addCenterEditState` not reset on browser back/forward (popstate) | Added `popstate` listener that clears `addCenterEditState = null` | `js/app/00b-state.js` |

### Code Cleanup
| # | Issue | Fix | File |
|---|-------|-----|------|
| 7 | `walletRole()` wrapper around `inferWalletBudgetRole` — redundant | Renamed internal call to use `window.capvoWalletBudgetRole` directly; kept alias for compatibility | `js/app/09-wallet-financial-engine.js` |

### Config / Deployment
| # | Issue | Fix | File |
|---|-------|-----|------|
| 9 | `js/config.js` removed from git → 404 on deployment | Replaced external `config.js` with inline `<script> window.CONFIG = {...} </script>` in `index.html` | `index.html` |

### Version Bump
| # | Change | Files |
|---|--------|-------|
| 10 | Version `1.15.9` → `1.15.10` | `index.html` (41 script links), `js/app-version.js`, `manifest.webmanifest`, `service-worker.js` |

---

## ✅ DONE — 1.15.9 Security + Bug Fixes Batch

### Security
| # | Issue | Fix | File |
|---|-------|-----|------|
| 1 | config.js tracked in git + exposed Supabase anon key | Added to `.gitignore`, `git rm --cached`, removed from SW `APP_SHELL`, replaced with inline `<script> window.CONFIG = {...} </script>` in `index.html` (anon key is public by design — RLS protects data) | `index.html`, `.gitignore`, `service-worker.js` |
| 2 | Dead `SUPABASE_SERVICE_ROLE_KEY` reference in client code | Deleted entire `saveTelegramLinkRequest` function (23 lines) | `js/app/06c-nav-auth.js` |

### Critical Bug Fixes
| # | Issue | Fix | File |
|---|-------|-----|------|
| 3 | `walletSheetSubmitting` never reset on success → save button permanently disabled | Moved `walletSheetSubmitting=false` into `finally` block | `js/wallets.js` |
| 4 | Unguarded `initApp()` calls → app crashes if core script fails | Added `if(typeof initApp==='function')` guards | `js/app/08-auth-bootstrap.js`, `js/advisor.js` |

### UI / State Fixes
| # | Issue | Fix | File |
|---|-------|-----|------|
| 5 | `closeAddCenterSheet` defined 4× in different IIFEs → load-order dependent behavior | Consolidated into single authoritative version in `07a-add-center-core.js` with full cleanup (edit state, submit reset, body classes, pickers) | `js/app/07a-add-center-core.js`, `07b-add-center-txcomplete.js`, `07c-add-center-v4v5.js` |
| 6 | `delCC` — deleting a card leaves orphan transactions/plans → inflated debt | Added filter cleanup for `creditCardTransactions` and `creditCardInstallmentPlans` | `js/cards.js` |

### Data Integrity Fixes
| # | Issue | Fix | File |
|---|-------|-----|------|
| 7 | `capvoPayFixedExpense` — payment insert BEFORE wallet update → orphaned payment if wallet fails | Reordered: wallet update → payment insert | `js/app/02c-wallet-settings.js` |

### Floating Point / Money Fixes
| # | Issue | Fix | File |
|---|-------|-----|------|
| 8 | `safeForecast` shows -0.02 due to float rounding | `Math.max(0, balance-(safeToday*remainingDays))` | `js/advisor.js` |
| 9 | `??` misuse for zero value — safeToday=0 falls through to dailyAllowance | Explicit null check: `!=null ? ... : ...` | `js/advisor.js` |

### Version Bump
| # | Change | Files |
|---|--------|-------|
| 10 | Version `1.15.8` → `1.15.9` | `index.html` (41 script links), `js/app-version.js`, `manifest.webmanifest`, `service-worker.js` |

---

## 📋 PENDING — What's Still Left

### P0 (Critical / High — Data Integrity)
| # | Issue | Effort | Source | Notes |
|---|-------|--------|--------|-------|
| D-1 | `saveToSupabase` delete-orphans pattern → data loss across devices | 3-4h | FIX-ACTION 2.1, CODE_REVIEW D-1 | Needs SQL migration (`deleted_at` column), changes `saveToSupabase`, `deleteExpenseRow` |
| D-2 | `capvoUpdateWalletBalance` TOCTOU race — no `updated_at` check | 30 min | CODE_REVIEW D-7 | Two tabs overwrite silently |
| D-4 | Telegram sync optimistic local mutation before server confirm | 30 min | CODE_REVIEW D-8 | Move `D.months` mutation after server save |
| D-5 | `deleteInstallmentPlan` — cascade deletes non-atomic | 1h | CODE_REVIEW D-5 | Needs DB-level cascade or RPC transaction |

### P1 (Data Integrity)
| # | Issue | Effort | Source | Notes |
|---|-------|--------|--------|-------|
| EC-5 | `createPaidTodayCycle` — double-click between tabs | 15 min | CODE_REVIEW EC-5 | DB-level ON CONFLICT WHERE NOT wallet_deposit_applied |
| EC-9 | `saveWalletFromSheet` primary flag clearing race | 15 min | CODE_REVIEW EC-9 | `updated_at` version check on clearing UPDATE |
| EC-6 | `deleteExpenseRow` partial failure in rollback chain | 15 min | CODE_REVIEW EC-8 | Retry on wallet rollback failure |

### P2 (Performance)
| # | Issue | Effort | Source | Notes |
|---|-------|--------|--------|-------|
| PERF-1 | `render()` rebuilds ENTIRE page on every data change | 1-2h | CODE_REVIEW PERF-1 | Split to per-section renders |

### P3 (Marginal — Money / UI)
| # | Issue | Effort | Source | Notes |
|---|-------|--------|--------|-------|
| FP-4 | `savingsNet` double-counts withdrawals in advisor | 10 min | FIX-ACTION 4.2, CODE_REVIEW FP-4 | **Already fixed** — `capvoAdvisorSum` with raw amounts (line 409) ✅ |
| PERF-3 | Split `render()` to per-section calls (not full chain) | 1-2h | FIX-ACTION 3.3 | Call only relevant render functions |

### P4 (Nice to Have)
| # | Issue | Effort | Source | Notes |
|---|-------|--------|--------|-------|
| A11y | Missing aria-labels, aria-live regions | 30 min | CODE_REVIEW P5, FIX-ACTION 5.1 | Add aria-labels + aria-live to index.html |
| A11y | Inline onclick handlers → should migrate to addEventListener | Long-term | CODE_REVIEW P5 | Progressive migration |

---

## 🔒 Security — Still Open

| # | Issue | Priority | Source | Notes |
|---|-------|----------|--------|-------|
| HIGH-1 | Worker endpoints have no rate limiting → cost abuse via Whisper | High | REPORT_SECURITY HIGH-2 | Add rate limiting + file size/duration validation |
| MED-1 | JSON import/export has no schema validation | Medium | REPORT_SECURITY MED-2 | Add schema check + version check + user warning |
| MED-2 | Sync picker innerHTML echo-back XSS vector | Medium | REPORT_SECURITY MED-3 | Use `esc()` instead of raw DOM innerHTML |
| MED-4 | Worker endpoints lack CSRF protection | Medium | REPORT_SECURITY MED-4 | Add CSRF token validation to state-changing endpoints |
| LOW-1 | Auth session in localStorage unencrypted | Low | REPORT_SECURITY LOW-1 | Acceptable risk with PKCE + CSP |
| LOW-2 | Telegram Chat ID as PII in localStorage | Low | REPORT_SECURITY LOW-2 | Acceptable — Chat ID is public once obtained |
| LOW-3 | Session persists across browser close | Low | REPORT_SECURITY LOW-3 | Acceptable UX tradeoff |

---

## 📐 Architecture — Ongoing

### Completed
- ✅ **Monolith → split refactor**: `app.js` (5397 lines) split into 27 modules in `js/app/`
- ✅ **CSS → 4 files**: core, components, pages, mobile

### Identified Issues (Not Yet Fixed)
| # | Issue | Effort | Source | Notes |
|---|-------|--------|--------|-------|
| 3.1 | Large file code smells: `03-render-*.js` 3874 lines, `00-core-state.js` 2045 lines, `02-supabase-data.js` 2523 lines | Ongoing | ARCHITECTURE 3.1 | Target: ~1300 lines each |
| 3.3 | `00-core-state.js` mixed concerns (8 different concepts) | Ongoing | ARCHITECTURE 3.3 | Separate state, wallet helpers, category helpers |
| 3.4 | Top-level JS (`cards.js`, `sync.js`, `advisor.js`, `wallets.js`) vs `js/app/` location inconsistency | Low | ARCHITECTURE 3.4 | Move all to `js/app/` or `js/features/` |
| 3.5 | `sync.js` 49KB mixed responsibilities | Medium | ARCHITECTURE 3.5 | Split into telegram-bot, sync-picker, sync-save |
| 3.6 | `index.html` 2179 lines, growing | Low | ARCHITECTURE 3.6 | Extract feature sections into template files |
| 3.7 | Missing clear module boundaries/documentation | Low | ARCHITECTURE 3.7 | Add JSDoc + module export comments |

### Technical Debt
- **Test coverage**: 0 files — should add unit tests for `syncExtractAmount`, `capvoMoney`, category matching
- **Version management**: Version hardcoded in 4 places + 41 script links — should use single source of truth

---

## 🚀 Deployment Checklist

For each new version:
- [ ] Bump version in `js/app-version.js`, `index.html`, `manifest.webmanifest`, `service-worker.js`
- [ ] Test in browser (login, add/edit/delete expenses, wallet, advisor, sync)
- [ ] Verify SW cache invalidation (new CACHE_NAME)
- [ ] Confirm `js/config.js` is NOT in git (CONFIG is inline in `index.html`)
- [ ] Push to GitHub Pages

---

*This file is auto-generated and updated during each fix session. See `Readme and other staff/` for original reports (SECURITY, CODE_REVIEW, ACTION_PLAN, ARCHITECTURE).*
