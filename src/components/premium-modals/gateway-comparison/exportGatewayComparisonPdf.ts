/**
 * GatewayComparisonModal — premium PDF export.
 * Multi-central connectivity report: hero band, a "Centrais comparadas" card
 * (wrapped, so a long list of names never runs off the page), a consolidated
 * KPI stat row (overall average latency + online/offline % across VISIBLE
 * centrals only, mirroring the eye-toggle behavior in the modal itself), a
 * per-central breakdown card, and the comparison chart embedded as an image.
 * See `pdfLayout.ts` for the shared visual language, modeled on
 * `docs/shared/myio_release_notes_alarmes_v0.1.446.html`.
 */

import { jsPDF } from 'jspdf';
import { formatLatency, calculateUptimeStats, type GatewayLatencyStats } from '../gateway/utils';
import {
  PDF_GREEN,
  PDF_RED,
  pdfHeroHeader,
  pdfHeadline,
  pdfCard,
  pdfStatRow,
  pdfListCard,
  pdfFooterBand,
  pdfEmbedChartImage,
  type PdfCursor,
} from '../gateway/pdfLayout';

export interface GatewayComparisonPdfCentral {
  label: string;
  stats: GatewayLatencyStats;
  /** True when the eye-toggle hid this central — excluded from the consolidated KPI, but still listed (marked "oculta"). */
  hidden: boolean;
}

export interface GatewayComparisonPdfOptions {
  centrals: GatewayComparisonPdfCentral[];
  customerName?: string;
  /** Filename-safe (dashes, no colons) — date only. Kept separate from `startTs`/`endTs` (used for the human-readable "Período" line, which includes the time). */
  startDateStr: string;
  endDateStr: string;
  startTs: number;
  endTs: number;
  chartCanvas?: HTMLCanvasElement | null;
  /** Test-only determinism override. */
  now?: Date;
}

/** Generates and saves (via jsPDF's `.save()`) a multi-central comparison PDF report. Returns the filename used. */
export function exportGatewayComparisonPdf(options: GatewayComparisonPdfOptions): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cursor: PdfCursor = { y: 14 };
  const now = options.now ?? new Date();
  const visible = options.centrals.filter((c) => !c.hidden);
  const filename = `comparacao_conectividade_${options.startDateStr}_${options.endDateStr}.pdf`;

  pdfHeroHeader(doc, cursor, {
    badgeText: 'RELATÓRIO · COMPARAÇÃO',
    metaLine: `Gerado em ${now.toLocaleString('pt-BR')}`,
  });

  const periodText = `${new Date(options.startTs).toLocaleString('pt-BR')} até ${new Date(options.endTs).toLocaleString('pt-BR')}`;
  pdfHeadline(
    doc,
    cursor,
    'Comparação de Conectividade',
    `${options.customerName ? options.customerName + ' — ' : ''}Período: ${periodText}`
  );

  pdfCard(doc, cursor, {
    title: `Centrais comparadas (${options.centrals.length})`,
    lines: [options.centrals.map((c) => c.label).join(', ')],
  });

  const avgValues = visible.map((c) => c.stats.avg).filter((v): v is number => v != null);
  const overallAvg = avgValues.length > 0 ? Math.round(avgValues.reduce((a, b) => a + b, 0) / avgValues.length) : null;

  let totalOfflineHours = 0;
  let totalOnlineHours = 0;
  let uptimeSampleCount = 0;
  visible.forEach((c) => {
    const uptime = calculateUptimeStats(c.stats, options.startTs, options.endTs);
    if (uptime.hasData) {
      totalOfflineHours += uptime.offlineHours;
      totalOnlineHours += uptime.onlineHours;
      uptimeSampleCount++;
    }
  });
  const anyUptimeData = uptimeSampleCount > 0;
  const totalCapacityHours = totalOnlineHours + totalOfflineHours;
  const offlinePercent = anyUptimeData && totalCapacityHours > 0 ? (totalOfflineHours / totalCapacityHours) * 100 : null;
  const onlinePercent = offlinePercent != null ? 100 - offlinePercent : null;

  pdfStatRow(doc, cursor, [
    { label: 'Média Geral de Latência', value: overallAvg != null ? formatLatency(overallAvg) : 'N/A' },
    { label: 'Disponibilidade', value: onlinePercent != null ? `${onlinePercent.toFixed(1)}%` : 'N/A', valueColor: PDF_GREEN },
    { label: 'Indisponibilidade', value: offlinePercent != null ? `${offlinePercent.toFixed(1)}%` : 'N/A', valueColor: PDF_RED },
    { label: 'Centrais Visíveis', value: `${visible.length} / ${options.centrals.length}` },
  ]);

  pdfListCard(
    doc,
    cursor,
    'Estatísticas por Central',
    options.centrals.map((c) => ({
      heading: `${c.label}${c.hidden ? ' (oculta na comparação)' : ''}`,
      body:
        c.stats.count > 0
          ? `Média ${formatLatency(c.stats.avg)} · Min ${formatLatency(c.stats.min)} · Max ${formatLatency(c.stats.max)} · Leituras ${c.stats.count}${
              c.stats.gaps > 0 ? ` · Falhas ${c.stats.gaps}` : ''
            }`
          : 'Sem dados no período',
    }))
  );

  if (options.chartCanvas) {
    pdfHeadline(doc, cursor, 'Gráfico Comparativo');
    pdfEmbedChartImage(doc, cursor, options.chartCanvas);
  }

  pdfFooterBand(doc, options.customerName);
  doc.save(filename);
  return filename;
}
