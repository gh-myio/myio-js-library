/**
 * RFC-0152 Phase 5: KPI Card Components
 * Reusable KPI card rendering functions
 */

import type { DashboardKPIs } from './types';
import { getTrendClass, getTrendIcon, formatTrend } from './utils';

/**
 * Render primary KPI cards (Availability, MTBF, MTTR)
 */
export function renderPrimaryKPIs(kpis: DashboardKPIs): string {
  const trendClass = getTrendClass(kpis.availabilityTrend);
  const trendIcon = getTrendIcon(kpis.availabilityTrend);

  return `
    <!-- Availability (Large) -->
    <div class="kpi-card large availability" id="kpiAvailability">
      <div class="kpi-icon">📊</div>
      <div class="kpi-content">
        <span class="kpi-value">${kpis.fleetAvailability.toFixed(1)}%</span>
        <span class="kpi-label">Disponibilidade dos Equipamentos</span>
        <span class="kpi-trend ${trendClass}">
          ${trendIcon} ${formatTrend(kpis.availabilityTrend)}
        </span>
      </div>
    </div>

    <!-- Average Availability -->
    <div class="kpi-card avg-availability" id="kpiAvgAvailability">
      <div class="kpi-icon">📈</div>
      <div class="kpi-content">
        <span class="kpi-value">${(kpis.avgAvailability || 0).toFixed(1)}%</span>
        <span class="kpi-label">Disponibilidade Media</span>
        <span class="kpi-sublabel">Media geral do periodo</span>
      </div>
    </div>

    <!-- Active Alerts -->
    <div class="kpi-card alerts ${(kpis.activeAlerts || 0) > 0 ? 'has-alerts' : ''}" id="kpiActiveAlerts">
      <div class="kpi-icon">🔔</div>
      <div class="kpi-content">
        <span class="kpi-value">${kpis.activeAlerts || 0}</span>
        <span class="kpi-label">Alertas Ativos</span>
        <span class="kpi-sublabel">Requer atencao</span>
      </div>
    </div>

    <!-- MTBF -->
    <div class="kpi-card mtbf" id="kpiMtbf">
      <div class="kpi-icon">⏱️</div>
      <div class="kpi-content">
        <span class="kpi-value">${Math.round(kpis.fleetMTBF)}h</span>
        <span class="kpi-label">MTBF Medio</span>
        <span class="kpi-sublabel">Tempo Medio Entre Falhas</span>
      </div>
    </div>

    <!-- MTTR -->
    <div class="kpi-card mttr" id="kpiMttr">
      <div class="kpi-icon">🔧</div>
      <div class="kpi-content">
        <span class="kpi-value">${kpis.fleetMTTR.toFixed(1)}h</span>
        <span class="kpi-label">MTTR Medio</span>
        <span class="kpi-sublabel">Tempo Medio de Reparo</span>
      </div>
    </div>
  `;
}

/**
 * Render secondary KPI cards (Equipment counts)
 */
export function renderSecondaryKPIs(kpis: DashboardKPIs): string {
  return `
    <div class="kpi-card small total" id="kpiTotal">
      <span class="kpi-value">${kpis.totalEquipment}</span>
      <span class="kpi-label">Total Equipamentos</span>
    </div>
    <div class="kpi-card small online" id="kpiOnline">
      <span class="kpi-value">${kpis.onlineCount}</span>
      <span class="kpi-label">Online</span>
      <div class="kpi-indicator" style="background: #22c55e"></div>
    </div>
    <div class="kpi-card small offline" id="kpiOffline">
      <span class="kpi-value">${kpis.offlineCount}</span>
      <span class="kpi-label">Offline</span>
      <div class="kpi-indicator" style="background: #ef4444"></div>
    </div>
    <div class="kpi-card small maintenance" id="kpiMaintenance">
      <span class="kpi-value">${kpis.maintenanceCount}</span>
      <span class="kpi-label">Em Manutencao</span>
      <div class="kpi-indicator" style="background: #f59e0b"></div>
    </div>
  `;
}

/**
 * Update a single KPI value in the DOM
 */
export function updateKPIValue(elementId: string, value: string | number): void {
  const element = document.querySelector(`#${elementId} .kpi-value`);
  if (element) {
    element.textContent = String(value);
  }
}

/**
 * Update availability KPI with trend
 */
export function updateAvailabilityKPI(
  containerId: string,
  availability: number,
  trend: number
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const valueEl = container.querySelector('.kpi-value');
  const trendEl = container.querySelector('.kpi-trend');

  if (valueEl) {
    valueEl.textContent = `${availability.toFixed(1)}%`;
  }

  if (trendEl) {
    const trendClass = getTrendClass(trend);
    const trendIcon = getTrendIcon(trend);
    trendEl.className = `kpi-trend ${trendClass}`;
    trendEl.innerHTML = `${trendIcon} ${formatTrend(trend)}`;
  }
}

/**
 * Update MTBF/MTTR KPI
 */
export function updateMTBFMTTRKPI(
  mtbfContainerId: string,
  mttrContainerId: string,
  mtbf: number,
  mttr: number
): void {
  const mtbfContainer = document.getElementById(mtbfContainerId);
  const mttrContainer = document.getElementById(mttrContainerId);

  if (mtbfContainer) {
    const valueEl = mtbfContainer.querySelector('.kpi-value');
    if (valueEl) {
      valueEl.textContent = `${Math.round(mtbf)}h`;
    }
  }

  if (mttrContainer) {
    const valueEl = mttrContainer.querySelector('.kpi-value');
    if (valueEl) {
      valueEl.textContent = `${mttr.toFixed(1)}h`;
    }
  }
}

/**
 * Update equipment count KPIs
 */
export function updateEquipmentCountKPIs(
  kpis: Pick<DashboardKPIs, 'totalEquipment' | 'onlineCount' | 'offlineCount' | 'maintenanceCount'>
): void {
  updateKPIValue('kpiTotal', kpis.totalEquipment);
  updateKPIValue('kpiOnline', kpis.onlineCount);
  updateKPIValue('kpiOffline', kpis.offlineCount);
  updateKPIValue('kpiMaintenance', kpis.maintenanceCount);
}

/**
 * Apply animation to a KPI card when value changes
 */
export function animateKPIChange(containerId: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
  container.style.transform = 'scale(1.02)';
  container.style.boxShadow = '0 8px 24px rgba(139, 92, 246, 0.2)';

  setTimeout(() => {
    container.style.transform = '';
    container.style.boxShadow = '';
  }, 300);
}
