/**
 * GatewayModal — premium PDF export.
 * Single-central connectivity report: hero band, KPI stat rows (latency +
 * uptime), and the rendered chart embedded as an image. See `pdfLayout.ts`
 * for the shared visual language, modeled on
 * `docs/shared/myio_release_notes_alarmes_v0.1.446.html`.
 */

import { jsPDF } from 'jspdf';
import { formatLatency, type GatewayLatencyStats, type GatewayUptimeStats } from './utils';
import {
  PDF_GREEN,
  PDF_RED,
  pdfHeroHeader,
  pdfHeadline,
  pdfStatRow,
  pdfFooterBand,
  pdfEmbedChartImage,
  type PdfCursor,
} from './pdfLayout';

export interface GatewayPdfOptions {
  label: string;
  customerName?: string;
  /** Filename-safe (dashes, no colons) — date only. Kept separate from `startTs`/`endTs` (used for the human-readable "Período" line, which includes the time). */
  startDateStr: string;
  endDateStr: string;
  /** ms epoch — used to render the "Período" line with date AND time (not just the date). */
  startTs: number;
  endTs: number;
  stats: GatewayLatencyStats;
  uptime: GatewayUptimeStats;
  currentLatencyMs?: number | null;
  targetLatencyMs?: number | null;
  chartCanvas?: HTMLCanvasElement | null;
  /** Test-only determinism override. */
  now?: Date;
}

/** Generates and saves (via jsPDF's `.save()`) a single-central connectivity PDF report. Returns the filename used. */
export function exportGatewayPdf(options: GatewayPdfOptions): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cursor: PdfCursor = { y: 14 };
  const now = options.now ?? new Date();
  const filename = `relatorio_conectividade_${options.label.replace(/\s+/g, '_')}_${options.startDateStr}_${options.endDateStr}.pdf`;

  pdfHeroHeader(doc, cursor, {
    badgeText: 'RELATÓRIO · CONECTIVIDADE',
    metaLine: `Gerado em ${now.toLocaleString('pt-BR')}`,
  });

  const periodText = `${new Date(options.startTs).toLocaleString('pt-BR')} até ${new Date(options.endTs).toLocaleString('pt-BR')}`;
  pdfHeadline(
    doc,
    cursor,
    'Relatório de Conectividade',
    `${options.label}${options.customerName ? ' · ' + options.customerName : ''} — Período: ${periodText}`
  );

  pdfStatRow(doc, cursor, [
    { label: 'Latência Atual', value: options.currentLatencyMs != null ? formatLatency(options.currentLatencyMs) : 'N/A' },
    { label: 'Média do Período', value: options.stats.count > 0 ? formatLatency(options.stats.avg) : 'N/A' },
    {
      label: 'Mín / Máx',
      value: options.stats.count > 0 ? `${formatLatency(options.stats.min)} / ${formatLatency(options.stats.max)}` : 'N/A',
    },
    { label: 'Alvo (SLA)', value: options.targetLatencyMs != null ? `${options.targetLatencyMs}ms` : '—' },
  ]);

  pdfStatRow(
    doc,
    cursor,
    options.uptime.hasData
      ? [
          { label: 'Disponibilidade', value: `${options.uptime.onlinePercent.toFixed(1)}%`, valueColor: PDF_GREEN },
          { label: 'Horas Online', value: `${options.uptime.onlineHours.toFixed(1)}h` },
          { label: 'Indisponibilidade', value: `${options.uptime.offlinePercent.toFixed(1)}%`, valueColor: PDF_RED },
          { label: 'Horas Offline', value: `${options.uptime.offlineHours.toFixed(1)}h` },
        ]
      : [{ label: 'Disponibilidade', value: 'Sem dados suficientes no período' }]
  );

  if (options.chartCanvas) {
    pdfHeadline(doc, cursor, 'Histórico de Latência');
    pdfEmbedChartImage(doc, cursor, options.chartCanvas);
  }

  pdfFooterBand(doc, options.customerName);
  doc.save(filename);
  return filename;
}
