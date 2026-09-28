"use client";

import { useState } from "react";
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
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent align="start" dir="rtl" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command dir="rtl">
          <CommandInput placeholder={searchPlaceholder} className="text-right" />
          <CommandList>
            <CommandEmpty>لا توجد نتيجة مطابقة.</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value={clearLabel}
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="justify-between text-right text-muted-foreground"
                >
                  <span>{clearLabel}</span>
                  <Check className={`size-4 ${!value ? "opacity-100" : "opacity-0"}`} />
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="justify-between text-right"
                >
                  <span>{option.label}</span>
                  <Check className={`size-4 ${value === option.value ? "opacity-100" : "opacity-0"}`} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
