import type { PaymentMode, TransactionType } from './expense';

export interface SplitDTO {
  person: string;
  amount: number;
  paymentReceived: boolean;
  paymentReceivedAt: string | null; // ISO instant
}

export interface ExpenseDTO {
  id: string;
  title: string;
  amount: number;
  paymentMode: PaymentMode;
  forWhom: string;
  date: string; // 'yyyy-MM-dd'
  transactionType: TransactionType;
  paymentReceived: boolean;
  paymentReceivedAt: string | null;
  isSplit: boolean;
  splitDetails: SplitDTO[] | null; // ordered by position
  category: string | null;
}

export type ExpenseInput = Omit<ExpenseDTO, 'id'>;

export interface BudgetDTO {
  id: string;
  month: string; // 'yyyy-MM-01'
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export type ActionErrorCode = 'unauthorized' | 'validation' | 'not_found' | 'server';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: ActionErrorCode };
