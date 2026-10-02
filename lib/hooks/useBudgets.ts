'use client';

import { useCallback, useEffect, useState } from 'react';
import { deleteBudgetAction, listBudgetsAction, upsertBudgetAction } from '@/app/actions/budgets';
import { budgetFromDTO } from '@/lib/mappers';
import type { ActionResult } from '@/types/dto';
import type { Budget } from '@/types/budget';
import { callAction, handleFailure } from './action-client';

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const result = await callAction(listBudgetsAction());
    if (result.ok) {
      setBudgets(result.data.map(budgetFromDTO));
    } else {
      // Budgets are optional: log only, no toast (plan 7.8).
      console.error('Failed to load budgets:', result.error);
      handleFailure(result, { silent: true });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mutate = useCallback(
    async <T>(action: Promise<ActionResult<T>>): Promise<ActionResult<T>> => {
      const result = await callAction(action);
      if (result.ok) await reload();
      else handleFailure(result);
      return result;
    },
    [reload],
  );

  /** month: 'yyyy-MM-01' */
  const save = useCallback(
    (month: string, amount: number) => mutate(upsertBudgetAction(month, amount)),
    [mutate],
  );
  const remove = useCallback((id: string) => mutate(deleteBudgetAction(id)), [mutate]);

  return { budgets, isLoading, reload, save, remove };
}
