# Database

The app stores its data in **Neon Postgres** and accesses it with **Drizzle ORM**. Only server code touches the database: Server Actions → `lib/repositories/*` → `lib/db`. `lib/db/index.ts` imports `server-only`, so any accidental import from client code fails the build.

## Neon project

- Project: `expense-tracker`
- Region: **AWS Asia Pacific (Singapore) `ap-southeast-1`**. The Vercel deployment runs in `sin1`, in the same region.
- Neon Auth and the Data API are **off**. Nothing connects to the database except this app's server code and the scripts below.

## Branches

| Branch | Purpose |
|---|---|
| `main` | Production data. Only the production Vercel deployment and deliberate production migrations use it. |
| `dev` | Development and Vercel preview deployments. Safe to experiment on; recreate it from `main` when you want a fresh copy of production data. |

## Connection strings

Each branch has two connection strings. Both include `sslmode=require&channel_binding=require`.

| Variable | Pooling | Used by |
|---|---|---|
| `DATABASE_URL` | **On** (host contains `-pooler`) | The app at runtime (`lib/db/index.ts`, `neon-http` driver). |
| `DATABASE_URL_UNPOOLED` | Off | `drizzle-kit` (`drizzle.config.ts`), `scripts/seed-dev.ts`, `scripts/import-firestore.ts`. |

Locally, put them in `.env.local` (or `.env`); both files are git-ignored. In Vercel, set the `main` strings for **Production** and the `dev` strings for **Preview / Development**. You can instead install the Neon integration from the Vercel Marketplace, which injects these variables and can create a branch for each preview deployment.

Never commit connection strings, paste them into docs or tests, or print them in logs.

## Schema

Defined in `lib/db/schema.ts`. Migrations are generated into `drizzle/` and committed.

- `expenses`: one row per transaction (expense, income, donation or lent).
  - `date` is a Postgres `date`. It travels as `'yyyy-MM-dd'` and is never converted to a JS `Date` on the server.
  - `amount` is `numeric(12,2)` with a `> 0` check.
- `expense_splits`: the shares of a split expense.
  - `position` (0-based) sets the order and is unique per expense.
  - Rows are deleted together with their expense (`ON DELETE CASCADE`).
- `budgets`: one row per month.
  - `month` is unique and must be the 1st of the month (check constraint).
  - Saving a budget is an upsert on `month`.
- Enums: `payment_mode` (`Credit Card`, `Debit Card`, `UPI`, `Cash`) and `transaction_type` (`expense`, `income`, `donation`, `lent`).
- `legacy_firestore_id` exists only to make the Firestore import idempotent. New rows leave it null. The seed script tags its rows `seed:*`.
- Money is read as a string by the driver and converted with `Number()` in the repository mappers. It is written with `toFixed(2)`.
- Instants (`payment_received_at`, `created_at`, `updated_at`) are `timestamptz`.
- The `neon-http` driver has no interactive transactions. Writes that touch several statements (an expense plus its splits) use `db.batch([...])`, which runs as one transaction.

## Commands

```bash
npm run db:generate   # write a new SQL migration from schema.ts changes
npm run db:migrate    # apply pending migrations to the branch in DATABASE_URL_UNPOOLED
npm run db:studio     # browse data in Drizzle Studio
npm run db:seed       # dev only: sample data tagged seed:*  (npx tsx scripts/seed-dev.ts --reset removes it)
```

`drizzle.config.ts` loads `.env.local`, then `.env`, and always uses `DATABASE_URL_UNPOOLED`. Check which branch that variable points at before you run `db:migrate`.

## Making a schema change

1. Edit `lib/db/schema.ts`.
2. Run `npm run db:generate`.
3. **Review the generated SQL** in `drizzle/`. Look especially for `DROP`, type changes, and `NOT NULL` added to columns that already hold data.
4. Run `npm run db:migrate` against **dev**, then run the app and tests.
5. Commit the schema change and the migration together.
6. Before deploying, run the migration on **main**. Use a shell where `DATABASE_URL_UNPOOLED` holds the `main` direct string, then run `npm run db:migrate`. Migrations are not part of the Vercel build.

## Backups and restore

Neon keeps a history of changes for the project's restore window, which depends on your plan.

- **Point-in-time restore:** in the Neon console, restore a branch to an earlier timestamp.
- **Branch from the past:** create a new branch from `main` at a past timestamp. Inspect it, copy back what you need, or point a preview deployment at it. This leaves `main` untouched.
- Before risky operations, such as a large import or a destructive migration, create a branch from `main` as a named checkpoint.

## One-off Firestore import

`scripts/import-firestore.ts` (`npm run db:import-firestore`) copies the old Firebase/Firestore data into Postgres. It defaults to a dry run and needs `--commit` to write. It is idempotent through `legacy_firestore_id`. It reads Firestore with the Firebase client SDK, which is installed only as a dev dependency, using the `NEXT_PUBLIC_FIREBASE_*` keys. The app never imports `firebase`. See `docs/MIGRATION.md` step 9.
