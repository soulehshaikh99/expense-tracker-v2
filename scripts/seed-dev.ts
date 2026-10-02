/**
 * Dev-only sample data. Every row is tagged legacy_firestore_id = 'seed:<n>' so it is
 * idempotent and can be removed precisely with --reset (run --reset before the Firestore import).
 *
 *   npx tsx scripts/seed-dev.ts            # insert (skips rows that already exist)
 *   npx tsx scripts/seed-dev.ts --reset    # delete only seed rows
 */
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { like } from 'drizzle-orm';
import { format, startOfMonth, subMonths } from 'date-fns';
import * as schema from '../lib/db/schema';

config({ path: ['.env.local', '.env'], quiet: true });

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed with NODE_ENV=production');
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error('DATABASE_URL_UNPOOLED is not set');
const db = drizzle(neon(url), { schema });

type Split = [person: string, amount: number, received?: boolean];
interface Seed {
  title: string;
  amount: number;
  mode: (typeof schema.paymentModeEnum.enumValues)[number];
  forWhom: string;
  monthsAgo: number;
  day: number;
  type?: (typeof schema.transactionTypeEnum.enumValues)[number];
  received?: boolean;
  category?: string;
  splits?: Split[];
}

const SEEDS: Seed[] = [
  { title: 'Groceries', amount: 2450.5, mode: 'UPI', forWhom: 'Self', monthsAgo: 0, day: 1, category: 'Food' },
  { title: 'Electricity Bill', amount: 1890, mode: 'Debit Card', forWhom: 'Self', monthsAgo: 0, day: 2, category: 'Bills' },
  { title: 'Movie tickets', amount: 600, mode: 'Credit Card', forWhom: 'Rahul', monthsAgo: 0, day: 2, category: 'Entertainment' },
  { title: 'Cab to airport', amount: 850, mode: 'Cash', forWhom: 'Asha', monthsAgo: 0, day: 1, received: true, category: 'Transport' },
  {
    title: 'Team dinner', amount: 3600, mode: 'Credit Card', forWhom: 'Split', monthsAgo: 0, day: 3, category: 'Food',
    splits: [['Self', 1200], ['Rahul', 1200, true], ['Asha', 1200]],
  },
  { title: 'Freelance payment', amount: 15000, mode: 'UPI', forWhom: 'Client A', monthsAgo: 0, day: 1, type: 'income' },
  { title: 'Temple donation', amount: 501, mode: 'Cash', forWhom: 'Self', monthsAgo: 0, day: 2, type: 'donation' },
  { title: 'Charity run (on behalf)', amount: 1000, mode: 'UPI', forWhom: 'Ravi', monthsAgo: 0, day: 3, type: 'donation' },
  { title: 'Loan to Ravi', amount: 5000, mode: 'UPI', forWhom: 'Ravi', monthsAgo: 0, day: 1, type: 'lent' },
  { title: 'Loan to Asha', amount: 2000, mode: 'Cash', forWhom: 'Asha', monthsAgo: 0, day: 2, type: 'lent', received: true },
  // Previous month, incl. first and last day
  { title: 'Rent', amount: 18000, mode: 'Debit Card', forWhom: 'Self', monthsAgo: 1, day: 1, category: 'Bills' },
  { title: 'Month-end snacks', amount: 320, mode: 'UPI', forWhom: 'Self', monthsAgo: 1, day: 31, category: 'Food' },
  { title: 'Concert', amount: 2400, mode: 'Credit Card', forWhom: 'Split', monthsAgo: 1, day: 15, category: 'Entertainment', splits: [['Self', 800], ['Rahul', 800, true], ['Ravi', 800, true]] },
  { title: 'Salary', amount: 60000, mode: 'UPI', forWhom: 'Employer', monthsAgo: 1, day: 30, type: 'income' },
];

function dateFor(monthsAgo: number, day: number): string {
  const start = startOfMonth(subMonths(new Date(), monthsAgo));
  const last = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return format(new Date(start.getFullYear(), start.getMonth(), Math.min(day, last)), 'yyyy-MM-dd');
}

async function reset() {
  const e = await db.delete(schema.expenses).where(like(schema.expenses.legacyFirestoreId, 'seed:%')).returning({ id: schema.expenses.id });
  const b = await db.delete(schema.budgets).where(like(schema.budgets.legacyFirestoreId, 'seed:%')).returning({ id: schema.budgets.id });
  console.log(`Removed ${e.length} seed expenses and ${b.length} seed budgets.`);
}

async function seed() {
  let inserted = 0;
  for (const [i, s] of SEEDS.entries()) {
    const id = crypto.randomUUID();
    const now = new Date();
    const isSplit = !!s.splits;
    const expense = db
      .insert(schema.expenses)
      .values({
        id,
        title: s.title,
        amount: s.amount.toFixed(2),
        paymentMode: s.mode,
        forWhom: s.forWhom,
        date: dateFor(s.monthsAgo, s.day),
        transactionType: s.type ?? 'expense',
        paymentReceived: !!s.received,
        paymentReceivedAt: s.received ? now : null,
        isSplit,
        category: s.category ?? null,
        legacyFirestoreId: `seed:${i}`,
      })
      .onConflictDoNothing({ target: schema.expenses.legacyFirestoreId })
      .returning({ id: schema.expenses.id });

    const [rows] = await db.batch([expense]);
    if (rows.length === 0) continue;
    inserted += 1;
    if (s.splits) {
      await db.insert(schema.expenseSplits).values(
        s.splits.map(([person, amount, received], position) => ({
          expenseId: id,
          position,
          person,
          amount: amount.toFixed(2),
          paymentReceived: !!received,
          paymentReceivedAt: received ? now : null,
        })),
      );
    }
  }
  const month = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const budget = await db
    .insert(schema.budgets)
    .values({ month, amount: '30000.00', legacyFirestoreId: 'seed:budget' })
    .onConflictDoNothing()
    .returning({ id: schema.budgets.id });
  console.log(`Inserted ${inserted} seed expenses${budget.length ? ' and a budget for ' + month : ''}.`);
}

(process.argv.includes('--reset') ? reset() : seed()).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
