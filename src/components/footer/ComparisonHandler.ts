/**
 * RFC-0115: Footer Component Library
 * Comparison handler for opening comparison modals
 */

import {
  FooterComponentParams,
  SelectedEntity,
  UnitType,
  DateRange,
  ComparisonDataSource,
  TemperatureDevice,
} from './types';
import type { Alarm } from '../../types/alarm';
import { openAlarmComparisonModal } from '../alarms/AlarmComparisonModal';

const DEFAULT_CHARTS_BASE_URL = 'https://graphs.staging.apps.myio-bas.com';

/**
 * Logger helper
 */
function createLogger(debug: boolean) {
  const prefix = '[ComparisonHandler]';
  return {
    log: (...args: unknown[]) => debug && console.log(prefix, ...args),
    warn: (...args: unknown[]) => debug && console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}

/**
 * ComparisonHandler class - handles opening comparison modals
 */
export class ComparisonHandler {
  private log: ReturnType<typeof createLogger>;
  private chartsBaseUrl: string;
  private dataApiHost: string;
  private dateRange: DateRange | null = null;

  constructor(private params: FooterComponentParams) {
    this.log = createLogger(params.debug ?? false);
    this.chartsBaseUrl = params.chartsBaseUrl ?? DEFAULT_CHARTS_BASE_URL;
    this.dataApiHost = params.dataApiHost ?? '';
  }

  /**
   * Set the date range for comparisons
   */
  setDateRange(start: string, end: string): void {
    this.dateRange = { start, end };
  }

  /**
   * Get the date range from params, stored value, or defaults
   * Always validates the returned values to ensure they are valid date strings
   */
  private getDateRange(): DateRange {
    // Helper to check if a date string is valid
    const isValidDateString = (val: unknown): val is string => {
      if (typeof val !== 'string' || !val) return false;
      const d = new Date(val);
      return !isNaN(d.getTime());
    };

    // Try params.getDateRange first
    if (this.params.getDateRange) {
      const range = this.params.getDateRange();
      if (range && isValidDateString(range.start) && isValidDateString(range.end)) {
        return range;
      }
      this.log.warn('getDateRange() returned invalid dates, trying fallbacks');
    }

    // Try stored date range
    if (this.dateRange && isValidDateString(this.dateRange.start) && isValidDateString(this.dateRange.end)) {
      return this.dateRange;
    }

    // Try ctx.scope
    const ctx = this.params.ctx;
    if (ctx?.scope?.startDateISO && ctx?.scope?.endDateISO) {
      const scopeStart = ctx.scope.startDateISO;
      const scopeEnd = ctx.scope.endDateISO;
      if (isValidDateString(scopeStart) && isValidDateString(scopeEnd)) {
        return {
          start: scopeStart,
          end: scopeEnd,
        };
      }
    }

    // Try window.MyIOOrchestrator date range
    const win = window as any;
    if (win.MyIOOrchestrator?.dateRange) {
      const orchStart = win.MyIOOrchestrator.dateRange.start || win.MyIOOrchestrator.dateRange.startDate;
      const orchEnd = win.MyIOOrchestrator.dateRange.end || win.MyIOOrchestrator.dateRange.endDate;
      if (isValidDateString(orchStart) && isValidDateString(orchEnd)) {
        this.log.log('Using date range from MyIOOrchestrator');
        return { start: orchStart, end: orchEnd };
      }
    }

    // Default: last 7 days
    this.log.log('Using default date range (last 7 days)');
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  /**
   * Open the comparison modal based on unit type
   */
  async openComparisonModal(entities: SelectedEntity[], unitType: UnitType): Promise<void> {
    this.log.log(`Opening comparison modal for ${entities.length} entities, type: ${unitType}`);

    if (entities.length < 2) {
      throw new Error('Need at least 2 entities for comparison');
    }

    if (unitType === 'alarms') {
      await this.openAlarmModal(entities);
      return;
    }

    if (unitType === 'temperature') {
      await this.openTemperatureModal(entities);
    } else {
      await this.openEnergyModal(entities, unitType);
    }
  }

  /**
   * Open alarm comparison modal
   */
  private async openAlarmModal(entities: SelectedEntity[]): Promise<void> {
    const { start, end } = this.getDateRange();

    const nowIso = new Date().toISOString();
    const alarms: Alarm[] = entities.map((entity, index) => {
      const raw = (entity.alarm as Record<string, unknown> | null)
        || (entity.meta as Record<string, unknown> | null)
        || {};

      const severity = (raw.severity as Alarm['severity']) || 'MEDIUM';
      const state = (raw.state as Alarm['state']) || 'OPEN';
      const tags = typeof raw.tags === 'object' && raw.tags ? raw.tags as Record<string, string> : {};

      return {
        id: String(raw.id || entity.id || `alarm-${index}`),
        customerId: String(raw.customerId || ''),
        customerName: String(raw.customerName || entity.customerName || ''),
        source: String(raw.source || raw.originator || raw.deviceName || ''),
        severity,
        state,
        title: String(raw.title || raw.name || entity.name || 'Alarm'),
        description: String(raw.description || ''),
        tags,
        firstOccurrence: String(raw.firstOccurrence || raw.createdTime || raw.createdAt || nowIso),
        lastOccurrence: String(raw.lastOccurrence || raw.updatedTime || raw.lastUpdate || nowIso),
        occurrenceCount: Number(raw.occurrenceCount || raw.count || entity.lastValue || 1),
        acknowledgedAt: raw.acknowledgedAt as string | undefined,
        acknowledgedBy: raw.acknowledgedBy as string | undefined,
        snoozedUntil: raw.snoozedUntil as string | undefined,
        closedAt: raw.closedAt as string | undefined,
        closedBy: raw.closedBy as string | undefined,
        closedReason: raw.closedReason as string | undefined,
      };
    });

    this.log.log('Opening alarm comparison modal:', {
      alarms: alarms.length,
      startDate: start,
      endDate: end,
    });

    openAlarmComparisonModal({
      alarms,
      startDate: start,
      endDate: end,
      theme: this.params.theme ?? 'dark',
      locale: 'pt-BR',
      onClose: () => {
        this.log.log('Alarm comparison modal closed');
      },
    });
  }

  /**
   * Open energy/water/tank comparison modal
   */
  private async openEnergyModal(entities: SelectedEntity[], unitType: UnitType): Promise<void> {
    const win = window as any;
    const MyIOLibrary = win.MyIOLibrary;

    if (!MyIOLibrary?.openDashboardPopupEnergy) {
      throw new Error('openDashboardPopupEnergy not available');
    }

    // Get tokens
    const jwtToken = localStorage.getItem('jwt_token');
    const ingestionToken = this.params.getIngestionToken?.() ||
      win.MyIOOrchestrator?.tokenManager?.getToken?.('ingestionToken');

    if (!ingestionToken) {
      throw new Error('Ingestion token not available');
    }

    // Get credentials for comparison mode (required by openDashboardPopupEnergy)
    const credentials = win.MyIOUtils?.getCredentials?.() || {};
    const clientId = credentials.clientId;
    const clientSecret = credentials.clientSecret;

    if (!clientId || !clientSecret) {
      this.log.warn('clientId/clientSecret not found in MyIOUtils.getCredentials()');
    }

    // Prepare data sources
    const dataSources: ComparisonDataSource[] = entities.map(entity => ({
      type: 'device',
      id: entity.ingestionId || entity.id,
      label: `${entity.name} ${entity.customerName}`.trim(),
    }));

    // Get date range and granularity
    const { start, end } = this.getDateRange();
    const granularity = this.calculateGranularity(start, end);
    const readingType = this.mapUnitTypeToReadingType(unitType);

    this.log.log('Opening energy comparison modal:', {
      dataSources: dataSources.length,
      readingType,
      startDate: start,
      endDate: end,
      granularity,
    });

    // Open modal
    MyIOLibrary.openDashboardPopupEnergy({
      mode: 'comparison',
      tbJwtToken: jwtToken,
      ingestionToken: ingestionToken,
      dataSources: dataSources,
      readingType: readingType,
      startDate: start,
      endDate: end,
      granularity: granularity,
      clientId: clientId,
      clientSecret: clientSecret,
      chartsBaseUrl: this.chartsBaseUrl,
      dataApiHost: this.dataApiHost,
      theme: this.params.theme ?? 'dark',
      deep: false,
      onOpen: (context: unknown) => {
        this.log.log('Comparison modal opened:', context);
      },
      onClose: () => {
        this.log.log('Comparison modal closed');
      },
      onError: (error: Error) => {
        this.log.error('Comparison modal error:', error);
        this.params.onError?.(error);
      },
    });
  }

  /**
   * Open temperature comparison modal
   */
  private async openTemperatureModal(entities: SelectedEntity[]): Promise<void> {
    const win = window as any;
    const MyIOLibrary = win.MyIOLibrary;

    if (!MyIOLibrary?.openTemperatureComparisonModal) {
      throw new Error('openTemperatureComparisonModal not available');
    }

    const jwtToken = localStorage.getItem('jwt_token');
    if (!jwtToken) {
      throw new Error('JWT token not found');
    }

    // Get date range
    const { start, end } = this.getDateRange();

    // Map entities to temperature device format
    const devices: TemperatureDevice[] = entities.map(entity => ({
      id: entity.id,
      label: entity.name,
      tbId: entity.tbId,
      customerName: entity.customerName,
      temperatureMin: entity.temperatureMin,
      temperatureMax: entity.temperatureMax,
    }));

    // Get global temperature range from ctx.scope (fallback)
    const ctx = this.params.ctx;
    const globalMin = ctx?.scope?.temperatureMin;
    const globalMax = ctx?.scope?.temperatureMax;

    this.log.log('Opening temperature comparison modal:', {
      devices: devices.length,
      startDate: start,
      endDate: end,
      globalMin,
      globalMax,
    });

    // Open modal
    MyIOLibrary.openTemperatureComparisonModal({
      token: jwtToken,
      devices: devices,
      startDate: start,
      endDate: end,
      theme: this.params.theme ?? 'dark',
      locale: 'pt-BR',
      granularity: 'hour',
      temperatureMin: globalMin,
      temperatureMax: globalMax,
    });
  }

  /**
   * Map unit type to reading type
   */
  private mapUnitTypeToReadingType(unitType: UnitType): string {
    const mapping: Record<UnitType, string> = {
      energy: 'energy',
      water: 'water',
      tank: 'tank',
      temperature: 'temperature',
      alarms: 'alarms',
    };
    return mapping[unitType] || 'energy';
  }

  /**
   * Calculate optimal granularity based on date range
   */
  private calculateGranularity(startISO: string, endISO: string): string {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return '1h';   // 1 day: hourly
    if (diffDays <= 7) return '1d';   // 1 week: daily
    if (diffDays <= 31) return '1d';  // 1 month: daily
    if (diffDays <= 90) return '1w';  // 3 months: weekly
    return '1M';                       // More than 3 months: monthly
  }
}
