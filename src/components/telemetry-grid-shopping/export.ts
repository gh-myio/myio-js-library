/**
 * RFC-0185 / RFC-0145: Grid export utilities — CSV, XLS (XML Spreadsheet), PDF (jsPDF)
 * All exports use the current filtered device list from the grid.
 */

import { jsPDF } from 'jspdf';
import type { TelemetryDevice } from './types';
import { resolvePercentDecimals } from '../../utils/percentDecimals';

// ─── Column definitions ───────────────────────────────────────────────────────

interface Col {
  key: string; // idx | nome | identificador | consumo | perc | x0..xN (extraColumns)
  label: string;
  pdfW: number; // mm in landscape A4
}

type RowData = Record<string, string>;

/**
 * Campos opcionais lidos de cada linha (além do TelemetryDevice) — permitem que o
 * export reproduza a tabela da modal: colunas extras, nota no nome e linhas de grupo.
 */
interface ExportRowExtras {
  /** Valores das `extraColumns` (mesma ordem), já formatados. */
  extraCells?: string[];
  /** Texto discreto após o nome (ex.: "offset −2,00 °C"). */
  nameNote?: string;
  /** Quando presente, a linha é um cabeçalho de grupo (faixa de largura total). */
  groupHeader?: string;
}

function extras(d: TelemetryDevice): ExportRowExtras {
  return d as unknown as ExportRowExtras;
}

export interface ExportPeriod {
  startISO?: string | null;
  endISO?: string | null;
}

/** Ajustes de colunas — permite relatórios single-device (Data | Consumo | %). */
export interface GridColumnsOptions {
  /** Rótulo da coluna "Nome" (ex.: 'Data' no relatório por device). */
  nameLabel?: string;
  /** Omite a coluna Identificador (redundante em relatórios single-device). */
  hideIdentifier?: boolean;
  /** Rótulo da coluna de valor (default "Consumo (<unit>)"; ex.: 'Temperatura média (°C)'). */
  valueLabel?: string;
  /** Omite a coluna % (participação não tem semântica para temperatura). */
  hidePerc?: boolean;
  /** Colunas extras após o valor (ex.: Mín/Máx) — células vêm de `extraCells` de cada linha. */
  extraColumns?: Array<{ label: string; pdfW?: number }>;
  /** Texto quando o valor é nulo (default '—'; ex.: 'Sem leitura'). */
  emptyValueText?: string;
  /** Rótulo da contagem no header do PDF (default 'dispositivo(s)'; ex.: 'sensor(es)', 'dia(s)'). */
  countLabel?: string;
  /** Casas decimais FIXAS do valor (ex.: 2 → "30,00" como na tela). Default: até 3, sem mínimo. */
  valueDecimals?: number;
}

function makeCols(unit: string, colOpts?: GridColumnsOptions | null): Col[] {
  const cols: Col[] = [
    { key: 'idx',          label: '#',                                    pdfW: 10  },
    { key: 'nome',         label: colOpts?.nameLabel || 'Nome',           pdfW: 100 },
    { key: 'identificador',label: 'Identificador',                        pdfW: 60  },
    { key: 'consumo',      label: colOpts?.valueLabel || (unit ? `Consumo (${unit})` : 'Consumo'), pdfW: 50  },
    ...(colOpts?.extraColumns || []).map((c, i) => ({ key: `x${i}`, label: c.label, pdfW: c.pdfW ?? 40 })),
    { key: 'perc',         label: '%',                                    pdfW: 20  },
  ];
  return cols.filter(
    (c) =>
      !(colOpts?.hideIdentifier && c.key === 'identificador') && !(colOpts?.hidePerc && c.key === 'perc'),
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRow(d: TelemetryDevice, idx: number, colOpts?: GridColumnsOptions | null): RowData {
  const x = extras(d);
  const fmtVal = (): string => {
    if (d.val === null || d.val === undefined) return colOpts?.emptyValueText || '—';
    const dec = colOpts?.valueDecimals;
    return Number(d.val).toLocaleString(
      'pt-BR',
      dec !== undefined
        ? { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: false }
        : { maximumFractionDigits: 3, useGrouping: false },
    );
  };
  // Percentage decimals — window.MyIOUtils.percentDecimals > 2 (resolved at run time).
  const pd = resolvePercentDecimals();
  const name = d.labelOrName || d.name || '—';
  const row: RowData = {
    idx:           String(idx + 1),
    nome:          x.nameNote ? `${name}  (${x.nameNote})` : name,
    identificador: d.deviceIdentifier || '—',
    consumo:       fmtVal(),
    perc:          d.perc !== undefined ? `${d.perc.toFixed(pd).replace('.', ',')}%` : '—',
  };
  (colOpts?.extraColumns || []).forEach((_, i) => {
    row[`x${i}`] = x.extraCells?.[i] ?? '—';
  });
  return row;
}

/** Itera as linhas separando cabeçalhos de grupo; `n` = índice só das linhas de dados. */
function forEachRow(
  devices: TelemetryDevice[],
  onGroup: (label: string) => void,
  onRow: (d: TelemetryDevice, n: number) => void,
): void {
  let n = 0;
  devices.forEach((d) => {
    const g = extras(d).groupHeader;
    if (g) onGroup(g);
    else onRow(d, n++);
  });
}

function countDataRows(devices: TelemetryDevice[]): number {
  return devices.filter((d) => !extras(d).groupHeader).length;
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

/** Builds `[customer-]label-YYYYMMDD-HHmm` for export filenames. */
function buildFilenameBase(label: string, customerName?: string | null): string {
  const parts: string[] = [];
  const cSlug = customerName ? slugify(customerName) : '';
  if (cSlug) parts.push(cSlug);
  parts.push(slugify(label));
  parts.push(datestamp());
  return parts.join('-');
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

/**
 * Texto seguro p/ as fontes padrão do jsPDF (WinAnsi). Caracteres fora dela — ex.: o sinal
 * de menos tipográfico "−" (U+2212) do "offset −2,00 °C" — fazem o jsPDF trocar a célula
 * inteira para UTF-16 e o nome sai ilegível. Mapeia para equivalentes ASCII/WinAnsi.
 */
function pdfSafe(s: string): string {
  return String(s)
    .replace(/−/g, '-')
    .replace(/[‐‑]/g, '-')
    .replace(/ /g, ' ');
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

export function exportGridCsv(
  devices: TelemetryDevice[],
  label: string,
  unit: string,
  period?: ExportPeriod | null,
  customerName?: string | null,
): void {
  const periodLabel = fmtPeriod(period);
  const metaRows = [
    `"${label}"`,
    customerName ? `"Cliente";"${customerName}"` : null,
    periodLabel ? `"Período";"${periodLabel}"` : null,
    `"Gerado em";"${new Date().toLocaleString('pt-BR')}"`,
    '',
  ].filter(v => v !== null);

  const cols = makeCols(unit);
  const header = cols.map(c => `"${c.label}"`).join(';');
  const rows: string[] = [];
  forEachRow(
    devices,
    (g) => rows.push(`"${g.replace(/"/g, '""')}"`),
    (d, i) => {
      const r = buildRow(d, i);
      rows.push(cols.map(c => `"${String(r[c.key]).replace(/"/g, '""')}"`).join(';'));
    },
  );

  const csv = '\uFEFF' + [...metaRows, header, ...rows].join('\r\n'); // BOM for Excel
  triggerDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `${buildFilenameBase(label, customerName)}.csv`,
  );
}

// ─── XLS (XML Spreadsheet 2003) ───────────────────────────────────────────────

export function exportGridXls(
  devices: TelemetryDevice[],
  label: string,
  unit: string,
  period?: ExportPeriod | null,
  customerName?: string | null,
  options?: { accentColor?: string; columns?: GridColumnsOptions | null; kpis?: GridPdfKpi[] } | null,
): void {
  const periodLabel = fmtPeriod(period);
  const cols = makeCols(unit, options?.columns);
  const accentHex = /^#[0-9a-f]{6}$/i.test(options?.accentColor || '')
    ? (options!.accentColor as string).toUpperCase()
    : '#3E1A7D';
  const span = cols.length - 1; // MergeAcross = span cols - 1

  const metaRow = (key: string, val: string) =>
    `<Row><Cell ss:StyleID="m"><Data ss:Type="String">${escXml(key)}</Data></Cell>` +
    `<Cell ss:MergeAcross="${span - 1}"><Data ss:Type="String">${escXml(val)}</Data></Cell></Row>`;

  const headerCells = cols.map(
    c => `<Cell ss:StyleID="h"><Data ss:Type="String">${escXml(c.label)}</Data></Cell>`,
  ).join('');

  const dataRowsArr: string[] = [];
  forEachRow(
    devices,
    (g) =>
      dataRowsArr.push(
        `<Row><Cell ss:StyleID="g" ss:MergeAcross="${cols.length - 1}"><Data ss:Type="String">${escXml(g)}</Data></Cell></Row>`,
      ),
    (d, i) => {
      const r = buildRow(d, i, options?.columns);
      const cells = cols.map(c => {
        const v = escXml(String(r[c.key]));
        return `<Cell><Data ss:Type="String">${v}</Data></Cell>`;
      }).join('');
      dataRowsArr.push(`<Row>${cells}</Row>`);
    },
  );
  const dataRows = dataRowsArr.join('\n');

  // KPIs (mesmos cards do summary da modal) — antes só o PDF os tinha
  const kpiRows = (options?.kpis || [])
    .map((k) => metaRow(k.label, k.sub ? `${k.value}  (${k.sub})` : k.value))
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="h">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="${accentHex}" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="m">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#F0EDF9" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="g">
      <Font ss:Bold="1" ss:Color="#555555"/>
      <Interior ss:Color="#EEEEEE" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escXml(label.slice(0, 31))}">
    <Table>
      ${metaRow('Relatório', label)}
      ${customerName ? metaRow('Cliente', customerName) : ''}
      ${periodLabel ? metaRow('Período', periodLabel) : ''}
      ${metaRow('Gerado em', new Date().toLocaleString('pt-BR'))}
      ${kpiRows ? `<Row/>\n${kpiRows}` : ''}
      <Row/>
      <Row>${headerCells}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

  triggerDownload(
    new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
    `${buildFilenameBase(label, customerName)}.xls`,
  );
}

// ─── PDF (jsPDF) ──────────────────────────────────────────────────────────────

/** KPI exibido na faixa abaixo do header da primeira página. */
export interface GridPdfKpi {
  label: string;
  value: string;
  sub?: string;
}

/** Extensões opcionais do PDF — paleta do dashboard, KPIs e seção de gráfico. */
export interface GridPdfOptions {
  /** Cor de destaque (hex #rrggbb) — banda do header, títulos de coluna. Default: roxo MYIO. */
  accentColor?: string;
  /** Faixa de KPIs na primeira página (mesmos cards do summary da modal). */
  kpis?: GridPdfKpi[];
  /** Gráfico (PNG dataUrl) renderizado em página dedicada ao final. */
  chartImage?: { dataUrl: string; width?: number; height?: number; title?: string } | null;
  /** Ajustes de colunas (relatórios single-device). */
  columns?: GridColumnsOptions | null;
}

type Rgb = [number, number, number];

function hexToRgb(hex: string | undefined, fallback: Rgb): Rgb {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return fallback;
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mistura a cor com branco (pct 0..1 = quanto de branco). */
function tintRgb([r, g, b]: Rgb, pct: number): Rgb {
  const t = (c: number) => Math.round(c + (255 - c) * pct);
  return [t(r), t(g), t(b)];
}

export function exportGridPdf(
  devices: TelemetryDevice[],
  label: string,
  unit: string,
  period?: ExportPeriod | null,
  customerName?: string | null,
  options?: GridPdfOptions | null,
): void {
  // Computed once so every page header shows the same timestamp.
  const generatedAt = new Date().toLocaleString('pt-BR');
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
  const KPI_H    = 16;  // KPI band height (first page, when options.kpis present)

  // Paleta: accent do dashboard (createMyIOTheme) ou roxo MYIO default.
  const ACCENT: Rgb       = hexToRgb(options?.accentColor, [62, 26, 125]);
  const ACCENT_SOFT: Rgb  = tintRgb(ACCENT, 0.88); // fundo dos títulos de coluna
  const ACCENT_FAINT: Rgb = tintRgb(ACCENT, 0.96); // zebra das linhas pares

  const cols = makeCols(unit, options?.columns);

  // Scale column widths to fill TABLE_W exactly
  const rawTotal = cols.reduce((s, c) => s + c.pdfW, 0);
  const scale    = TABLE_W / rawTotal;
  const colWidths = cols.map(c => c.pdfW * scale);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const colX = (ci: number): number =>
    MARGIN + colWidths.slice(0, ci).reduce((s, w) => s + w, 0);

  function drawPageHeader(pageNo: number): void {
    // Top band
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, PW, HDR_H, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const titleText = customerName ? `${customerName} — ${label}` : label;
    doc.text(pdfSafe(titleText), MARGIN, HDR_H / 2 + 1.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const periodLabel = fmtPeriod(period);
    const periodPart = periodLabel ? `Período: ${periodLabel}  •  ` : '';
    const countLabel = options?.columns?.countLabel || 'dispositivo(s)';
    const info =
      `${periodPart}Gerado em: ${generatedAt}  •  ${countDataRows(devices)} ${countLabel}  •  Unidade: ${unit}  •  Pág. ${pageNo}`;
    doc.text(pdfSafe(info), PW - MARGIN, HDR_H / 2 + 1.5, { align: 'right' });
  }

  function drawColumnHeaders(y: number): void {
    doc.setFillColor(...ACCENT_SOFT);
    doc.rect(MARGIN, y, TABLE_W, HEAD_H, 'F');

    doc.setTextColor(...ACCENT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);

    cols.forEach((c, ci) => {
      const x = colX(ci) + 1.5;
      doc.text(pdfSafe(c.label), x, y + HEAD_H / 2 + 2.5);
    });

    doc.setDrawColor(200, 195, 220);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, y, TABLE_W, HEAD_H);
  }

  function drawDataRow(r: RowData, y: number, even: boolean): void {
    if (even) {
      doc.setFillColor(...ACCENT_FAINT);
      doc.rect(MARGIN, y, TABLE_W, ROW_H, 'F');
    }

    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);

    cols.forEach((c, ci) => {
      const x  = colX(ci) + 1.5;
      const maxChars = Math.floor(colWidths[ci] / 1.8);
      const text = truncate(pdfSafe(String(r[c.key])), maxChars);
      doc.text(text, x, y + ROW_H / 2 + 2.2);
    });

    doc.setDrawColor(230, 228, 240);
    doc.setLineWidth(0.1);
    doc.line(MARGIN, y + ROW_H, MARGIN + TABLE_W, y + ROW_H);
  }

  // Cabeçalho de grupo (ex.: "CLIMATIZÁVEL · 16 sensores · média 25,89 °C")
  function drawGroupRow(text: string, y: number): void {
    doc.setFillColor(...ACCENT_SOFT);
    doc.rect(MARGIN, y, TABLE_W, ROW_H, 'F');
    doc.setTextColor(...ACCENT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(truncate(pdfSafe(text), 160), MARGIN + 1.5, y + ROW_H / 2 + 2.2);
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
      `Gerado em ${generatedAt}  —  MyIO`,
      MARGIN,
      PH - FTR_H + 6,
    );
  }

  // Faixa de KPIs (primeira página): cards lado a lado — valor em destaque no
  // accent, label e sub em cinza (mesma leitura do summary da modal).
  function drawKpiBand(y: number, kpis: GridPdfKpi[]): void {
    doc.setFillColor(...ACCENT_FAINT);
    doc.setDrawColor(...ACCENT_SOFT);
    doc.setLineWidth(0.2);
    doc.roundedRect(MARGIN, y, TABLE_W, KPI_H, 1.5, 1.5, 'FD');

    const slot = TABLE_W / kpis.length;
    kpis.forEach((kpi, i) => {
      const cx = MARGIN + slot * i + slot / 2;
      doc.setTextColor(...ACCENT);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(truncate(pdfSafe(kpi.value), 24), cx, y + 6.5, { align: 'center' });
      doc.setTextColor(110, 110, 120);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(truncate(pdfSafe(kpi.label), 34), cx, y + 10.5, { align: 'center' });
      if (kpi.sub) {
        doc.setFontSize(5.5);
        doc.text(truncate(pdfSafe(kpi.sub), 40), cx, y + 13.5, { align: 'center' });
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  let pageNo  = 1;
  let currentY = TABLE_Y;

  drawPageHeader(pageNo);
  if (options?.kpis?.length) {
    drawKpiBand(currentY, options.kpis);
    currentY += KPI_H + 4;
  }
  drawColumnHeaders(currentY);
  currentY += HEAD_H;

  const ensureSpace = () => {
    if (currentY + ROW_H > MAX_Y) {
      drawFooter();
      doc.addPage();
      pageNo++;
      currentY = TABLE_Y;
      drawPageHeader(pageNo);
      drawColumnHeaders(currentY);
      currentY += HEAD_H;
    }
  };

  forEachRow(
    devices,
    (g) => {
      ensureSpace();
      drawGroupRow(g, currentY);
      currentY += ROW_H;
    },
    (d, i) => {
      ensureSpace();
      drawDataRow(buildRow(d, i, options?.columns), currentY, i % 2 === 0);
      currentY += ROW_H;
    },
  );

  drawFooter();

  // Seção do gráfico (página dedicada ao final) — imagem PNG do gráfico da modal.
  const chart = options?.chartImage;
  if (chart?.dataUrl) {
    doc.addPage();
    pageNo++;
    drawPageHeader(pageNo);

    const titleY = TABLE_Y + 2;
    doc.setTextColor(...ACCENT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(pdfSafe(chart.title || 'Participação por Dispositivo'), MARGIN, titleY);

    const imgTop = titleY + 4;
    const availW = TABLE_W;
    const availH = MAX_Y - imgTop;
    const srcW = chart.width || 1200;
    const srcH = chart.height || 900;
    const ratio = Math.min(availW / srcW, availH / srcH);
    const imgW = srcW * ratio;
    const imgH = srcH * ratio;
    try {
      doc.addImage(chart.dataUrl, 'PNG', (PW - imgW) / 2, imgTop + (availH - imgH) / 2, imgW, imgH);
    } catch (err) {
      console.warn('[exportGridPdf] Falha ao embutir o gráfico no PDF:', err);
    }
    drawFooter();
  }

  doc.save(`${buildFilenameBase(label, customerName)}.pdf`);
}
