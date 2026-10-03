'use client';

import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/shared/Money';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';
import { isSelf } from '@/lib/person';
import type { Expense } from '@/types/expense';

interface SplitSharesProps {
  expense: Expense;
  offline: boolean;
  onToggle: (expense: Expense, index: number, received: boolean) => void;
  /** Prefix for checkbox ids, so the same split can render in two places at once. */
  idPrefix?: string;
}

/** Each share of a split with its received toggle (non-self shares only). */
export function SplitShares({ expense, offline, onToggle, idPrefix = 'split' }: SplitSharesProps) {
  return (
    <ul className="space-y-2">
      {(expense.splitDetails ?? []).map((share, index) => {
        const self = isSelf(share.person);
        const id = `${idPrefix}-${expense.id}-${index}`;
        return (
          <li
            key={`${share.person}-${index}`}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border bg-card p-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Badge variant={self ? 'self' : 'person'} className="max-w-48 truncate">
                {share.person}
              </Badge>
              <Money value={share.amount} className="text-sm font-semibold" />
            </div>
            {!self && (
              <div className="flex items-center gap-2">
                <OfflineTooltip offline={offline}>
                  <Checkbox
                    id={id}
                    checked={!!share.paymentReceived}
                    disabled={offline}
                    aria-label={`Payment received from ${share.person}`}
                    onCheckedChange={(c) => onToggle(expense, index, c === true)}
                  />
                </OfflineTooltip>
                <Label htmlFor={id} className="text-xs font-normal">
                  {share.paymentReceived ? 'Received' : 'Pending'}
                  {share.paymentReceived && share.paymentReceivedDate && (
                    <span className="text-muted-foreground">
                      {' '}
                      on {format(share.paymentReceivedDate, 'MMM dd, yyyy')}
                    </span>
                  )}
                </Label>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
