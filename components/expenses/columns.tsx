'use client';

import type { ColumnDef, RowData } from '@tanstack/react-table';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Money } from '@/components/shared/Money';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';
import { splitStatus } from '@/lib/filters';
import { canHavePaymentStatus, isSelf, typeOf } from '@/lib/person';
import { cn } from '@/lib/utils';
import { TRANSACTION_TYPE_LABELS, type Expense } from '@/types/expense';
import { COLUMN_LABELS, DEFAULT_COLUMN_WIDTHS, type ColumnId } from '@/types/table';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Responsive visibility / alignment classes applied to both th and td. */
    className?: string;
    label?: string;
    /** Breakpoint from which the column is displayed (hidden below it). */
    showFrom?: 'md' | 'lg';
  }
}

export interface RowHandlers {
  offline: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  onToggleReceived: (e: Expense, received: boolean) => void;
}

const AMOUNT_COLOR: Record<string, string> = {
  income: 'text-income',
  lent: 'text-lent',
  donation: 'text-donation',
};

const SPLIT_STATUS = {
  received: { label: 'All Received', variant: 'received' },
  partial: { label: 'Partial', variant: 'partial' },
  pending: { label: 'Pending', variant: 'pending' },
} as const;

export const ACTIONS_COLUMN_ID = 'actions';

function col(id: ColumnId, extra: Partial<ColumnDef<Expense>> = {}): ColumnDef<Expense> {
  return {
    id,
    header: COLUMN_LABELS[id],
    size: DEFAULT_COLUMN_WIDTHS[id],
    minSize: 60,
    maxSize: 800,
    ...extra,
    meta: { label: COLUMN_LABELS[id], ...extra.meta },
  };
}

export function buildColumns(h: RowHandlers): ColumnDef<Expense>[] {
  return [
    col('date', {
      accessorFn: (e) => e.date.getTime(),
      // Year is implied by the month picker, so phones drop it.
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          <span className="sm:hidden">{format(row.original.date, 'dd MMM')}</span>
          <span className="max-sm:hidden">{format(row.original.date, 'MMM dd, yyyy')}</span>
        </span>
      ),
    }),
    col('title', {
      accessorKey: 'title',
      cell: ({ row }) => {
        const type = typeOf(row.original);
        return (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate font-medium">{row.original.title}</span>
            <Badge variant={type}>{TRANSACTION_TYPE_LABELS[type]}</Badge>
          </div>
        );
      },
    }),
    col('amount', {
      accessorKey: 'amount',
      meta: { className: 'text-right' },
      cell: ({ row }) => (
        <Money
          value={row.original.amount}
          className={cn('font-semibold whitespace-nowrap', AMOUNT_COLOR[typeOf(row.original)])}
        />
      ),
    }),
    col('paymentMode', {
      accessorKey: 'paymentMode',
      meta: { className: 'hidden md:table-cell', showFrom: 'md' },
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.paymentMode}</span>,
    }),
    col('forWhom', {
      accessorKey: 'forWhom',
      cell: ({ row }) => {
        const e = row.original;
        if (e.isSplit && e.splitDetails?.length) {
          const expanded = row.getIsExpanded();
          return (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-8 gap-1 px-2"
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Hide' : 'Show'} split details for ${e.title}`}
              onClick={() => row.toggleExpanded()}
            >
              {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              <Badge variant="split">Split ({e.splitDetails.length})</Badge>
            </Button>
          );
        }
        return isSelf(e.forWhom) ? (
          <Badge variant="self">Self</Badge>
        ) : (
          <Badge variant="person" className="max-w-full truncate">
            {e.forWhom}
          </Badge>
        );
      },
    }),
    col('paymentStatus', {
      meta: { className: 'hidden lg:table-cell', showFrom: 'lg' },
      cell: ({ row }) => {
        const e = row.original;
        if (e.isSplit && e.splitDetails?.length) {
          const s = SPLIT_STATUS[splitStatus(e)];
          return <Badge variant={s.variant}>{s.label}</Badge>;
        }
        if (!canHavePaymentStatus(e)) return <span className="text-muted-foreground">—</span>;
        const id = `received-${e.id}`;
        return (
          <div className="flex items-center gap-2">
            <OfflineTooltip offline={h.offline}>
              <Checkbox
                id={id}
                checked={!!e.paymentReceived}
                disabled={h.offline}
                aria-label={`Mark "${e.title}" as ${e.paymentReceived ? 'pending' : 'received'}`}
                onCheckedChange={(c) => h.onToggleReceived(e, c === true)}
              />
            </OfflineTooltip>
            <Badge variant={e.paymentReceived ? 'received' : 'pending'}>
              {e.paymentReceived ? 'Received' : 'Pending'}
            </Badge>
          </div>
        );
      },
    }),
    col('category', {
      accessorKey: 'category',
      cell: ({ row }) =>
        row.original.category ? (
          <span className="truncate">{row.original.category}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    }),
    {
      id: ACTIONS_COLUMN_ID,
      header: () => <span className="sr-only">Actions</span>,
      size: 56,
      enableHiding: false,
      enableResizing: false,
      meta: { className: 'sticky right-0 z-10 bg-card text-right shadow-[-1px_0_0_var(--border)]' },
      cell: ({ row }) => (
        <DropdownMenu>
          <OfflineTooltip offline={h.offline}>
            <DropdownMenuTrigger asChild disabled={h.offline}>
              <Button variant="ghost" size="icon-lg" aria-label={`Actions for ${row.original.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
          </OfflineTooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => h.onEdit(row.original)}>
              <Pencil aria-hidden="true" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => h.onDelete(row.original)}>
              <Trash2 aria-hidden="true" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
