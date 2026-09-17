"use client";

import { useState, useCallback } from "react";
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
import { formatMetricValue } from "@/lib/domain/metrics/types";
import type { ValueType } from "@/lib/domain/metrics/types";
import { cn } from "@/lib/utils";

export const SCORECARD_CAPTURE_ID = "scorecard-capture";

export interface ScorecardMetric {
  category: string | null;
  name: string;
  currentValue: number | null;
  previousValue: number | null;
  targetValue: number | null;
  status: string;
  unit: string | null;
  valueType: ValueType;
}

interface ScorecardExportProps {
  employeeName: string;
  periodLabel: string;
  metrics: ScorecardMetric[];
}

function formatVal(value: number | null, unit: string | null, valueType: ValueType): string {
  if (value === null) return "—";
  return formatMetricValue(value, unit, valueType);
}

function statusLabel(status: string): string {
  switch (status) {
    case "on_target":
      return "On Target";
    case "warning":
      return "Warning";
    case "off_target":
      return "Off Target";
    case "no_target":
      return "No Target";
    case "no_data":
      return "No Data";
    default:
      return status;
  }
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

export function ScorecardExport({ employeeName, periodLabel, metrics }: ScorecardExportProps) {
  const [open, setOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  async function handlePdf() {
    const el = document.getElementById(SCORECARD_CAPTURE_ID);
    if (!el) return;
    setExporting(true);
    close();
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
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
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setExporting(false);
    }
  }

  async function handlePng() {
    const el = document.getElementById(SCORECARD_CAPTURE_ID);
    if (!el) return;
    setExporting(true);
    close();
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Failed to generate image");
          return;
        }
        triggerDownload(blob, `${safeName(employeeName)}-scorecard-${fileDate()}.png`);
        toast.success("PNG downloaded");
      }, "image/png");
    } catch {
      toast.error("Failed to generate PNG");
    } finally {
      setExporting(false);
    }
  }

  function handleCsv() {
    close();
    const header = "Category,Metric,This Week,Last Week,Target,Status";
    const rows = metrics.map((m) => {
      const cat = m.category ?? "Other";
      const curr = formatVal(m.currentValue, m.unit, m.valueType);
      const prev = formatVal(m.previousValue, m.unit, m.valueType);
      const target = formatVal(m.targetValue, m.unit, m.valueType);
      const status = statusLabel(m.status);
      return [cat, m.name, curr, prev, target, status]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
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

    let text = `Scorecard: ${employeeName}\nPeriod: ${periodLabel}\n`;
    for (const [cat, catMetrics] of categories) {
      text += `\n${cat.toUpperCase()}\n`;
      for (const m of catMetrics) {
        const curr = formatVal(m.currentValue, m.unit, m.valueType);
        const prev = formatVal(m.previousValue, m.unit, m.valueType);
        const target =
          m.targetValue !== null
            ? ` (target: ${formatVal(m.targetValue, m.unit, m.valueType)})`
            : "";
        const status = statusLabel(m.status);
        text += `  ${m.name}: ${curr} (prev: ${prev})${target} — ${status}\n`;
      }
    }

    try {
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
    { label: "Download as PDF", icon: FileText, action: handlePdf },
    { label: "Download as PNG", icon: Image, action: handlePng },
    { label: "Export to CSV", icon: Table2, action: handleCsv },
    { label: "Copy as text", icon: ClipboardList, action: handleTextCopy },
    { label: "divider", icon: null, action: null },
    {
      label: linkCopied ? "Link copied!" : "Copy link",
      icon: linkCopied ? Check : Copy,
      action: handleCopyLink,
    },
    { label: "Print", icon: Printer, action: handlePrint },
  ];

  return (
    <div className="relative print:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
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
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border/80 bg-card shadow-lg z-50 py-1">
            {menuItems.map((item, i) => {
              if (item.label === "divider") {
                return <div key={i} className="my-1 border-t border-border/60" />;
              }
              const Icon = item.icon!;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action!}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors text-left"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
