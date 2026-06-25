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

### P0 (Critical / High)
| # | Issue | Effort | Notes |
|---|-------|--------|-------|
| D-1 | `saveToSupabase` delete-orphans pattern → data loss across devices | 3-4h | Needs SQL migration (`deleted_at` column), changes `saveToSupabase`, `deleteExpenseRow` |

### P1 (Data Integrity)
| # | Issue | Effort | Notes |
|---|-------|--------|-------|
| D-5 | `deleteInstallmentPlan` — cascade deletes non-atomic | 1h | Needs DB-level cascade or RPC transaction |
| EC-5 | `createPaidTodayCycle` — double-click between tabs | 15 min | DB-level conflict resolution |
| EC-9 | `saveWalletFromSheet` primary flag clearing race | 15 min | `updated_at` version check |

### P2 (Performance)
| # | Issue | Effort | Notes |
|---|-------|--------|-------|
| PERF-2 | `archiveBuildCycles()` freezes page with >6mo data | 30 min | Add cache with version counter |

### P3 (Marginal)
| # | Issue | Effort | Notes |
|---|-------|--------|-------|
| UI-5 | Card purchase edit loses `isCreditCardPurchase` metadata | 10 min | Preserve card flags |

### P4 (Nice to Have)
| # | Issue | Effort | Notes |
|---|-------|--------|-------|
| A11y | Missing aria-labels, aria-live regions | 30 min | index.html |
| A11y | Inline onclick handlers → should migrate to addEventListener | Long-term | index.html, all JS |

---

## 🔒 Security — Still Open

| # | Issue | Priority |
|---|-------|----------|
| HIGH-1 | Worker endpoints have no rate limiting → cost abuse via Whisper | High |
| MED-1 | JSON import/export has no schema validation | Medium |
| MED-2 | Sync picker innerHTML echo-back XSS vector | Medium |
| MED-4 | Worker endpoints lack CSRF protection | Medium |

---

## 📐 Architecture — Ongoing

- **Monolith → split refactor**: ✅ COMPLETE. `app.js` (5397 lines) split into 27 modules in `js/app/`
- **CSS → 4 files**: ✅ COMPLETE. core, components, pages, mobile
- **Next potential refactor**: Split `00b-state.js` (global `D` state management) into signals/observers
- **Test coverage**: 0 files — should add unit tests for `syncExtractAmount`, `capvoMoney`, category matching

---

## 🚀 Deployment Checklist

For each new version:
- [ ] Bump version in `js/app-version.js`, `index.html`, `manifest.webmanifest`, `service-worker.js`
- [ ] Test in browser (login, add/edit/delete expenses, wallet, advisor, sync)
- [ ] Verify SW cache invalidation (new CACHE_NAME)
- [ ] Confirm `js/config.js` is NOT in git (`git ls-files js/config.js` should return nothing)
- [ ] Push to GitHub Pages

---

*This file is auto-generated and updated during each fix session. See `Readme and other staff/` for original reports (SECURITY, CODE_REVIEW, ACTION_PLAN).*
