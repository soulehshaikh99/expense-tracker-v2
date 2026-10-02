'use client';

import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { TableCell, TableRow } from '@/components/ui/table';
import { Money } from '@/components/shared/Money';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';
import { isSelf } from '@/lib/person';
import type { Expense } from '@/types/expense';

interface SplitDetailsRowProps {
  expense: Expense;
  colSpan: number;
  offline: boolean;
  onToggle: (expense: Expense, index: number, received: boolean) => void;
}

export function SplitDetailsRow({ expense, colSpan, offline, onToggle }: SplitDetailsRowProps) {
  return (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableCell colSpan={colSpan} className="p-0">
        <Collapsible open>
          <CollapsibleContent className="sticky left-0 w-fit max-w-[calc(100vw-3rem)] space-y-2 px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground">Split Details:</p>
            <ul className="space-y-2">
              {(expense.splitDetails ?? []).map((share, index) => {
                const self = isSelf(share.person);
                const id = `split-${expense.id}-${index}`;
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
          </CollapsibleContent>
        </Collapsible>
      </TableCell>
    </TableRow>
  );
}
