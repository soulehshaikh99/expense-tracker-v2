# Migration: Firebase Firestore → Neon Postgres (Drizzle ORM)

This file tells an agent how to replace Firebase/Firestore with Neon Postgres in the Expense Tracker and how to move the existing data. Do the steps in order. Do not skip the verification gates.

**Scope**

- Applies to the app built from `IMPLEMENTATION_PLAN.md`. Where this file conflicts with the Firebase parts of that plan (sections 1.2, 1.4, 5, 7.5, 7.10, 9 phase 4), **this file wins**. Everything else in the plan stays.
- If you are instead working on the original repository (Next 14, no repository layer), also follow Appendix A.

**Outcome**

- Data lives in Neon Postgres (region AWS `ap-southeast-1`, Singapore).
- The browser never talks to the database. All reads and writes go through Next.js Server Actions, which check the session cookie. The login now actually protects the data.
- Firebase is fully removed from the app and from `package.json`.
- All existing Firestore data is copied to Neon and verified.

---

## 0. Prerequisites (done by the human, verify before starting)

The human has already:

1. Created a Neon project `expense-tracker` in **AWS Asia Pacific (Singapore) `ap-southeast-1`**, Neon Auth and Data API **off**.
2. Created a branch `dev` from `main`.
3. Put the **dev** branch connection strings in `.env.local`:

   ```
   DATABASE_URL=postgresql://<role>:<password>@<endpoint>-pooler.ap-southeast-1.aws.neon.tech/<db>?sslmode=require&channel_binding=require
   DATABASE_URL_UNPOOLED=postgresql://<role>:<password>@<endpoint>.ap-southeast-1.aws.neon.tech/<db>?sslmode=require&channel_binding=require
   ```

   - `DATABASE_URL`: connection pooling **on** (host contains `-pooler`). Used by the app at runtime.
   - `DATABASE_URL_UNPOOLED`: pooling **off**. Used by migrations and the import script.

4. Kept the existing `NEXT_PUBLIC_FIREBASE_*` values in `.env.local`. They are needed **only** by the data import script (step 9) and are removed afterwards.

**Agent checks:**

- `.env.local` exists and both `DATABASE_URL*` variables are set. The pooled one contains `-pooler`; the unpooled one does not.
- `.gitignore` covers `.env` and `.env*.local`.

If any check fails, **stop and ask the human**. Never print, log, or commit connection strings. Never put them in source files, docs, or test fixtures.

---

## 1. Dependencies

```
npm i drizzle-orm @neondatabase/serverless
npm i -D drizzle-kit dotenv tsx
```

- Do not uninstall `firebase` yet. The import script (step 9) needs it. Removal happens in step 11.
- Add scripts to `package.json`:

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "db:import-firestore": "tsx scripts/import-firestore.ts"
}
```

---

## 2. Drizzle config

`drizzle.config.ts` (project root):

```ts
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error('DATABASE_URL_UNPOOLED is not set');

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
```

Commit the generated `drizzle/` migrations folder.

---

## 3. Schema

`lib/db/schema.ts`:

```ts
import { relations } from 'drizzle-orm';
import {
  pgTable, pgEnum, uuid, text, numeric, date, timestamp, boolean, integer, index, unique, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const paymentModeEnum = pgEnum('payment_mode', ['Credit Card', 'Debit Card', 'UPI', 'Cash']);
export const transactionTypeEnum = pgEnum('transaction_type', ['expense', 'income', 'donation', 'lent']);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paymentMode: paymentModeEnum('payment_mode').notNull(),
    forWhom: text('for_whom').notNull(),               // 'Self', a name, or 'Split'
    date: date('date').notNull(),                      // calendar date, 'yyyy-MM-dd'
    transactionType: transactionTypeEnum('transaction_type').notNull().default('expense'),
    paymentReceived: boolean('payment_received').notNull().default(false),
    paymentReceivedAt: timestamp('payment_received_at', { withTimezone: true }),
    isSplit: boolean('is_split').notNull().default(false),
    category: text('category'),
    legacyFirestoreId: text('legacy_firestore_id').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('expenses_date_idx').on(t.date),
    check('expenses_amount_positive', sql`${t.amount} > 0`),
  ],
);

export const expenseSplits = pgTable(
  'expense_splits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    expenseId: uuid('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),           // order shown in UI, 0-based
    person: text('person').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paymentReceived: boolean('payment_received').notNull().default(false),
    paymentReceivedAt: timestamp('payment_received_at', { withTimezone: true }),
  },
  (t) => [
    unique('expense_splits_expense_position_uq').on(t.expenseId, t.position),
    index('expense_splits_expense_idx').on(t.expenseId),
    check('expense_splits_amount_nonneg', sql`${t.amount} >= 0`),
  ],
);

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    month: date('month').notNull().unique(),           // always first day: 'yyyy-MM-01'
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    legacyFirestoreId: text('legacy_firestore_id').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('budgets_amount_positive', sql`${t.amount} > 0`),
    check('budgets_month_first_day', sql`extract(day from ${t.month}) = 1`),
  ],
);

export const expensesRelations = relations(expenses, ({ many }) => ({
  splits: many(expenseSplits),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, { fields: [expenseSplits.expenseId], references: [expenses.id] }),
}));
```

### Schema rules

- **Calendar dates** (`expenses.date`, `budgets.month`) are Postgres `date`. They travel as `'yyyy-MM-dd'` strings end to end. Never convert them to `Date` on the server: Vercel runs in UTC, and conversion shifts the day for users in other timezones. The client converts with `parseLocalDate` from `lib/dates.ts`.
- **Instants** (`payment_received_at`, `created_at`, `updated_at`) are `timestamptz`.
- **Money** is `numeric(12,2)`. Drizzle returns it as a string. Convert to `number` in the repository mappers with `Number()`. Write with `amount.toFixed(2)`.
- `legacy_firestore_id` exists only so the import is idempotent. New rows leave it null.
- If the installed `drizzle-orm` version does not support the array-returning table callback or `check()`, use the object-returning form `(t) => ({ ... })` and drop `check()` (the zod validation still enforces the rules). Do not downgrade other packages to make it fit.

---

## 4. Create the tables on `dev`

```
npm run db:generate
npm run db:migrate
```

**Gate 1.** Run `npm run db:studio` or query `information_schema`. Confirm:

- Tables `expenses`, `expense_splits`, `budgets` exist.
- Enums `payment_mode` and `transaction_type` exist.
- The `__drizzle_migrations` table exists.

Stop on any error.

---

## 5. Database client

`lib/db/index.ts`:

```ts
import 'server-only';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export const db = drizzle(neon(url), { schema });
```

- Install `server-only` (`npm i server-only`) so any accidental client import fails at build time.
- The `neon-http` driver has no interactive transactions. Multi-statement writes use `db.batch([...])`, which runs as one transaction.

---

## 6. Repository layer (server only)

Replace the Firestore code in `lib/repositories/expenses.ts` and `lib/repositories/budgets.ts`. Both files start with `import 'server-only';`. Components and hooks must not import them; only the Server Actions in step 7 do.

### 6.1 Transport types (`types/dto.ts`)

These are what Server Actions send and receive. They are plain, serializable objects.

```ts
export interface SplitDTO {
  person: string;
  amount: number;
  paymentReceived: boolean;
  paymentReceivedAt: string | null;   // ISO instant
}

export interface ExpenseDTO {
  id: string;
  title: string;
  amount: number;
  paymentMode: PaymentMode;
  forWhom: string;
  date: string;                       // 'yyyy-MM-dd'
  transactionType: TransactionType;
  paymentReceived: boolean;
  paymentReceivedAt: string | null;
  isSplit: boolean;
  splitDetails: SplitDTO[] | null;    // ordered by position
  category: string | null;
}

export type ExpenseInput = Omit<ExpenseDTO, 'id'>;

export interface BudgetDTO {
  id: string;
  month: string;                      // 'yyyy-MM-01'
  amount: number;
  createdAt: string;
  updatedAt: string;
}
```

Client hooks map DTOs to the domain types in `types/expense.ts` / `types/budget.ts`:

- Calendar dates: `parseLocalDate(dto.date)`.
- Instants: `new Date(iso)`.

Writes map back the opposite way: `formatLocalDate(date)` and `toISOString()`. Put both mappers in `lib/mappers.ts` and unit-test them.

### 6.2 Expenses repository

Implement:

| Function | Behavior |
|---|---|
| `listExpenses(): Promise<ExpenseDTO[]>` | `db.query.expenses.findMany({ with: { splits: { orderBy: position asc } }, orderBy: [desc(date), desc(createdAt)] })`. Map rows: `Number(amount)`, instants `toISOString()`, `isSplit` false → `splitDetails: null`. |
| `createExpense(input)` | Generate `id = crypto.randomUUID()`. If split: `db.batch([insert expense, insert splits with position = index])`. Otherwise single insert. Return the new DTO. |
| `updateExpense(id, input)` | `db.batch([update expense (set updatedAt = now), delete splits where expenseId = id, insert new splits if split])`. Throw `NotFoundError` if no row updated. |
| `deleteExpense(id)` | Delete. Splits cascade. |
| `setPaymentReceived(id, received)` | Update `payment_received` and `payment_received_at = received ? now() : null`, plus `updated_at`. Only allowed when the row is not split. |
| `setSplitPaymentReceived(expenseId, position, received)` | Update the one split row by `(expense_id, position)`, plus the parent's `updated_at`. |

### 6.3 Budgets repository

| Function | Behavior |
|---|---|
| `listBudgets()` | Order by `month desc`. |
| `upsertBudget(month, amount)` | `month` must match `/^\d{4}-\d{2}-01$/`. `insert ... onConflictDoUpdate({ target: budgets.month, set: { amount, updatedAt: now } })`. This replaces the old "find in loaded state, then update or add" logic. |
| `deleteBudget(id)` | Delete. |

### 6.4 Rules

- Normalize person names (`normalizePerson`) and trim strings in the repository too, not only in the form.
- Re-validate every input with the zod schemas from `lib/validation/*` on the server. Use a DTO variant of each schema with string dates. Never trust client input.
- Repositories throw typed errors (`NotFoundError`, `ValidationError`). Actions turn them into results (step 7).

---

## 7. Server Actions

Files: `app/actions/expenses.ts` and `app/actions/budgets.ts`. Each file starts with `'use server';`.

### 7.1 Session guard

Add `requireSession()` to `lib/auth.ts`:

- Reads `auth-session` via `await cookies()`.
- Verifies it with the same function the middleware uses.
- Throws `UnauthorizedError` if missing or invalid.

**Every action calls `await requireSession()` first.** Server Actions are POST requests to page routes, so do not rely on middleware alone.

### 7.2 Result shape

```ts
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: 'unauthorized' | 'validation' | 'not_found' | 'server' };
```

- Catch every error inside the action.
- Log server errors with `console.error` (no connection strings, no full input dumps).
- Return a readable `error` string. On `unauthorized`, the client redirects to `/login`.

### 7.3 Actions

```
listExpensesAction(): ActionResult<ExpenseDTO[]>
createExpenseAction(input: ExpenseInput): ActionResult<ExpenseDTO>
updateExpenseAction(id: string, input: ExpenseInput): ActionResult<ExpenseDTO>
deleteExpenseAction(id: string): ActionResult<null>
setPaymentReceivedAction(id: string, received: boolean): ActionResult<null>
setSplitPaymentReceivedAction(expenseId: string, position: number, received: boolean): ActionResult<null>
listBudgetsAction(): ActionResult<BudgetDTO[]>
upsertBudgetAction(month: string, amount: number): ActionResult<BudgetDTO>
deleteBudgetAction(id: string): ActionResult<null>
```

- Validate `id` arguments as UUIDs.
- Validate `position` as an integer ≥ 0.

---

## 8. Client changes

### 8.1 Hooks

- `useExpenses` / `useBudgets` call the actions instead of Firestore and map DTOs to domain types.
- Keep the plan's behavior:
  - Load on mount.
  - Reload after each successful mutation.
  - Reload when connectivity returns.
  - Toast on failure.
  - On `code: 'unauthorized'`, set `window.location.href = '/login'`.
- Split toggles call `setSplitPaymentReceivedAction(expense.id, index, checked)`. `index` is the position in `splitDetails`. Remove the old "rewrite whole document" path.

### 8.2 Offline behavior (replaces plan section 7.10 Firestore persistence)

Firestore's IndexedDB cache and queued offline writes are gone.

- **While offline**, data already loaded stays visible (it is in memory).
- **While offline**, disable every control that writes data:
  - Add button.
  - Row Edit / Delete.
  - Payment-received checkboxes in the table and in Money to Collect.
  - Budget Set/Edit.
  - Form submit buttons.
- Disabled controls show a `Tooltip`: "You're offline".
- Banner text becomes: "No internet connection. Changes are disabled until you're back online."
- On reconnect, reload both lists (unchanged).
- No service worker. No local write queue. Do not add one.

---

## 9. Import existing Firestore data

Script: `scripts/import-firestore.ts`, run with `npm run db:import-firestore -- [flags]`.

### 9.1 Inputs

- Loads `.env.local` via `dotenv`.
- Reads Firestore with the Firebase **client** SDK, using the `NEXT_PUBLIC_FIREBASE_*` config. The current rules allow reads.
  - Call `initializeApp` / `getFirestore` directly in the script.
  - Do **not** import `lib/firebase.ts`: it uses browser-only persistence.
- Writes to Neon through a `drizzle(neon(DATABASE_URL_UNPOOLED))` instance created in the script.
  - Do **not** import `lib/db/index.ts`: it has `server-only`.

### 9.2 Flags

| Flag | Meaning |
|---|---|
| `--dry-run` | Read and transform everything, print the report, write nothing. **Default if no flag is given.** |
| `--commit` | Actually write. |
| `--tz=<IANA>` | Timezone the old app ran in. Default `Asia/Kolkata`. |

### 9.3 Transform rules

Read every document in `expenses` and `budgets`.

**Expense fields:**

| Firestore | Postgres | Rule |
|---|---|---|
| doc id | `legacy_firestore_id` | |
| `title` | `title` | trim; if empty → `'(untitled)'` and add to the warnings list |
| `amount` | `amount` | `Number(x).toFixed(2)`; if not finite or ≤ 0 → **skip the doc** and add to the errors list |
| `paymentMode` | `payment_mode` | must be one of the 4 enum values; otherwise skip + error |
| `forWhom` | `for_whom` | `normalizePerson` (lowercase `self` → `Self`); if `isSplit` → `'Split'` |
| `date` | `date` | see date rule below |
| `transactionType` | `transaction_type` | missing → `'expense'`; unknown → skip + error |
| `paymentReceived` | `payment_received` | missing → false |
| `paymentReceivedDate` | `payment_received_at` | Timestamp → `toDate()`; missing/null → null |
| `isSplit` | `is_split` | missing → false; true but `splitDetails` empty → treat as not split and add a warning |
| `category` | `category` | trim; empty → null |
| `splitDetails[i]` | `expense_splits` row | `position = i`, `person` normalized, `amount.toFixed(2)`, `paymentReceived ?? false`, `paymentReceivedDate` → instant or null |

**Date rule for `expenses.date`.** The old app saved form dates as `new Date('yyyy-MM-dd')`, which is UTC midnight. The seed script saved `new Date()`, which is an arbitrary time.

- If the timestamp is exactly `00:00:00.000` UTC → use its **UTC** calendar date (`toISOString().slice(0, 10)`).
- Otherwise → use its calendar date in `--tz`: `new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)`.

**Budget fields:**

- `month`: the old app saved local midnight of the 1st in the browser's timezone. Take the calendar date in `--tz` (same `Intl` call) and force the day to `01`.
- `amount`: `toFixed(2)`; if ≤ 0 → skip + error.
- `createdAt` / `updatedAt`: Timestamps → instants; missing → now.
- **Duplicate months:** keep the doc with the latest `updatedAt` and put the others in the warnings list.

**Split checks (warnings only, still import):**

- Sum of shares differs from the amount by more than 0.01.
- No `Self` share.
- Duplicate person names.

### 9.4 Write rules (`--commit`)

- **Idempotent:** insert with `onConflictDoNothing({ target: legacyFirestoreId })`. Re-running must not duplicate rows.
- Each expense and its splits go in one `db.batch`.
- Insert in chunks of 100 expenses. Log progress.

### 9.5 Report (printed in both modes)

- Firestore counts vs. to-be-imported/imported counts, per collection, plus split row count.
- Skipped docs with id and reason. Warnings with id and reason.
- **Checksums:** for each `yyyy-MM` month, the per-transaction-type count and amount sum. Show source vs. Postgres side by side (Postgres side only in `--commit` mode, queried after the insert). Flag any mismatch.
- Budget months and amounts, source vs. Postgres.

### 9.6 Run order

1. `npm run db:import-firestore -- --dry-run`. Show the report to the human.
2. **Gate 2:**
   - No unexpected errors.
   - Warnings reviewed by the human.
   - Dates spot-checked: pick 5 transactions near month boundaries and confirm the month is correct.
3. `npm run db:import-firestore -- --commit` against **dev**.
4. **Gate 3:**
   - Checksums match with zero mismatches.
   - Run the app locally (`npm run dev`) against dev. Monthly Summary numbers for the last 3 months match the old Firebase app.

     Exception: plan section 8 intentionally adds pending split shares to the net amount, so the net figure may differ by exactly that sum. Report that sum.
5. Re-run `--commit` once and confirm 0 new rows (idempotency check).

---

## 10. Production cutover

Do these only after Gate 3 passes and the human approves.

1. **Ask the human** for the `main` branch connection strings, or have them set the env vars in Vercel themselves (preferred; the agent never needs to see production credentials).
2. Vercel → Project → Settings → Environment Variables:
   - **Production:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED` = `main` branch strings.
   - **Preview / Development:** `dev` branch strings.
   - Alternatively, install the **Neon** integration from the Vercel Marketplace and link the project. It injects these variables and can create a branch per preview deployment.
3. Set `vercel.json` `"regions": ["sin1"]` (Singapore, same as the database). Remove `iad1`.
4. Run migrations on `main`:
   - The human runs `DATABASE_URL_UNPOOLED=<main unpooled> npm run db:migrate`, or
   - Add a `vercel-build` step: `drizzle-kit migrate && next build`, with `DATABASE_URL_UNPOOLED` available at build time. Pick one and document it in the README.
5. **Freeze writes** in the old Firebase app (tell the human not to add transactions), then run the import against `main`:
   - `--dry-run` first.
   - Then `--commit`.
   - Same gates as steps 9.6.2–9.6.5.
6. Deploy. Smoke test production:
   - Log in.
   - Add, edit, and delete a test transaction.
   - Toggle a split share.
   - Set and remove a budget.
   - Log out.
   - Delete the test data.
7. Keep the Firebase project **read-only** (do not delete) for at least 30 days as a rollback source. Deleting it is the human's decision.

---

## 11. Remove Firebase

After production cutover succeeds:

1. Delete:
   - `lib/firebase.ts`
   - Any Firestore code left in `lib/repositories/*`
   - `components/FirebaseStatus.tsx` (if present)
   - `FIRESTORE_SETUP.md`
2. Move `scripts/import-firestore.ts` to `scripts/archive/` with a header comment saying it was a one-off and needs `firebase` installed to run. Exclude `scripts/archive` from `tsconfig.json` `include` so the build does not need `firebase`.
3. `npm uninstall firebase`.
4. Remove all `NEXT_PUBLIC_FIREBASE_*` from:
   - `.env.example`
   - The README
   - Vercel env vars (the human does this)
   - The plan's env list
5. Grep must return nothing: `firebase`, `firestore`, `Timestamp` (from Firebase), `enableIndexedDbPersistence`, `NEXT_PUBLIC_FIREBASE`. The archive folder is the only exception.
6. Update `.env.example`:

   ```
   DATABASE_URL=
   DATABASE_URL_UNPOOLED=
   BASIC_AUTH_USER=
   BASIC_AUTH_PASSWORD=
   SESSION_SECRET=
   ```

7. Replace `FIRESTORE_SETUP.md` with `DATABASE.md` covering:
   - Neon project and region.
   - `main` / `dev` branches.
   - Which connection string is used where.
   - `db:generate` / `db:migrate` / `db:studio`.
   - How to make a schema change (edit schema → generate → review SQL → migrate dev → migrate main).
   - Backups: Neon point-in-time restore / branch from a past timestamp.
8. README: replace the Firebase setup and offline sections. The offline text must match step 8.2.

---

## 12. Tests

Add with Vitest:

- `lib/mappers.ts`: DTO ↔ domain, especially `'yyyy-MM-dd'` parse/format in a non-UTC TZ. Run with `TZ=America/Los_Angeles` and `TZ=Asia/Kolkata`.
- Import transform (export the pure transform functions from the script):
  - UTC-midnight date.
  - Arbitrary-time date in `Asia/Kolkata`.
  - Budget month near the IST/UTC boundary (e.g. `2025-03-31T18:30:00Z` → `2025-04-01`).
  - Lowercase `self`.
  - Missing fields.
  - Invalid amount/mode/type → skipped.
  - Duplicate budget months.
- Repository integration tests (optional, only if `DATABASE_URL` points to a **disposable Neon branch**, never `main`): create → list → update splits → toggle split → delete; budget upsert twice → one row.
- Actions: without a valid session cookie, every action returns `code: 'unauthorized'`.

---

## 13. Final acceptance

- [ ] `npm run lint`, `npm run build`, `npm test` pass.
- [ ] No client bundle contains `@neondatabase/serverless`, `drizzle-orm`, or `DATABASE_URL`. Check `.next/static` with grep.
- [ ] Every Server Action rejects requests without a valid session.
- [ ] All plan features work against Neon (plan section 10 checklist, minus Firestore/offline-write items).
- [ ] Offline: data stays visible, write controls disabled with tooltip, reload on reconnect.
- [ ] Import report: zero mismatches; skipped/warning lists approved by the human.
- [ ] Production on `sin1` reads/writes Neon `main`.
- [ ] Firebase removed (step 11 grep clean).

---

## Appendix A: Applying to the original repository (Next 14, no repository layer)

If the target is the original codebase instead of the rebuild:

1. Do steps 0–5 as written. Next 14.0.4 supports Server Actions; `cookies()` is sync there, but `await cookies()` still works.
2. Create the repository layer and Server Actions from steps 6–7.
3. In `app/page.tsx`, replace these functions to call the actions and map DTOs:
   - `fetchExpenses`
   - `handleAddExpense`
   - `handleUpdateExpense`
   - `handleDeleteExpense`
   - `handleMarkPaymentReceived`
   - `fetchBudgets`
   - `handleSetBudget`
   - `handleDeleteBudget`
4. Change split toggles to call `setSplitPaymentReceivedAction`. The current code passes them through `onUpdateExpense` in `components/ExpenseList.tsx` and `components/MonthlySummary.tsx`.
5. Change `components/ExpenseForm.tsx` date handling to `'yyyy-MM-dd'` local strings (`format(date, 'yyyy-MM-dd')` and `parse(value, 'yyyy-MM-dd', new Date())` from date-fns). Remove `toISOString().split('T')[0]` and `new Date(dateString)`.
6. The current session token is unsigned. `requireSession()` must still reuse `validateSessionToken` from `lib/auth.ts` so behavior matches the middleware. Signing the token (plan section 6.4) is a separate change.
7. Then continue with steps 8–13.
