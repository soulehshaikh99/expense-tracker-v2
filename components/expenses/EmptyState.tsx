'use client';

import { Plus, ReceiptText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';

interface EmptyStateProps {
  variant: 'empty' | 'no-match';
  offline: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
}

export function EmptyState({ variant, offline, onAdd, onClearFilters }: EmptyStateProps) {
  if (variant === 'no-match') {
    return (
      <div className="flex flex-col items-center px-4 py-12 text-center sm:py-16">
        <Search className="mb-4 size-14 text-muted-foreground" aria-hidden="true" />
        <h3 className="mb-2 text-lg font-semibold">No expenses match your filters</h3>
        <p className="mb-6 max-w-md text-sm text-muted-foreground">
          Try adjusting your filters or select a different month to see more expenses.
        </p>
        <Button variant="outline" size="lg" onClick={onClearFilters}>
          Clear filters
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4 py-12 text-center sm:py-16">
      <ReceiptText className="mb-4 size-14 text-muted-foreground" aria-hidden="true" />
      <h3 className="mb-2 text-lg font-semibold">No expenses yet</h3>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Start tracking your expenses by adding your first expense entry.
      </p>
      <OfflineTooltip offline={offline}>
        <Button size="lg" onClick={onAdd} disabled={offline}>
          <Plus aria-hidden="true" />
          Add your first transaction
        </Button>
      </OfflineTooltip>
    </div>
  );
}
