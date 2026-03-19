/**
 * RFC-0152 Phase 5: Operational Dashboard Styles
 * CSS-in-JS styles for the management dashboard component
 */

export const OPERATIONAL_DASHBOARD_STYLES = `
  /* Root Container */
  .myio-dashboard-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: transparent;
    color: var(--ink-1, #f1f5f9);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: auto;
    padding: 0;
    box-sizing: border-box;
  }

  .myio-dashboard-root[data-theme="light"] {
    --bg-primary: #f8fafc;
    --bg-card: #ffffff;
    --ink-1: #1e293b;
    --ink-2: #64748b;
    --border-color: #e2e8f0;
  }

  .myio-dashboard-root[data-theme="dark"] {
    --bg-primary: #0f172a;
    --bg-card: #1e293b;
    --ink-1: #f1f5f9;
    --ink-2: #94a3b8;
    --border-color: #334155;
  }

  /* Header */
  .myio-dashboard-root .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0 16px 0;
    border-bottom: 1px solid var(--border-color, #334155);
    margin-bottom: 20px;
  }

  .myio-dashboard-root .dashboard-header h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--ink-1, #f1f5f9);
  }

  .myio-dashboard-root .header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .myio-dashboard-root .period-select {
    padding: 8px 32px 8px 12px;
    border: 1px solid var(--border-color, #334155);
    border-radius: 8px;
    background: var(--bg-card, #1e293b);
    color: var(--ink-1, #f1f5f9);
    font-size: 13px;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
  }

  .myio-dashboard-root .period-select:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  .myio-dashboard-root .refresh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--border-color, #334155);
    border-radius: 8px;
    background: var(--bg-card, #1e293b);
    color: var(--ink-2, #94a3b8);
    cursor: pointer;
    font-size: 16px;
    transition: all 0.15s ease;
  }

  .myio-dashboard-root .refresh-btn:hover {
    background: #8b5cf6;
    border-color: #8b5cf6;
    color: white;
  }

  .myio-dashboard-root .refresh-btn.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* KPI Grid */
  .myio-dashboard-root .kpi-grid {
    display: grid;
    gap: 16px;
    margin-bottom: 20px;
  }

  .myio-dashboard-root .kpi-grid.primary {
    grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr;
  }

  .myio-dashboard-root .kpi-grid.secondary {
    grid-template-columns: repeat(4, 1fr);
  }

  /* KPI Card */
  .myio-dashboard-root .kpi-card {
    background: var(--bg-card, #1e293b);
    border: 1px solid var(--border-color, #334155);
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    position: relative;
    transition: all 0.2s ease;
  }

  .myio-dashboard-root .kpi-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }

  .myio-dashboard-root .kpi-card.large {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.2) 100%);
    border-color: #8b5cf6;
  }

  .myio-dashboard-root .kpi-card .kpi-icon {
    font-size: 26px;
    line-height: 1;
    flex-shrink: 0;
  }

  .myio-dashboard-root .kpi-card.large .kpi-icon {
    font-size: 38px;
  }

  .myio-dashboard-root .kpi-card .kpi-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .myio-dashboard-root .kpi-card .kpi-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--ink-1, #f1f5f9);
    line-height: 1.2;
  }

  .myio-dashboard-root .kpi-card.large .kpi-value {
    font-size: 28px;
    color: #8b5cf6;
  }

  .myio-dashboard-root .kpi-card .kpi-label {
    font-size: 10px;
    color: var(--ink-2, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .myio-dashboard-root .kpi-card .kpi-sublabel {
    font-size: 9px;
    color: var(--ink-2, #94a3b8);
    opacity: 0.7;
  }

  .myio-dashboard-root .kpi-card .kpi-trend {
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .myio-dashboard-root .kpi-card .kpi-trend.positive {
    color: #22c55e;
  }

  .myio-dashboard-root .kpi-card .kpi-trend.negative {
    color: #ef4444;
  }

  /* Secondary KPI Cards (small) */
  .myio-dashboard-root .kpi-card.small {
    flex-direction: column;
    text-align: center;
    padding: 10px;
    gap: 4px;
  }

  .myio-dashboard-root .kpi-card.small .kpi-value {
    font-size: 20px;
    margin-bottom: 2px;
  }

  .myio-dashboard-root .kpi-card.small .kpi-label {
    font-size: 10px;
  }

  .myio-dashboard-root .kpi-card.small .kpi-indicator {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 0 0 10px 10px;
  }

  .myio-dashboard-root .kpi-card.online .kpi-value { color: #22c55e; }
  .myio-dashboard-root .kpi-card.offline .kpi-value { color: #ef4444; }
  .myio-dashboard-root .kpi-card.maintenance .kpi-value { color: #f59e0b; }

  /* Average Availability Card */
  .myio-dashboard-root .kpi-card.avg-availability {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.15) 100%);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .myio-dashboard-root .kpi-card.avg-availability .kpi-value {
    color: #22c55e;
  }

  /* Alerts Card */
  .myio-dashboard-root .kpi-card.alerts {
    background: var(--bg-card, #1e293b);
    border-color: var(--border-color, #334155);
  }

  .myio-dashboard-root .kpi-card.alerts .kpi-value {
    color: var(--ink-2, #94a3b8);
  }

  .myio-dashboard-root .kpi-card.alerts.has-alerts {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.2) 100%);
    border-color: #ef4444;
    animation: alertPulse 2s ease-in-out infinite;
  }

  .myio-dashboard-root .kpi-card.alerts.has-alerts .kpi-value {
    color: #ef4444;
  }

  @keyframes alertPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.2); }
    50% { box-shadow: 0 0 12px 4px rgba(239, 68, 68, 0.3); }
  }

  /* MTBF Card */
  .myio-dashboard-root .kpi-card.mtbf {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.15) 100%);
    border-color: rgba(59, 130, 246, 0.4);
  }

  .myio-dashboard-root .kpi-card.mtbf .kpi-value {
    color: #3b82f6;
  }

  /* MTTR Card */
  .myio-dashboard-root .kpi-card.mttr {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.15) 100%);
    border-color: rgba(245, 158, 11, 0.4);
  }

  .myio-dashboard-root .kpi-card.mttr .kpi-value {
    color: #f59e0b;
  }

  /* Charts Grid */
  .myio-dashboard-root .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    flex: 1;
    min-height: 0;
  }

  .myio-dashboard-root .chart-tile {
    background: var(--bg-card, #1e293b);
    border: 1px solid var(--border-color, #334155);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
  }

  .myio-dashboard-root .chart-tile h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-1, #f1f5f9);
  }

  .myio-dashboard-root .chart-area {
    flex: 1;
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* SVG Charts */
  .myio-dashboard-root .chart-svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .myio-dashboard-root .chart-line {
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .myio-dashboard-root .chart-line.primary {
    stroke: #8b5cf6;
  }

  .myio-dashboard-root .chart-line.secondary {
    stroke: #f59e0b;
  }

  .myio-dashboard-root .chart-area-fill {
    fill: url(#areaGradient);
    opacity: 0.3;
  }

  .myio-dashboard-root .chart-dot {
    fill: #8b5cf6;
    stroke: var(--bg-card, #1e293b);
    stroke-width: 2;
  }

  .myio-dashboard-root .chart-label {
    font-size: 9px;
    fill: var(--ink-2, #94a3b8);
    text-anchor: middle;
  }

  .myio-dashboard-root .chart-grid-line {
    stroke: var(--border-color, #334155);
    stroke-width: 1;
    stroke-dasharray: 2 4;
  }

  /* Availability Chart (RFC-0156 Enhanced) */
  .myio-dashboard-root .availability-chart-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    height: 100%;
    position: relative;
  }

  .myio-dashboard-root .avail-chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;
  }

  .myio-dashboard-root .avail-subtitle {
    font-size: 10px;
    color: var(--ink-2, #94a3b8);
  }

  .myio-dashboard-root .avail-formula {
    font-size: 10px;
    color: var(--ink-2, #94a3b8);
    cursor: help;
    opacity: 0.7;
  }

  .myio-dashboard-root .avail-formula:hover {
    opacity: 1;
  }

  .myio-dashboard-root .availability-chart-svg {
    width: 100%;
    flex: 1;
    min-height: 160px;
  }

  .myio-dashboard-root .avail-line {
    fill: none;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .myio-dashboard-root .avail-area {
    opacity: 0.5;
  }

  .myio-dashboard-root .avail-dot {
    stroke: var(--bg-card, #1e293b);
    stroke-width: 2;
    cursor: pointer;
    transition: r 0.15s ease;
  }

  .myio-dashboard-root .avail-dot:hover {
    r: 6;
  }

  .myio-dashboard-root .sla-line {
    stroke: #8b5cf6;
    stroke-width: 1.5;
    stroke-dasharray: 6 3;
  }

  .myio-dashboard-root .sla-label {
    font-size: 9px;
    fill: #8b5cf6;
    font-weight: 600;
  }

  .myio-dashboard-root .avg-line {
    stroke: #64748b;
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }

  .myio-dashboard-root .avg-label {
    font-size: 8px;
    fill: var(--ink-2, #94a3b8);
  }

  .myio-dashboard-root .zone-critical { pointer-events: none; }
  .myio-dashboard-root .zone-warning { pointer-events: none; }
  .myio-dashboard-root .zone-good { pointer-events: none; }

  .myio-dashboard-root .event-marker {
    cursor: pointer;
  }

  .myio-dashboard-root .event-marker circle {
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
  }

  .myio-dashboard-root .avail-chart-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-primary, #0f172a);
    border-radius: 8px;
    margin-top: 4px;
  }

  .myio-dashboard-root .avail-stats {
    display: flex;
    gap: 16px;
  }

  .myio-dashboard-root .avail-stats .stat {
    font-size: 11px;
    color: var(--ink-2, #94a3b8);
  }

  .myio-dashboard-root .avail-stats .stat strong {
    color: var(--ink-1, #f1f5f9);
  }

  .myio-dashboard-root .avail-stats .stat.warning strong {
    color: #f59e0b;
  }

  .myio-dashboard-root .status-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .myio-dashboard-root .status-badge.good {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .myio-dashboard-root .status-badge.warning {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  /* RFC-0156 Feedback: Clickable badge with CTA */
  .myio-dashboard-root .status-badge.clickable {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 12px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .myio-dashboard-root .status-badge.clickable:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  }

  .myio-dashboard-root .badge-cta {
    font-size: 8px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    opacity: 0.9;
  }

  /* RFC-0156 Feedback: Header actions container */
  .myio-dashboard-root .avail-header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* RFC-0156 Feedback: Scale toggle button */
  .myio-dashboard-root .scale-toggle {
    font-size: 9px;
    padding: 4px 8px;
    border: 1px solid var(--border-color, #334155);
    border-radius: 4px;
    background: var(--bg-card, #1e293b);
    color: var(--ink-2, #94a3b8);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .myio-dashboard-root .scale-toggle:hover {
    background: rgba(139, 92, 246, 0.1);
    border-color: #8b5cf6;
    color: #8b5cf6;
  }

  /* RFC-0156 Feedback: Trend line */
  .myio-dashboard-root .trend-line {
    pointer-events: none;
  }

  /* RFC-0156 Feedback: Trend indicator badge */
  .myio-dashboard-root .trend-indicator-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 10px;
    margin-left: 8px;
  }

  .myio-dashboard-root .trend-indicator-badge.improving {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .myio-dashboard-root .trend-indicator-badge.worsening {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .myio-dashboard-root .trend-indicator-badge.stable {
    background: rgba(148, 163, 184, 0.15);
    color: #94a3b8;
  }

  /* RFC-0156 Feedback: Event marker hierarchy with critical animation */
  .myio-dashboard-root .event-marker.critical-event circle,
  .myio-dashboard-root .event-marker circle.critical-event {
    animation: pulse-critical 1.5s ease-in-out infinite;
  }

  @keyframes pulse-critical {
    0%, 100% {
      filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.6));
    }
    50% {
      filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.9));
    }
  }

  /* Availability Tooltip */
  .myio-dashboard-root .avail-tooltip {
    position: fixed;
    z-index: 10000;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11px;
    color: #f1f5f9;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.1s ease, visibility 0.1s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-width: 220px;
  }

  .myio-dashboard-root .avail-tooltip.visible {
    opacity: 1;
    visibility: visible;
  }

  .myio-dashboard-root .avail-tooltip .tooltip-title {
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 6px;
  }

  .myio-dashboard-root .avail-tooltip .tooltip-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 0;
  }

  .myio-dashboard-root .avail-tooltip .tooltip-label {
    color: #94a3b8;
  }

  .myio-dashboard-root .avail-tooltip .tooltip-value {
    color: #f1f5f9;
    font-weight: 500;
  }

  .myio-dashboard-root .avail-tooltip .tooltip-divider {
    height: 1px;
    background: #475569;
    margin: 6px 0;
  }

  .myio-dashboard-root .avail-tooltip .tooltip-event {
    font-size: 10px;
    color: #f59e0b;
    font-style: italic;
  }

  /* Light Theme Availability Chart */
  .myio-dashboard-root[data-theme="light"] .avail-tooltip {
    background: rgba(255, 255, 255, 0.98);
    border-color: #e2e8f0;
    color: #1e293b;
  }

  .myio-dashboard-root[data-theme="light"] .avail-tooltip .tooltip-label {
    color: #64748b;
  }

  .myio-dashboard-root[data-theme="light"] .avail-tooltip .tooltip-value {
    color: #1e293b;
  }

  .myio-dashboard-root[data-theme="light"] .avail-chart-footer {
    background: #f1f5f9;
  }

  /* Donut Chart (RFC-0155 Enhanced) */
  .myio-dashboard-root .donut-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .myio-dashboard-root .donut-container.enhanced {
    position: relative;
  }

  .myio-dashboard-root .donut-container .chart-period {
    font-size: 10px;
    color: var(--ink-2, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: center;
  }

  .myio-dashboard-root .donut-main {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .myio-dashboard-root .donut-svg {
    width: 120px;
    height: 120px;
    flex-shrink: 0;
  }

  .myio-dashboard-root .donut-segment {
    fill: none;
    stroke-width: 20;
    stroke-linecap: round;
    cursor: pointer;
    transition: opacity 0.2s ease, stroke-width 0.2s ease;
  }

  .myio-dashboard-root .donut-segment:hover,
  .myio-dashboard-root .donut-segment.highlighted {
    stroke-width: 24;
    opacity: 0.9;
  }

  .myio-dashboard-root .donut-segment.critical {
    animation: criticalPulse 2s ease-in-out infinite;
  }

  @keyframes criticalPulse {
    0%, 100% { stroke-opacity: 1; }
    50% { stroke-opacity: 0.7; }
  }

  .myio-dashboard-root .donut-center {
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .myio-dashboard-root .donut-center .value {
    font-size: 20px;
    font-weight: 700;
    fill: var(--ink-1, #f1f5f9);
  }

  .myio-dashboard-root .donut-center .label {
    font-size: 10px;
    fill: var(--ink-2, #94a3b8);
  }

  /* Enhanced Legend */
  .myio-dashboard-root .donut-legend {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .myio-dashboard-root .donut-legend.enhanced {
    gap: 10px;
  }

  .myio-dashboard-root .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 6px;
    transition: background 0.15s ease;
  }

  .myio-dashboard-root .legend-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .myio-dashboard-root .legend-item.critical {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .myio-dashboard-root .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .myio-dashboard-root .legend-dot.online { background: #22c55e; }
  .myio-dashboard-root .legend-dot.offline { background: #ef4444; }
  .myio-dashboard-root .legend-dot.maintenance { background: #f59e0b; }

  .myio-dashboard-root .legend-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .myio-dashboard-root .legend-label {
    color: var(--ink-1, #f1f5f9);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .myio-dashboard-root .legend-metrics {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .myio-dashboard-root .legend-value {
    font-weight: 600;
    color: var(--ink-1, #f1f5f9);
  }

  .myio-dashboard-root .legend-pct {
    font-size: 10px;
    color: var(--ink-2, #94a3b8);
  }

  .myio-dashboard-root .trend-indicator {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 4px;
  }

  .myio-dashboard-root .trend-indicator.trend-up {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
  }

  .myio-dashboard-root .trend-indicator.trend-down {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .myio-dashboard-root .critical-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 700;
  }

  /* Complementary Indicators */
  .myio-dashboard-root .status-indicators {
    display: flex;
    justify-content: space-around;
    padding: 10px 0;
    border-top: 1px solid var(--border-color, #334155);
    margin-top: 4px;
  }

  .myio-dashboard-root .status-indicators .indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 10px;
    border-radius: 6px;
  }

  .myio-dashboard-root .status-indicators .indicator.warning {
    background: rgba(239, 68, 68, 0.1);
  }

  .myio-dashboard-root .status-indicators .indicator.ok {
    background: rgba(34, 197, 94, 0.05);
  }

  .myio-dashboard-root .status-indicators .indicator.availability {
    background: rgba(139, 92, 246, 0.1);
  }

  .myio-dashboard-root .status-indicators .indicator-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink-1, #f1f5f9);
  }

  .myio-dashboard-root .status-indicators .indicator.warning .indicator-value {
    color: #ef4444;
  }

  .myio-dashboard-root .status-indicators .indicator.availability .indicator-value {
    color: #8b5cf6;
  }

  .myio-dashboard-root .status-indicators .indicator-label {
    font-size: 9px;
    color: var(--ink-2, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    text-align: center;
  }

  /* RFC-0155 Feedback: Clickable indicators */
  .myio-dashboard-root .status-indicators .indicator.clickable {
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .myio-dashboard-root .status-indicators .indicator.clickable:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .myio-dashboard-root .legend-item.clickable {
    cursor: pointer;
  }

  .myio-dashboard-root .legend-item.clickable:hover {
    background: rgba(139, 92, 246, 0.1);
    border-radius: 6px;
  }

  /* RFC-0155 Feedback: SLA reference in availability indicator */
  .myio-dashboard-root .status-indicators .indicator.availability {
    min-width: 90px;
  }

  .myio-dashboard-root .status-indicators .indicator.availability.below-sla {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .myio-dashboard-root .status-indicators .indicator.availability.above-sla {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .myio-dashboard-root .status-indicators .indicator.availability.below-sla .indicator-value {
    color: #ef4444;
  }

  .myio-dashboard-root .status-indicators .indicator.availability.above-sla .indicator-value {
    color: #22c55e;
  }

  .myio-dashboard-root .availability-main {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .myio-dashboard-root .availability-trend {
    font-size: 11px;
    font-weight: 600;
  }

  .myio-dashboard-root .availability-trend.trend-positive {
    color: #22c55e;
  }

  .myio-dashboard-root .availability-trend.trend-negative {
    color: #ef4444;
  }

  .myio-dashboard-root .sla-reference {
    font-size: 8px;
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 2px;
  }

  .myio-dashboard-root .sla-reference.ok {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .myio-dashboard-root .sla-reference.warning {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  /* RFC-0155 Feedback: Legend hierarchy details */
  .myio-dashboard-root .legend-hierarchy {
    display: block;
    font-size: 9px;
    color: var(--ink-2, #94a3b8);
    margin-top: 1px;
    font-style: italic;
  }

  .myio-dashboard-root .legend-item.critical .legend-hierarchy {
    color: #ef4444;
  }

  /* Status Tooltip */
  .myio-dashboard-root .status-tooltip {
    position: fixed;
    z-index: 10000;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11px;
    color: #f1f5f9;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.1s ease, visibility 0.1s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-width: 200px;
  }

  .myio-dashboard-root .status-tooltip.visible {
    opacity: 1;
    visibility: visible;
  }

  .myio-dashboard-root .status-tooltip .tooltip-title {
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 6px;
  }

  .myio-dashboard-root .status-tooltip .tooltip-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 0;
  }

  .myio-dashboard-root .status-tooltip .tooltip-label {
    color: #94a3b8;
  }

  .myio-dashboard-root .status-tooltip .tooltip-value {
    color: #f1f5f9;
    font-weight: 500;
  }

  /* Light Theme Status */
  .myio-dashboard-root[data-theme="light"] .status-tooltip {
    background: rgba(255, 255, 255, 0.98);
    border-color: #e2e8f0;
    color: #1e293b;
  }

  .myio-dashboard-root[data-theme="light"] .status-tooltip .tooltip-label {
    color: #64748b;
  }

  .myio-dashboard-root[data-theme="light"] .status-tooltip .tooltip-value {
    color: #1e293b;
  }

  .myio-dashboard-root[data-theme="light"] .legend-item:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  /* Downtime List */
  .myio-dashboard-root .downtime-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
    overflow-y: auto;
  }

  .myio-dashboard-root .downtime-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--bg-primary, #0f172a);
    border-radius: 8px;
  }

  .myio-dashboard-root .downtime-item .rank {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--border-color, #334155);
    border-radius: 50%;
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-1, #f1f5f9);
    flex-shrink: 0;
  }

  .myio-dashboard-root .downtime-item:nth-child(1) .rank { background: #ef4444; }
  .myio-dashboard-root .downtime-item:nth-child(2) .rank { background: #f59e0b; }
  .myio-dashboard-root .downtime-item:nth-child(3) .rank { background: #eab308; }

  .myio-dashboard-root .downtime-item .item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 100px;
  }

  .myio-dashboard-root .downtime-item .item-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-1, #f1f5f9);
  }

  .myio-dashboard-root .downtime-item .item-location {
    font-size: 10px;
    color: var(--ink-2, #94a3b8);
  }

  .myio-dashboard-root .downtime-item .item-metrics {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .myio-dashboard-root .downtime-item .downtime-hours {
    font-size: 13px;
    font-weight: 600;
    color: #ef4444;
    min-width: 40px;
    text-align: right;
  }

  .myio-dashboard-root .downtime-item .downtime-bar {
    flex: 1;
    height: 6px;
    background: var(--border-color, #334155);
    border-radius: 3px;
    overflow: hidden;
  }

  .myio-dashboard-root .downtime-item .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #ef4444 0%, #f59e0b 100%);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .myio-dashboard-root .downtime-item .downtime-percentage {
    font-size: 11px;
    color: var(--ink-2, #94a3b8);
    min-width: 40px;
    text-align: right;
  }

  /* MTBF Timeline Chart (RFC-0154) */
  .myio-dashboard-root .mtbf-timeline-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    height: 100%;
    position: relative;
  }

  .myio-dashboard-root .mtbf-timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-primary, #0f172a);
    border-radius: 8px;
    font-size: 11px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .myio-dashboard-root .mtbf-timeline-header .header-period {
    color: var(--ink-1, #f1f5f9);
    font-weight: 600;
  }

  .myio-dashboard-root .mtbf-timeline-header .header-stats {
    color: var(--ink-2, #94a3b8);
  }

  .myio-dashboard-root .mtbf-timeline-svg {
    width: 100%;
    flex: 1;
    min-height: 140px;
  }

  .myio-dashboard-root .mtbf-segment.operating {
    transition: opacity 0.2s ease;
    cursor: pointer;
  }

  .myio-dashboard-root .mtbf-segment.operating:hover {
    opacity: 0.85;
  }

  .myio-dashboard-root .mtbf-segment.stopped {
    cursor: pointer;
  }

  .myio-dashboard-root .mtbf-segment.stopped:hover {
    opacity: 0.85;
  }

  .myio-dashboard-root .mtbf-segment.maintenance {
    cursor: pointer;
  }

  .myio-dashboard-root .failure-marker {
    cursor: pointer;
  }

  .myio-dashboard-root .duration-label {
    pointer-events: none;
  }

  .myio-dashboard-root .tooltip-trigger {
    cursor: pointer;
  }

  /* MTBF Calculation Display */
  .myio-dashboard-root .mtbf-calculation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.15) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 8px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .myio-dashboard-root .mtbf-calculation .calc-formula {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .myio-dashboard-root .mtbf-calculation .calc-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-2, #94a3b8);
  }

  .myio-dashboard-root .mtbf-calculation .calc-values {
    font-size: 12px;
    color: var(--ink-1, #f1f5f9);
  }

  .myio-dashboard-root .mtbf-calculation .calc-result {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .myio-dashboard-root .mtbf-calculation .result-badge {
    background: #7c3aed;
    color: white;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
  }

  .myio-dashboard-root .mtbf-calculation .result-label {
    font-size: 10px;
    color: var(--ink-2, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* MTBF Legend */
  .myio-dashboard-root .mtbf-legend {
    display: flex;
    justify-content: center;
    gap: 20px;
    padding: 8px 0;
    flex-wrap: wrap;
  }

  .myio-dashboard-root .mtbf-legend .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--ink-2, #94a3b8);
  }

  .myio-dashboard-root .mtbf-legend .legend-color {
    width: 14px;
    height: 14px;
    border-radius: 3px;
  }

  .myio-dashboard-root .mtbf-legend .legend-color.operating {
    background: #22c55e;
  }

  .myio-dashboard-root .mtbf-legend .legend-color.stopped {
    background: #ef4444;
  }

  .myio-dashboard-root .mtbf-legend .legend-color.maintenance {
    background: #f59e0b;
  }

  /* MTBF Empty/No Failures States */
  .myio-dashboard-root .mtbf-timeline-empty,
  .myio-dashboard-root .mtbf-timeline-no-failures {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px 20px;
    text-align: center;
    flex: 1;
  }

  .myio-dashboard-root .mtbf-timeline-empty .empty-icon,
  .myio-dashboard-root .mtbf-timeline-no-failures .success-icon {
    font-size: 40px;
    margin-bottom: 12px;
  }

  .myio-dashboard-root .mtbf-timeline-empty .empty-message {
    color: var(--ink-2, #94a3b8);
    font-size: 13px;
    margin: 0;
  }

  .myio-dashboard-root .mtbf-timeline-no-failures .success-message {
    color: #22c55e;
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px 0;
  }

  .myio-dashboard-root .mtbf-timeline-no-failures .success-detail {
    color: var(--ink-2, #94a3b8);
    font-size: 12px;
    margin: 0;
  }

  /* MTBF Timeline Tooltip */
  .myio-dashboard-root .mtbf-tooltip {
    position: fixed;
    z-index: 10000;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11px;
    color: #f1f5f9;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.1s ease, visibility 0.1s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-width: 220px;
    white-space: nowrap;
  }

  .myio-dashboard-root .mtbf-tooltip.visible {
    opacity: 1;
    visibility: visible;
  }

  .myio-dashboard-root .mtbf-tooltip .tooltip-title {
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .myio-dashboard-root .mtbf-tooltip .tooltip-title.operating {
    color: #22c55e;
  }

  .myio-dashboard-root .mtbf-tooltip .tooltip-title.stopped {
    color: #ef4444;
  }

  .myio-dashboard-root .mtbf-tooltip .tooltip-title.maintenance {
    color: #f59e0b;
  }

  .myio-dashboard-root .mtbf-tooltip .tooltip-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 0;
  }

  .myio-dashboard-root .mtbf-tooltip .tooltip-label {
    color: #94a3b8;
  }

  .myio-dashboard-root .mtbf-tooltip .tooltip-value {
    color: #f1f5f9;
    font-weight: 500;
  }

  .myio-dashboard-root .mtbf-tooltip .tooltip-divider {
    height: 1px;
    background: #475569;
    margin: 6px 0;
  }

  /* Light Theme Tooltip */
  .myio-dashboard-root[data-theme="light"] .mtbf-tooltip {
    background: rgba(255, 255, 255, 0.98);
    border-color: #e2e8f0;
    color: #1e293b;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .myio-dashboard-root[data-theme="light"] .mtbf-tooltip .tooltip-label {
    color: #64748b;
  }

  .myio-dashboard-root[data-theme="light"] .mtbf-tooltip .tooltip-value {
    color: #1e293b;
  }

  .myio-dashboard-root[data-theme="light"] .mtbf-tooltip .tooltip-divider {
    background: #e2e8f0;
  }

  /* Light Theme */
  .myio-dashboard-root[data-theme="light"] .mtbf-timeline-header {
    background: #f1f5f9;
  }

  .myio-dashboard-root[data-theme="light"] .mtbf-timeline-svg text {
    fill: #1e293b;
  }

  .myio-dashboard-root[data-theme="light"] .mtbf-segment.operating {
    fill: #22c55e;
  }

  .myio-dashboard-root[data-theme="light"] .mtbf-calculation {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(139, 92, 246, 0.1) 100%);
  }

  .myio-dashboard-root .no-data {
    color: var(--ink-2, #94a3b8);
    font-size: 13px;
    text-align: center;
    padding: 20px;
  }

  /* Loading Overlay */
  .myio-dashboard-root .loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    z-index: 100;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease, visibility 0.2s ease;
  }

  .myio-dashboard-root .loading-overlay.visible {
    opacity: 1;
    visibility: visible;
  }

  .myio-dashboard-root[data-theme="light"] .loading-overlay {
    background: rgba(248, 250, 252, 0.9);
  }

  .myio-dashboard-root .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color, #334155);
    border-top-color: #8b5cf6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .myio-dashboard-root .loading-overlay p {
    margin: 0;
    color: var(--ink-2, #94a3b8);
    font-size: 13px;
  }

  /* Responsive */
  @media (max-width: 1400px) {
    .myio-dashboard-root .kpi-grid.primary {
      grid-template-columns: 1.5fr 1fr 1fr;
    }

    .myio-dashboard-root .kpi-grid.primary .kpi-card.mtbf,
    .myio-dashboard-root .kpi-grid.primary .kpi-card.mttr {
      grid-column: auto;
    }
  }

  @media (max-width: 1024px) {
    .myio-dashboard-root .kpi-grid.primary {
      grid-template-columns: repeat(2, 1fr);
    }

    .myio-dashboard-root .kpi-grid.primary .kpi-card.large {
      grid-column: span 2;
    }

    .myio-dashboard-root .kpi-grid.secondary {
      grid-template-columns: repeat(2, 1fr);
    }

    .myio-dashboard-root .charts-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .myio-dashboard-root {
      padding: 0;
    }

    .myio-dashboard-root .dashboard-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .myio-dashboard-root .header-actions {
      width: 100%;
      justify-content: space-between;
    }

    .myio-dashboard-root .kpi-grid.secondary {
      grid-template-columns: repeat(2, 1fr);
    }

    .myio-dashboard-root .kpi-card .kpi-value {
      font-size: 18px;
    }

    .myio-dashboard-root .kpi-card.large .kpi-value {
      font-size: 22px;
    }

    .myio-dashboard-root .kpi-card .kpi-icon {
      font-size: 22px;
    }

    .myio-dashboard-root .kpi-card.large .kpi-icon {
      font-size: 30px;
    }

    .myio-dashboard-root .donut-container {
      flex-direction: column;
    }
  }
`;

let stylesInjected = false;

export function injectOperationalDashboardStyles(): void {
  if (stylesInjected) return;

  const styleId = 'myio-operational-dashboard-styles';
  if (document.getElementById(styleId)) {
    stylesInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = OPERATIONAL_DASHBOARD_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

export function removeOperationalDashboardStyles(): void {
  const styleId = 'myio-operational-dashboard-styles';
  const styleElement = document.getElementById(styleId);
  if (styleElement) {
    styleElement.remove();
    stylesInjected = false;
  }
}
