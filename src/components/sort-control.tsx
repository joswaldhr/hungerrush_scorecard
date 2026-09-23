"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortOption<T extends string> {
  value: T;
  label: string;
}

interface SortControlProps<T extends string> {
  label: string;
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
}

// A single compact "Label: current option" dropdown -- shared shape for any
// page that needs a lightweight sort/view toggle, styled to match the
// Export button's dropdown pattern rather than inventing a new one.
export function SortControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SortControlProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sort order: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-2xs hover:bg-muted transition-colors"
      >
        <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
        <span>
          {label}: {current.label}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1.5 w-40 rounded-lg border border-border/80 bg-card shadow-lg z-50 py-1"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center px-3 py-1.5 text-sm font-medium text-left transition-colors",
                opt.value === value
                  ? "text-[#009ca6] font-semibold"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
