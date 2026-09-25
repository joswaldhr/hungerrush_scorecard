"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn, shiftWeekStart, weekBoundsForDate } from "@/lib/utils";

interface WeekNavigatorProps {
  periodStart: string;
  rangeLabel: string;
  weeksAgo: number;
  onNavigate: (periodStart: string) => void;
  isLoading?: boolean;
}

export function WeekNavigator({
  periodStart,
  rangeLabel,
  weeksAgo,
  onNavigate,
  isLoading,
}: WeekNavigatorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const pickerId = useId();

  useEffect(() => {
    if (!pickerOpen) return;
    dateRef.current?.focus();
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  const isCurrent = weeksAgo <= 0;
  const contextLabel = isCurrent
    ? "CURRENT WEEK"
    : weeksAgo === 1
      ? "1 WEEK AGO"
      : `${weeksAgo} WEEKS AGO`;

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col items-end gap-1.5 sm:w-auto print:hidden">
      <div className="grid grid-cols-3 sm:flex w-full items-center gap-1 rounded-lg border border-border/80 bg-card p-1 shadow-2xs">
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => {
            onNavigate(shiftWeekStart(periodStart, -1));
          }}
          className="flex h-11 w-full shrink-0 items-center justify-center rounded-md sm:h-7 sm:w-7 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span
          aria-live="polite"
          aria-atomic="true"
          aria-busy={isLoading}
          className={cn(
            "col-span-3 order-first sm:order-none min-w-0 flex-1 sm:min-w-[170px] text-center text-sm font-semibold text-foreground tabular-nums transition-opacity",
            isLoading && "opacity-50"
          )}
        >
          {rangeLabel}
        </span>

        <button
          type="button"
          aria-label="Next week"
          disabled={isCurrent}
          onClick={() => {
            onNavigate(shiftWeekStart(periodStart, 1));
          }}
          className="flex h-11 w-full shrink-0 items-center justify-center rounded-md sm:h-7 sm:w-7 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div
          ref={popoverRef}
          className="relative shrink-0 border-l border-border/70 pl-1"
          onKeyDown={(event) => {
            if (pickerOpen && event.key === "Escape") {
              event.preventDefault();
              setPickerOpen(false);
              triggerRef.current?.focus();
            }
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setPickerOpen(false);
          }}
        >
          <button
            ref={triggerRef}
            type="button"
            aria-label="Jump to a week"
            aria-expanded={pickerOpen}
            aria-controls={pickerOpen ? pickerId : undefined}
            onClick={() => setPickerOpen((o) => !o)}
            className="flex h-11 w-full items-center justify-center rounded-md sm:h-7 sm:w-7 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </button>
          {pickerOpen && (
            <div
              id={pickerId}
              role="group"
              aria-label="Jump to a reporting week"
              className="absolute right-0 top-full mt-1.5 z-50 rounded-lg border border-border/80 bg-card p-2 shadow-lg"
            >
              <label className="sr-only" htmlFor={`${pickerId}-date`}>
                Pick a date to jump to that reporting week
              </label>
              <input
                ref={dateRef}
                id={`${pickerId}-date`}
                type="date"
                defaultValue={periodStart}
                onChange={(e) => {
                  if (!e.target.value) return;
                  onNavigate(weekBoundsForDate(e.target.value).periodStart);
                  setPickerOpen(false);
                  triggerRef.current?.focus();
                }}
                className="w-40 min-h-11 sm:min-h-0 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex max-w-full flex-wrap justify-end items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tracking-wide text-foreground/80">
          {contextLabel}
        </span>
        <span>Comparing against previous week</span>
      </div>
    </div>
  );
}
