'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnSizingState,
  type ExpandedState,
  type VisibilityState,
} from '@tanstack/react-table';
import { Columns3, Filter, Plus, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MonthPicker } from '@/components/shared/MonthPicker';
import { Money } from '@/components/shared/Money';
import { OfflineTooltip } from '@/components/shared/OfflineTooltip';
import { listTotal } from '@/lib/accounting';
import {
  loadColumnVisibility,
  loadColumnWidths,
  saveColumnVisibility,
  saveColumnWidths,
} from '@/lib/table-prefs';
import { cn } from '@/lib/utils';
import type { Expense } from '@/types/expense';
import {
  COLUMN_IDS,
  COLUMN_LABELS,
  DEFAULT_COLUMN_WIDTHS,
  type ColumnVisibility,
  type ColumnWidths,
} from '@/types/table';
import { buildColumns, type RowHandlers } from './columns';
import { EmptyState } from './EmptyState';
import { SplitDetailsRow } from './SplitDetailsRow';

export interface ExpenseTableProps extends RowHandlers {
  rows: Expense[];
  totalCount: number;
  isLoading: boolean;
  month: Date;
  months: Date[];
  onMonthChange: (month: Date) => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  onOpenFilters: () => void;
  onClearFilters: () => void;
  onAdd: () => void;
  onToggleSplit: (expense: Expense, index: number, received: boolean) => void;
}

export function ExpenseTable(props: ExpenseTableProps) {
  const {
    rows,
    totalCount,
    isLoading,
    month,
    months,
    onMonthChange,
    activeFilterCount,
    hasActiveFilters,
    onOpenFilters,
    onClearFilters,
    onAdd,
    onToggleSplit,
    offline,
    onEdit,
    onDelete,
    onToggleReceived,
  } = props;

  // Preferences load after mount so server and first client render match.
  const [visibility, setVisibility] = useState<ColumnVisibility | null>(null);
  const [widths, setWidths] = useState<ColumnWidths | null>(null);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  useEffect(() => {
    setVisibility(loadColumnVisibility());
    setWidths(loadColumnWidths());
  }, []);

  const columns = useMemo(
    () => buildColumns({ offline, onEdit, onDelete, onToggleReceived }),
    [offline, onEdit, onDelete, onToggleReceived],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (e) => e.id,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => !!row.original.isSplit && !!row.original.splitDetails?.length,
    columnResizeMode: 'onChange',
    state: {
      expanded,
      columnVisibility: (visibility ?? undefined) as VisibilityState | undefined,
      columnSizing: (widths ?? DEFAULT_COLUMN_WIDTHS) as ColumnSizingState,
    },
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: (updater) => {
      setVisibility((prev) => {
        const base = (prev ?? loadColumnVisibility()) as VisibilityState;
        const next = (typeof updater === 'function' ? updater(base) : updater) as ColumnVisibility;
        saveColumnVisibility(next);
        return next;
      });
    },
    onColumnSizingChange: (updater) => {
      setWidths((prev) => {
        const base = (prev ?? DEFAULT_COLUMN_WIDTHS) as ColumnSizingState;
        const next = { ...DEFAULT_COLUMN_WIDTHS, ...(typeof updater === 'function' ? updater(base) : updater) };
        saveColumnWidths(next);
        return next;
      });
    },
  });

  const resetWidths = () => {
    setWidths({ ...DEFAULT_COLUMN_WIDTHS });
    saveColumnWidths({ ...DEFAULT_COLUMN_WIDTHS });
  };

  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const total = useMemo(() => listTotal(rows), [rows]);

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3 sm:p-4">
      <MonthPicker value={month} onChange={onMonthChange} months={months} />
      <div className="flex flex-wrap items-center gap-2">
        {hasActiveFilters && (
          <Button variant="ghost" size="lg" onClick={onClearFilters}>
            <X aria-hidden="true" />
            Clear filters
          </Button>
        )}
        <Button variant="outline" size="lg" className="min-w-10" onClick={onOpenFilters} aria-label="Filters">
          <Filter aria-hidden="true" />
          <span className="max-sm:sr-only">Filters</span>
          {activeFilterCount > 0 && (
            <Badge className="ml-0.5" aria-label={`${activeFilterCount} active`}>
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-lg" aria-label="Column visibility">
              <Columns3 />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Columns</DropdownMenuLabel>
            {COLUMN_IDS.map((id) => {
              const column = table.getColumn(id);
              return (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={column?.getIsVisible() ?? true}
                  onCheckedChange={(v) => column?.toggleVisibility(v === true)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {COLUMN_LABELS[id]}
                </DropdownMenuCheckboxItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={resetWidths}>
              <RotateCcw aria-hidden="true" /> Reset widths
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <OfflineTooltip offline={offline}>
          <Button size="lg" className="min-w-10" onClick={onAdd} disabled={offline} aria-label="Add transaction">
            <Plus aria-hidden="true" />
            <span className="max-sm:sr-only">Add</span>
          </Button>
        </OfflineTooltip>
      </div>
    </div>
  );

  if (isLoading) return <ExpenseTableSkeleton />;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {toolbar}
      {rows.length === 0 ? (
        <EmptyState
          variant={hasActiveFilters && totalCount > 0 ? 'no-match' : 'empty'}
          offline={offline}
          onAdd={onAdd}
          onClearFilters={onClearFilters}
        />
      ) : (
        <>
        <Table className="min-w-full table-fixed" style={{ width: table.getTotalSize() }}>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={cn('relative h-11 px-3', header.column.columnDef.meta?.className)}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanResize() && (
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${header.column.columnDef.meta?.label ?? ''} column`}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                        className={cn(
                          'absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-border',
                          header.column.getIsResizing() && 'bg-primary',
                        )}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <TableRow data-state={row.getIsExpanded() ? 'expanded' : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className={cn('px-3 py-2', cell.column.columnDef.meta?.className)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {row.getIsExpanded() && (
                  <SplitDetailsRow
                    expense={row.original}
                    colSpan={visibleColumnCount}
                    offline={offline}
                    onToggle={onToggleSplit}
                  />
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t bg-muted/50 px-3 py-3">
          <span className="text-sm text-muted-foreground">Total:</span>
          <Money value={total} className="text-base font-semibold sm:text-lg" />
        </div>
        </>
      )}
    </Card>
  );
}

export function ExpenseTableSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden py-0" aria-busy="true" aria-label="Loading transactions">
      <div className="flex items-center justify-between gap-2 border-b p-3 sm:p-4">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="size-10" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
      <div className="space-y-0 divide-y">
        <div className="flex gap-4 bg-muted/50 px-3 py-3">
          {[140, 200, 120, 140, 180].map((w, i) => (
            <Skeleton key={i} className="h-4" style={{ width: w * 0.6 }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="hidden h-4 w-24 md:block" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t bg-muted/50 px-3 py-3">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-5 w-24" />
      </div>
    </Card>
  );
}
