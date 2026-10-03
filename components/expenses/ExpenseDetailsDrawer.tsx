'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/shared/Money';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';
import { useRestoreFocus } from '@/lib/hooks/useRestoreFocus';
import { canHavePaymentStatus, isSelf, typeOf } from '@/lib/person';
import { cn } from '@/lib/utils';
import { TRANSACTION_TYPE_LABELS, type Expense } from '@/types/expense';
import { AMOUNT_COLOR, type RowHandlers } from './columns';
import { SplitShares } from './SplitShares';

interface ExpenseDetailsDrawerProps extends RowHandlers {
  /** The open transaction; null closes the drawer. */
  expense: Expense | null;
  onClose: () => void;
  onToggleSplit: (expense: Expense, index: number, received: boolean) => void;
}

/** Phone-only bottom sheet with a transaction's full details and its actions. */
export function ExpenseDetailsDrawer({
  expense,
  onClose,
  offline,
  onEdit,
  onDelete,
  onToggleReceived,
  onToggleSplit,
}: ExpenseDetailsDrawerProps) {
  const restoreFocus = useRestoreFocus();
  // Keep showing the last transaction while the sheet animates closed.
  const [shown, setShown] = useState(expense);
  if (expense && expense !== shown) setShown(expense);
  const e = expense ?? shown;

  return (
    <Drawer open={expense !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent {...restoreFocus}>
        {e && (
          <>
            <DrawerHeader className="text-left">
              <div className="flex items-start justify-between gap-3">
                <DrawerTitle className="min-w-0 text-lg break-words">{e.title}</DrawerTitle>
                <Money
                  value={e.amount}
                  className={cn('shrink-0 text-lg font-semibold', AMOUNT_COLOR[typeOf(e)])}
                />
              </div>
              <DrawerDescription className="text-left">{format(e.date, 'EEEE, MMMM d, yyyy')}</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-2">
              <Details expense={e} offline={offline} onToggleReceived={onToggleReceived} onToggleSplit={onToggleSplit} />
            </div>
            <DrawerFooter className="grid grid-cols-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <OfflineTooltip offline={offline}>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={offline}
                  onClick={() => {
                    onClose();
                    onEdit(e);
                  }}
                >
                  <Pencil aria-hidden="true" /> Edit
                </Button>
              </OfflineTooltip>
              <OfflineTooltip offline={offline}>
                <Button
                  variant="destructive"
                  size="lg"
                  className="w-full"
                  disabled={offline}
                  onClick={() => {
                    onClose();
                    onDelete(e);
                  }}
                >
                  <Trash2 aria-hidden="true" /> Delete
                </Button>
              </OfflineTooltip>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function Details({
  expense: e,
  offline,
  onToggleReceived,
  onToggleSplit,
}: Pick<ExpenseDetailsDrawerProps, 'offline' | 'onToggleReceived' | 'onToggleSplit'> & { expense: Expense }) {
  const type = typeOf(e);
  const split = !!e.isSplit && !!e.splitDetails?.length;
  const receivedId = `details-received-${e.id}`;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
        <dt className="text-muted-foreground">Type</dt>
        <dd>
          <Badge variant={type}>{TRANSACTION_TYPE_LABELS[type]}</Badge>
        </dd>
        {!split && (
          <>
            <dt className="text-muted-foreground">For/From</dt>
            <dd>
              <Badge variant={isSelf(e.forWhom) ? 'self' : 'person'} className="max-w-full truncate">
                {isSelf(e.forWhom) ? 'Self' : e.forWhom}
              </Badge>
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Payment mode</dt>
        <dd>{e.paymentMode}</dd>
        <dt className="text-muted-foreground">Category</dt>
        <dd className={cn(!e.category && 'text-muted-foreground')}>{e.category || '—'}</dd>
        {canHavePaymentStatus(e) && (
          <>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="flex items-center gap-2">
              <OfflineTooltip offline={offline}>
                <Checkbox
                  id={receivedId}
                  checked={!!e.paymentReceived}
                  disabled={offline}
                  onCheckedChange={(c) => onToggleReceived(e, c === true)}
                />
              </OfflineTooltip>
              <Label htmlFor={receivedId} className="font-normal">
                {e.paymentReceived ? 'Received' : 'Pending'}
                {e.paymentReceived && e.paymentReceivedDate && (
                  <span className="text-muted-foreground"> on {format(e.paymentReceivedDate, 'MMM dd, yyyy')}</span>
                )}
              </Label>
            </dd>
          </>
        )}
      </dl>
      {split && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Split between</p>
          <SplitShares expense={e} offline={offline} onToggle={onToggleSplit} idPrefix="details-split" />
        </div>
      )}
    </div>
  );
}
