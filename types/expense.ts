export type PaymentMode = 'Credit Card' | 'Debit Card' | 'UPI' | 'Cash';
export type TransactionType = 'expense' | 'income' | 'donation' | 'lent';

export const PAYMENT_MODES = ['Credit Card', 'Debit Card', 'UPI', 'Cash'] as const satisfies readonly PaymentMode[];
export const TRANSACTION_TYPES = ['expense', 'income', 'donation', 'lent'] as const satisfies readonly TransactionType[];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Expense',
  income: 'Income',
  donation: 'Donation',
  lent: 'Lent',
};

export interface SplitDetail {
  person: string; // 'Self' or a name
  amount: number;
  paymentReceived?: boolean;
  paymentReceivedDate?: Date;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paymentMode: PaymentMode;
  forWhom: string; // 'Self', a name, or 'Split' when isSplit
  date: Date; // local midnight of the calendar date
  transactionType?: TransactionType; // missing → 'expense'
  paymentReceived?: boolean;
  paymentReceivedDate?: Date;
  isSplit?: boolean;
  splitDetails?: SplitDetail[];
  category?: string;
}
