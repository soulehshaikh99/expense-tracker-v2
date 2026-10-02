'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Money } from '@/components/shared/Money';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';
import type { MoneyToCollectGroup, MoneyToCollectItem } from '@/lib/accounting';
import { typeOf } from '@/lib/person';
import { cn } from '@/lib/utils';
import type { Expense } from '@/types/expense';

const TYPE_STYLE: Record<string, { label: string; className: string }> = {
  expense: { label: 'Expense', className: 'text-expense' },
  donation: { label: 'Donation', className: 'text-donation' },
  lent: { label: 'Lent', className: 'text-lent' },
};

interface MoneyToCollectProps {
  groups: MoneyToCollectGroup[];
  offline: boolean;
  onToggleReceived: (expense: Expense, received: boolean) => void;
  onToggleSplit: (expense: Expense, index: number, received: boolean) => void;
}

export function MoneyToCollect({ groups, offline, onToggleReceived, onToggleSplit }: MoneyToCollectProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (groups.length === 0) return null;

  const toggle = (person: string, next: boolean) =>
    setOpen((prev) => {
      const s = new Set(prev);
      if (next) s.add(person);
      else s.delete(person);
      return s;
    });

  return (
    <section className="space-y-3 border-t pt-4" aria-labelledby="money-to-collect">
      <h3 id="money-to-collect" className="text-sm font-semibold">
        Money to Collect
      </h3>
      {groups.map((g) => {
        const isOpen = open.has(g.person);
        return (
          <Collapsible
            key={g.person}
            open={isOpen}
            onOpenChange={(v) => toggle(g.person, v)}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between gap-2 bg-muted/50 p-3 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-hidden">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{g.person}</span>
                  <span className="block text-xs text-muted-foreground">
                    {g.count} {g.count === 1 ? 'item' : 'items'}
                  </span>
                </span>
              </span>
              <Money value={g.amount} className="shrink-0 text-sm font-bold" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="space-y-1 border-t p-2">
                {g.items.map((item) => (
                  <CollectItem
                    key={`${item.expense.id}-${item.splitIndex ?? 'main'}`}
                    item={item}
                    offline={offline}
                    onToggleReceived={onToggleReceived}
                    onToggleSplit={onToggleSplit}
                  />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </section>
  );
}

function CollectItem({
  item,
  offline,
  onToggleReceived,
  onToggleSplit,
}: {
  item: MoneyToCollectItem;
  offline: boolean;
  onToggleReceived: MoneyToCollectProps['onToggleReceived'];
  onToggleSplit: MoneyToCollectProps['onToggleSplit'];
}) {
  const e = item.expense;
  const isShare = item.splitIndex !== undefined;
  const style = TYPE_STYLE[typeOf(e)] ?? TYPE_STYLE.expense;
  const received = isShare ? !!e.splitDetails?.[item.splitIndex!]?.paymentReceived : !!e.paymentReceived;
  const id = `collect-${e.id}-${item.splitIndex ?? 'main'}`;

  return (
    <li className="flex items-start justify-between gap-3 rounded-md p-2 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-x-2 text-xs">
          <span className={cn('font-medium', style.className)}>{style.label}</span>
          {isShare && (
            <>
              <span className="text-muted-foreground" aria-hidden="true">•</span>
              <span className="font-medium text-summary-others">Split</span>
            </>
          )}
          <span className="text-muted-foreground" aria-hidden="true">•</span>
          <span className="text-muted-foreground">{format(e.date, 'MMM dd, yyyy')}</span>
        </div>
        <label htmlFor={id} className="block truncate text-sm font-medium">
          {e.title}
        </label>
        <div className="text-xs text-muted-foreground">{e.paymentMode}</div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <Money value={item.amount} className="block text-sm font-semibold" />
          {isShare && e.amount !== item.amount && (
            <span className="text-xs text-muted-foreground">
              of <Money value={e.amount} />
            </span>
          )}
        </div>
        <OfflineTooltip offline={offline}>
          <Checkbox
            id={id}
            checked={received}
            disabled={offline}
            aria-label={`Mark "${e.title}" as received`}
            onCheckedChange={(c) =>
              isShare ? onToggleSplit(e, item.splitIndex!, c === true) : onToggleReceived(e, c === true)
            }
          />
        </OfflineTooltip>
      </div>
    </li>
  );
}
