'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface MultiSelectOption<T extends string> {
  value: T;
  label: string;
}

interface MultiSelectProps<T extends string> {
  id?: string;
  options: MultiSelectOption<T>[];
  value: T[] | 'All';
  onChange: (value: T[] | 'All') => void;
  placeholder: string;
  emptyText?: string;
  disabled?: boolean;
}

/** Multi-select with an "All" option. An empty selection collapses back to 'All'. */
export function MultiSelect<T extends string>({
  id,
  options,
  value,
  onChange,
  placeholder,
  emptyText = 'No options.',
  disabled,
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = value === 'All' ? [] : value;

  const toggle = (v: T) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(next.length > 0 ? next : 'All');
  };

  const summary =
    value === 'All'
      ? 'All'
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between px-3 font-normal"
        >
          <span className="truncate">{summary}</span>
          <span className="flex items-center gap-1.5">
            {selected.length > 0 && <Badge variant="secondary">{selected.length}</Badge>}
            <ChevronsUpDown className="opacity-50" aria-hidden="true" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
        <Command>
          {options.length > 7 && <CommandInput placeholder={placeholder} />}
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => onChange('All')}>
                <Check className={cn(value === 'All' ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                All
              </CommandItem>
            </CommandGroup>
            {options.length > 0 && <CommandSeparator />}
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                  <Check
                    className={cn(selected.includes(o.value) ? 'opacity-100' : 'opacity-0')}
                    aria-hidden="true"
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
