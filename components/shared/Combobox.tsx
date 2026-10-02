'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Offer a 'Clear' item when a value is set. */
  allowClear?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/** Free-text input with filtered suggestions (Popover + Command). */
export function Combobox({
  id,
  value,
  onChange,
  suggestions,
  placeholder = 'Select...',
  searchPlaceholder = 'Type to search or add...',
  disabled,
  invalid,
  allowClear,
  className,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const query = search.trim();
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? suggestions.filter((s) => s.toLowerCase().includes(q)) : suggestions;
  }, [suggestions, query]);
  const exact = suggestions.some((s) => s.toLowerCase() === query.toLowerCase());

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn('h-10 w-full justify-between px-3 font-normal', className)}
          {...aria}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || placeholder}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList>
            {!query && filtered.length === 0 && <CommandEmpty>Start typing a name.</CommandEmpty>}
            {filtered.length > 0 && (
              <CommandGroup heading="Suggestions">
                {filtered.map((s) => (
                  <CommandItem key={s} value={s} onSelect={() => select(s)}>
                    <Check className={cn(value === s ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                    {s}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {query && !exact && (
              <CommandGroup>
                <CommandItem value={`__create__${query}`} onSelect={() => select(query)}>
                  <Plus aria-hidden="true" />
                  Use &quot;{query}&quot;
                </CommandItem>
              </CommandGroup>
            )}
            {allowClear && value && !query && (
              <CommandGroup>
                <CommandItem value="__clear__" onSelect={() => select('')}>
                  <X aria-hidden="true" />
                  Clear
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
