'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useRestoreFocus } from '@/lib/hooks/useRestoreFocus';
import { ExpenseForm, type ExpenseFormProps } from './ExpenseForm';

interface ExpenseFormDialogProps extends Omit<ExpenseFormProps, 'onCancel'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Dialog on ≥ sm, Drawer on mobile (plan 2.2). */
export function ExpenseFormDialog({ open, onOpenChange, editing, ...formProps }: ExpenseFormDialogProps) {
  const desktop = useMediaQuery('(min-width: 640px)');
  const restoreFocus = useRestoreFocus();
  const title = editing ? 'Edit Transaction' : 'Add New Transaction';
  const description = editing ? 'Update the details of this transaction.' : 'Record an expense, income, donation or money lent.';
  // Remount the form for each record so default values are fresh.
  const form = (
    <ExpenseForm
      key={editing?.id ?? 'new'}
      editing={editing}
      onCancel={() => onOpenChange(false)}
      {...formProps}
    />
  );

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" {...restoreFocus}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[95dvh]" {...restoreFocus}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">{form}</div>
      </DrawerContent>
    </Drawer>
  );
}
