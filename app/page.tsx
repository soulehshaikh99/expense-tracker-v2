'use client';

import { useCallback, useMemo, useState } from 'react';
import { startOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { BudgetDialog } from '@/components/budget/BudgetDialog';
import { ExpenseFiltersSheet } from '@/components/expenses/ExpenseFiltersSheet';
import { ExpenseFormDialog } from '@/components/expenses/ExpenseFormDialog';
import { ExpenseTable } from '@/components/expenses/ExpenseTable';
import { MonthlySummary } from '@/components/summary/MonthlySummary';
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
import { formatMonthKey, isSameMonthAs } from '@/lib/dates';
import { useBudgets } from '@/lib/hooks/useBudgets';
import { useExpenses } from '@/lib/hooks/useExpenses';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { useReconnect } from '@/lib/hooks/useReconnect';
import { categorySuggestions, forWhomOptions, personSuggestions } from '@/lib/suggestions';
import type { ExpenseInput } from '@/types/dto';
import type { Budget } from '@/types/budget';
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
  const budgetsApi = useBudgets();

  useReconnect(online, () => {
    void expensesApi.reload();
    void budgetsApi.reload();
  });

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [filters, setFilters] = useState<ExpenseFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);

  const currentBudget = useMemo(
    () => budgetsApi.budgets.find((b) => isSameMonthAs(b.month, currentMonth)) ?? null,
    [budgetsApi.budgets, currentMonth],
  );

  const saveBudget = async (amount: number) => {
    const result = await budgetsApi.save(formatMonthKey(currentMonth), amount);
    if (!result.ok) return false;
    toast.success('Budget saved');
    setBudgetOpen(false);
    return true;
  };

  const deleteBudget = async (budget: Budget) => {
    const result = await budgetsApi.remove(budget.id);
    if (!result.ok) return false;
    toast.success('Budget removed');
    return true;
  };

  const persons = useMemo(() => personSuggestions(expenses), [expenses]);
  const categories = useMemo(() => categorySuggestions(expenses), [expenses]);
  const personFilterOptions = useMemo(() => forWhomOptions(expenses), [expenses]);
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
          <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start" aria-label="Monthly summary">
            <MonthlySummary
              expenses={expenses}
              month={currentMonth}
              budget={currentBudget}
              isLoading={isLoading || budgetsApi.isLoading}
              offline={offline}
              onSetBudget={() => setBudgetOpen(true)}
              onToggleReceived={toggleReceived}
              onToggleSplit={toggleSplit}
            />
          </aside>
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

      <ExpenseFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onFiltersChange={setFilters}
        month={currentMonth}
        months={months}
        onMonthChange={setCurrentMonth}
        persons={personFilterOptions}
        categories={categories}
        onClearAll={clearFilters}
      />

      <BudgetDialog
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        month={currentMonth}
        budget={currentBudget}
        offline={offline}
        onSave={saveBudget}
        onDelete={deleteBudget}
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
