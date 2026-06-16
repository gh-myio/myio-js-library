/**
 * RFC-0203 M7 — CSV export (AC-40 path, AC-41 columns, AC-42 filename).
 *
 * Pure string generation + a small browser-side download helper. No external
 * dependencies. UTF-8 BOM is prepended so Excel opens accented text correctly.
 */

import type {
  AnnotatedDevice,
  Annotation,
} from '../../services/annotations/types';

// ─── Column contract (AC-41) ────────────────────────────────────────────────

export const CSV_COLUMNS = [
  'identifier',
  'device_name',
  'device_label',
  'domain',
  'annotation_id',
  'type',
  'importance',
  'status',
  'text',
  'created_at',
  'created_by_email',
  'due_date',
  'acknowledged',
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

// ─── CSV escaping ──────────────────────────────────────────────────────────

/** Quote a value when it contains delimiter / quote / newline; double inner quotes. */
export function csvEscape(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (s === '') return '';
  const needsQuoting = /[",\n\r;]/.test(s);
  if (!needsQuoting) return s;
  return '"' + s.replace(/"/g, '""') + '"';
}

// ─── Row + serialization ───────────────────────────────────────────────────

function buildRow(device: AnnotatedDevice, ann: Annotation): Record<CsvColumn, string> {
  return {
    identifier: device.identifier ?? '',
    device_name: device.name ?? '',
    device_label: device.label ?? '',
    domain: device.domain ?? '',
    annotation_id: ann.id ?? '',
    type: ann.type ?? '',
    importance: String(ann.importance ?? ''),
    status: ann.status ?? '',
    text: ann.text ?? '',
    created_at: ann.createdAt ?? '',
    created_by_email: ann.createdBy?.email ?? '',
    due_date: ann.dueDate ?? '',
    acknowledged: ann.acknowledged ? 'true' : 'false',
  };
}

/**
 * Build a CSV string for the given devices (flattens to one row per
 * annotation). Filters out annotations with `status === 'archived'` UNLESS
 * `includeArchived: true`.
 */
export function buildAnnotationsCsv(
  devices: AnnotatedDevice[],
  options: { includeArchived?: boolean } = {}
): string {
  const includeArchived = options.includeArchived ?? false;

  const lines: string[] = [];
  lines.push(CSV_COLUMNS.join(','));

  for (const device of devices) {
    for (const ann of device.annotations) {
      if (!includeArchived && ann.status === 'archived') continue;
      const row = buildRow(device, ann);
      lines.push(CSV_COLUMNS.map((c) => csvEscape(row[c])).join(','));
    }
  }

  // UTF-8 BOM so Excel decodes accented characters correctly
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ─── Filename (AC-42) ──────────────────────────────────────────────────────

/**
 * Builds `anotacoes_${customerName}_${yyyymmdd_hhmm}.{pdf,csv}` filename.
 * customerName is sanitized to alphanumerics + dash + underscore.
 */
export function buildExportFilename(
  customerName: string | undefined,
  ext: 'csv' | 'pdf',
  now: Date = new Date()
): string {
  const safeCustomer = (customerName || 'customer')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase() || 'customer';

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');

  return `anotacoes_${safeCustomer}_${yyyy}${mm}${dd}_${hh}${mi}.${ext}`;
}

// ─── Browser download ──────────────────────────────────────────────────────

/**
 * Triggers a browser download of `content` as a file. Safe to call in
 * non-browser env (no-op).
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
): void {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return;
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Convenience: build + download in one call. */
export function exportAnnotationsCsv(
  devices: AnnotatedDevice[],
  options: { customerName?: string; includeArchived?: boolean } = {}
): { filename: string; content: string } {
  const filename = buildExportFilename(options.customerName, 'csv');
  const content = buildAnnotationsCsv(devices, { includeArchived: options.includeArchived });
  downloadTextFile(filename, content, 'text/csv');
  return { filename, content };
}
