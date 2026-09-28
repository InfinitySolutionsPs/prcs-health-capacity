"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchableSelectOption = { value: string; label: string };

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "اختر من القائمة",
  searchPlaceholder = "ابحث في القائمة...",
  disabled = false,
  className = "",
  contentClassName = "",
  allowClear = false,
  clearLabel = "بدون تحديد",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = normalizedQuery
      ? options.filter((option) => `${option.label} ${option.value}`.toLocaleLowerCase().includes(normalizedQuery))
      : options;
    return matches.slice(0, 100);
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={`h-10 w-full justify-between bg-white px-3 text-right font-normal ${className}`}
        >
          <span className={`truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>
            {selected?.label || placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" dir="rtl" className={`w-[var(--radix-popover-trigger-width)] p-0 ${contentClassName}`}>
        <Command dir="rtl" shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} className="text-right" />
          <CommandList>
            <CommandEmpty>لا توجد نتيجة مطابقة.</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value={clearLabel}
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                    setQuery("");
                  }}
                  className="justify-between text-right text-muted-foreground"
                >
                  <span>{clearLabel}</span>
                  <Check className={`size-4 ${!value ? "opacity-100" : "opacity-0"}`} />
                </CommandItem>
              )}
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="justify-between text-right"
                >
                  <span>{option.label}</span>
                  <Check className={`size-4 ${value === option.value ? "opacity-100" : "opacity-0"}`} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {visibleOptions.length === 100 && <p className="border-t px-3 py-2 text-center text-xs text-muted-foreground">تظهر أول 100 نتيجة؛ اكتب للبحث عن نتيجة محددة.</p>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
