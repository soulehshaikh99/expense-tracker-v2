'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Money } from '@/components/shared/Money';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';
import { computeBudgetStatus } from '@/lib/accounting';
import { cn } from '@/lib/utils';

const LEVEL_TINT = {
  ok: 'bg-received/10 border-received/25',
  warning: 'bg-pending/10 border-pending/30',
  over: 'bg-destructive/10 border-destructive/25',
} as const;

interface BudgetCardProps {
  budget: number | null;
  spent: number;
  offline: boolean;
  onSetBudget: () => void;
}

export function BudgetCard({ budget, spent, offline, onSetBudget }: BudgetCardProps) {
  if (budget === null) {
    return (
      <Card className="items-center gap-2 border-dashed py-4 text-center shadow-none">
        <CardContent className="space-y-2 px-4">
          <p className="text-sm text-muted-foreground">No budget set for this month</p>
          <OfflineTooltip offline={offline}>
            <Button variant="outline" size="lg" onClick={onSetBudget} disabled={offline}>
              Set Budget
            </Button>
          </OfflineTooltip>
        </CardContent>
      </Card>
    );
  }

  const status = computeBudgetStatus(budget, spent);
  return (
    <Card className={cn('gap-0 py-3 shadow-none sm:py-4', LEVEL_TINT[status.level])}>
      <CardContent className="space-y-2 px-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground sm:text-sm">Monthly Budget</span>
          <Money value={budget} className="text-lg font-bold sm:text-xl" />
        </div>
        <Progress
          value={status.barValue}
          variant={status.level}
          className="h-2.5 sm:h-3"
          aria-label="Budget used"
          aria-valuetext={`${status.percentage.toFixed(1)}% of budget used`}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-2 text-xs sm:text-sm">
          <span className="text-muted-foreground">
            Spent: <Money value={spent} /> ({status.percentage.toFixed(1)}%)
          </span>
          {status.remaining >= 0 ? (
            <span className="font-semibold">
              Remaining: <Money value={status.remaining} />
            </span>
          ) : (
            <span className="font-semibold text-destructive">
              Over by: <Money value={Math.abs(status.remaining)} />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
