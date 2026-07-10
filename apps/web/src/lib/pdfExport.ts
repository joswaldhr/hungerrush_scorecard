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
  /** Full 8-week history array for sparkline rendering (oldest to newest). */
  history: (number | null)[];
  /** Fixed domain [min, max] for sparkline scaling. */
  domain: readonly [number, number];
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

export async function generateScorecardPdf(
  employeeName: string,
  employeeEmail: string,
  metrics: PdfMetric[],
  managerEmail: string,
): Promise<void> {
  const doc = new jsPDF();

  // Load custom font dynamically
  try {
    const fetchFont = async (filename: string, fontName: string, weight: string) => {
      const res = await fetch(`${window.location.origin}/fonts/${filename}`);
      if (!res.ok) throw new Error(`Font ${filename} load failed`);
      const buffer = await res.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const base64Font = btoa(binary);
      doc.addFileToVFS(filename, base64Font);
      doc.addFont(filename, fontName, weight);
    };

    await Promise.all([
      fetchFont('Inter-Regular.ttf', 'Inter', 'normal'),
      fetchFont('Inter-Bold.ttf', 'Inter', 'bold'),
      fetchFont('Montserrat-Bold.ttf', 'Montserrat', 'bold'),
    ]);
  } catch (e) {
    console.warn('Failed to load brand fonts for PDF:', e);
  }

  const fontName = doc.getFontList()['Inter'] ? 'Inter' : 'helvetica';
  const headingFontName = doc.getFontList()['Montserrat'] ? 'Montserrat' : fontName;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const dateStr = format(now, 'MMM d, yyyy h:mm a');

  // Brand band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setFont(headingFontName, 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('HungerRush Cadence', 14, 15);
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...LAVENDER);
  doc.text('1:1 briefing snapshot', pageWidth - 14, 15, { align: 'right' });

  let y = 36;
  doc.setFont(headingFontName, 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(employeeName, 14, y);
  y += 6.5;
  doc.setFont(fontName, 'normal');
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
    if (y > pageHeight - 56) {
      doc.addPage();
      y = 20;
    }

    doc.setFont(headingFontName, 'bold');
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

    doc.setFont(fontName, 'normal');
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

    // Draw sparkline
    const validHistory = m.history.filter(v => v !== null) as number[];
    if (validHistory.length > 1) {
      const sparklineHeight = 10;
      const sparklineWidth = 30;
      const sparklineX = 14;
      const sparklineY = y + 2;

      const [min, max] = m.domain;
      const range = max - min === 0 ? 1 : max - min; // avoid division by zero

      doc.setDrawColor(...(m.tone ? TONE_PDF[m.tone].color : NAVY));
      doc.setLineWidth(0.5);

      const stepX = sparklineWidth / (m.history.length - 1);
      
      let inGap = true;
      let prevX = 0;
      let prevY = 0;

      for (let i = 0; i < m.history.length; i++) {
        const val = m.history[i];
        if (val === null || val === undefined) {
          inGap = true;
          continue;
        }

        const cx = sparklineX + i * stepX;
        const cy = sparklineY + sparklineHeight - ((val - min) / range) * sparklineHeight;

        if (!inGap) {
          doc.line(prevX, prevY, cx, cy);
        }

        prevX = cx;
        prevY = cy;
        inGap = false;
      }
      y += sparklineHeight + 6;
    } else if (validHistory.length <= 1) {
      y += 2; // small padding if no sparkline
    }

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
  doc.setFont(fontName, 'normal');
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
