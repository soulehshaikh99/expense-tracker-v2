import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const paymentModeEnum = pgEnum('payment_mode', ['Credit Card', 'Debit Card', 'UPI', 'Cash']);
export const transactionTypeEnum = pgEnum('transaction_type', ['expense', 'income', 'donation', 'lent']);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paymentMode: paymentModeEnum('payment_mode').notNull(),
    forWhom: text('for_whom').notNull(), // 'Self', a name, or 'Split'
    date: date('date').notNull(), // calendar date, 'yyyy-MM-dd'
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
    expenseId: uuid('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(), // order shown in UI, 0-based
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
    month: date('month').notNull().unique(), // always first day: 'yyyy-MM-01'
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
