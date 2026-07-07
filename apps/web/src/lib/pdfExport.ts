import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { formatMetricValue } from './formatMetric';
import type { MetricDefinition, TrendTone } from '@scorecard/shared';

export interface PdfMetric {
  definition: MetricDefinition;
  /** This-week-so-far value — 0 is a measured value (L8); only null reads "No data". */
  currentValue: number | null;
  /** Frozen last completed week. */
  lastWeekValue: number | null;
  /** Tone from the one trend engine; null when the metric has no history. */
  tone: TrendTone | null;
}

// Cadence tokens as RGB (tailwind.config.ts is the source of the hex values).
const NAVY = [12, 20, 67] as const;
const TEAL = [59, 130, 114] as const;
const CORAL = [196, 85, 58] as const;
const GRAY = [92, 96, 126] as const;
const GRAY_LIGHT = [158, 162, 188] as const;
const LINE = [227, 230, 238] as const;
const LAVENDER = [174, 179, 206] as const; // sub-brand text on navy, matches app chrome

const TONE_PDF: Record<TrendTone, { label: string; color: readonly [number, number, number] }> = {
  win: { label: 'Improving', color: TEAL },
  discuss: { label: 'To discuss', color: CORAL },
  steady: { label: 'Steady', color: GRAY },
  new: { label: 'New', color: GRAY_LIGHT },
};

export function generateScorecardPdf(
  employeeName: string,
  employeeEmail: string,
  metrics: PdfMetric[],
  managerEmail: string,
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const dateStr = format(now, 'MMM d, yyyy h:mm a');

  // Brand band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('HungerRush Cadence', 14, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...LAVENDER);
  doc.text('1:1 briefing snapshot', pageWidth - 14, 15, { align: 'right' });

  let y = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(employeeName, 14, y);
  y += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  doc.text(employeeEmail, 14, y);
  y += 8;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.7);
  doc.line(14, y, pageWidth - 14, y);
  y += 9;

  doc.setFontSize(8);
  doc.setTextColor(...GRAY_LIGHT);
  doc.text('THIS WEEK SO FAR  ·  LAST WEEK (COMPLETED)', 14, y);
  y += 8;

  for (const m of metrics) {
    if (y > pageHeight - 42) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(m.definition.name, 14, y);

    // Value — 0 is a measured value (L8, 1C commit 11); only null means "No data".
    const current = m.currentValue;
    doc.setFontSize(12);
    if (current !== null) {
      doc.setTextColor(...NAVY);
      doc.text(formatMetricValue(current, m.definition.unit), pageWidth - 14, y, { align: 'right' });
    } else {
      doc.setTextColor(...GRAY_LIGHT);
      doc.text('No data', pageWidth - 14, y, { align: 'right' });
    }
    y += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    if (m.tone) {
      const t = TONE_PDF[m.tone];
      doc.setTextColor(...t.color);
      doc.text(t.label, 14, y);
    }
    doc.setTextColor(...GRAY);
    doc.text(
      m.lastWeekValue !== null
        ? `last wk ${formatMetricValue(m.lastWeekValue, m.definition.unit)}`
        : 'last wk —',
      pageWidth - 14,
      y,
      { align: 'right' },
    );
    y += 5.5;

    if (m.definition.coaching_prompt) {
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      const lines = doc.splitTextToSize(m.definition.coaching_prompt, pageWidth - 28) as string[];
      doc.text(lines, 14, y);
      y += lines.length * 4 + 2;
    }

    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(14, y, pageWidth - 14, y);
    y += 7;
  }

  // Watermark on EVERY page — a forwardable performance doc must carry its
  // provenance on each page, not just the last one.
  const pageCount = doc.getNumberOfPages();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_LIGHT);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Exported by ${managerEmail} on ${dateStr}`, pageWidth / 2, pageHeight - 10, {
      align: 'center',
    });
  }

  doc.save(
    `scorecard-${employeeName.toLowerCase().replace(/\s+/g, '-')}-${format(now, 'yyyy-MM-dd')}.pdf`,
  );
}
