'use client';

import { useCallback, useMemo, useState } from 'react';
import { startOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { ExpenseFormDialog } from '@/components/expenses/ExpenseFormDialog';
import { ExpenseTable } from '@/components/expenses/ExpenseTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LogoutButton } from '@/components/shared/LogoutButton';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import {
  applyFilters,
  countActiveFilters,
  DEFAULT_FILTERS,
  hasActiveFilters as filtersActive,
  type ExpenseFilters,
} from '@/lib/filters';
import { useExpenses } from '@/lib/hooks/useExpenses';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { useReconnect } from '@/lib/hooks/useReconnect';
import { categorySuggestions, personSuggestions } from '@/lib/suggestions';
import type { ExpenseInput } from '@/types/dto';
import type { Expense } from '@/types/expense';

/** Months that have transactions, plus the current month, newest first. */
function availableMonths(expenses: Expense[]): Date[] {
  const byTime = new Map<number, Date>();
  for (const d of [new Date(), ...expenses.map((e) => e.date)]) {
    const m = startOfMonth(d);
    byTime.set(m.getTime(), m);
  }
  return [...byTime.values()].sort((a, b) => b.getTime() - a.getTime());
}

export default function DashboardPage() {
  const online = useOnlineStatus();
  const offline = !online;
  const expensesApi = useExpenses();
  const { expenses, isLoading } = expensesApi;

  useReconnect(online, () => {
    void expensesApi.reload();
  });

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [filters, setFilters] = useState<ExpenseFilters>(DEFAULT_FILTERS);
  const [, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const persons = useMemo(() => personSuggestions(expenses), [expenses]);
  const categories = useMemo(() => categorySuggestions(expenses), [expenses]);
  const months = useMemo(() => availableMonths(expenses), [expenses]);
  const filtered = useMemo(
    () => applyFilters(expenses, currentMonth, filters),
    [expenses, currentMonth, filters],
  );
  const activeCount = countActiveFilters(filters);
  const anyFilterActive = filtersActive(filters, currentMonth);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setCurrentMonth(startOfMonth(new Date()));
  }, []);

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((e: Expense) => {
    setEditing(e);
    setFormOpen(true);
  }, []);

  const saveExpense = async (input: ExpenseInput) => {
    const result = editing ? await expensesApi.update(editing.id, input) : await expensesApi.create(input);
    if (!result.ok) return false;
    toast.success(editing ? 'Transaction updated' : 'Transaction added');
    setFormOpen(false);
    return true;
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const result = await expensesApi.remove(deleting.id);
    if (!result.ok) return false;
    toast.success('Transaction deleted');
  };

  const { setPaymentReceived, setSplitPaymentReceived } = expensesApi;
  const toggleReceived = useCallback(
    async (e: Expense, received: boolean) => {
      const result = await setPaymentReceived(e.id, received);
      if (result.ok) toast.success(received ? 'Marked as received' : 'Marked as pending');
    },
    [setPaymentReceived],
  );
  const toggleSplit = useCallback(
    async (e: Expense, index: number, received: boolean) => {
      const result = await setSplitPaymentReceived(e.id, index, received);
      if (result.ok) toast.success(received ? 'Marked as received' : 'Marked as pending');
    },
    [setSplitPaymentReceived],
  );

  return (
    <div className="min-h-screen bg-background">
      <OfflineBanner />
      <main className="mx-auto w-full max-w-[1600px] px-4 py-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Expense Tracker</h1>
            <p className="text-muted-foreground">Manage your monthly expenses</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="min-w-0 lg:col-span-2" aria-label="Transactions">
            <ExpenseTable
              rows={filtered}
              totalCount={expenses.length}
              isLoading={isLoading}
              month={currentMonth}
              months={months}
              onMonthChange={setCurrentMonth}
              activeFilterCount={activeCount}
              hasActiveFilters={anyFilterActive}
              onOpenFilters={() => setFiltersOpen(true)}
              onClearFilters={clearFilters}
              onAdd={openAdd}
              offline={offline}
              onEdit={openEdit}
              onDelete={setDeleting}
              onToggleReceived={toggleReceived}
              onToggleSplit={toggleSplit}
            />
          </section>
        </div>
      </main>

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        personSuggestions={persons}
        categorySuggestions={categories}
        offline={offline}
        onSubmit={saveExpense}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete transaction?"
        description="Are you sure you want to delete this expense?"
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
