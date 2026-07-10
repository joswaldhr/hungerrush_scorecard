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
  /**
   * The 8-week calendar window, oldest → newest — one slot per week; null =
   * week without a snapshot, kept as a visible gap (never packed).
   */
  history: (number | null)[];
  /** Resolved sparkline y-scale (spec domain as minimum extent) — same honest scale the screen uses. */
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

// The brand TTFs live beside the CSS woff2s in public/fonts/ (self-hosted —
// never a CDN fetch). Fetched and base64'd once per session, then reused.
const BRAND_FONTS = [
  { file: 'Inter-Regular.ttf', family: 'Inter', style: 'normal' },
  { file: 'Inter-Bold.ttf', family: 'Inter', style: 'bold' },
  { file: 'Montserrat-Bold.ttf', family: 'Montserrat', style: 'bold' },
] as const;

let brandFontCache: Promise<Map<string, string> | null> | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunked — a single fromCharCode spread overflows the arg limit on ~400KB files.
  for (let i = 0; i < bytes.byteLength; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function loadBrandFonts(): Promise<Map<string, string> | null> {
  brandFontCache ??= (async () => {
    try {
      const entries = await Promise.all(
        BRAND_FONTS.map(async f => {
          const res = await fetch(`/fonts/${f.file}`);
          if (!res.ok) throw new Error(`${f.file}: ${res.status}`);
          return [f.file, toBase64(await res.arrayBuffer())] as const;
        }),
      );
      return new Map(entries);
    } catch (e) {
      console.warn('Brand fonts unavailable for PDF (offline?) — falling back to helvetica:', e);
      brandFontCache = null; // let a later export retry once back online
      return null;
    }
  })();
  return brandFontCache;
}

export async function generateScorecardPdf(
  employeeName: string,
  employeeEmail: string,
  metrics: PdfMetric[],
  managerEmail: string,
): Promise<void> {
  const doc = new jsPDF();

  const fontData = await loadBrandFonts();
  if (fontData) {
    for (const f of BRAND_FONTS) {
      doc.addFileToVFS(f.file, fontData.get(f.file)!);
      doc.addFont(f.file, f.family, f.style);
    }
  }
  // Montserrat = headings, Inter = body (the app's own pairing); helvetica offline.
  const headingFont = fontData ? 'Montserrat' : 'helvetica';
  const bodyFont = fontData ? 'Inter' : 'helvetica';

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const dateStr = format(now, 'MMM d, yyyy h:mm a');

  // Brand band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setFont(headingFont, 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('HungerRush Cadence', 14, 15);
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...LAVENDER);
  doc.text('1:1 briefing snapshot', pageWidth - 14, 15, { align: 'right' });

  let y = 36;
  doc.setFont(headingFont, 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(employeeName, 14, y);
  y += 6.5;
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  doc.text(employeeEmail, 14, y);
  y += 8;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.7);
  doc.line(14, y, pageWidth - 14, y);
  y += 9;

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_LIGHT);
  doc.text('THIS WEEK SO FAR  ·  LAST WEEK (COMPLETED)', 14, y);
  y += 8;

  for (const m of metrics) {
    // Tallest card: name + windows + sparkline + a 3-line coaching prompt.
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFont(headingFont, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(m.definition.name, 14, y);

    // Value — 0 is a measured value (L8, 1C commit 11); only null means "No data".
    const current = m.currentValue;
    doc.setFont(bodyFont, 'bold');
    doc.setFontSize(12);
    if (current !== null) {
      doc.setTextColor(...NAVY);
      doc.text(formatMetricValue(current, m.definition.unit), pageWidth - 14, y, { align: 'right' });
    } else {
      doc.setTextColor(...GRAY_LIGHT);
      doc.text('No data', pageWidth - 14, y, { align: 'right' });
    }
    y += 5.5;

    doc.setFont(bodyFont, 'normal');
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

    // Sparkline — the same honest chart rules as the screen (Cadence): fixed
    // domain scale so small wiggles look small, one x-slot per calendar week,
    // and a missing week stays a visible gap instead of packing the line.
    const pointCount = m.history.filter(v => v !== null).length;
    if (pointCount > 0) {
      const sparkH = 10;
      const sparkW = 40;
      const sparkX = 14;
      const sparkY = y + 2;
      const [lo, hi] = m.domain;
      const range = hi - lo || 1;
      const slots = m.history.length;
      const stepX = slots > 1 ? sparkW / (slots - 1) : 0;
      const yFor = (v: number) => sparkY + sparkH - ((v - lo) / range) * sparkH;

      const color = m.tone ? TONE_PDF[m.tone].color : NAVY;
      doc.setDrawColor(...color);
      doc.setFillColor(...color);
      doc.setLineWidth(0.5);

      for (let i = 0; i < slots; i++) {
        const v = m.history[i];
        if (v === null || v === undefined) continue;
        const prev = i > 0 ? m.history[i - 1] : null;
        if (prev !== null && prev !== undefined) {
          doc.line(sparkX + (i - 1) * stepX, yFor(prev), sparkX + i * stepX, yFor(v));
        } else {
          // Segment start (or isolated week) — mark the point so gaps read as
          // gaps rather than the line simply starting late.
          doc.circle(sparkX + i * stepX, yFor(v), 0.45, 'F');
        }
      }
      y += sparkH + 6;
    } else {
      y += 2; // no history — small padding only
    }

    if (m.definition.coaching_prompt) {
      doc.setFont(bodyFont, 'normal');
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
  doc.setFont(bodyFont, 'normal');
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
