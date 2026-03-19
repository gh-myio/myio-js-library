/**
 * RFC-0167: On/Off Timeline Chart
 *
 * A standalone SVG-based timeline chart component for visualizing
 * on/off device activations over time.
 *
 * @example
 * ```typescript
 * import {
 *   createOnOffTimelineChart,
 *   renderOnOffTimelineChart,
 *   generateMockOnOffTimelineData,
 * } from 'myio-js-library';
 *
 * // Option 1: Create interactive instance
 * const chart = createOnOffTimelineChart({
 *   container: '#chart-container',
 *   data: myTimelineData,
 *   config: {
 *     themeMode: 'dark',
 *     labels: { on: 'Aberta', off: 'Fechada' },
 *   },
 * });
 *
 * // Update data
 * chart.update(newData);
 *
 * // Change theme
 * chart.setTheme('light');
 *
 * // Cleanup
 * chart.destroy();
 *
 * // Option 2: Render static HTML
 * const html = renderOnOffTimelineChart(data, config);
 * container.innerHTML = html;
 * initOnOffTimelineTooltips(container);
 *
 * // Generate mock data for testing
 * const mockData = generateMockOnOffTimelineData();
 * ```
 */

export {
  createOnOffTimelineChart,
  renderOnOffTimelineChart,
  initOnOffTimelineTooltips,
  generateMockOnOffTimelineData,
} from './OnOffTimelineChart';

export {
  ONOFF_TIMELINE_CSS_PREFIX,
  injectOnOffTimelineStyles,
} from './styles';

export type {
  OnOffActivationPoint,
  OnOffTimelineSegment,
  OnOffTimelineData,
  OnOffTimelineChartConfig,
  OnOffTimelineChartInstance,
  OnOffTimelineChartParams,
} from './types';
