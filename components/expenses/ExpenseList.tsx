'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/shared/Money';
import { groupByDay } from '@/lib/dates';
import { splitStatus } from '@/lib/filters';
import { canHavePaymentStatus, isSelf, typeOf } from '@/lib/person';
import { cn } from '@/lib/utils';
import { TRANSACTION_TYPE_LABELS, type Expense } from '@/types/expense';
import { AMOUNT_COLOR, SPLIT_STATUS } from './columns';
import { SplitShares } from './SplitShares';

const STATUS_TEXT = {
  received: 'text-received',
  pending: 'text-pending',
  partial: 'text-partial',
} as const;

interface ExpenseListProps {
  rows: Expense[];
  offline: boolean;
  onOpen: (expense: Expense) => void;
  onToggleSplit: (expense: Expense, index: number, received: boolean) => void;
}

/** Phone layout: two-line rows grouped by day. Tapping a row opens its details. */
export function ExpenseList({ rows, offline, onOpen, onToggleSplit }: ExpenseListProps) {
  const groups = useMemo(() => groupByDay(rows), [rows]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div>
      {groups.map(({ day, items }) => (
        <section key={day.getTime()} aria-label={format(day, 'EEEE, MMMM d')}>
          {/* Pinned to the viewport top while its day is on screen. */}
          <h3 className="sticky top-0 z-10 border-b bg-muted-solid px-4 py-1.5 text-xs font-semibold text-muted-foreground">
            {format(day, 'EEE, dd MMM')}
          </h3>
          <ul className="divide-y border-b last:border-b-0">
            {items.map((e) => (
              <ExpenseListItem
                key={e.id}
                expense={e}
                expanded={!!expanded[e.id]}
                onToggleExpanded={() => setExpanded((prev) => ({ ...prev, [e.id]: !prev[e.id] }))}
                offline={offline}
                onOpen={onOpen}
                onToggleSplit={onToggleSplit}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface ExpenseListItemProps {
  expense: Expense;
  expanded: boolean;
  onToggleExpanded: () => void;
  offline: boolean;
  onOpen: (expense: Expense) => void;
  onToggleSplit: (expense: Expense, index: number, received: boolean) => void;
}

function ExpenseListItem({ expense: e, expanded, onToggleExpanded, offline, onOpen, onToggleSplit }: ExpenseListItemProps) {
  const type = typeOf(e);
  const split = !!e.isSplit && !!e.splitDetails?.length;

  let status: { label: string; tone: keyof typeof STATUS_TEXT } | null = null;
  if (split) {
    const s = splitStatus(e);
    status = { label: SPLIT_STATUS[s].label, tone: s };
  } else if (canHavePaymentStatus(e)) {
    status = e.paymentReceived ? { label: 'Received', tone: 'received' } : { label: 'Pending', tone: 'pending' };
  }

  // Empty values are dropped rather than shown as "—".
  const meta = [split ? null : isSelf(e.forWhom) ? 'Self' : e.forWhom, e.category, e.paymentMode].filter(Boolean);

  return (
    <li>
      <div className="relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* Stretched over the whole row, so a tap anywhere opens details. */}
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => onOpen(e)}
              className="truncate text-left font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
            >
              {e.title}
            </button>
            <Badge variant={type} className="shrink-0">
              {TRANSACTION_TYPE_LABELS[type]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            {split && (
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={`${expanded ? 'Hide' : 'Show'} split details for ${e.title}`}
                onClick={onToggleExpanded}
                // Above the stretched open-button; padding enlarges the touch target.
                className="relative z-10 -mx-1.5 -my-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-1.5 font-medium text-summary-others outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                Split ({e.splitDetails!.length})
                {expanded ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
              </button>
            )}
            {status && (
              <>
                {split && <span aria-hidden="true">·</span>}
                <span className={cn('font-medium', STATUS_TEXT[status.tone])}>{status.label}</span>
              </>
            )}
            {meta.map((m, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                {(i > 0 || split || status) && <span aria-hidden="true">·</span>}
                <span className="truncate">{m}</span>
              </span>
            ))}
          </div>
        </div>
        <Money
          value={e.amount}
          className={cn('shrink-0 pt-0.5 font-semibold whitespace-nowrap', AMOUNT_COLOR[type])}
        />
      </div>
      {split && expanded && (
        <div className="bg-muted/40 px-4 pt-1 pb-3">
          <SplitShares expense={e} offline={offline} onToggle={onToggleSplit} idPrefix="list-split" />
        </div>
      )}
    </li>
  );
}
