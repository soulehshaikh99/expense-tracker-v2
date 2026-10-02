'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ExpenseFormDialog } from '@/components/expenses/ExpenseFormDialog';
import { LogoutButton } from '@/components/shared/LogoutButton';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useExpenses } from '@/lib/hooks/useExpenses';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { useReconnect } from '@/lib/hooks/useReconnect';
import { categorySuggestions, personSuggestions } from '@/lib/suggestions';
import type { ExpenseInput } from '@/types/dto';
import type { Expense } from '@/types/expense';

export default function DashboardPage() {
  const online = useOnlineStatus();
  const offline = !online;
  const expensesApi = useExpenses();
  const { expenses } = expensesApi;

  useReconnect(online, () => {
    void expensesApi.reload();
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const persons = useMemo(() => personSuggestions(expenses), [expenses]);
  const categories = useMemo(() => categorySuggestions(expenses), [expenses]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const saveExpense = async (input: ExpenseInput) => {
    const result = editing ? await expensesApi.update(editing.id, input) : await expensesApi.create(input);
    if (!result.ok) return false;
    toast.success(editing ? 'Transaction updated' : 'Transaction added');
    setFormOpen(false);
    return true;
  };

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

        <div className="flex items-center gap-2">
          <OfflineTooltip offline={offline}>
            <Button size="lg" onClick={openAdd} disabled={offline}>
              <Plus aria-hidden="true" />
              <span className="max-sm:sr-only">Add</span>
            </Button>
          </OfflineTooltip>
          <p className="text-sm text-muted-foreground">{expenses.length} transactions loaded</p>
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
    </div>
  );
}
