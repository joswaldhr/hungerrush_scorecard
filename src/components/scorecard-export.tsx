"use client";

import { useState, useCallback, useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import {
  Download,
  Copy,
  Check,
  Printer,
  FileText,
  Image,
  Table2,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import {
  exportCsv,
  exportDataDetails,
  formatExportValue as formatVal,
  formatExportTarget as formatTarget,
  type ExportSnapshot,
  type ScorecardMetric,
} from "@/lib/domain/metrics/export-snapshot";
import { freezeScorecardCapture } from "@/lib/scorecard-capture";
import { getStatusLabel } from "./status-badge";
export type { ScorecardMetric } from "@/lib/domain/metrics/export-snapshot";
import { cn } from "@/lib/utils";

export const SCORECARD_CAPTURE_ID = "scorecard-capture";

function statusLabel(status: string): string {
  return getStatusLabel(status as Parameters<typeof getStatusLabel>[0]);
}

function fileDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

function safeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ScorecardExport({
  employeeName,
  periodLabel,
  previousPeriodLabel,
  metrics,
}: ExportSnapshot) {
  const [open, setOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openAtEnd = useRef(false);
  const menuId = useId();
  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    items?.[openAtEnd.current ? items.length - 1 : 0]?.focus();
    const outside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open, close]);

  async function handlePdf() {
    const el = document.getElementById(SCORECARD_CAPTURE_ID);
    if (!el) return;
    const frozen = freezeScorecardCapture(el, {
      employeeName,
      periodLabel,
      previousPeriodLabel,
      metrics,
    });
    setExporting(true);
    close();
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(frozen.element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdfWidth = 210;
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pdfWidth, Math.max(pdfHeight + 20, 297)],
      });
      pdf.addImage(imgData, "PNG", 0, 10, pdfWidth, pdfHeight);
      pdf.save(`${safeName(employeeName)}-scorecard-${fileDate()}.pdf`);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("Failed to generate PDF");
    } finally {
      frozen.dispose();
      setExporting(false);
    }
  }

  async function handlePng() {
    const el = document.getElementById(SCORECARD_CAPTURE_ID);
    if (!el) return;
    const frozen = freezeScorecardCapture(el, {
      employeeName,
      periodLabel,
      previousPeriodLabel,
      metrics,
    });
    setExporting(true);
    close();
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(frozen.element, { scale: 2, useCORS: true });
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Failed to generate image");
          return;
        }
        triggerDownload(blob, `${safeName(employeeName)}-scorecard-${fileDate()}.png`);
        toast.success("PNG downloaded");
      }, "image/png");
    } catch (err) {
      console.error("PNG export failed:", err);
      toast.error("Failed to generate PNG");
    } finally {
      frozen.dispose();
      setExporting(false);
    }
  }

  function handleCsv() {
    close();
    const csv = exportCsv({ employeeName, periodLabel, previousPeriodLabel, metrics }, statusLabel);
    // Excel assumes the system codepage (not UTF-8) for a CSV with no BOM, so
    // the en/em dashes in target ranges and blank values ("75-128", "-")
    // render as mojibake ("â€"") without this -- confirmed live.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `${safeName(employeeName)}-metrics-${fileDate()}.csv`);
    toast.success("CSV downloaded");
  }

  async function handleTextCopy() {
    close();
    const categories = new Map<string, ScorecardMetric[]>();
    for (const m of metrics) {
      const cat = m.category ?? "Other";
      const arr = categories.get(cat) ?? [];
      arr.push(m);
      categories.set(cat, arr);
    }

    let text = `Scorecard: ${employeeName}\nPeriod: ${periodLabel} (UTC)\nComparison: ${previousPeriodLabel} (UTC)\n`;
    for (const [cat, catMetrics] of categories) {
      text += `\n${cat.toUpperCase()}\n`;
      for (const m of catMetrics) {
        const curr = formatVal(m.currentValue, m.unit, m.valueType);
        const prev = formatVal(m.previousValue, m.unit, m.valueType);
        const hasTarget = m.targetType === "range" ? m.targetMin !== null : m.targetValue !== null;
        const target = hasTarget ? ` (target: ${formatTarget(m)})` : "";
        const status = statusLabel(m.status);
        text += `  ${m.name}: ${curr} (prev: ${prev})${target} — ${status}\n`;
      }
    }

    try {
      text += `\nData details\n${exportDataDetails(metrics)}`;
      await navigator.clipboard.writeText(text.trimEnd());
      toast.success("Scorecard copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  async function handleCopyLink() {
    close();
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      toast.success("Link copied");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  function handlePrint() {
    close();
    window.print();
  }

  const menuItems = [
    { label: "Download as PDF", icon: FileText, action: "pdf" },
    { label: "Download as PNG", icon: Image, action: "png" },
    { label: "Export to CSV", icon: Table2, action: "csv" },
    { label: "Copy as text", icon: ClipboardList, action: "text" },
    { label: "divider", icon: null, action: null },
    {
      label: linkCopied ? "Link copied!" : "Copy link",
      icon: linkCopied ? Check : Copy,
      action: "link",
    },
    { label: "Print", icon: Printer, action: "print" },
  ];

  return (
    <div
      ref={rootRef}
      className="relative print:hidden"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          openAtEnd.current = false;
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openAtEnd.current = event.key === "ArrowUp";
            setOpen(true);
          }
        }}
        disabled={exporting}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted transition-colors",
          exporting && "opacity-50 cursor-wait"
        )}
      >
        <Download className="h-3.5 w-3.5" />
        <span>{exporting ? "Exporting..." : "Export"}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Export scorecard"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
              return;
            }
            const items = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
            );
            const current = items.indexOf(document.activeElement as HTMLButtonElement);
            let next: number;
            if (event.key === "ArrowDown") next = (current + 1) % items.length;
            else if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = items.length - 1;
            else return;
            event.preventDefault();
            items[next]?.focus();
          }}
          className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border/80 bg-card shadow-lg z-50 py-1"
        >
          {menuItems.map((item, i) => {
            if (item.label === "divider") {
              return <div key={i} role="separator" className="my-1 border-t border-border/60" />;
            }
            const Icon = item.icon!;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  switch (item.action) {
                    case "pdf":
                      void handlePdf();
                      break;
                    case "png":
                      void handlePng();
                      break;
                    case "csv":
                      handleCsv();
                      break;
                    case "text":
                      void handleTextCopy();
                      break;
                    case "link":
                      void handleCopyLink();
                      break;
                    case "print":
                      handlePrint();
                      break;
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors text-left"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
