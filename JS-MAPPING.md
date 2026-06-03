# CAPVO JS Refactor Mapping v3

This refactor keeps the same browser/global-script behavior, but splits the large `app.js` into ordered classic script files.

## Load order

1. `js/app/00-core-state.js` — Supabase client, constants, global state, helpers
2. `js/app/01-ui-selection-toast.js` — bulk select/delete, toast, confirm modal helpers
3. `js/app/02-supabase-data.js` — Supabase fetch/save/sync operations
4. `js/app/03-render-dashboard-transactions-income.js` — main render, dashboard, transactions, income page rendering
5. `js/app/04-reports-archive.js` — reports/statistics and archive/history functions
6. `js/app/05-income-pickers.js` — income custom dropdown/picker UI helpers
7. `js/app/06-modals-nav-auth.js` — modals, save actions, navigation, auth/Telegram linking logic
8. `js/app/07-add-center.js` — mobile Add Center / Quick Add / manual add logic
9. `js/app/08-auth-bootstrap.js` — final auth bootstrap safety/init logic
10. `js/cards.js`, `js/sync.js`, `js/advisor.js` — existing feature modules

## Why this is safe

- No functions were rewritten in this pass.
- The original full file is preserved at `js/legacy/app.monolith.backup.js`.
- The scripts are classic browser scripts, not ES modules, so existing inline `onclick="..."` handlers continue to work.
- CSS remains in the 4-file architecture: core, components, pages, mobile.

## Next safe refactor step

After testing this version, the next step is to move repeated page render logic into cleaner page files and gradually remove inline `onclick` handlers from `index.html`.
