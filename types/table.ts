export type ColumnId =
  | 'date'
  | 'title'
  | 'amount'
  | 'paymentMode'
  | 'forWhom'
  | 'paymentStatus'
  | 'category';

export const COLUMN_IDS: readonly ColumnId[] = [
  'date',
  'title',
  'amount',
  'paymentMode',
  'forWhom',
  'paymentStatus',
  'category',
];

export type ColumnVisibility = Record<ColumnId, boolean>;
export type ColumnWidths = Record<ColumnId, number>;

export const COLUMN_VISIBILITY_STORAGE_KEY = 'expense-tracker-column-visibility';
export const COLUMN_WIDTHS_STORAGE_KEY = 'expense-tracker-column-widths';

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  date: true,
  title: true,
  amount: true,
  paymentMode: true,
  forWhom: true,
  paymentStatus: true,
  category: true,
};

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  date: 140,
  title: 200,
  amount: 120,
  paymentMode: 140,
  forWhom: 180,
  paymentStatus: 150,
  category: 150,
};

export const COLUMN_LABELS: Record<ColumnId, string> = {
  date: 'Date',
  title: 'Title',
  amount: 'Amount',
  paymentMode: 'Payment Mode',
  forWhom: 'For/From Whom',
  paymentStatus: 'Payment Status',
  category: 'Category',
};
