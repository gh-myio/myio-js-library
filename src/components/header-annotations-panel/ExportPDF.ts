/**
 * RFC-0203 M7 — PDF export (AC-40, AC-43, AC-42).
 *
 * Uses `jsPDF` (already in package.json deps via M1 audit). Generates a
 * single PDF that may combine up to 3 sections — Sumário, Consolidado,
 * Detalhado — controlled by the `levels` option.
 *
 * Layout is portrait A4 with simple text-positioning (no jspdf-autotable
 * dependency to keep bundle weight down). Section/page breaks are managed
 * manually via a height tracker.
 */

import { jsPDF } from 'jspdf';
import type {
  AnnotatedDevice,
  Annotation,
} from '../../services/annotations/types';
import { buildExportFilename } from './ExportCSV';

export type PdfLevel = 'summary' | 'consolidated' | 'detailed';

export interface ExportPdfOptions {
  /** Customer name for filename + cover */
  customerName?: string;
  /** Levels to include — at least one. Order: summary, consolidated, detailed. */
  levels: PdfLevel[];
  /** Include archived annotations in counts/lists. Default false. */
  includeArchived?: boolean;
  /** Optional title override. Default "Anotações Operacionais". */
  title?: string;
  /** Optional Date override for test determinism. */
  now?: Date;
}

// ─── Page layout constants (portrait A4 in mm) ──────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 14;
const MARGIN_TOP = 14;
const MARGIN_BOTTOM = 18;
const LINE_H = 5;

// ─── Public surface ────────────────────────────────────────────────────────

/**
 * Generate a PDF and save it via jsPDF.save(). Returns the filename used.
 */
export function exportAnnotationsPdf(
  devices: AnnotatedDevice[],
  options: ExportPdfOptions
): string {
  if (!options.levels || options.levels.length === 0) {
    throw new Error('exportAnnotationsPdf: at least one level required');
  }

  const includeArchived = options.includeArchived ?? false;
  const visibleDevices = _filterVisible(devices, includeArchived);
  const filename = buildExportFilename(options.customerName, 'pdf', options.now);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Cursor state — passed by reference via closure
  const cursor = { y: MARGIN_TOP };

  _renderCover(doc, cursor, options, visibleDevices);

  if (options.levels.includes('summary')) {
    _newPageIfNeeded(doc, cursor, 60);
    _renderSummary(doc, cursor, visibleDevices);
  }
  if (options.levels.includes('consolidated')) {
    _newPage(doc, cursor);
    _renderConsolidated(doc, cursor, visibleDevices);
  }
  if (options.levels.includes('detailed')) {
    _newPage(doc, cursor);
    _renderDetailed(doc, cursor, visibleDevices);
  }

  _renderFooterAllPages(doc, options.customerName);

  doc.save(filename);
  return filename;
}

// ─── Renderers ─────────────────────────────────────────────────────────────

function _renderCover(
  doc: jsPDF,
  cursor: { y: number },
  options: ExportPdfOptions,
  devices: AnnotatedDevice[]
): void {
  const total = _countAnnotations(devices);
  const customer = options.customerName || 'customer';

  doc.setFontSize(20);
  doc.setTextColor(76, 58, 172); // amethyst #4c3aac
  doc.text(options.title || 'Anotações Operacionais', MARGIN_X, cursor.y + 8);
  cursor.y += 16;

  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Cliente: ${customer}`, MARGIN_X, cursor.y);
  cursor.y += LINE_H;
  doc.text(
    `Gerado em: ${(options.now ?? new Date()).toLocaleString('pt-BR')}`,
    MARGIN_X,
    cursor.y
  );
  cursor.y += LINE_H;
  doc.text(`Total de anotações: ${total} (em ${devices.length} devices)`, MARGIN_X, cursor.y);
  cursor.y += LINE_H + 4;

  doc.setDrawColor(108, 92, 231);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_X, cursor.y, PAGE_W - MARGIN_X, cursor.y);
  cursor.y += 6;
}

function _renderSummary(
  doc: jsPDF,
  cursor: { y: number },
  devices: AnnotatedDevice[]
): void {
  _sectionHeader(doc, cursor, 'Sumário');

  const byType = _countByType(devices);
  const byImportance = _countByImportance(devices);
  const byDomain = _countByDomain(devices);

  doc.setFontSize(11);
  doc.setTextColor(40);

  const lines: string[] = [
    `Por tipo:`,
    `  • Pendência: ${byType.pending}`,
    `  • Manutenção: ${byType.maintenance}`,
    `  • Observação: ${byType.observation}`,
    `  • Atividade: ${byType.activity}`,
    ``,
    `Por importância:`,
    `  • Crítica (5): ${byImportance[5]}`,
    `  • Alta (4): ${byImportance[4]}`,
    `  • Média (3): ${byImportance[3]}`,
    `  • Baixa (2): ${byImportance[2]}`,
    `  • Muito baixa (1): ${byImportance[1]}`,
    ``,
    `Por domínio:`,
    `  • Energia: ${byDomain.energy}`,
    `  • Água: ${byDomain.water}`,
    `  • Temperatura: ${byDomain.temperature}`,
    `  • Indeterminado: ${byDomain.unknown}`,
  ];
  for (const ln of lines) {
    _newPageIfNeeded(doc, cursor, LINE_H);
    doc.text(ln, MARGIN_X, cursor.y);
    cursor.y += LINE_H;
  }
}

function _renderConsolidated(
  doc: jsPDF,
  cursor: { y: number },
  devices: AnnotatedDevice[]
): void {
  _sectionHeader(doc, cursor, 'Consolidado por device');

  const sorted = devices
    .slice()
    .filter((d) => d.annotations.length > 0)
    .sort((a, b) => b.annotations.length - a.annotations.length);

  doc.setFontSize(10);
  doc.setTextColor(40);

  for (const d of sorted) {
    _newPageIfNeeded(doc, cursor, LINE_H * 2);
    doc.setFont(undefined, 'bold');
    const ident = d.identifier ? `[${d.identifier}] ` : '';
    doc.text(`${ident}${d.label || d.name} (${d.annotations.length})`, MARGIN_X, cursor.y);
    cursor.y += LINE_H;
    doc.setFont(undefined, 'normal');
    const last = d.annotations.reduce(
      (acc: Annotation | null, a) =>
        !acc || a.createdAt > acc.createdAt ? a : acc,
      null as Annotation | null
    );
    if (last) {
      const txt = `  Última: "${_truncate(last.text, 90)}" — ${last.createdBy?.name ?? ''} — ${_formatDate(last.createdAt)}`;
      const wrapped = doc.splitTextToSize(txt, PAGE_W - MARGIN_X * 2);
      for (const line of wrapped) {
        _newPageIfNeeded(doc, cursor, LINE_H);
        doc.text(line, MARGIN_X, cursor.y);
        cursor.y += LINE_H;
      }
    }
    cursor.y += 1;
  }
}

function _renderDetailed(
  doc: jsPDF,
  cursor: { y: number },
  devices: AnnotatedDevice[]
): void {
  _sectionHeader(doc, cursor, 'Detalhado por anotação');

  doc.setFontSize(10);
  doc.setTextColor(40);

  for (const d of devices) {
    if (d.annotations.length === 0) continue;
    _newPageIfNeeded(doc, cursor, LINE_H * 2);
    doc.setFont(undefined, 'bold');
    const ident = d.identifier ? `[${d.identifier}] ` : '';
    doc.text(`${ident}${d.label || d.name}`, MARGIN_X, cursor.y);
    cursor.y += LINE_H;
    doc.setFont(undefined, 'normal');

    for (const a of d.annotations) {
      const header = `  ${a.type.toUpperCase()} · Importância ${a.importance} · ${a.status}`;
      _newPageIfNeeded(doc, cursor, LINE_H * 3);
      doc.text(header, MARGIN_X, cursor.y);
      cursor.y += LINE_H;

      const wrapped = doc.splitTextToSize(`  "${a.text}"`, PAGE_W - MARGIN_X * 2);
      for (const line of wrapped) {
        _newPageIfNeeded(doc, cursor, LINE_H);
        doc.text(line, MARGIN_X, cursor.y);
        cursor.y += LINE_H;
      }

      const meta = `  por ${a.createdBy?.name ?? '—'} (${a.createdBy?.email ?? '—'}) em ${_formatDate(a.createdAt)}${a.dueDate ? ' · vence ' + _formatDate(a.dueDate) : ''}`;
      const metaWrapped = doc.splitTextToSize(meta, PAGE_W - MARGIN_X * 2);
      for (const line of metaWrapped) {
        _newPageIfNeeded(doc, cursor, LINE_H);
        doc.text(line, MARGIN_X, cursor.y);
        cursor.y += LINE_H;
      }
      cursor.y += 2;
    }
    cursor.y += 2;
  }
}

function _renderFooterAllPages(doc: jsPDF, customerName: string | undefined): void {
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `MyIO · ${customerName || ''} · Documento confidencial — contém dados operacionais.`,
      MARGIN_X,
      PAGE_H - 8
    );
    doc.text(`Página ${p} / ${pageCount}`, PAGE_W - MARGIN_X - 25, PAGE_H - 8);
  }
}

// ─── Layout helpers ────────────────────────────────────────────────────────

function _sectionHeader(doc: jsPDF, cursor: { y: number }, title: string): void {
  doc.setFontSize(14);
  doc.setTextColor(76, 58, 172);
  doc.text(title, MARGIN_X, cursor.y);
  cursor.y += 7;
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, cursor.y - 3, PAGE_W - MARGIN_X, cursor.y - 3);
}

function _newPage(doc: jsPDF, cursor: { y: number }): void {
  doc.addPage();
  cursor.y = MARGIN_TOP;
}

function _newPageIfNeeded(
  doc: jsPDF,
  cursor: { y: number },
  required: number
): void {
  if (cursor.y + required > PAGE_H - MARGIN_BOTTOM) {
    _newPage(doc, cursor);
  }
}

// ─── Filters + counts ──────────────────────────────────────────────────────

function _filterVisible(devices: AnnotatedDevice[], includeArchived: boolean): AnnotatedDevice[] {
  if (includeArchived) return devices;
  return devices
    .map((d) => ({
      ...d,
      annotations: d.annotations.filter((a) => a.status !== 'archived'),
    }))
    .filter((d) => d.annotations.length > 0);
}

function _countAnnotations(devices: AnnotatedDevice[]): number {
  return devices.reduce((acc, d) => acc + d.annotations.length, 0);
}

function _countByType(devices: AnnotatedDevice[]): Record<Annotation['type'], number> {
  const acc = { observation: 0, pending: 0, maintenance: 0, activity: 0 } as Record<
    Annotation['type'],
    number
  >;
  for (const d of devices) {
    for (const a of d.annotations) {
      if (acc[a.type] !== undefined) acc[a.type]++;
    }
  }
  return acc;
}

function _countByImportance(
  devices: AnnotatedDevice[]
): Record<1 | 2 | 3 | 4 | 5, number> {
  const acc = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const d of devices) {
    for (const a of d.annotations) {
      const lv = a.importance as 1 | 2 | 3 | 4 | 5;
      if (acc[lv] !== undefined) acc[lv]++;
    }
  }
  return acc;
}

function _countByDomain(devices: AnnotatedDevice[]): Record<AnnotatedDevice['domain'], number> {
  const acc = { energy: 0, water: 0, temperature: 0, unknown: 0 } as Record<
    AnnotatedDevice['domain'],
    number
  >;
  for (const d of devices) {
    acc[d.domain] = (acc[d.domain] ?? 0) + d.annotations.length;
  }
  return acc;
}

function _truncate(s: string, max: number): string {
  const t = String(s ?? '');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function _formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}
