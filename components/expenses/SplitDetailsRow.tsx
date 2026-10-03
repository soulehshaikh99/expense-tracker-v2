'use client';

import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { TableCell, TableRow } from '@/components/ui/table';
import type { Expense } from '@/types/expense';
import { SplitShares } from './SplitShares';

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
            <SplitShares expense={expense} offline={offline} onToggle={onToggle} />
          </CollapsibleContent>
        </Collapsible>
      </TableCell>
    </TableRow>
  );
}
