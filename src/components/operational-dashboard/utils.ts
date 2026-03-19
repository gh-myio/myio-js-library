/**
 * RFC-0152 Phase 5: Operational Dashboard Utilities
 * KPI calculation functions and formatting helpers
 */

import type { DashboardKPIs, TrendDataPoint, DowntimeEntry, DashboardPeriod } from './types';

// ============================================
// KPI CALCULATIONS
// ============================================

/**
 * Calculate MTBF (Mean Time Between Failures)
 * MTBF = (Total Operating Time - Maintenance Time) / Number of Failures
 */
export function calculateMTBF(
  operatingHours: number,
  maintenanceHours: number,
  failureCount: number
): number {
  if (failureCount === 0) return operatingHours;
  return (operatingHours - maintenanceHours) / failureCount;
}

/**
 * Calculate MTTR (Mean Time To Repair)
 * MTTR = Total Maintenance Time / Number of Failures
 */
export function calculateMTTR(maintenanceHours: number, failureCount: number): number {
  if (failureCount === 0) return 0;
  return maintenanceHours / failureCount;
}

/**
 * Calculate Availability
 * Availability = (MTBF / (MTBF + MTTR)) * 100
 */
export function calculateAvailability(mtbf: number, mttr: number): number {
  if (mtbf + mttr === 0) return 100;
  return (mtbf / (mtbf + mttr)) * 100;
}

/**
 * Calculate fleet-wide KPIs from equipment array
 */
export function calculateFleetKPIs(
  equipment: Array<{
    availability: number;
    mtbf: number;
    mttr: number;
    status: string;
  }>
): DashboardKPIs {
  if (equipment.length === 0) {
    return {
      fleetAvailability: 0,
      availabilityTrend: 0,
      avgAvailability: 0,
      activeAlerts: 0,
      fleetMTBF: 0,
      fleetMTTR: 0,
      totalEquipment: 0,
      onlineCount: 0,
      offlineCount: 0,
      maintenanceCount: 0,
    };
  }

  const totalEquipment = equipment.length;
  const onlineCount = equipment.filter(e => e.status === 'online').length;
  const offlineCount = equipment.filter(e => e.status === 'offline').length;
  const maintenanceCount = equipment.filter(e => e.status === 'maintenance').length;

  const avgAvailability = equipment.reduce((sum, e) => sum + e.availability, 0) / totalEquipment;
  const avgMTBF = equipment.reduce((sum, e) => sum + e.mtbf, 0) / totalEquipment;
  const avgMTTR = equipment.reduce((sum, e) => sum + e.mttr, 0) / totalEquipment;

  return {
    fleetAvailability: avgAvailability,
    availabilityTrend: 0, // Calculated separately with historical data
    avgAvailability, // Same as fleet for now, can be customized
    activeAlerts: 0, // Calculated separately from alarm data
    fleetMTBF: avgMTBF,
    fleetMTTR: avgMTTR,
    totalEquipment,
    onlineCount,
    offlineCount,
    maintenanceCount,
  };
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Format hours for display
 */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours / 24)}d`;
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format trend value with sign
 */
export function formatTrend(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Get trend direction icon
 */
export function getTrendIcon(value: number): string {
  return value >= 0 ? '\u2191' : '\u2193'; // ↑ or ↓
}

/**
 * Get trend CSS class
 */
export function getTrendClass(value: number): string {
  return value >= 0 ? 'positive' : 'negative';
}

// ============================================
// DATE HELPERS
// ============================================

/**
 * Get date range for period
 */
export function getPeriodDateRange(period: DashboardPeriod): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  let start: Date;

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case 'week':
      // Start of current week (Monday)
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday, 0, 0, 0);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      break;
    case 'quarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  }

  return { start, end };
}

/**
 * Format date for chart label
 */
export function formatDateLabel(timestamp: number, period: DashboardPeriod): string {
  const date = new Date(timestamp);

  switch (period) {
    case 'today':
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    case 'week':
      return date.toLocaleDateString('pt-BR', { weekday: 'short' });
    case 'month':
      return date.toLocaleDateString('pt-BR', { day: '2-digit' });
    case 'quarter':
      return date.toLocaleDateString('pt-BR', { month: 'short' });
    default:
      return date.toLocaleDateString('pt-BR');
  }
}

// ============================================
// MOCK DATA GENERATORS
// ============================================

/**
 * Generate mock trend data for testing (RFC-0156 Enhanced)
 * Now includes: failureCount, downtimeHours, affectedEquipment, hasEvent, eventDescription
 */
export function generateMockTrendData(period: DashboardPeriod): TrendDataPoint[] {
  const points: TrendDataPoint[] = [];
  const now = Date.now();

  let dataPoints: number;
  let interval: number;

  switch (period) {
    case 'today':
      dataPoints = 12;
      interval = 2 * 60 * 60 * 1000; // 2 hours
      break;
    case 'week':
      dataPoints = 7;
      interval = 24 * 60 * 60 * 1000; // 1 day
      break;
    case 'month':
      dataPoints = 30;
      interval = 24 * 60 * 60 * 1000; // 1 day
      break;
    case 'quarter':
      dataPoints = 12;
      interval = 7 * 24 * 60 * 60 * 1000; // 1 week
      break;
    default:
      dataPoints = 10;
      interval = 24 * 60 * 60 * 1000;
  }

  for (let i = dataPoints - 1; i >= 0; i--) {
    const timestamp = now - i * interval;
    const baseValue = 90 + Math.random() * 8;
    const mtbfValue = 300 + Math.random() * 100;
    const mttrValue = 2 + Math.random() * 4;

    // RFC-0156: Enhanced data for availability chart
    // Simulate some days with failures
    const hasFailure = Math.random() < 0.2; // 20% chance of failure
    const failureCount = hasFailure ? Math.floor(Math.random() * 3) + 1 : 0;
    const downtimeHours = hasFailure ? Math.random() * 4 + 0.5 : 0;
    const affectedEquipment = hasFailure ? Math.floor(Math.random() * 5) + 1 : 0;

    // Simulate significant events occasionally
    const hasEvent = Math.random() < 0.1; // 10% chance of event
    const eventDescriptions = [
      'Manutencao preventiva programada',
      'Falha de energia no predio',
      'Substituicao de componente critico',
      'Queda de conexao com servidor',
    ];
    const eventDescription = hasEvent
      ? eventDescriptions[Math.floor(Math.random() * eventDescriptions.length)]
      : undefined;

    // Adjust availability based on failures
    const adjustedValue = hasFailure ? baseValue - (failureCount * 2 + Math.random() * 5) : baseValue;

    points.push({
      label: formatDateLabel(timestamp, period),
      timestamp,
      value: Math.max(70, Math.min(100, adjustedValue)),
      secondaryValue: mttrValue,
      // RFC-0156 enhanced fields
      failureCount,
      downtimeHours,
      affectedEquipment,
      hasEvent: hasEvent || hasFailure,
      eventDescription: hasEvent ? eventDescription : (hasFailure ? `${failureCount} falha(s) detectada(s)` : undefined),
    });
  }

  return points;
}

/**
 * Generate mock downtime list for testing
 */
export function generateMockDowntimeList(): DowntimeEntry[] {
  return [
    { name: 'ESC-02', location: 'Shopping Meier', downtime: 48, percentage: 15 },
    { name: 'ELV-05', location: 'Shopping Central', downtime: 32, percentage: 10 },
    { name: 'ESC-08', location: 'Shopping Madureira', downtime: 24, percentage: 7.5 },
    { name: 'ELV-02', location: 'Shopping Deodoro', downtime: 18, percentage: 5.6 },
    { name: 'ESC-11', location: 'Shopping Bonsucesso', downtime: 12, percentage: 3.8 },
  ];
}

/**
 * Generate mock KPIs for testing (RFC-0155 Feedback Enhanced)
 */
export function generateMockKPIs(): DashboardKPIs {
  return {
    fleetAvailability: 94.7,
    availabilityTrend: 2.3,
    avgAvailability: 92.5,
    activeAlerts: 3,
    fleetMTBF: 342,
    fleetMTTR: 4.2,
    totalEquipment: 48,
    onlineCount: 42,
    offlineCount: 3,
    maintenanceCount: 3,
    // RFC-0155: Enhanced status metrics
    onlineTrend: 2,
    offlineTrend: -1,
    maintenanceTrend: 0,
    offlineCriticalCount: 1,
    recurrentFailuresCount: 2,
    avgTimeInStatus: {
      online: 168.5,
      offline: 4.2,
      maintenance: 12.0,
    },
    // RFC-0155 Feedback: Additional metrics
    maintenanceBreakdown: {
      scheduled: 2,
      corrective: 1,
      avgDuration: 4.5,
    },
    availabilitySlaTarget: 95,
    availabilityTrendValue: -2.3,
    offlineEssentialCount: 1,
  };
}
