'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { MonthPicker } from '@/components/shared/MonthPicker';
import { MultiSelect, type MultiSelectOption } from '@/components/shared/MultiSelect';
import type { ExpenseFilters, PaymentStatusFilter } from '@/lib/filters';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useRestoreFocus } from '@/lib/hooks/useRestoreFocus';
import { PAYMENT_MODES, type PaymentMode, type TransactionType } from '@/types/expense';

const TYPE_OPTIONS: MultiSelectOption<TransactionType>[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'donation', label: 'Donation' },
  { value: 'lent', label: 'Money Lent' },
];

const MODE_OPTIONS: MultiSelectOption<PaymentMode>[] = PAYMENT_MODES.map((m) => ({ value: m, label: m }));

interface ExpenseFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ExpenseFilters;
  onFiltersChange: (filters: ExpenseFilters) => void;
  month: Date;
  months: Date[];
  onMonthChange: (month: Date) => void;
  persons: string[];
  categories: string[];
  onClearAll: () => void;
}

export function ExpenseFiltersSheet({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  month,
  months,
  onMonthChange,
  persons,
  categories,
  onClearAll,
}: ExpenseFiltersSheetProps) {
  const desktop = useMediaQuery('(min-width: 640px)');
  const restoreFocus = useRestoreFocus();
  const set = <K extends keyof ExpenseFilters>(key: K, value: ExpenseFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...restoreFocus}
        side={desktop ? 'right' : 'bottom'}
        className="max-h-[90dvh] w-full gap-0 sm:max-h-none sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Filters apply as you change them.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div className="space-y-2">
            <Label htmlFor="filter-month">Month</Label>
            <MonthPicker id="filter-month" value={month} onChange={onMonthChange} months={months} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-type">Transaction Type</Label>
            <MultiSelect
              id="filter-type"
              options={TYPE_OPTIONS}
              value={filters.types}
              onChange={(v) => set('types', v)}
              placeholder="Search types..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-mode">Payment Mode</Label>
            <MultiSelect
              id="filter-mode"
              options={MODE_OPTIONS}
              value={filters.paymentModes}
              onChange={(v) => set('paymentModes', v)}
              placeholder="Search payment modes..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-person">For/From Whom</Label>
            <MultiSelect
              id="filter-person"
              options={persons.map((p) => ({ value: p, label: p }))}
              value={filters.persons}
              onChange={(v) => set('persons', v)}
              placeholder="Search people..."
              emptyText="No people found."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-status">Payment Status</Label>
            <Select
              value={filters.paymentStatus}
              onValueChange={(v) => set('paymentStatus', v as PaymentStatusFilter)}
            >
              <SelectTrigger id="filter-status" className="h-10! w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Received">Received</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-category">Category</Label>
            <MultiSelect
              id="filter-category"
              options={categories.map((c) => ({ value: c, label: c }))}
              value={filters.categories}
              onChange={(v) => set('categories', v)}
              placeholder="Search categories..."
              emptyText="No categories found."
            />
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 border-t">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClearAll}>
            Clear all
          </Button>
          <Button size="lg" className="flex-1" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
