'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Combobox } from '@/components/shared/Combobox';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';
import { today } from '@/lib/dates';
import { paymentReceivedLabel, TYPE_LABELS } from '@/lib/expense-labels';
import {
  buildExpenseInput,
  formValuesFromExpense,
  initialSplitRows,
  splitRowsHaveData,
} from '@/lib/expense-payload';
import { canHavePaymentStatus, isSelf, SELF } from '@/lib/person';
import { cn } from '@/lib/utils';
import {
  defaultExpenseFormValues,
  expenseFormSchema,
  type ExpenseFormValues,
} from '@/lib/validation/expense';
import type { ExpenseInput } from '@/types/dto';
import { PAYMENT_MODES, TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS, type Expense, type TransactionType } from '@/types/expense';
import { SplitEditor } from './SplitEditor';

export interface ExpenseFormProps {
  editing: Expense | null;
  personSuggestions: string[];
  categorySuggestions: string[];
  offline: boolean;
  /** Resolve true when saved (the caller closes the dialog). */
  onSubmit: (input: ExpenseInput) => Promise<boolean>;
  onCancel: () => void;
}

type PendingSplitOff = { kind: 'toggle' } | { kind: 'type'; type: TransactionType };

export function ExpenseForm({
  editing,
  personSuggestions,
  categorySuggestions,
  offline,
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: editing ? formValuesFromExpense(editing) : defaultExpenseFormValues(today()),
  });
  const { control, register, setValue, getValues, formState } = form;
  const { errors, isSubmitting } = formState;

  const [type, isSplit, forWhom] = useWatch({ control, name: ['transactionType', 'isSplit', 'forWhom'] });
  const labels = TYPE_LABELS[type];
  const [dateOpen, setDateOpen] = useState(false);
  const [pendingSplitOff, setPendingSplitOff] = useState<PendingSplitOff | null>(null);

  const personOptions = (type === 'lent' ? [] : [SELF]).concat(personSuggestions.filter((p) => !isSelf(p)));
  const showReceived = !!forWhom.trim() && canHavePaymentStatus({ isSplit, forWhom, transactionType: type });

  const turnSplitOff = () => {
    setValue('isSplit', false);
    setValue('splitDetails', []);
    if (!getValues('forWhom').trim() && getValues('transactionType') === 'expense') setValue('forWhom', SELF);
  };

  const applyType = (next: TransactionType) => {
    setValue('transactionType', next, { shouldValidate: formState.isSubmitted });
    if (next === 'lent' && isSelf(getValues('forWhom'))) setValue('forWhom', '');
  };

  const changeType = (next: string) => {
    if (!next) return; // ToggleGroup sends '' when the active item is clicked again
    const t = next as TransactionType;
    if (t !== 'expense' && getValues('isSplit')) {
      if (splitRowsHaveData(getValues('splitDetails'))) {
        setPendingSplitOff({ kind: 'type', type: t });
        return;
      }
      turnSplitOff();
    }
    applyType(t);
  };

  const toggleSplit = (on: boolean) => {
    if (on) {
      setValue('isSplit', true);
      setValue('splitDetails', initialSplitRows(getValues('amount')));
      setValue('forWhom', '');
      setValue('paymentReceived', false);
      return;
    }
    if (splitRowsHaveData(getValues('splitDetails'))) {
      setPendingSplitOff({ kind: 'toggle' });
      return;
    }
    turnSplitOff();
  };

  const confirmSplitOff = () => {
    const pending = pendingSplitOff;
    turnSplitOff();
    if (pending?.kind === 'type') applyType(pending.type);
  };

  const submit = form.handleSubmit(async (values) => {
    const saved = await onSubmit(buildExpenseInput(values, editing ?? undefined));
    if (saved && !editing) form.reset(defaultExpenseFormValues(today()));
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel id="type-label">Transaction Type</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            value={type}
            onValueChange={changeType}
            aria-labelledby="type-label"
            className="grid w-full grid-cols-4"
          >
            {TRANSACTION_TYPES.map((t) => (
              <ToggleGroupItem key={t} value={t} className="h-10 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {TRANSACTION_TYPE_LABELS[t]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="title">{labels.title}</FieldLabel>
          <Input
            id="title"
            className="h-10"
            placeholder="e.g., Electricity Bill"
            autoComplete="off"
            aria-invalid={!!errors.title}
            {...register('title')}
          />
          <FieldError errors={[errors.title]} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.amount}>
            <FieldLabel htmlFor="amount">Amount</FieldLabel>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="h-10"
                  aria-invalid={!!errors.amount}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={Number.isFinite(field.value) ? field.value : ''}
                  onChange={(e) => field.onChange(e.target.value === '' ? Number.NaN : e.target.valueAsNumber)}
                />
              )}
            />
            <FieldError errors={[errors.amount]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="paymentMode">Payment Mode</FieldLabel>
            <Controller
              control={control}
              name="paymentMode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="paymentMode" className="h-10! w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        {!isSplit && (
          <Field data-invalid={!!errors.forWhom}>
            <FieldLabel htmlFor="forWhom">{labels.person}</FieldLabel>
            <Controller
              control={control}
              name="forWhom"
              render={({ field }) => (
                <Combobox
                  id="forWhom"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  suggestions={personOptions}
                  placeholder={labels.personPlaceholder}
                  invalid={!!errors.forWhom}
                />
              )}
            />
            <FieldError errors={[errors.forWhom]} />
          </Field>
        )}

        {type === 'expense' && (
          <Field orientation="horizontal" data-invalid={!!errors.isSplit}>
            <Switch id="isSplit" checked={isSplit} onCheckedChange={toggleSplit} />
            <FieldLabel htmlFor="isSplit" className="font-normal">
              Split Transaction
            </FieldLabel>
            <FieldError errors={[errors.isSplit]} />
          </Field>
        )}

        {isSplit && type === 'expense' && (
          <SplitEditor
            control={control}
            setValue={setValue}
            errors={errors}
            personSuggestions={personSuggestions}
            isEditing={!!editing}
          />
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor="date">Date</FieldLabel>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      type="button"
                      variant="outline"
                      className={cn('h-10 w-full justify-start px-3 font-normal', !field.value && 'text-muted-foreground')}
                    >
                      <CalendarIcon aria-hidden="true" />
                      {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      defaultMonth={field.value}
                      onSelect={(d) => {
                        if (d) field.onChange(d);
                        setDateOpen(false);
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            <FieldError errors={[errors.date]} />
          </Field>

          <Field data-invalid={!!errors.category}>
            <FieldLabel htmlFor="category">Category</FieldLabel>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Combobox
                  id="category"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  suggestions={categorySuggestions}
                  placeholder="e.g., Food, Transport, Bills"
                  allowClear
                />
              )}
            />
            <FieldError errors={[errors.category]} />
          </Field>
        </div>

        {showReceived && (
          <Controller
            control={control}
            name="paymentReceived"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="paymentReceived"
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(c === true)}
                />
                <Label htmlFor="paymentReceived" className="font-normal">
                  {paymentReceivedLabel(type, forWhom.trim())}
                </Label>
              </div>
            )}
          />
        )}
      </FieldGroup>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <OfflineTooltip offline={offline}>
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={isSubmitting || offline}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {editing ? 'Update Transaction' : 'Add Transaction'}
          </Button>
        </OfflineTooltip>
      </div>

      <ConfirmDialog
        open={pendingSplitOff !== null}
        onOpenChange={(open) => !open && setPendingSplitOff(null)}
        title="Remove split details?"
        description="Converting to regular transaction will lose split details. Continue?"
        confirmLabel="Continue"
        destructive
        onConfirm={confirmSplitOff}
      />
    </form>
  );
}
