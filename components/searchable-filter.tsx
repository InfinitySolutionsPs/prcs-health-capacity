"use client";

import { Search, X } from "lucide-react";

let filterId = 0;

export function SearchableFilterInput({
  value,
  onChange,
  placeholder,
  options,
  allLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
  allLabel?: string;
}) {
  const id = `search-filter-${++filterId}`;
  const values = [...new Set(options.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute right-3 top-3 size-4 text-[#89939c]" />
      <input
        list={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={value ? undefined : allLabel || placeholder}
        className="h-11 w-full rounded-xl border border-[#dfe5e9] bg-white px-3 pr-9 text-right text-sm outline-none transition focus:border-[#b5122b] focus:ring-2 focus:ring-[#b5122b]/15"
        aria-label={placeholder}
      />
      <datalist id={id}>{values.map((option) => <option key={option} value={option} />)}</datalist>
      {value && <button type="button" onClick={() => onChange("")} className="absolute left-2 top-2 grid size-6 place-items-center rounded-full text-[#7a858f] hover:bg-[#fbecef] hover:text-[#a50f27]" aria-label="مسح الفلتر"><X className="size-4" /></button>}
    </div>
  );
}

