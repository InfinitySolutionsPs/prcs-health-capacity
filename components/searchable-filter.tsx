"use client";

import { X } from "lucide-react";

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
      <input
        list={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={value ? undefined : allLabel || placeholder}
        className="h-10 w-full rounded-md border bg-white px-3 text-right text-sm outline-none focus:border-[#b5122b] focus:ring-2 focus:ring-[#b5122b]/15"
        aria-label={placeholder}
      />
      <datalist id={id}>{values.map((option) => <option key={option} value={option} />)}</datalist>
      {value && <button type="button" onClick={() => onChange("")} className="absolute left-2 top-2 grid size-6 place-items-center rounded-full text-[#7a858f] hover:bg-[#fbecef] hover:text-[#a50f27]" aria-label="مسح الفلتر"><X className="size-4" /></button>}
    </div>
  );
}

