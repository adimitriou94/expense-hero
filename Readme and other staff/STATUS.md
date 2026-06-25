# CAPVO — Status & Change Log

> Last updated: 2026-06-25 — Version 1.15.10

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **1.15.10** | 2026-06-25 | **Performance + Edge Cases Batch** (see below) |
| **1.15.9** | 2026-06-25 | **Security + Bug Fixes Batch** (see below) |
| 1.15.8 | — | Previous release |

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

### Version Bump
| # | Change | Files |
|---|--------|-------|
| 8 | Version `1.15.9` → `1.15.10` | `index.html` (41 script links), `js/app-version.js`, `manifest.webmanifest`, `service-worker.js` |

---

## ✅ DONE — 1.15.9 Security + Bug Fixes Batch

### Security
| # | Issue | Fix | File |
|---|-------|-----|------|
| 1 | config.js tracked in git + exposed Supabase anon key | Added to `.gitignore`, `git rm --cached`, removed from SW `APP_SHELL`, bumped `CACHE_NAME` to v1.15.9 | `.gitignore`, `service-worker.js` |
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
| D-1 | `saveToSupabase` delete-orphans pattern → data loss across devices | 3-4h | FIX-ACTION 2.1, CODE_REVIEW D-1 | Needs SQL migration (`deleted_at` column) |
| D-2 | `capvoUpdateWalletBalance` TOCTOU race — no `updated_at` check | 30 min | CODE_REVIEW D-7 | Two tabs overwrite silently |
| D-3 | `capvoApplyCycleAmountToWallet` wallet update before income marking | 15 min | FIX-ACTION 2.3, CODE_REVIEW D-3 | Upsert income row first, then wallet, then mark |
| D-4 | Telegram sync optimistic local mutation before server confirm | 30 min | CODE_REVIEW D-8 | Move `D.months` mutation after server save |
| D-5 | `deleteInstallmentPlan` — cascade deletes non-atomic | 1h | CODE_REVIEW D-5 | Needs DB-level cascade or RPC transaction |

### P1 (Data Integrity)
| # | Issue | Effort | Source | Notes |
|---|-------|--------|--------|-------|
| EC-5 | `createPaidTodayCycle` — double-click between tabs | 15 min | CODE_REVIEW EC-5 | DB-level ON CONFLICT WHERE NOT wallet_deposit_applied |
| EC-9 | `saveWalletFromSheet` primary flag clearing race | 15 min | CODE_REVIEW EC-9 | `updated_at` version check on clearing UPDATE |
| UI-4 | `saveFixed` — no `fetchAllData` recovery on failure | 10 min | FIX-ACTION 2.5, CODE_REVIEW UI-4 | Add `fetchAllData(userId)` + `render()` to catch |
| UI-6 | `saveCardPayment` — installment failure leaves inconsistent state | 15 min | CODE_REVIEW D-6 | Add `fetchAllData(userId)` to catch block |

### P2 (Performance)
| # | Issue | Effort | Source | Notes |
|---|-------|--------|--------|-------|
| PERF-1 | `render()` rebuilds ENTIRE page on every data change | 1-2h | CODE_REVIEW PERF-1 | Split to per-section renders |
| PERF-2 | `archiveBuildCycles()` freezes page with >6mo data | 30 min | FIX-ACTION 3.2, CODE_REVIEW PERF-2/PERF-5 | Add cache with version counter |
| PERF-4 | `rStats()` rebuilds EVERY report section | 30 min | CODE_REVIEW PERF-4 | Split into per-section renders |

### P3 (Marginal — Money / UI)
| # | Issue | Effort | Source | Notes |
|---|-------|--------|--------|-------|
| FP-4 | `savingsNet` double-counts withdrawals in advisor | 10 min | FIX-ACTION 4.2, CODE_REVIEW FP-4 | Use `capvoAdvisorSum` with raw amounts |
| UI-5 | `txCompleteFillManualForm` card purchases lose `isCreditCardPurchase` metadata | 10 min | CODE_REVIEW UI-5 | Preserve card purchase flags, prevent payment source change |
| PERF-3 | Split `render()` to per-section calls (not full chain) | 1-2h | FIX-ACTION 3.3 | Call only relevant render functions |

### P4 (Edge Cases)
| # | Issue | Effort | Source | Notes |
|---|-------|--------|--------|-------|
| EC-1 | `parseExpense` "καφές 150" → 150€ not 1.50€ | 10 min | CODE_REVIEW EC-1 | Add warning for amounts > 5000 in sync preview |
| EC-2 | `syncTextHasAlias` substring false positives | 15 min | CODE_REVIEW EC-2 | Word-boundary or tokenized matching |
| EC-4 | `expenseExistsById` only checks local D.months, not Supabase | 15 min | CODE_REVIEW EC-4 | Add Supabase query for duplicate detection |
| EC-6 | `deleteExpenseRow` partial failure in rollback chain | 15 min | CODE_REVIEW EC-8 | Retry on wallet rollback failure |
| EC-10 | `capvoAdvisorDaysBetween` returns NaN when both dates invalid | 5 min | CODE_REVIEW EC-10 | Guard: `if(!totalDays || totalDays <= 0) return defaults` |

### P5 (Nice to Have)
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
- [ ] Confirm `js/config.js` is NOT in git (`git ls-files js/config.js` should return nothing)
- [ ] Push to GitHub Pages

---

*This file is auto-generated and updated during each fix session. See `Readme and other staff/` for original reports (SECURITY, CODE_REVIEW, ACTION_PLAN, ARCHITECTURE).*
