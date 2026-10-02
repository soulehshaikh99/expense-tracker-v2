'use client';

import { useMemo } from 'react';
import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KEY = 'yyyy-MM';

interface MonthPickerProps {
  id?: string;
  value: Date;
  onChange: (month: Date) => void;
  /** Months to offer in the select (any day within the month). */
  months: Date[];
}

export function MonthPicker({ id, value, onChange, months }: MonthPickerProps) {
  const options = useMemo(() => {
    const byKey = new Map<string, Date>();
    for (const m of [...months, value]) byKey.set(format(m, KEY), startOfMonth(m));
    return [...byKey.entries()].sort((a, b) => b[1].getTime() - a[1].getTime());
  }, [months, value]);

  const selectedKey = format(value, KEY);

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label="Previous month"
        onClick={() => onChange(startOfMonth(subMonths(value, 1)))}
      >
        <ChevronLeft />
      </Button>
      <Select
        value={selectedKey}
        onValueChange={(key) => {
          const month = options.find(([k]) => k === key)?.[1];
          if (month) onChange(month);
        }}
      >
        <SelectTrigger id={id} aria-label="Month" className="h-10! min-w-40 flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([key, month]) => (
            <SelectItem key={key} value={key}>
              {format(month, 'MMMM yyyy')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label="Next month"
        onClick={() => onChange(startOfMonth(addMonths(value, 1)))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
