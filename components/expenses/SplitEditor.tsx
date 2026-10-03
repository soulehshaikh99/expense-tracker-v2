'use client';

import { useEffect, useState } from 'react';
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormSetValue } from 'react-hook-form';
import { Divide, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/shared/Combobox';
import { autoBalanceAmount, equalSplitAmounts } from '@/lib/expense-payload';
import { isSelf, SELF } from '@/lib/person';
import { formatNumber } from '@/lib/utils';
import type { ExpenseFormValues } from '@/lib/validation/expense';

interface SplitEditorProps {
  control: Control<ExpenseFormValues>;
  setValue: UseFormSetValue<ExpenseFormValues>;
  errors: FieldErrors<ExpenseFormValues>;
  personSuggestions: string[];
  isEditing: boolean;
  disabled?: boolean;
}

export function SplitEditor({
  control,
  setValue,
  errors,
  personSuggestions,
  isEditing,
  disabled,
}: SplitEditorProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'splitDetails' });
  const total = useWatch({ control, name: 'amount' });
  const rows = useWatch({ control, name: 'splitDetails' });

  // One row is the balance row: max(0, total − sum(other rows)). Defaults to Self, so
  // entering what others owe fills in your own share; any row can be picked instead.
  const [balanceId, setBalanceId] = useState<string | null>(null);
  const pickedIndex = fields.findIndex((f) => f.id === balanceId);
  const selfIndex = rows.findIndex((r) => isSelf(r.person));
  const balanceIndex = pickedIndex >= 0 ? pickedIndex : selfIndex >= 0 ? selfIndex : rows.length - 1;
  const expectedBalance = autoBalanceAmount(total, rows, balanceIndex);
  const currentBalance = rows[balanceIndex]?.amount;
  useEffect(() => {
    if (rows.length >= 2 && currentBalance !== expectedBalance) {
      setValue(`splitDetails.${balanceIndex}.amount`, expectedBalance, { shouldValidate: false });
    }
  }, [rows.length, balanceIndex, currentBalance, expectedBalance, setValue]);

  const splitEqually = () => {
    equalSplitAmounts(total, rows.length, balanceIndex).forEach((amount, i) =>
      setValue(`splitDetails.${i}.amount`, amount, { shouldValidate: !!errors.splitDetails }),
    );
  };

  const sum = rows.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0);
  const rootError = errors.splitDetails?.root?.message ?? errors.splitDetails?.message;

  const suggestionsFor = (index: number) => {
    const used = new Set(
      rows.filter((_, i) => i !== index).map((r) => r.person.trim().toLowerCase()).filter(Boolean),
    );
    return [SELF, ...personSuggestions.filter((p) => !isSelf(p))].filter((p) => !used.has(p.toLowerCase()));
  };

  return (
    <fieldset className="space-y-4 rounded-lg border bg-muted/40 p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Split Details</legend>

      {fields.map((field, index) => {
        const row = rows[index];
        const self = isSelf(row?.person);
        const isBalance = index === balanceIndex;
        const rowErrors = errors.splitDetails?.[index];
        const personId = `split-person-${index}`;
        const amountId = `split-amount-${index}`;
        return (
          <div key={field.id} className="space-y-2">
            <div className="flex items-start gap-2">
              <Field className="min-w-0 flex-1 gap-1.5" data-invalid={!!rowErrors?.person}>
                <FieldLabel htmlFor={personId} className="text-xs text-muted-foreground">
                  Person {index + 1}
                </FieldLabel>
                <Combobox
                  id={personId}
                  value={row?.person ?? ''}
                  onChange={(value) => {
                    // A second Self cannot be entered.
                    if (isSelf(value) && rows.some((r, i) => i !== index && isSelf(r.person))) return;
                    setValue(`splitDetails.${index}.person`, value, { shouldValidate: !!rowErrors });
                  }}
                  suggestions={suggestionsFor(index)}
                  placeholder={self ? 'Self' : "Person's name"}
                  disabled={disabled || self}
                  invalid={!!rowErrors?.person}
                />
                <FieldError errors={[rowErrors?.person]} />
              </Field>
              <Field className="w-32 shrink-0 gap-1.5" data-invalid={!!rowErrors?.amount}>
                <div className="flex items-center justify-between gap-1">
                  <FieldLabel htmlFor={amountId} className="text-xs text-muted-foreground">
                    Amount
                  </FieldLabel>
                  <button
                    type="button"
                    aria-pressed={isBalance}
                    title={isBalance ? 'Calculated from the total' : 'Calculate this share from the total'}
                    className={
                      isBalance
                        ? 'rounded-full bg-primary px-1.5 text-[10px] font-medium leading-4 text-primary-foreground'
                        : 'rounded-full border px-1.5 text-[10px] leading-4 text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }
                    onClick={() => setBalanceId(field.id)}
                  >
                    Auto
                  </button>
                </div>
                <Input
                  id={amountId}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className={isBalance ? 'h-10 bg-muted' : 'h-10'}
                  readOnly={isBalance}
                  aria-readonly={isBalance}
                  aria-invalid={!!rowErrors?.amount}
                  value={Number.isFinite(row?.amount) ? row.amount : ''}
                  onChange={(e) =>
                    setValue(
                      `splitDetails.${index}.amount`,
                      e.target.value === '' ? Number.NaN : e.target.valueAsNumber,
                      { shouldValidate: !!rowErrors },
                    )
                  }
                />
                <FieldError errors={[rowErrors?.amount]} />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className="mt-6 shrink-0 text-destructive hover:text-destructive"
                aria-label={`Remove person ${index + 1}`}
                disabled={disabled || fields.length <= 2 || self}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
            {isEditing && !self && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`split-received-${index}`}
                  checked={!!row?.paymentReceived}
                  onCheckedChange={(checked) =>
                    setValue(`splitDetails.${index}.paymentReceived`, checked === true)
                  }
                />
                <Label htmlFor={`split-received-${index}`} className="text-xs font-normal">
                  Payment received from {row?.person.trim() || 'this person'}
                </Label>
              </div>
            )}
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => append({ person: '', amount: 0, paymentReceived: false })}
        >
          <Plus aria-hidden="true" />
          Add Person
        </Button>
        <Button type="button" variant="outline" className="h-10" onClick={splitEqually}>
          <Divide aria-hidden="true" />
          Split Equally
        </Button>
      </div>

      <p className="border-t pt-2 text-xs text-muted-foreground tabular-nums">
        Total: ₹{formatNumber(Number.isFinite(total) ? total : 0)} | Split Sum: ₹{formatNumber(sum)}
      </p>
      <p className="-mt-2 text-xs text-muted-foreground">
        The <span className="font-medium">Auto</span> share is the total minus everyone else. Tap Auto on another row to
        calculate that one instead.
      </p>
      {rootError && (
        <p role="alert" className="text-sm text-destructive">
          {rootError}
        </p>
      )}
    </fieldset>
  );
}
