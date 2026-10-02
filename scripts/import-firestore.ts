/**
 * One-off import: Firestore (old app) → Neon Postgres. docs/MIGRATION.md §9.
 *
 *   npm run db:import-firestore -- --dry-run            # default: read + transform + report, write nothing
 *   npm run db:import-firestore -- --commit             # write (idempotent via legacy_firestore_id)
 *   npm run db:import-firestore -- --tz=Asia/Kolkata    # timezone the old app ran in (default Asia/Kolkata)
 *
 * Reads Firestore with the Firebase *client* SDK (devDependency only) using NEXT_PUBLIC_FIREBASE_*.
 * Writes with its own drizzle(neon(DATABASE_URL_UNPOOLED)) — it does not import lib/db (server-only).
 * Never prints connection strings or keys. A Markdown copy of the report is written to
 * scripts/import-firestore/reports/ (git-ignored).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore, terminate } from 'firebase/firestore';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, isNotNull, notLike, sql } from 'drizzle-orm';
import { subMonths, format } from 'date-fns';
import * as schema from '../lib/db/schema';
import { computeMonthlySummary } from '../lib/accounting';
import { parseLocalDate } from '../lib/dates';
import type { Expense } from '../types/expense';
import {
  checksums,
  paiseToFixed,
  transformBudgets,
  transformExpense,
  TRANSACTION_TYPES,
  type BudgetRowOut,
  type Checksums,
  type ExpenseRowOut,
  type Issue,
  type RawDoc,
  type SplitRowOut,
} from './import-firestore/transform';

config({ path: ['.env.local', '.env'], quiet: true });

// ---------- flags ----------
const args = process.argv.slice(2);
const commit = args.includes('--commit');
if (commit && args.includes('--dry-run')) throw new Error('Pass either --dry-run or --commit, not both');
const tz = args.find((a) => a.startsWith('--tz='))?.slice(5) || 'Asia/Kolkata';
try {
  new Intl.DateTimeFormat('en-CA', { timeZone: tz });
} catch {
  throw new Error(`Unknown timezone: ${tz}`);
}

const lines: string[] = [];
const log = (s = '') => {
  console.log(s);
  lines.push(s);
};

function requireEnv(keys: string[]): Record<string, string> {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing env keys: ${missing.join(', ')}`);
  return Object.fromEntries(keys.map((k) => [k, process.env[k] as string]));
}

async function readFirestore(): Promise<{ expenses: RawDoc[]; budgets: RawDoc[] }> {
  const env = requireEnv([
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ]);
  const app = initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  const firestore = getFirestore(app);
  try {
    const [e, b] = await Promise.all([
      getDocs(collection(firestore, 'expenses')),
      getDocs(collection(firestore, 'budgets')),
    ]);
    return {
      expenses: e.docs.map((d) => ({ id: d.id, data: d.data() })),
      budgets: b.docs.map((d) => ({ id: d.id, data: d.data() })),
    };
  } finally {
    await terminate(firestore);
  }
}

// ---------- report helpers ----------
function checksumTable(source: Checksums, target?: Checksums): { text: string[]; mismatches: number } {
  const months = [...new Set([...source.keys(), ...(target?.keys() ?? [])])].sort();
  const text: string[] = [];
  let mismatches = 0;
  text.push(
    target
      ? '| Month | Type | Source count | Source sum | Postgres count | Postgres sum | |'
      : '| Month | Type | Count | Sum |',
  );
  text.push(target ? '|---|---|---:|---:|---:|---:|---|' : '|---|---|---:|---:|');
  for (const m of months) {
    for (const t of TRANSACTION_TYPES) {
      const s = source.get(m)?.get(t);
      const p = target?.get(m)?.get(t);
      if (!s && !p) continue;
      if (!target) {
        text.push(`| ${m} | ${t} | ${s!.count} | ₹${paiseToFixed(s!.paise)} |`);
        continue;
      }
      const ok = s?.count === p?.count && s?.paise === p?.paise;
      if (!ok) mismatches += 1;
      text.push(
        `| ${m} | ${t} | ${s?.count ?? 0} | ₹${paiseToFixed(s?.paise ?? 0)} | ${p?.count ?? 0} | ₹${paiseToFixed(p?.paise ?? 0)} | ${ok ? '✓' : '**MISMATCH**'} |`,
      );
    }
  }
  return { text, mismatches };
}

function toDomain(row: ExpenseRowOut, splits: SplitRowOut[]): Expense {
  return {
    id: row.legacyFirestoreId,
    title: row.title,
    amount: Number(row.amount),
    paymentMode: row.paymentMode,
    forWhom: row.forWhom,
    date: parseLocalDate(row.date),
    transactionType: row.transactionType,
    paymentReceived: row.paymentReceived,
    paymentReceivedDate: row.paymentReceivedAt ?? undefined,
    isSplit: row.isSplit,
    splitDetails: row.isSplit
      ? splits.map((s) => ({
          person: s.person,
          amount: Number(s.amount),
          paymentReceived: s.paymentReceived,
          paymentReceivedDate: s.paymentReceivedAt ?? undefined,
        }))
      : undefined,
    category: row.category ?? undefined,
  };
}

function issueList(title: string, issues: Issue[]) {
  log(`### ${title} (${issues.length})`);
  if (issues.length === 0) log('None.');
  for (const i of issues) log(`- \`${i.collection}/${i.id}\`: ${i.reason}`);
  log();
}

// ---------- main ----------
async function main() {
  const mode = commit ? 'COMMIT' : 'DRY RUN';
  log(`# Firestore → Postgres import report (${mode})`);
  log();
  log(`- Run at: ${new Date().toISOString()}`);
  log(`- Timezone for non-midnight dates and budget months: \`${tz}\``);
  log();

  const source = await readFirestore();

  // Transform
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const good: { row: ExpenseRowOut; splits: SplitRowOut[] }[] = [];
  for (const d of source.expenses) {
    const r = transformExpense(d, tz);
    if (!r.ok) {
      errors.push({ id: d.id, collection: 'expenses', reason: r.error });
      continue;
    }
    for (const w of r.warnings) warnings.push({ id: d.id, collection: 'expenses', reason: w });
    good.push({ row: r.row, splits: r.splits });
  }
  const budgets = transformBudgets(source.budgets, tz);
  errors.push(...budgets.errors);
  warnings.push(...budgets.warnings);

  const splitCount = good.reduce((n, g) => n + g.splits.length, 0);
  log('## Counts');
  log();
  log('| Collection | Firestore docs | To import | Skipped |');
  log('|---|---:|---:|---:|');
  log(`| expenses | ${source.expenses.length} | ${good.length} | ${source.expenses.length - good.length} |`);
  log(`| budgets | ${source.budgets.length} | ${budgets.rows.length} | ${source.budgets.length - budgets.rows.length} |`);
  log(`| expense_splits (rows) | — | ${splitCount} | — |`);
  log();

  issueList('Skipped (errors)', errors);
  issueList('Warnings', warnings);

  // Boundary spot check candidates: 1st/last of month, or tz rule where UTC date differs.
  const boundary = good
    .filter(({ row }) => {
      const day = Number(row.date.slice(8, 10));
      const d = parseLocalDate(row.date);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return day === 1 || day === last || (row.dateSource.rule === 'tz' && row.dateSource.raw.slice(0, 10) !== row.date);
    })
    .sort((a, b) => b.row.date.localeCompare(a.row.date));
  log(`## Month-boundary dates for spot check (${boundary.length}; up to 15 shown)`);
  log();
  log('| Firestore id | Title | Stored timestamp (UTC) | Rule | Imported date |');
  log('|---|---|---|---|---|');
  for (const { row } of boundary.slice(0, 15)) {
    log(`| ${row.legacyFirestoreId} | ${row.title.replace(/\|/g, '/')} | ${row.dateSource.raw} | ${row.dateSource.rule} | **${row.date}** |`);
  }
  log();

  const sourceSums = checksums(good.map((g) => g.row));

  // Summary preview for the last 3 months that have data (what v2 will show).
  const domain = good.map((g) => toDomain(g.row, g.splits));
  const latest = good.map((g) => g.row.date).sort().at(-1);
  if (latest) {
    const anchor = parseLocalDate(`${latest.slice(0, 7)}-01`);
    log('## Monthly Summary preview (last 3 months with data)');
    log();
    log('Old-app net = v2 net − pending split shares (plan §8 intentionally adds them).');
    log();
    log('| Month | Spent by Me | Spent for Others | Income | Donations | Lent | Pending split shares | v2 Net | Old-app Net |');
    log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (let i = 0; i < 3; i++) {
      const m = subMonths(anchor, i);
      const s = computeMonthlySummary(domain, m);
      const f = (n: number) => `₹${n.toFixed(2)}`;
      log(
        `| ${format(m, 'MMM yyyy')} | ${f(s.totalSpentByMe)} | ${f(s.totalSpentForOthers)} | ${f(s.totalIncome)} | ${f(s.totalDonations)} | ${f(s.totalLent)} | ${f(s.pendingSplitShares)} | ${f(s.netAmount)} | ${f(s.netAmount - s.pendingSplitShares)} |`,
      );
    }
    log();
  }

  if (!commit) {
    log('## Checksums (source)');
    log();
    checksumTable(sourceSums).text.forEach((l) => log(l));
    log();
    log('## Budgets (source → to import)');
    log();
    budgetTable(budgets.rows);
    log();
    log('_Dry run: nothing was written._');
    return finish(0);
  }

  // ---------- COMMIT ----------
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED is not set');
  const db = drizzle(neon(url), { schema });

  const existing = new Set(
    (await db.select({ id: schema.expenses.legacyFirestoreId }).from(schema.expenses).where(isNotNull(schema.expenses.legacyFirestoreId))).map((r) => r.id),
  );
  const toInsert = good.filter((g) => !existing.has(g.row.legacyFirestoreId));
  log(`## Write`);
  log();
  log(`- Expenses already imported (skipped): ${good.length - toInsert.length}`);

  let inserted = 0;
  let insertedSplits = 0;
  const writeErrors: Issue[] = [];
  for (let start = 0; start < toInsert.length; start += 100) {
    const chunk = toInsert.slice(start, start + 100);
    for (const { row, splits } of chunk) {
      const id = crypto.randomUUID();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { dateSource, ...values } = row;
      const insertExpense = db
        .insert(schema.expenses)
        .values({ id, ...values })
        .onConflictDoNothing({ target: schema.expenses.legacyFirestoreId })
        .returning({ id: schema.expenses.id });
      try {
        if (splits.length) {
          const [rows] = await db.batch([
            insertExpense,
            db.insert(schema.expenseSplits).values(splits.map((s) => ({ ...s, expenseId: id }))),
          ]);
          if (rows.length) {
            inserted += 1;
            insertedSplits += splits.length;
          }
        } else {
          const rows = await insertExpense;
          if (rows.length) inserted += 1;
        }
      } catch (error) {
        writeErrors.push({ id: row.legacyFirestoreId, collection: 'expenses', reason: (error as Error).message });
      }
    }
    console.log(`  … ${Math.min(start + 100, toInsert.length)}/${toInsert.length} expenses processed`);
  }

  // Budgets: skip months that already have a non-imported budget (unique month).
  const existingBudgets = await db.select().from(schema.budgets);
  const legacyBudgetIds = new Set(existingBudgets.map((b) => b.legacyFirestoreId).filter(Boolean));
  const otherMonths = new Map(existingBudgets.filter((b) => !b.legacyFirestoreId || b.legacyFirestoreId.startsWith('seed:')).map((b) => [b.month, b]));
  let insertedBudgets = 0;
  for (const b of budgets.rows) {
    if (legacyBudgetIds.has(b.legacyFirestoreId)) continue;
    if (otherMonths.has(b.month)) {
      writeErrors.push({ id: b.legacyFirestoreId, collection: 'budgets', reason: `month ${b.month} already has a non-imported budget in Postgres; not overwritten` });
      continue;
    }
    try {
      const rows = await db
        .insert(schema.budgets)
        .values(b)
        .onConflictDoNothing({ target: schema.budgets.legacyFirestoreId })
        .returning({ id: schema.budgets.id });
      insertedBudgets += rows.length;
    } catch (error) {
      writeErrors.push({ id: b.legacyFirestoreId, collection: 'budgets', reason: (error as Error).message });
    }
  }

  log(`- New expenses inserted: ${inserted} (split rows: ${insertedSplits})`);
  log(`- New budgets inserted: ${insertedBudgets}`);
  log();
  issueList('Write errors', writeErrors);

  // Postgres side (imported rows only — excludes seed:* and app-created rows).
  const imported = and(isNotNull(schema.expenses.legacyFirestoreId), notLike(schema.expenses.legacyFirestoreId, 'seed:%'));
  const pgRows = await db
    .select({ date: schema.expenses.date, transactionType: schema.expenses.transactionType, amount: schema.expenses.amount })
    .from(schema.expenses)
    .where(imported);
  const [{ splitRows }] = await db
    .select({ splitRows: sql<number>`count(*)::int` })
    .from(schema.expenseSplits)
    .innerJoin(schema.expenses, sql`${schema.expenses.id} = ${schema.expenseSplits.expenseId}`)
    .where(imported);
  const pgBudgets = (await db.select().from(schema.budgets)).filter(
    (b) => b.legacyFirestoreId && !b.legacyFirestoreId.startsWith('seed:'),
  );

  log('## Postgres totals (imported rows only)');
  log();
  log(`- expenses: ${pgRows.length} (source to import: ${good.length})`);
  log(`- expense_splits: ${splitRows} (source: ${splitCount})`);
  log(`- budgets: ${pgBudgets.length} (source to import: ${budgets.rows.length})`);
  log();

  log('## Checksums (source vs Postgres)');
  log();
  const table = checksumTable(sourceSums, checksums(pgRows));
  table.text.forEach((l) => log(l));
  log();
  log(`**Mismatches: ${table.mismatches}**`);
  log();

  log('## Budgets (source vs Postgres)');
  log();
  const pgByMonth = new Map(pgBudgets.map((b) => [b.month, b]));
  log('| Month | Source amount | Postgres amount | |');
  log('|---|---:|---:|---|');
  let budgetMismatches = 0;
  for (const b of budgets.rows) {
    const p = pgByMonth.get(b.month);
    const ok = !!p && Number(p.amount).toFixed(2) === b.amount;
    if (!ok) budgetMismatches += 1;
    log(`| ${b.month} | ₹${b.amount} | ${p ? `₹${Number(p.amount).toFixed(2)}` : '—'} | ${ok ? '✓' : '**MISMATCH**'} |`);
  }
  log();
  log(`**Budget mismatches: ${budgetMismatches}**`);
  return finish(table.mismatches + budgetMismatches + writeErrors.length > 0 ? 2 : 0);
}

function budgetTable(rows: BudgetRowOut[]) {
  log('| Month | Amount | Firestore id |');
  log('|---|---:|---|');
  for (const b of rows) log(`| ${b.month} | ₹${b.amount} | ${b.legacyFirestoreId} |`);
}

function finish(code: number) {
  const dir = 'scripts/import-firestore/reports';
  mkdirSync(dir, { recursive: true });
  const file = `${dir}/import-${commit ? 'commit' : 'dry-run'}-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
  writeFileSync(file, lines.join('\n') + '\n');
  console.log(`\nReport written to ${file}`);
  process.exit(code);
}

main().catch((error: unknown) => {
  console.error('Import failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
