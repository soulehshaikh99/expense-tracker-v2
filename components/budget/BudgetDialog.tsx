'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';
import { budgetFormSchema, type BudgetFormValues } from '@/lib/validation/budget';
import type { Budget } from '@/types/budget';

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: Date;
  budget: Budget | null;
  offline: boolean;
  /** Resolve true when saved. */
  onSave: (amount: number) => Promise<boolean>;
  /** Resolve true when deleted. */
  onDelete: (budget: Budget) => Promise<boolean>;
}

export function BudgetDialog(props: BudgetDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remount per open/month/budget so the default amount is fresh. */}
        {props.open && <BudgetForm key={`${props.month.getTime()}-${props.budget?.id ?? 'new'}`} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function BudgetForm({ onOpenChange, month, budget, offline, onSave, onDelete }: BudgetDialogProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: { amount: budget?.amount ?? Number.NaN },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ amount }) => {
    await onSave(amount);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{budget ? 'Edit Budget' : 'Set Budget'}</DialogTitle>
        <DialogDescription>{format(month, 'MMMM yyyy')}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field>
          <FieldLabel htmlFor="budget-month">Month</FieldLabel>
          <Input id="budget-month" className="h-10" value={format(month, 'MMMM yyyy')} readOnly disabled />
        </Field>
        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="budget-amount">Budget Amount</FieldLabel>
          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <Input
                id="budget-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="h-10"
                autoFocus
                aria-invalid={!!errors.amount}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={Number.isFinite(field.value) ? field.value : ''}
                onChange={(e) => field.onChange(e.target.value === '' ? Number.NaN : e.target.valueAsNumber)}
              />
            )}
          />
          <FieldDescription>
            This budget applies to your net spending (personal expenses + pending payments from others)
          </FieldDescription>
          <FieldError errors={[errors.amount]} />
        </Field>
        <DialogFooter className="gap-2 sm:justify-between">
          {budget ? (
            <OfflineTooltip offline={offline}>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                onClick={() => setConfirmOpen(true)}
                disabled={isSubmitting || offline}
              >
                Remove Budget
              </Button>
            </OfflineTooltip>
          ) : (
            <span />
          )}
          <OfflineTooltip offline={offline}>
            <Button type="submit" size="lg" disabled={isSubmitting || offline}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {budget ? 'Update Budget' : 'Set Budget'}
            </Button>
          </OfflineTooltip>
        </DialogFooter>
      </form>
      {budget && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Remove budget?"
          description="Are you sure you want to remove the budget for this month?"
          confirmLabel="Remove"
          destructive
          onConfirm={async () => {
            const ok = await onDelete(budget);
            if (ok) onOpenChange(false);
            return ok;
          }}
        />
      )}
    </>
  );
}
