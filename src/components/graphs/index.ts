/**
 * MYIO Graphs — dependency-free SVG chart components.
 *
 * `createParticipationChart` — share-of-total (participation) chart with two
 * renderers (pie/donut and horizontal bars), selectable legend, InfoTooltip on
 * hover, light/dark themes, PNG/PDF export and fullscreen expand.
 *
 * @example
 * ```typescript
 * import { createParticipationChart } from 'myio-js-library';
 *
 * const chart = createParticipationChart(container, {
 *   title: 'Participação por Dispositivo',
 *   unit: 'kWh',
 *   items: [
 *     { id: 'a', label: 'Loja A', value: 152.4 },
 *     { id: 'b', label: 'Loja B', value: 98.1 },
 *   ],
 * });
 *
 * chart.updateData(newItems);
 * chart.setThemeMode('dark');
 * chart.destroy();
 * ```
 */

export { createParticipationChart } from './createParticipationChart';

export {
  PARTICIPATION_CHART_CSS_PREFIX,
  injectParticipationChartStyles,
} from './styles';

export {
  // Types
  type ParticipationChartType,
  type ParticipationChartThemeMode,
  type ParticipationChartLegendPosition,
  type ParticipationChartPaletteMode,
  type ParticipationChartItem,
  type ParticipationChartThemeColors,
  type ParticipationChartLegendSettings,
  type ParticipationChartExportSettings,
  type ParticipationChartSettings,
  type ParticipationChartParams,
  type ParticipationChartInstance,
  // Constants
  MYIO_CHART_PALETTE,
  MYIO_CHART_PALETTE_DARK,
  DEFAULT_PARTICIPATION_CHART_SETTINGS,
} from './types';
