'use client';

import { useEffect } from 'react';
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormSetValue } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/shared/Combobox';
import { autoLastAmount } from '@/lib/expense-payload';
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

  // Keep the last row equal to max(0, total − sum(other rows)).
  const lastIndex = rows.length - 1;
  const expectedLast = autoLastAmount(total, rows);
  const currentLast = rows[lastIndex]?.amount;
  useEffect(() => {
    if (lastIndex >= 1 && currentLast !== expectedLast) {
      setValue(`splitDetails.${lastIndex}.amount`, expectedLast, { shouldValidate: false });
    }
  }, [lastIndex, currentLast, expectedLast, setValue]);

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
        const isLast = index === fields.length - 1;
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
              <Field className="w-28 shrink-0 gap-1.5" data-invalid={!!rowErrors?.amount}>
                <FieldLabel htmlFor={amountId} className="text-xs text-muted-foreground">
                  Amount {isLast && '(Auto)'}
                </FieldLabel>
                <Input
                  id={amountId}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="h-10"
                  readOnly={isLast}
                  aria-readonly={isLast}
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

      <Button
        type="button"
        variant="outline"
        className="h-10 w-full"
        onClick={() => append({ person: '', amount: 0, paymentReceived: false })}
      >
        <Plus aria-hidden="true" />
        Add Person
      </Button>

      <p className="border-t pt-2 text-xs text-muted-foreground tabular-nums">
        Total: ₹{formatNumber(Number.isFinite(total) ? total : 0)} | Split Sum: ₹{formatNumber(sum)}
      </p>
      {rootError && (
        <p role="alert" className="text-sm text-destructive">
          {rootError}
        </p>
      )}
    </fieldset>
  );
}
