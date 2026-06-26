# CAPVO JS Split Mapping v4

> Updated: 2026-06-25 — reflects the current 27-module structure

## Load Order

The `index.html` loads scripts in this exact numbered order (all classic `<script>` tags):

### Core State & Config (Phase 1)
| File | Lines (approx) | What It Does |
|------|---------------|-------------|
| `00a-supabase.js` | ~15 | Supabase client, constants |
| `00b-state.js` | ~400 | Global `D` state, wallet helpers, category helpers, auth state, debounce utility, SPA navigation cleanup |
| `00c1-budget-cycle.js` | ~300 | Budget cycle manager UI |
| `00c2-holiday-salary.js` | ~200 | Holiday salary / 13th-month logic |
| `00c3-fixed-budget.js` | ~150 | Fixed budget configuration |

### UI Helpers (Phase 2)
| File | Lines (approx) | What It Does |
|------|---------------|-------------|
| `01-ui-selection-toast.js` | ~100 | Bulk select/delete, toast, confirm modal helpers |

### Data Operations (Phase 3)
| File | Lines (approx) | What It Does |
|------|---------------|-------------|
| `02a-data-fetch.js` | ~400 | Supabase fetch operations |
| `02b-data-save.js` | ~450 | Supabase save/delete operations |
| `02c-wallet-settings.js` | ~300 | Wallet balance updates, fixed expense payments |

### Render (Phase 4)
| File | Lines (approx) | What It Does |
|------|---------------|-------------|
| `03a-dashboard.js` | ~300 | Dashboard render, wallet cards, budget progress |
| `03b-transactions.js` | ~300 | Transaction list render, daily list |
| `03c1-income-sources.js` | ~150 | Income page rendering |
| `03c2-savings-goals.js` | ~100 | Savings goals rendering |

### Reports & Archive (Phase 5)
| File | Lines (approx) | What It Does |
|------|---------------|-------------|
| `04a-reports.js` | ~300 | Reports/statistics rendering |
| `04b-archive.js` | ~200 | Archive/history rendering |

### UI Widgets (Phase 6)
| File | Lines (approx) | What It Does |
|------|---------------|-------------|
| `05-income-pickers.js` | ~100 | Income custom dropdown/picker UI helpers |

### Modals, Nav, Auth (Phase 7)
| File | Lines (approx) | What It Does |
|------|---------------|-------------|
| `06a-modal-ui.js` | ~250 | Modal open/close, category helpers, card helpers |
| `06b-save-actions.js` | ~250 | Validate/save/delete expense actions |
| `06c-nav-auth.js` | ~300 | Navigation router, auth, Telegram linking |
| `06d1-misc-ui.js` | ~250 | Quick add, misc UI helpers |
| `06d2a-onboarding-flow.js` | ~300 | Onboarding wizard flow |
| `06d2b-onboarding-render.js` | ~200 | Onboarding wizard rendering |
| `06d3-finishing.js` | ~200 | Finishing touches, legacy cleanup |

### Add Center / Quick Add (Phase 8)
| File | Lines (approx) | What It Does |
|------|---------------|-------------|
| `07a-add-center-core.js` | ~150 | V1 Quick/Manual tabs, payment picker, category picker, manual form, recent chips |
| `07b-add-center-txcomplete.js` | ~250 | Transaction completion, manual form edit logic |
| `07c-add-center-v4v5.js` | ~150 | V4 Premium overrides + V5 Hotfix stable state |

### Auth Bootstrap (Phase 9)
| File | Lines (approx) | What It Does |
|------|---------------|-------------|
| `08-auth-bootstrap.js` | ~50 | Final auth bootstrap, initApp safety guard |

### Feature Modules (Top-Level JS — loaded after all `js/app/` modules)
| File | Lines (approx) | What It Does |
|------|---------------|-------------|
| `cards.js` | ~500 | Credit card & debt planner |
| `sync.js` | ~450 | Telegram sync, expense parsing, message picker |
| `advisor.js` | ~500 | Financial advisor engine |
| `wallets.js` | ~300 | Wallet UI, transfers, wallet sheet |

### Legacy
| File | Purpose |
|------|---------|
| `js/legacy/app.monolith.backup.js` | Full monolith backup (pre-refactor, ~5217 lines) |
| `js/legacy/06-modals-nav-auth.js.backup` | Pre-split 06 file backup |

## Why This Is Safe

- No functions were rewritten in the split pass.
- The original full file is preserved at `js/legacy/app.monolith.backup.js`.
- Scripts are classic browser scripts (not ES modules), so existing inline `onclick="..."` handlers continue to work.
- CSS remains in the 4-file architecture: core, components, pages, mobile.

## Next Refactor Steps

After testing this version, the next step is to move repeated page render logic into cleaner page files and gradually remove inline `onclick` handlers from `index.html`.

See `STATUS.md` for the full list of pending improvements.
