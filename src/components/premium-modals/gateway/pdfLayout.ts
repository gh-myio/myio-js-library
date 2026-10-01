/**
 * Shared "premium PDF" layout helpers for the GatewayModal /
 * GatewayComparisonModal PDF exports.
 *
 * Built on jsPDF, portrait A4, manual cursor-based Y positioning (no
 * jspdf-autotable) — same base technique as
 * `src/components/header-annotations-panel/ExportPDF.ts` — but the visual
 * language (purple hero band + decorative accent circle, rounded
 * left-accented "cards", bordered KPI stat rows, solid footer band) is
 * modeled on `docs/shared/myio_release_notes_alarmes_v0.1.446.html`, MYIO's
 * actual release-notes document design, per explicit request to draw on that
 * layout for a "premium" export look. Palette lifted directly from that
 * file's `:root` custom properties (`--myio-purple`, `--myio-purple-dark`,
 * `--myio-green`, `--myio-red`, `--text`, `--muted`, `--border`).
 *
 * Every text block that could plausibly run long (a card's body lines, a
 * list item's heading/body) goes through `doc.splitTextToSize` before being
 * drawn — jsPDF's `doc.text()` never wraps on its own, so skipping this was
 * the cause of a real bug: a long "Centrais: A, B, C, D" line ran off the
 * page edge instead of wrapping.
 */

import type { jsPDF } from 'jspdf';

export const PDF_PAGE_W = 210;
export const PDF_PAGE_H = 297;
export const PDF_MARGIN_X = 14;
export const PDF_MARGIN_TOP = 14;
/** Leaves room for the solid footer band (14mm tall) on every page. */
export const PDF_MARGIN_BOTTOM = 20;
export const PDF_LINE_H = 5;

// ─── Palette (docs/shared/myio_release_notes_alarmes_v0.1.446.html :root) ──
export const PDF_PURPLE_DARK: [number, number, number] = [77, 42, 145]; // #4d2a91
export const PDF_PURPLE: [number, number, number] = [102, 58, 181]; // #663ab5
export const PDF_GREEN: [number, number, number] = [4, 192, 129]; // #04c081
export const PDF_RED: [number, number, number] = [224, 49, 49]; // #e03131
export const PDF_TEXT: [number, number, number] = [42, 35, 64]; // #2a2340
export const PDF_MUTED: [number, number, number] = [111, 103, 135]; // #6f6787
export const PDF_BORDER: [number, number, number] = [229, 221, 245]; // #e5ddf5
export const PDF_CARD_BG: [number, number, number] = [250, 248, 255]; // near-white purple tint

const HERO_HEIGHT = 34;
const FOOTER_HEIGHT = 14;

export interface PdfCursor {
  y: number;
}

export function pdfNewPage(doc: jsPDF, cursor: PdfCursor): void {
  doc.addPage();
  cursor.y = PDF_MARGIN_TOP;
}

export function pdfNewPageIfNeeded(doc: jsPDF, cursor: PdfCursor, required: number): void {
  if (cursor.y + required > PDF_PAGE_H - PDF_MARGIN_BOTTOM) {
    pdfNewPage(doc, cursor);
  }
}

/**
 * Purple hero band across the top of the current page — MYIO wordmark +
 * subtitle, a decorative green accent circle, a rounded "pill" badge (report
 * type), and a right-aligned meta line. Mirrors the reference doc's `.hero`.
 */
export function pdfHeroHeader(doc: jsPDF, cursor: PdfCursor, opts: { badgeText: string; metaLine: string }): void {
  doc.setFillColor(...PDF_PURPLE_DARK);
  doc.rect(0, 0, PDF_PAGE_W, HERO_HEIGHT, 'F');

  // Decorative accent circle (mostly off-page, top-right) — like `.hero::after`.
  doc.setFillColor(...PDF_GREEN);
  doc.circle(PDF_PAGE_W - 6, -6, 16, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('MYIO', PDF_MARGIN_X, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Plataforma de Telemetria e Monitoramento', PDF_MARGIN_X, 21);

  // Pill badge, top-right.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const badgeW = doc.getTextWidth(opts.badgeText) + 10;
  const badgeX = PDF_PAGE_W - PDF_MARGIN_X - badgeW;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(badgeX, 7, badgeW, 8, 4, 4, 'S');
  doc.text(opts.badgeText, badgeX + badgeW / 2, 12.3, { align: 'center' });

  // Meta line, bottom-right of the band.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(opts.metaLine, PDF_PAGE_W - PDF_MARGIN_X, HERO_HEIGHT - 4, { align: 'right' });

  cursor.y = HERO_HEIGHT + 10;
}

/** A bold headline + optional muted subtitle — mirrors the reference doc's `.headline`. */
export function pdfHeadline(doc: jsPDF, cursor: PdfCursor, title: string, subtitle?: string): void {
  pdfNewPageIfNeeded(doc, cursor, subtitle ? 16 : 10);
  doc.setTextColor(...PDF_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, PDF_MARGIN_X, cursor.y);
  cursor.y += 6;
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_MUTED);
    const wrapped = doc.splitTextToSize(subtitle, PDF_PAGE_W - PDF_MARGIN_X * 2) as string[];
    for (const line of wrapped) {
      doc.text(line, PDF_MARGIN_X, cursor.y);
      cursor.y += 4.6;
    }
  }
  cursor.y += 4;
}

/**
 * A bordered, left-accented "card" with a title + wrapped body lines —
 * mirrors the reference doc's `.card`. Every line is wrapped to the card's
 * inner width via `splitTextToSize`.
 */
export function pdfCard(
  doc: jsPDF,
  cursor: PdfCursor,
  opts: { title: string; lines: string[]; accentColor?: [number, number, number] }
): void {
  const accent = opts.accentColor ?? PDF_PURPLE;
  const innerPad = 4;
  const contentWidth = PDF_PAGE_W - PDF_MARGIN_X * 2 - innerPad * 2 - 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const wrappedBody: string[] = [];
  for (const line of opts.lines) {
    wrappedBody.push(...(doc.splitTextToSize(line, contentWidth) as string[]));
  }

  const titleH = 7;
  const bodyLineH = 4.6;
  const cardH = innerPad * 2 + titleH + wrappedBody.length * bodyLineH;

  pdfNewPageIfNeeded(doc, cursor, Math.min(cardH + 4, PDF_PAGE_H - PDF_MARGIN_TOP - PDF_MARGIN_BOTTOM));

  const cardY = cursor.y;
  doc.setFillColor(...PDF_CARD_BG);
  doc.setDrawColor(...PDF_BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(PDF_MARGIN_X, cardY, PDF_PAGE_W - PDF_MARGIN_X * 2, cardH, 2.5, 2.5, 'FD');
  doc.setFillColor(...accent);
  doc.roundedRect(PDF_MARGIN_X, cardY, 1.6, cardH, 0.8, 0.8, 'F');

  let ty = cardY + innerPad + 3;
  doc.setTextColor(...PDF_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(opts.title, PDF_MARGIN_X + innerPad + 2, ty);
  ty += titleH - 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_MUTED);
  for (const line of wrappedBody) {
    doc.text(line, PDF_MARGIN_X + innerPad + 2, ty);
    ty += bodyLineH;
  }

  cursor.y = cardY + cardH + 5;
}

export interface PdfListItem {
  heading: string;
  body: string;
}

/**
 * A bordered, left-accented "card" containing multiple heading/body rows —
 * mirrors the reference doc's card list pattern. Used for "one row per
 * central" breakdowns; both heading and body are wrapped, so a long central
 * name or stats line never runs off the page.
 */
export function pdfListCard(
  doc: jsPDF,
  cursor: PdfCursor,
  title: string,
  items: PdfListItem[],
  accentColor: [number, number, number] = PDF_PURPLE
): void {
  const innerPad = 4;
  const contentWidth = PDF_PAGE_W - PDF_MARGIN_X * 2 - innerPad * 2 - 2;
  const headingLineH = 4.6;
  const bodyLineH = 4.2;
  const itemGap = 2.5;
  const titleH = 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const wrapped = items.map((item) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const headingLines = doc.splitTextToSize(item.heading, contentWidth) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const bodyLines = doc.splitTextToSize(item.body, contentWidth) as string[];
    return { headingLines, bodyLines };
  });

  let contentH = 0;
  wrapped.forEach((it) => {
    contentH += it.headingLines.length * headingLineH + it.bodyLines.length * bodyLineH + itemGap;
  });
  const cardH = innerPad * 2 + titleH + contentH;

  pdfNewPageIfNeeded(doc, cursor, Math.min(cardH + 4, PDF_PAGE_H - PDF_MARGIN_TOP - PDF_MARGIN_BOTTOM));

  const cardY = cursor.y;
  doc.setFillColor(...PDF_CARD_BG);
  doc.setDrawColor(...PDF_BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(PDF_MARGIN_X, cardY, PDF_PAGE_W - PDF_MARGIN_X * 2, cardH, 2.5, 2.5, 'FD');
  doc.setFillColor(...accentColor);
  doc.roundedRect(PDF_MARGIN_X, cardY, 1.6, cardH, 0.8, 0.8, 'F');

  let ty = cardY + innerPad + 3;
  doc.setTextColor(...PDF_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, PDF_MARGIN_X + innerPad + 2, ty);
  ty += titleH;

  wrapped.forEach((it) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_TEXT);
    for (const line of it.headingLines) {
      doc.text(line, PDF_MARGIN_X + innerPad + 2, ty);
      ty += headingLineH;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_MUTED);
    for (const line of it.bodyLines) {
      doc.text(line, PDF_MARGIN_X + innerPad + 2, ty);
      ty += bodyLineH;
    }
    ty += itemGap;
  });

  cursor.y = cardY + cardH + 6;
}

export interface PdfStatItem {
  label: string;
  value: string;
  valueColor?: [number, number, number];
}

/**
 * A row of KPI stat blocks (big bold value + small muted uppercase label)
 * inside one bordered container, divided by thin rules — mirrors the
 * reference doc's `.alarm-stat` grid.
 */
export function pdfStatRow(doc: jsPDF, cursor: PdfCursor, stats: PdfStatItem[]): void {
  if (stats.length === 0) return;
  const rowH = 18;
  pdfNewPageIfNeeded(doc, cursor, rowH + 6);

  const boxW = (PDF_PAGE_W - PDF_MARGIN_X * 2) / stats.length;
  const y = cursor.y;

  doc.setDrawColor(...PDF_BORDER);
  doc.setLineWidth(0.2);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(PDF_MARGIN_X, y, PDF_PAGE_W - PDF_MARGIN_X * 2, rowH, 2.5, 2.5, 'FD');

  stats.forEach((stat, i) => {
    const boxX = PDF_MARGIN_X + boxW * i;
    if (i > 0) {
      doc.setDrawColor(...PDF_BORDER);
      doc.line(boxX, y + 3, boxX, y + rowH - 3);
    }
    doc.setTextColor(...(stat.valueColor ?? PDF_TEXT));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(stat.value, boxX + boxW / 2, y + 9, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_MUTED);
    doc.text(stat.label.toUpperCase(), boxX + boxW / 2, y + 14.5, { align: 'center' });
  });

  cursor.y = y + rowH + 6;
}

/** Solid purple footer band on every page — brand, confidentiality note, and page N/M. */
export function pdfFooterBand(doc: jsPDF, customerName: string | undefined): void {
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const bandY = PDF_PAGE_H - FOOTER_HEIGHT;
    doc.setFillColor(...PDF_PURPLE);
    doc.rect(0, bandY, PDF_PAGE_W, FOOTER_HEIGHT, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`MYIO${customerName ? ' · ' + customerName : ''}`, PDF_MARGIN_X, bandY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Documento confidencial', PDF_PAGE_W / 2, bandY + 9, { align: 'center' });
    doc.text(`Página ${p} / ${pageCount}`, PDF_PAGE_W - PDF_MARGIN_X, bandY + 9, { align: 'right' });
  }
}

/**
 * Embeds a chart `<canvas>` as a PNG image, scaled to the full content
 * width, preserving aspect ratio. No-op if the canvas has zero size, or if
 * `toDataURL`/`addImage` throws (e.g. a tainted canvas).
 */
export function pdfEmbedChartImage(doc: jsPDF, cursor: PdfCursor, canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return;
  const maxWidthMm = PDF_PAGE_W - PDF_MARGIN_X * 2;
  const heightMm = maxWidthMm * (canvas.height / canvas.width);
  pdfNewPageIfNeeded(doc, cursor, heightMm + 10);
  try {
    const dataUrl = canvas.toDataURL('image/png');
    doc.addImage(dataUrl, 'PNG', PDF_MARGIN_X, cursor.y, maxWidthMm, heightMm);
    cursor.y += heightMm + 8;
  } catch (err) {
    console.warn('[GatewayModal PDF export] Failed to embed chart image:', err);
  }
}
