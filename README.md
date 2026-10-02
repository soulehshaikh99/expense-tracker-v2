# Expense Tracker v2

A single-user, password-gated personal finance tracker. It records expenses, income, donations and money lent, splits shared expenses, tracks who owes you money, and compares monthly spending to a monthly budget. Currency is Indian rupees (₹).

- **Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), TanStack Table, react-hook-form + zod, date-fns.
- **Data:** Neon Postgres (AWS `ap-southeast-1`) through Drizzle ORM. See [DATABASE.md](DATABASE.md).
- **Specs:** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) and [docs/MIGRATION.md](docs/MIGRATION.md).

## How it works

- The browser never talks to the database. Every read and write goes through a Next.js Server Action (`app/actions/*`) that calls `requireSession()` first, then a server-only repository (`lib/repositories/*`).
- Login checks `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` and sets an `auth-session` cookie: an HS256 JWT signed with `SESSION_SECRET`, valid for 7 days, `httpOnly`, `sameSite=lax`, `secure` in production. Middleware redirects unauthenticated page requests to `/login?from=…` and answers other `/api/*` requests with 401. Because Server Actions also check the session, the login protects the data, not only the UI.
- Calendar dates (`expenses.date`, `budgets.month`) travel as `'yyyy-MM-dd'` strings and are parsed as local dates in the browser, so a transaction on the 1st or last day of a month stays in that month in every timezone.

## Getting started

Requirements: Node.js 20 or newer, npm, and a Neon project (see [DATABASE.md](DATABASE.md)).

```bash
npm install
cp .env.example .env.local   # fill in the values, see below
npm run db:migrate           # create tables on the branch in DATABASE_URL_UNPOOLED
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | App at runtime | Neon **pooled** connection string (host contains `-pooler`). |
| `DATABASE_URL_UNPOOLED` | `drizzle-kit`, scripts | Neon **direct** connection string. |
| `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` | Login | If either is missing, any credentials are accepted in development and **all** logins are rejected in production. |
| `SESSION_SECRET` | Session cookie | At least 32 random characters, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Changing it logs everyone out. |

`.env`, `.env.local` and other `.env*` files are git-ignored (except `.env.example`). The `NEXT_PUBLIC_FIREBASE_*` keys listed in `.env.example` are only for the one-off Firestore import script; the app never uses them.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server. |
| `npm run build` / `npm start` | Production build / server. |
| `npm run lint` | ESLint. |
| `npm test` | Vitest (accounting, filters, dates, mappers, validation, session, middleware, actions). |
| `npm run db:generate` | Generate a SQL migration from `lib/db/schema.ts` into `drizzle/`. |
| `npm run db:migrate` | Apply pending migrations to the branch in `DATABASE_URL_UNPOOLED`. |
| `npm run db:studio` | Drizzle Studio. |
| `npm run db:seed` | Insert sample data (dev only). `npx tsx scripts/seed-dev.ts --reset` removes exactly the seeded rows. |
| `npm run db:import-firestore` | One-off import of the old Firestore data. Dry run by default. |

## Offline behaviour

There is no service worker and no offline write queue.

- Data that is already loaded stays visible while you are offline (it is held in memory).
- While offline, every control that writes data is disabled: Add, row Edit/Delete, payment-received checkboxes in the table and in Money to Collect, Set/Edit Budget, and form submit buttons. Hovering or focusing one shows "You're offline".
- A banner says: "No internet connection. Changes are disabled until you're back online."
- When the connection returns, transactions and budgets reload automatically.
- Reloading the page while offline does not work, because nothing is cached for offline use.

## Accounting

All summary numbers come from pure functions in `lib/accounting.ts` (plan section 8). Net amount is:

```
Total Spent by Me + self donations + pending donations for others
+ pending expenses for others + pending split shares + lent pending − income
```

Pending split shares are included on purpose (the original app left them out), so money owed to you counts the same whether it came from a regular expense or a split. The monthly summary ignores the table filters; it only uses the selected month.

## Deployment (Vercel)

- `vercel.json` pins the region to `sin1` (Singapore), next to the Neon database.
- Set the environment variables in Vercel → Project → Settings → Environment Variables:
  - **Production:** `DATABASE_URL` and `DATABASE_URL_UNPOOLED` from the Neon `main` branch, plus `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` and a production `SESSION_SECRET`.
  - **Preview / Development:** the Neon `dev` branch strings.
- **Migrations are run by hand**, not during the Vercel build. Before deploying a schema change, run `npm run db:migrate` with `DATABASE_URL_UNPOOLED` pointing at `main`. See [DATABASE.md](DATABASE.md).

## Project layout

```
app/                 pages, auth route handlers, Server Actions (app/actions)
components/ui/       shadcn/ui primitives (CLI-generated; only variants added)
components/shared/   Combobox, MultiSelect, MonthPicker, ConfirmDialog, Money, ThemeToggle, OfflineBanner, …
components/expenses/ form, split editor, table, filters
components/summary/  monthly summary, budget card, money to collect
components/budget/   budget dialog
lib/                 domain logic (accounting, filters, dates, person, mappers), auth/session, hooks
lib/db/              Drizzle schema + server-only client
lib/repositories/    server-only data access
drizzle/             generated SQL migrations (committed)
scripts/             seed and Firestore import scripts
tests/               Vitest suites
```
