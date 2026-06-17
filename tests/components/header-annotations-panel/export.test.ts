/**
 * RFC-0203 M7 — Export tests (CSV + PDF + Export modal).
 *
 * Covers:
 *   - AC-40 (PDF builder uses jsPDF without throwing)
 *   - AC-41 (CSV columns exact order + content)
 *   - AC-42 (filename format)
 *   - AC-43 (PDF levels combinable)
 *   - Export modal UI scaffold + onExport callback contract
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, unlinkSync } from 'node:fs';
import { jsPDF } from 'jspdf';
import {
  buildAnnotationsCsv,
  buildExportFilename,
  csvEscape,
  CSV_COLUMNS,
  exportAnnotationsCsv,
} from '../../../src/components/header-annotations-panel/ExportCSV';
import { exportAnnotationsPdf } from '../../../src/components/header-annotations-panel/ExportPDF';
import { openExportModal, closeExportModal } from '../../../src/components/header-annotations-panel/ExportModal';
import type { AnnotatedDevice, Annotation } from '../../../src/services/annotations/types';

// ─── Disk-artifact cleanup ───────────────────────────────────────────────────
// `exportAnnotationsPdf` calls `jsPDF.save()`, which in the Node/jsdom test
// environment writes the PDF straight to disk (it bypasses the stubbed anchor
// download path). Remove any `anotacoes_*.pdf` these tests emit so they never
// leak into the working tree / a commit. Runs once after this file's suite.
function cleanupGeneratedPdfs(): void {
  try {
    for (const f of readdirSync(process.cwd())) {
      if (/^anotacoes_.*\.pdf$/i.test(f)) {
        try {
          unlinkSync(f);
        } catch {
          /* best-effort */
        }
      }
    }
  } catch {
    /* cwd not readable — nothing to clean */
  }
}

afterAll(cleanupGeneratedPdfs);

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeAnn(over: Partial<Annotation> = {}): Annotation {
  return {
    id: over.id ?? 'a-1',
    version: 1,
    text: over.text ?? 'texto',
    type: over.type ?? 'observation',
    importance: over.importance ?? 3,
    status: over.status ?? 'created',
    createdAt: over.createdAt ?? '2026-05-01T12:00:00.000Z',
    dueDate: over.dueDate,
    createdBy: over.createdBy ?? { id: 'u', email: 'a@b.com', name: 'João' },
    acknowledged: over.acknowledged ?? false,
    responses: [],
    history: [],
  } as Annotation;
}

function makeDevice(over: Partial<AnnotatedDevice> = {}): AnnotatedDevice {
  return {
    deviceId: over.deviceId ?? 'd1',
    name: over.name ?? 'Device 1',
    label: over.label ?? 'Loja Riachuelo',
    identifier: over.identifier === undefined ? 'L-203' : over.identifier,
    domain: over.domain ?? 'energy',
    deviceType: over.deviceType ?? '3F_MEDIDOR',
    annotations: over.annotations ?? [makeAnn()],
  };
}

// ─── csvEscape ─────────────────────────────────────────────────────────────

describe('csvEscape', () => {
  it('passes plain ASCII through', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape(true)).toBe('true');
  });
  it('returns empty for nullish', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
    expect(csvEscape('')).toBe('');
  });
  it('quotes when value contains comma / quote / newline / semicolon', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('a"b')).toBe('"a""b"');
    expect(csvEscape('a\nb')).toBe('"a\nb"');
    expect(csvEscape('a;b')).toBe('"a;b"');
  });
});

// ─── buildAnnotationsCsv (AC-41) ───────────────────────────────────────────

describe('buildAnnotationsCsv', () => {
  it('emits BOM + header row + one row per annotation', () => {
    const dev = makeDevice({
      annotations: [
        makeAnn({ id: 'a1', text: 'first' }),
        makeAnn({ id: 'a2', text: 'second' }),
      ],
    });
    const csv = buildAnnotationsCsv([dev]);
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = csv.slice(1).trim().split(/\r\n/);
    expect(rows).toHaveLength(3); // header + 2
    expect(rows[0]).toBe(CSV_COLUMNS.join(','));
  });

  it('exposes columns in the AC-41 contract order', () => {
    expect(CSV_COLUMNS).toEqual([
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
    ]);
  });

  it('escapes values with commas/quotes correctly', () => {
    const dev = makeDevice({
      label: 'Loja, com vírgula',
      annotations: [makeAnn({ text: 'aspa "interna"' })],
    });
    const csv = buildAnnotationsCsv([dev]);
    expect(csv).toContain('"Loja, com vírgula"');
    expect(csv).toContain('"aspa ""interna"""');
  });

  it('skips archived annotations by default; includes when includeArchived=true', () => {
    const dev = makeDevice({
      annotations: [makeAnn({ id: 'a1' }), makeAnn({ id: 'a2', status: 'archived' })],
    });
    expect(buildAnnotationsCsv([dev]).trim().split(/\r\n/).length).toBe(2); // header + a1
    expect(buildAnnotationsCsv([dev], { includeArchived: true }).trim().split(/\r\n/).length).toBe(3);
  });
});

// ─── buildExportFilename (AC-42) ───────────────────────────────────────────

describe('buildExportFilename', () => {
  it('produces anotacoes_<customer>_<yyyymmdd_hhmm>.<ext>', () => {
    const now = new Date('2026-05-27T18:34:00');
    const fn = buildExportFilename('Souza Aguiar', 'pdf', now);
    expect(fn).toMatch(/^anotacoes_souza_aguiar_\d{8}_\d{4}\.pdf$/);
  });

  it('falls back to "customer" when name is empty', () => {
    const now = new Date('2026-05-27T09:05:00');
    expect(buildExportFilename(undefined, 'csv', now)).toMatch(/^anotacoes_customer_\d{8}_\d{4}\.csv$/);
  });

  it('strips accents and unsafe characters', () => {
    const now = new Date('2026-05-27T09:05:00');
    const fn = buildExportFilename('Shop/ping  São José', 'csv', now);
    expect(fn).toMatch(/^anotacoes_shop_ping_sao_jose_\d{8}_\d{4}\.csv$/);
  });
});

// ─── exportAnnotationsPdf (AC-40, AC-43) ───────────────────────────────────

describe('exportAnnotationsPdf', () => {
  beforeEach(() => {
    // jsPDF.save() ultimately calls URL.createObjectURL + anchor.click() —
    // stub those so the test doesn't trigger a real download.
    if (typeof URL.createObjectURL !== 'function') {
      (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => '';
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when levels is empty', () => {
    expect(() =>
      exportAnnotationsPdf([], { customerName: 'x', levels: [] })
    ).toThrow(/at least one level/i);
  });

  it('generates a PDF and returns the constructed filename (AC-40, AC-42)', () => {
    const dev = makeDevice({ annotations: [makeAnn({ id: 'a1' })] });
    const fn = exportAnnotationsPdf([dev], {
      customerName: 'Test Mall',
      levels: ['summary'],
      now: new Date('2026-05-27T18:00:00'),
    });
    expect(fn).toMatch(/^anotacoes_test_mall_\d{8}_\d{4}\.pdf$/);
  });

  it('combines multiple levels in a single PDF without throwing (AC-43)', () => {
    const dev = makeDevice({ annotations: [makeAnn({ id: 'a1' }), makeAnn({ id: 'a2' })] });
    expect(() =>
      exportAnnotationsPdf([dev], {
        customerName: 'X',
        levels: ['summary', 'consolidated', 'detailed'],
      })
    ).not.toThrow();
  });

  it('respects includeArchived flag', () => {
    const dev = makeDevice({
      annotations: [makeAnn({ id: 'a1' }), makeAnn({ id: 'a2', status: 'archived' })],
    });
    expect(() =>
      exportAnnotationsPdf([dev], { levels: ['summary'], includeArchived: true })
    ).not.toThrow();
    expect(() =>
      exportAnnotationsPdf([dev], { levels: ['summary'], includeArchived: false })
    ).not.toThrow();
  });
});

// ─── exportAnnotationsCsv (browser glue) ───────────────────────────────────

describe('exportAnnotationsCsv (browser download)', () => {
  let createSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // jsdom doesn't ship createObjectURL/revokeObjectURL — stub before spy
    if (typeof URL.createObjectURL !== 'function') {
      (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => '';
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    }
    createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers <a>.click() with the generated filename', () => {
    const dev = makeDevice({ annotations: [makeAnn()] });
    const result = exportAnnotationsCsv([dev], { customerName: 'X' });
    expect(result.filename).toMatch(/^anotacoes_x_\d{8}_\d{4}\.csv$/);
    expect(createSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ─── openExportModal (AC-39 scaffold) ──────────────────────────────────────

describe('openExportModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    closeExportModal();
    document.body.innerHTML = '';
  });

  it('mounts a modal with format radios, level checkboxes, scope radios (AC-39)', () => {
    openExportModal({ hasActiveFilter: false, onExport: vi.fn() });
    expect(document.querySelectorAll('input[name="fmt"]')).toHaveLength(2);
    expect(document.querySelector('input[name="lvl-summary"]')).not.toBeNull();
    expect(document.querySelector('input[name="lvl-consolidated"]')).not.toBeNull();
    expect(document.querySelector('input[name="lvl-detailed"]')).not.toBeNull();
    expect(document.querySelectorAll('input[name="scope"]')).toHaveLength(3);
  });

  it('disables "filtered" scope when no filter is active', () => {
    openExportModal({ hasActiveFilter: false, onExport: vi.fn() });
    const filtered = document.querySelector<HTMLInputElement>('input[name="scope"][value="filtered"]');
    expect(filtered?.disabled).toBe(true);
  });

  it('enables "filtered" scope when filter is active', () => {
    openExportModal({ hasActiveFilter: true, onExport: vi.fn() });
    const filtered = document.querySelector<HTMLInputElement>('input[name="scope"][value="filtered"]');
    expect(filtered?.disabled).toBe(false);
  });

  it('calls onExport with the chosen options on confirm', () => {
    const onExport = vi.fn();
    openExportModal({ hasActiveFilter: false, onExport });
    // Default: PDF + summary + consolidated + scope current-tab
    document.querySelector<HTMLButtonElement>('.myio-annotations-export-modal-confirm')?.click();
    expect(onExport).toHaveBeenCalledTimes(1);
    const opts = onExport.mock.calls[0][0];
    expect(opts.format).toBe('pdf');
    expect(opts.levels).toEqual(expect.arrayContaining(['summary', 'consolidated']));
    expect(opts.scope).toBe('current-tab');
  });

  it('CSV path passes levels=undefined to onExport', () => {
    const onExport = vi.fn();
    openExportModal({ hasActiveFilter: false, onExport });
    document.querySelector<HTMLInputElement>('input[name="fmt"][value="csv"]')!.click();
    document.querySelector<HTMLButtonElement>('.myio-annotations-export-modal-confirm')?.click();
    expect(onExport).toHaveBeenCalledTimes(1);
    const opts = onExport.mock.calls[0][0];
    expect(opts.format).toBe('csv');
    expect(opts.levels).toBeUndefined();
  });

  it('cancel button closes without calling onExport', () => {
    const onExport = vi.fn();
    openExportModal({ hasActiveFilter: false, onExport });
    document.querySelector<HTMLButtonElement>('.myio-annotations-export-modal-cancel')?.click();
    expect(onExport).not.toHaveBeenCalled();
    expect(document.querySelector('.myio-annotations-export-modal')).toBeNull();
  });
});
