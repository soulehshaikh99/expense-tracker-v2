# Acceptance results

Checked on 2026-10-03 against the Neon `dev` branch, using local dev and production builds. Browser checks used Playwright with seeded data (`scripts/seed-dev.ts`).

## IMPLEMENTATION_PLAN.md §10

| Item | Result | How verified |
|---|---|---|
| Primitives only from `components/ui`; no hand-rolled modals/dropdowns/checkboxes/toasts; no `alert()`/`confirm()` | ✅ | grep for `alert(`/`confirm(` and raw `<select|input|table|dialog|button>` in feature code: none |
| No hard-coded gray/colour classes in feature components | ✅ | grep for `(bg|text|border)-(gray|…)-N` outside `components/ui`: none |
| Tailwind 4: no `tailwind.config.*`, no `@tailwind`, no `bg-opacity-*`, no `tailwindcss-animate`; PostCSS uses only `@tailwindcss/postcss` | ✅ | file check + grep |
| Unauthenticated `/` → `/login?from=/`; login returns to `from` | ✅ | Playwright: redirect, then `from=/?check=1` honoured; `from=//evil.com` ignored |
| Forged/expired cookie rejected; `/api/*` (non-auth) → 401 | ✅ | Vitest (sign/verify/expiry/tamper/`alg:none`/legacy token, middleware) + curl against `next start` |
| Add, edit, delete for each transaction type persist after reload | ✅ | Playwright: expense (split), income, donation, lent |
| Split validation inline; last share auto-fills; Self required and unique | ✅ | Vitest (schema) + Playwright (auto-fill, second Self rejected) |
| Lent to Self blocked | ✅ | Self not suggested for lent; typed "self" shows the plan's error |
| Editing a received transaction keeps its original received date | ✅ | Vitest (payload builder) + DB check after editing a split with a received share |
| 1st / last day of a month stays in that month in every timezone | ✅ | Vitest across UTC, LA, Kolkata, UTC+14 + Playwright with `timezoneId` LA / Kolkata / Kiritimati |
| Filters combine; payment status handles donations and splits; Clear resets the month | ✅ | Vitest + Playwright |
| Summary numbers match §8 for a seeded dataset; filters don't affect the summary | ✅ | Vitest formulas + manual recomputation of the seeded October numbers (net −1,158.50, collect Ravi 6,000 / Asha 1,200 / Rahul 600) |
| Budget set, edit, delete; bar colour thresholds | ✅ | Playwright (validation message, update, remove, set) + Vitest thresholds (79.9 / 80 / 99.99 / 100) |
| Money to Collect toggles update table and summary | ✅ | Playwright |
| Column visibility and widths survive reload | ✅ | Playwright (localStorage keys `expense-tracker-column-visibility` / `-widths`) |
| Light, dark, system themes; no flash | ✅ | next-themes with `storageKey=theme-preference`; Playwright dark + persisted light after reload |
| Offline banner; data visible offline; reload on reconnect | ✅ (migration 8.2 version) | Playwright `setOffline`: banner text, write controls disabled, tooltip "You're offline", rows still visible, both lists reloaded on reconnect |
| No horizontal page scroll at 360 px; table scrolls in its container | ✅ | Playwright at 360/768/1024/1440 CSS px |
| Lint, build, tests pass; deploys to Vercel | ✅ / ⏳ | Lint, build, 105 tests pass. Vercel deploy is for the owner to do (env vars). |

Replaced by MIGRATION.md: Firestore rules, IndexedDB persistence, queued offline writes.

## MIGRATION.md §13

| Item | Result |
|---|---|
| `npm run lint`, `npm run build`, `npm test` pass | ✅ |
| No client bundle contains `@neondatabase/serverless`, `drizzle-orm`, or `DATABASE_URL` | ✅ grep of `.next/static`: 0 hits (also 0 for `SESSION_SECRET`, `BASIC_AUTH`, `firebase`, `postgresql://`) |
| Every Server Action rejects requests without a valid session | ✅ Vitest covers all 9 exported actions with no cookie and with a forged cookie; the db mock proves no query runs |
| All plan features work against Neon | ✅ see above |
| Offline: data visible, write controls disabled with tooltip, reload on reconnect | ✅ |
| Import report: zero mismatches; skips/warnings approved | ⏳ Gates 2 and 3 |
| Production on `sin1` reads/writes Neon `main` | ⏳ production cutover (owner) |
| Firebase removed (grep clean) | ✅ for app code. `firebase` will only be a devDependency for `scripts/import-firestore.ts` |
