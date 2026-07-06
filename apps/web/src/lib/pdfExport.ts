import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { formatMetricValue } from './formatMetric';
import type { MetricDefinition } from '@scorecard/shared';

interface PdfMetric {
  definition: MetricDefinition;
  value: number | null;
}

const NAVY = [30, 46, 74] as const;
const GREEN = [29, 158, 117] as const;
const GRAY = [148, 163, 184] as const;

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
  let y = 20;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text('HungerRush Scorecard', 14, y);
  y += 12;

  doc.setFontSize(14);
  doc.text(employeeName, 14, y);
  y += 7;

  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(employeeEmail, 14, y);
  y += 5;

  // Divider
  y += 5;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  // Section header
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text('Current Week Metrics', 14, y);
  y += 10;

  // Metrics
  for (const m of metrics) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }

    // Metric name
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(m.definition.name, 14, y);

    // Value — 0 is a measured value (L8 fix, commit 11); only null means "No data".
    const hasValue = m.value !== null;
    const valueText = hasValue
      ? formatMetricValue(m.value, m.definition.unit)
      : 'No data';
    doc.setFontSize(11);
    if (hasValue) {
      doc.setTextColor(...GREEN);
    } else {
      doc.setTextColor(...GRAY);
    }
    doc.text(valueText, pageWidth - 14, y, { align: 'right' });
    y += 6;

    // Coaching prompt
    if (m.definition.coaching_prompt) {
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      const lines = doc.splitTextToSize(m.definition.coaching_prompt, pageWidth - 28);
      doc.text(lines as string[], 14, y);
      y += (lines as string[]).length * 4 + 4;
    }

    y += 4;
  }

  // Watermark at bottom
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `Exported by ${managerEmail} on ${dateStr}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' },
  );

  doc.save(`scorecard-${employeeName.toLowerCase().replace(/\s+/g, '-')}-${format(now, 'yyyy-MM-dd')}.pdf`);
}
