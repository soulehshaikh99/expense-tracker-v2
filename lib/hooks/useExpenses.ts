'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createExpenseAction,
  deleteExpenseAction,
  listExpensesAction,
  setPaymentReceivedAction,
  setSplitPaymentReceivedAction,
  updateExpenseAction,
} from '@/app/actions/expenses';
import { expenseFromDTO } from '@/lib/mappers';
import type { ActionResult, ExpenseInput } from '@/types/dto';
import type { Expense } from '@/types/expense';
import { callAction, handleFailure } from './action-client';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await callAction(listExpensesAction());
    if (result.ok) {
      setExpenses(result.data.map(expenseFromDTO));
      setError(null);
    } else {
      setError(result.error);
      handleFailure(result);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Run a mutation; reload on success, toast/redirect on failure. */
  const mutate = useCallback(
    async <T>(action: Promise<ActionResult<T>>): Promise<ActionResult<T>> => {
      const result = await callAction(action);
      if (result.ok) await reload();
      else handleFailure(result);
      return result;
    },
    [reload],
  );

  const create = useCallback((input: ExpenseInput) => mutate(createExpenseAction(input)), [mutate]);
  const update = useCallback(
    (id: string, input: ExpenseInput) => mutate(updateExpenseAction(id, input)),
    [mutate],
  );
  const remove = useCallback((id: string) => mutate(deleteExpenseAction(id)), [mutate]);
  const setPaymentReceived = useCallback(
    (id: string, received: boolean) => mutate(setPaymentReceivedAction(id, received)),
    [mutate],
  );
  const setSplitPaymentReceived = useCallback(
    (expenseId: string, index: number, received: boolean) =>
      mutate(setSplitPaymentReceivedAction(expenseId, index, received)),
    [mutate],
  );

  return {
    expenses,
    isLoading,
    error,
    reload,
    create,
    update,
    remove,
    setPaymentReceived,
    setSplitPaymentReceived,
  };
}
