import type { TransactionType } from '@/types/expense';

interface TypeLabels {
  title: string;
  person: string;
  personPlaceholder: string;
}

export const TYPE_LABELS: Record<TransactionType, TypeLabels> = {
  expense: { title: 'Expense Title', person: 'For Whom', personPlaceholder: "Self or person's name" },
  income: { title: 'Income Title', person: 'From Whom', personPlaceholder: "Person's name" },
  donation: {
    title: 'Donation Title',
    person: 'For Whom',
    personPlaceholder: "Self, organization or person's name",
  },
  lent: { title: 'Money Lent Title', person: 'To Whom', personPlaceholder: "Person's name" },
};

export function paymentReceivedLabel(type: TransactionType, name: string): string {
  return type === 'lent' ? `Money received back from ${name}` : `Payment received from ${name}`;
}
