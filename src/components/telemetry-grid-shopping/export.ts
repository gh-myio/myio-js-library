/**
 * RFC-0185 / RFC-0145: Grid export utilities — CSV, XLS (XML Spreadsheet), PDF (jsPDF)
 * All exports use the current filtered device list from the grid.
 */

import { jsPDF } from 'jspdf';
import type { TelemetryDevice } from './types';

// ─── Column definitions ───────────────────────────────────────────────────────

interface Col {
  key: keyof RowData;
  label: string;
  pdfW: number; // mm in landscape A4
}

interface RowData {
  idx: string;
  nome: string;
  identificador: string;
  consumo: string;
  perc: string;
}

export interface ExportPeriod {
  startISO?: string | null;
  endISO?: string | null;
}

function makeCols(unit: string): Col[] {
  return [
    { key: 'idx',          label: '#',                                    pdfW: 10  },
    { key: 'nome',         label: 'Nome',                                 pdfW: 100 },
    { key: 'identificador',label: 'Identificador',                        pdfW: 60  },
    { key: 'consumo',      label: unit ? `Consumo (${unit})` : 'Consumo', pdfW: 50  },
    { key: 'perc',         label: '%',                                    pdfW: 20  },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRow(d: TelemetryDevice, idx: number): RowData {
  const fmtVal = (): string => {
    if (d.val === null || d.val === undefined) return '—';
    return Number(d.val).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  };
  return {
    idx:           String(idx + 1),
    nome:          d.labelOrName || d.name || '—',
    identificador: d.deviceIdentifier || '—',
    consumo:       fmtVal(),
    perc:          d.perc !== undefined ? `${d.perc.toFixed(1)}%` : '—',
  };
}

function fmtPeriod(period?: ExportPeriod | null): string {
  if (!period?.startISO) return '';
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
  return period.endISO
    ? `${fmt(period.startISO)} — ${fmt(period.endISO)}`
    : fmt(period.startISO);
}

function slugify(s: string): string {
  return s.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function datestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

export function exportGridCsv(
  devices: TelemetryDevice[],
  label: string,
  unit: string,
  period?: ExportPeriod | null,
): void {
  const periodLabel = fmtPeriod(period);
  const metaRows = [
    `"${label}"`,
    periodLabel ? `"Período";"${periodLabel}"` : null,
    `"Gerado em";"${new Date().toLocaleString('pt-BR')}"`,
    '',
  ].filter(v => v !== null);

  const cols = makeCols(unit);
  const header = cols.map(c => `"${c.label}"`).join(';');
  const rows = devices.map((d, i) => {
    const r = buildRow(d, i);
    return cols.map(c => `"${String(r[c.key]).replace(/"/g, '""')}"`).join(';');
  });

  const csv = '\uFEFF' + [...metaRows, header, ...rows].join('\r\n'); // BOM for Excel
  triggerDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `${slugify(label)}-${datestamp()}.csv`,
  );
}

// ─── XLS (XML Spreadsheet 2003) ───────────────────────────────────────────────

export function exportGridXls(
  devices: TelemetryDevice[],
  label: string,
  unit: string,
  period?: ExportPeriod | null,
): void {
  const periodLabel = fmtPeriod(period);
  const cols = makeCols(unit);
  const span = cols.length - 1; // MergeAcross = span cols - 1

  const metaRow = (key: string, val: string) =>
    `<Row><Cell ss:StyleID="m"><Data ss:Type="String">${escXml(key)}</Data></Cell>` +
    `<Cell ss:MergeAcross="${span - 1}"><Data ss:Type="String">${escXml(val)}</Data></Cell></Row>`;

  const headerCells = cols.map(
    c => `<Cell ss:StyleID="h"><Data ss:Type="String">${escXml(c.label)}</Data></Cell>`,
  ).join('');

  const dataRows = devices
    .map((d, i) => {
      const r = buildRow(d, i);
      const cells = cols.map(c => {
        const v = escXml(String(r[c.key]));
        return `<Cell><Data ss:Type="String">${v}</Data></Cell>`;
      }).join('');
      return `<Row>${cells}</Row>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="h">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#3E1A7D" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="m">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#F0EDF9" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escXml(label.slice(0, 31))}">
    <Table>
      ${metaRow('Relatório', label)}
      ${periodLabel ? metaRow('Período', periodLabel) : ''}
      ${metaRow('Gerado em', new Date().toLocaleString('pt-BR'))}
      <Row/>
      <Row>${headerCells}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

  triggerDownload(
    new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
    `${slugify(label)}-${datestamp()}.xls`,
  );
}

// ─── PDF (jsPDF) ──────────────────────────────────────────────────────────────

export function exportGridPdf(
  devices: TelemetryDevice[],
  label: string,
  unit: string,
  period?: ExportPeriod | null,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();   // 297
  const PH = doc.internal.pageSize.getHeight();  // 210

  const MARGIN   = 10;
  const HDR_H    = 13;  // top header band
  const FTR_H    = 10;  // bottom footer band
  const ROW_H    = 7;   // data row height
  const HEAD_H   = 8;   // column header row height
  const TABLE_Y  = HDR_H + MARGIN;
  const MAX_Y    = PH - FTR_H - MARGIN;
  const TABLE_W  = PW - MARGIN * 2;

  const cols = makeCols(unit);

  // Scale column widths to fill TABLE_W exactly
  const rawTotal = cols.reduce((s, c) => s + c.pdfW, 0);
  const scale    = TABLE_W / rawTotal;
  const colWidths = cols.map(c => c.pdfW * scale);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const colX = (ci: number): number =>
    MARGIN + colWidths.slice(0, ci).reduce((s, w) => s + w, 0);

  function drawPageHeader(pageNo: number): void {
    // Top band
    doc.setFillColor(62, 26, 125);
    doc.rect(0, 0, PW, HDR_H, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(label, MARGIN, HDR_H / 2 + 1.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const periodLabel = fmtPeriod(period);
    const periodPart = periodLabel ? `Período: ${periodLabel}  •  ` : '';
    const info = `${periodPart}${devices.length} dispositivo(s)  •  Unidade: ${unit}  •  Pág. ${pageNo}`;
    doc.text(info, PW - MARGIN, HDR_H / 2 + 1.5, { align: 'right' });
  }

  function drawColumnHeaders(y: number): void {
    doc.setFillColor(240, 237, 250);
    doc.rect(MARGIN, y, TABLE_W, HEAD_H, 'F');

    doc.setTextColor(62, 26, 125);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);

    cols.forEach((c, ci) => {
      const x = colX(ci) + 1.5;
      doc.text(c.label, x, y + HEAD_H / 2 + 2.5);
    });

    doc.setDrawColor(200, 195, 220);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, y, TABLE_W, HEAD_H);
  }

  function drawDataRow(r: RowData, y: number, even: boolean): void {
    if (even) {
      doc.setFillColor(250, 249, 255);
      doc.rect(MARGIN, y, TABLE_W, ROW_H, 'F');
    }

    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);

    cols.forEach((c, ci) => {
      const x  = colX(ci) + 1.5;
      const maxChars = Math.floor(colWidths[ci] / 1.8);
      const text = truncate(String(r[c.key]), maxChars);
      doc.text(text, x, y + ROW_H / 2 + 2.2);
    });

    doc.setDrawColor(230, 228, 240);
    doc.setLineWidth(0.1);
    doc.line(MARGIN, y + ROW_H, MARGIN + TABLE_W, y + ROW_H);
  }

  function drawFooter(): void {
    doc.setFillColor(250, 249, 255);
    doc.rect(0, PH - FTR_H, PW, FTR_H, 'F');
    doc.setDrawColor(210, 205, 230);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PH - FTR_H + 0.5, PW - MARGIN, PH - FTR_H + 0.5);
    doc.setTextColor(120, 110, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      `Gerado em ${new Date().toLocaleString('pt-BR')}  —  MyIO`,
      MARGIN,
      PH - FTR_H + 6,
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  let pageNo  = 1;
  let currentY = TABLE_Y;

  drawPageHeader(pageNo);
  drawColumnHeaders(currentY);
  currentY += HEAD_H;

  devices.forEach((d, i) => {
    // New page if needed
    if (currentY + ROW_H > MAX_Y) {
      drawFooter();
      doc.addPage();
      pageNo++;
      currentY = TABLE_Y;
      drawPageHeader(pageNo);
      drawColumnHeaders(currentY);
      currentY += HEAD_H;
    }

    drawDataRow(buildRow(d, i), currentY, i % 2 === 0);
    currentY += ROW_H;
  });

  drawFooter();

  doc.save(`${slugify(label)}-${datestamp()}.pdf`);
}
