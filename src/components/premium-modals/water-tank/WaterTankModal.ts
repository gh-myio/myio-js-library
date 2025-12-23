// water-tank/WaterTankModal.ts - Main controller for water tank modal

import { WaterTankModalView } from './WaterTankModalView';
import {
  OpenDashboardPopupWaterTankOptions,
  WaterTankModalContext,
  WaterTankModalError,
  WaterTankTelemetryData,
  WaterTankDataPoint,
  TelemetryApiConfig,
  ThingsBoardTelemetryResponse
} from './types';

/**
 * Main controller class for Water Tank Modal
 *
 * Responsibilities:
 * - Fetch telemetry data from ThingsBoard REST API
 * - Manage modal lifecycle (open, close, destroy)
 * - Coordinate between data layer and view layer
 * - Handle errors and user callbacks
 */
export class WaterTankModal {
  private view: WaterTankModalView | null = null;
  private options: OpenDashboardPopupWaterTankOptions;
  private context: WaterTankModalContext;
  private data: WaterTankTelemetryData | null = null;

  constructor(options: OpenDashboardPopupWaterTankOptions) {
    this.options = this.normalizeOptions(options);
    this.context = this.buildContext(this.options);
  }

  /**
   * Normalize and set defaults for options
   */
  private normalizeOptions(options: OpenDashboardPopupWaterTankOptions): OpenDashboardPopupWaterTankOptions {
    return {
      ...options,
      tbApiHost: options.tbApiHost || window.location.origin,
      timezone: options.timezone || 'America/Sao_Paulo',
      theme: options.theme || 'light',
      closeOnEsc: options.closeOnEsc !== false,
      zIndex: options.zIndex || 10000,
      telemetryKeys: options.telemetryKeys || ['waterLevel', 'nivel', 'level'],
      aggregation: options.aggregation || 'NONE',
      limit: options.limit || 1000,
      ui: {
        title: options.ui?.title || `Water Tank - ${options.label || options.deviceId}`,
        width: options.ui?.width || 900,
        height: options.ui?.height || 600,
        showExport: options.ui?.showExport !== false,
        showLevelIndicator: options.ui?.showLevelIndicator !== false,
      }
    };
  }

  /**
   * Build context object for callbacks
   */
  private buildContext(options: OpenDashboardPopupWaterTankOptions): WaterTankModalContext {
    // RFC-0107: Use clamped level for visual display (0-100)
    const displayLevel = options.currentLevelClamped ?? options.currentLevel ?? 0;

    return {
      device: {
        id: options.deviceId,
        label: options.label || options.deviceId,
        type: options.deviceType,
        currentLevel: displayLevel
      },
      metadata: {
        slaveId: options.slaveId,
        centralId: options.centralId,
        ingestionId: options.ingestionId
      },
      timeRange: {
        startTs: options.startTs,
        endTs: options.endTs,
        timezone: options.timezone!
      }
    };
  }

  /**
   * Fetch telemetry data from ThingsBoard REST API
   */
  private async fetchTelemetryData(): Promise<WaterTankTelemetryData> {
    const config: TelemetryApiConfig = {
      tbApiHost: this.options.tbApiHost!,
      tbJwtToken: this.options.tbJwtToken,
      deviceId: this.options.deviceId,
      keys: this.options.telemetryKeys!,
      startTs: this.options.startTs,
      endTs: this.options.endTs,
      aggregation: this.options.aggregation,
      limit: this.options.limit
    };

    console.log('[WaterTankModal] Fetching telemetry data:', {
      deviceId: config.deviceId,
      keys: config.keys,
      timeRange: {
        start: new Date(config.startTs).toISOString(),
        end: new Date(config.endTs).toISOString()
      }
    });

    try {
      // Build ThingsBoard telemetry API URL
      const keysParam = config.keys.join(',');
      const url = `${config.tbApiHost}/api/plugins/telemetry/DEVICE/${config.deviceId}/values/timeseries?keys=${keysParam}&startTs=${config.startTs}&endTs=${config.endTs}&limit=${config.limit}`;

      if (config.aggregation && config.aggregation !== 'NONE') {
        // Add aggregation parameters if needed
        // For now, we'll fetch raw data
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': `Bearer ${config.tbJwtToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw this.createError('AUTH_ERROR', 'Authentication failed. Please login again.');
        }
        if (response.status === 404) {
          throw this.createError('NO_DATA', 'Device not found or no telemetry data available.');
        }
        throw this.createError('NETWORK_ERROR', `Failed to fetch data: ${response.statusText}`);
      }

      const rawData: ThingsBoardTelemetryResponse = await response.json();

      console.log('[WaterTankModal] Raw telemetry response:', rawData);

      // Transform raw data to our format
      const telemetryData = this.transformTelemetryData(rawData, config.keys);

      // Calculate summary statistics
      const summary = this.calculateSummary(telemetryData);

      const result: WaterTankTelemetryData = {
        deviceId: config.deviceId,
        telemetry: telemetryData,
        summary,
        metadata: {
          keys: config.keys,
          aggregation: config.aggregation || 'NONE',
          limit: config.limit || 1000
        }
      };

      console.log('[WaterTankModal] Processed telemetry data:', {
        pointCount: result.telemetry.length,
        summary: result.summary
      });

      return result;

    } catch (error) {
      console.error('[WaterTankModal] Error fetching telemetry:', error);

      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw our custom errors
      }

      throw this.createError(
        'NETWORK_ERROR',
        `Failed to fetch telemetry data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Transform raw ThingsBoard response to our data points
   * RFC-0107: Keep ALL data points with their original keys (no deduplication)
   * This allows the chart to switch between water_level and water_percentage dynamically
   */
  private transformTelemetryData(rawData: ThingsBoardTelemetryResponse, keys: string[]): WaterTankDataPoint[] {
    const allPoints: WaterTankDataPoint[] = [];

    // Combine data from all keys - keep ALL points for dynamic filtering
    for (const key of keys) {
      if (rawData[key] && Array.isArray(rawData[key])) {
        const keyPoints = rawData[key].map(point => {
          let value = typeof point.value === 'string' ? parseFloat(point.value) : point.value;

          // RFC-0107: Convert water_percentage from 0-1 to 0-100 range for display
          if (key === 'water_percentage' && value <= 1.5) {
            // Values <= 1.5 are assumed to be in 0-1 range, convert to percentage
            value = value * 100;
          }

          return {
            ts: point.ts,
            value: value,
            key: key
          };
        });
        allPoints.push(...keyPoints);
      }
    }

    // Sort by timestamp (but keep all points - no deduplication)
    allPoints.sort((a, b) => a.ts - b.ts);

    // Log counts by key for debugging
    const keyCounts: Record<string, number> = {};
    for (const p of allPoints) {
      keyCounts[p.key || 'unknown'] = (keyCounts[p.key || 'unknown'] || 0) + 1;
    }
    console.log(`[WaterTankModal] Transformed ${allPoints.length} total points:`, keyCounts);

    return allPoints;
  }

  /**
   * Calculate summary statistics from telemetry data
   * RFC-0107: Use clamped level for display
   */
  private calculateSummary(telemetry: WaterTankDataPoint[]) {
    // RFC-0107: Use clamped level for visual display
    const displayLevel = this.options.currentLevelClamped ?? this.options.currentLevel ?? 0;

    if (telemetry.length === 0) {
      return {
        currentLevel: displayLevel,
        avgLevel: 0,
        minLevel: 0,
        maxLevel: 0,
        totalReadings: 0
      };
    }

    const values = telemetry.map(p => p.value);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Most recent reading
    const lastPoint = telemetry[telemetry.length - 1];

    return {
      currentLevel: lastPoint.value,
      avgLevel: avg,
      minLevel: min,
      maxLevel: max,
      totalReadings: telemetry.length,
      firstReadingTs: telemetry[0].ts,
      lastReadingTs: lastPoint.ts
    };
  }

  /**
   * Create a standardized error object
   */
  private createError(
    code: WaterTankModalError['code'],
    message: string,
    cause?: unknown
  ): WaterTankModalError {
    const error: WaterTankModalError = {
      code,
      message,
      cause
    };

    // Add user action suggestions
    switch (code) {
      case 'AUTH_ERROR':
      case 'TOKEN_EXPIRED':
        error.userAction = 'RE_AUTH';
        break;
      case 'NETWORK_ERROR':
        error.userAction = 'RETRY';
        break;
      case 'VALIDATION_ERROR':
        error.userAction = 'FIX_INPUT';
        break;
      default:
        error.userAction = 'CONTACT_ADMIN';
    }

    return error;
  }

  /**
   * Show the modal
   */
  public async show(): Promise<{ close: () => void }> {
    try {
      console.log('[WaterTankModal] Initializing modal...');

      // Fetch telemetry data
      this.data = await this.fetchTelemetryData();

      // Trigger onDataLoaded callback
      if (this.options.onDataLoaded) {
        try {
          this.options.onDataLoaded(this.data);
        } catch (callbackError) {
          console.warn('[WaterTankModal] onDataLoaded callback error:', callbackError);
        }
      }

      // Create and show view
      this.view = new WaterTankModalView({
        context: this.context,
        params: this.options,
        data: this.data,
        onExport: () => this.handleExport(),
        onError: (error) => this.handleError(error),
        onClose: () => this.close(), // Call close() to destroy view and trigger user callback
        onDateRangeChange: (startTs, endTs) => this.handleDateRangeChange(startTs, endTs),
        onParamsChange: (params) => this.handleParamsChange(params)
      });

      this.view.render();
      this.view.show();

      // Trigger onOpen callback
      if (this.options.onOpen) {
        try {
          this.options.onOpen(this.context);
        } catch (callbackError) {
          console.warn('[WaterTankModal] onOpen callback error:', callbackError);
        }
      }

      console.log('[WaterTankModal] Modal opened successfully');

      return {
        close: () => this.close()
      };

    } catch (error) {
      console.error('[WaterTankModal] Failed to show modal:', error);
      this.handleError(error as WaterTankModalError);
      throw error;
    }
  }

  /**
   * Close the modal
   */
  public close(): void {
    console.log('[WaterTankModal] Closing modal');

    if (this.view) {
      this.view.destroy();
      this.view = null;
    }

    this.handleClose();
  }

  /**
   * Handle date range change from view
   */
  private async handleDateRangeChange(startTs: number, endTs: number): Promise<void> {
    console.log('[WaterTankModal] Date range changed:', {
      startTs,
      endTs,
      startDate: new Date(startTs).toISOString(),
      endDate: new Date(endTs).toISOString()
    });

    // Update options with new date range
    this.options.startTs = startTs;
    this.options.endTs = endTs;

    // Update context
    this.context.timeRange.startTs = startTs;
    this.context.timeRange.endTs = endTs;

    try {
      // Show loading state (could add loading indicator here)
      console.log('[WaterTankModal] Fetching new data for date range...');

      // Fetch new data
      this.data = await this.fetchTelemetryData();

      // Update view with new data
      if (this.view) {
        this.view.updateData(this.data);
      }

      // Trigger callback
      if (this.options.onDataLoaded) {
        try {
          this.options.onDataLoaded(this.data);
        } catch (callbackError) {
          console.warn('[WaterTankModal] onDataLoaded callback error:', callbackError);
        }
      }

      console.log('[WaterTankModal] Data refreshed successfully');

    } catch (error) {
      console.error('[WaterTankModal] Failed to fetch data for new date range:', error);
      this.handleError(error as WaterTankModalError);
    }
  }

  /**
   * RFC-0107: Handle params change (date range, aggregation, limit)
   */
  private async handleParamsChange(params: { startTs: number; endTs: number; aggregation: string; limit: number }): Promise<void> {
    console.log('[WaterTankModal] Params changed:', {
      startTs: params.startTs,
      endTs: params.endTs,
      aggregation: params.aggregation,
      limit: params.limit,
      startDate: new Date(params.startTs).toISOString(),
      endDate: new Date(params.endTs).toISOString()
    });

    // Update options with new params
    this.options.startTs = params.startTs;
    this.options.endTs = params.endTs;
    this.options.aggregation = params.aggregation as typeof this.options.aggregation;
    this.options.limit = params.limit;

    // Update context
    this.context.timeRange.startTs = params.startTs;
    this.context.timeRange.endTs = params.endTs;

    try {
      console.log('[WaterTankModal] Fetching data with new params...');

      // Fetch new data with updated params
      this.data = await this.fetchTelemetryData();

      // Update view with new data
      if (this.view) {
        this.view.updateData(this.data);
      }

      // Trigger callback
      if (this.options.onDataLoaded) {
        try {
          this.options.onDataLoaded(this.data);
        } catch (callbackError) {
          console.warn('[WaterTankModal] onDataLoaded callback error:', callbackError);
        }
      }

      console.log('[WaterTankModal] Data refreshed with new params successfully');

    } catch (error) {
      console.error('[WaterTankModal] Failed to fetch data with new params:', error);
      this.handleError(error as WaterTankModalError);
    }
  }

  /**
   * Handle export functionality
   */
  private handleExport(): void {
    if (!this.data) {
      console.warn('[WaterTankModal] No data to export');
      return;
    }

    console.log('[WaterTankModal] Exporting CSV...');

    try {
      // Create CSV content
      const headers = ['Timestamp', 'Date', 'Time', 'Level (%)', 'Key'];
      const rows = this.data.telemetry.map(point => {
        const date = new Date(point.ts);
        return [
          point.ts.toString(),
          date.toLocaleDateString('pt-BR'),
          date.toLocaleTimeString('pt-BR'),
          point.value.toFixed(2),
          point.key || 'waterLevel'
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const filename = `water-tank-${this.options.deviceId}-${Date.now()}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('[WaterTankModal] CSV exported successfully:', filename);

    } catch (error) {
      console.error('[WaterTankModal] Export failed:', error);
      this.handleError(this.createError('UNKNOWN_ERROR', 'Failed to export CSV'));
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: WaterTankModalError): void {
    console.error('[WaterTankModal] Error:', error);

    if (this.options.onError) {
      try {
        this.options.onError(error);
      } catch (callbackError) {
        console.warn('[WaterTankModal] onError callback error:', callbackError);
      }
    }
  }

  /**
   * Handle modal close
   */
  private handleClose(): void {
    if (this.options.onClose) {
      try {
        this.options.onClose();
      } catch (callbackError) {
        console.warn('[WaterTankModal] onClose callback error:', callbackError);
      }
    }
  }
}
