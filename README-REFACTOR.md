# CAPVO Refactor Structure v2

Αυτό είναι ασφαλές structural checkpoint. Δεν αλλάζει business logic, auth, Telegram ή data model.

## Νέα δομή

```text
/
  index.html
  manifest.webmanifest
  .gitignore

/assets
  capvo icons / mark

/js
  config.js             # για local test, ΜΗΝ το ανεβάσεις σε public repo
  config.example.js     # ασφαλές template
  app.js                # μένει monolith σε αυτό το checkpoint για να μη σπάσει auth/data
  cards.js
  sync.js
  advisor.js

/css
  capvo-core.css        # variables, reset, app shell, desktop/mobile shell, branding
  capvo-components.css  # shared components, auth, Telegram, Quick Add, mobile nav
  capvo-pages.css       # dashboard, transactions, income, cards, advisor, reports, archive, settings
  capvo-mobile.css      # mobile/final overrides, transaction final layers
```

## Γιατί 4 CSS και όχι 1

- Μειώνει τα 20+ requests/αρχεία.
- Κρατάει λογική οργάνωση για συντήρηση.
- Δεν δημιουργεί ένα τεράστιο άναρχο CSS.
- Μπορούμε αργότερα να πάμε σε build/minify χωρίς να αλλάξουμε source logic.

## Τι να ελέγξεις πρώτο

1. Google login / refresh μετά το login.
2. Telegram αλλαγή / sync.
3. Dashboard hero με ημερήσιο/εβδομαδιαίο allowance.
4. Quick Add από dashboard και από το κεντρικό +.
5. Manual expense.
6. Έσοδα / Ticket-Voucher.
7. Πάγια & Υποχρεώσεις.
8. Κάρτες / Debt planner.
9. Reports / Archive / Settings.

## Σημαντικό

Το `app.js` δεν σπάστηκε επίτηδες. Το επόμενο refactor πρέπει να γίνει ξεχωριστά, αφού περάσει αυτό το CSS/structure checkpoint.


## v3 JS split

The monolithic app.js has been split into `js/app/*.js`. Keep the script order in `index.html`. The legacy full copy is available under `js/legacy/app.monolith.backup.js`.
