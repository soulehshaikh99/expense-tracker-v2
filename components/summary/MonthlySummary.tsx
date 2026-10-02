'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';
import { computeMonthlySummary } from '@/lib/accounting';
import type { Budget } from '@/types/budget';
import type { Expense } from '@/types/expense';
import { BudgetCard } from './BudgetCard';
import { MoneyToCollect } from './MoneyToCollect';
import { SummaryCard } from './SummaryCard';

interface MonthlySummaryProps {
  /** All expenses — the summary applies only the month, never the filters. */
  expenses: Expense[];
  month: Date;
  budget: Budget | null;
  isLoading: boolean;
  offline: boolean;
  onSetBudget: () => void;
  onToggleReceived: (expense: Expense, received: boolean) => void;
  onToggleSplit: (expense: Expense, index: number, received: boolean) => void;
}

export function MonthlySummary({
  expenses,
  month,
  budget,
  isLoading,
  offline,
  onSetBudget,
  onToggleReceived,
  onToggleSplit,
}: MonthlySummaryProps) {
  const s = useMemo(() => computeMonthlySummary(expenses, month), [expenses, month]);

  if (isLoading) return <MonthlySummarySkeleton />;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">{format(month, 'MMMM yyyy')} Summary</CardTitle>
        <CardAction>
          <OfflineTooltip offline={offline}>
            <Button variant="link" className="h-10 px-2" onClick={onSetBudget} disabled={offline}>
              {budget ? 'Edit' : 'Set Budget'}
            </Button>
          </OfflineTooltip>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <BudgetCard
          budget={budget?.amount ?? null}
          spent={s.netAmount}
          offline={offline}
          onSetBudget={onSetBudget}
        />
        <SummaryCard title="Total Spent by Me" value={s.totalSpentByMe} tone="expense" />
        <SummaryCard
          title="Spent for Others"
          value={s.totalSpentForOthers}
          tone="others"
          lines={[
            { label: 'Received', value: s.othersReceived },
            { label: 'Pending', value: s.othersPending },
          ]}
        />
        {s.totalIncome > 0 && <SummaryCard title="Money Received" value={s.totalIncome} tone="income" />}
        {s.totalDonations > 0 && (
          <SummaryCard title="Amount Donated" value={s.totalDonations} tone="donation" />
        )}
        {s.totalLent > 0 && (
          <SummaryCard
            title="Money Lent"
            value={s.totalLent}
            tone="lent"
            lines={[
              { label: 'Received', value: s.lentReceived },
              { label: 'Pending', value: s.lentPending },
            ]}
          />
        )}
        <SummaryCard
          title="Net Amount (Me + Donations + Pending + Lent Pending − Income)"
          value={s.netAmount}
          tone="net"
        />
        <MoneyToCollect
          groups={s.moneyToCollect}
          offline={offline}
          onToggleReceived={onToggleReceived}
          onToggleSplit={onToggleSplit}
        />
      </CardContent>
    </Card>
  );
}

export function MonthlySummarySkeleton() {
  return (
    <Card className="gap-4" aria-busy="true" aria-label="Loading summary">
      <CardHeader className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-20" />
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="space-y-3 border-t pt-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
