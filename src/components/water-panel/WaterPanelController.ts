import {
  WaterPanelParams,
  WaterPanelState,
  WaterSummaryData,
  ThemeMode,
  PeriodDays,
  VizMode,
  ChartType,
} from './types';

export class WaterPanelController {
  private state: WaterPanelState;
  private params: WaterPanelParams;
  private onStateChange: ((state: WaterPanelState) => void) | null = null;

  constructor(params: WaterPanelParams) {
    this.params = params;
    this.state = {
      theme: params.theme || 'light',
      period: params.period || 7,
      vizMode: params.vizMode || 'total',
      chartType: params.chartType || 'line',
      selectedShoppingIds: params.selectedShoppingIds || [],
      summary: params.initialSummary || null,
      isLoading: false,
      error: null,
    };
  }

  // Observer pattern
  setOnStateChange(callback: (state: WaterPanelState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  // Getters
  getState(): WaterPanelState {
    return { ...this.state };
  }

  getSummary(): WaterSummaryData | null {
    return this.state.summary ? { ...this.state.summary } : null;
  }

  // Data updates
  updateSummary(data: WaterSummaryData): void {
    // Calculate percentages if not provided
    const total = data.total || data.storesTotal + data.commonAreaTotal;
    const storesPercentage = total > 0 ? (data.storesTotal / total) * 100 : 0;
    const commonAreaPercentage = total > 0 ? (data.commonAreaTotal / total) * 100 : 0;

    this.state.summary = {
      ...data,
      total,
      storesPercentage: data.storesPercentage ?? storesPercentage,
      commonAreaPercentage: data.commonAreaPercentage ?? commonAreaPercentage,
    };
    this.notifyStateChange();
  }

  // Config updates
  setTheme(mode: ThemeMode): void {
    if (this.state.theme !== mode) {
      this.state.theme = mode;
      this.notifyStateChange();
    }
  }

  setPeriod(days: PeriodDays): void {
    if (this.state.period !== days) {
      this.state.period = days;
      this.params.onPeriodChange?.(days);
      this.notifyStateChange();
    }
  }

  setVizMode(mode: VizMode): void {
    if (this.state.vizMode !== mode) {
      this.state.vizMode = mode;
      this.params.onVizModeChange?.(mode);
      this.notifyStateChange();
    }
  }

  setChartType(type: ChartType): void {
    if (this.state.chartType !== type) {
      this.state.chartType = type;
      this.notifyStateChange();
    }
  }

  // Filter updates
  applyShoppingFilter(ids: string[]): void {
    this.state.selectedShoppingIds = [...ids];
    this.params.onFilterChange?.(ids);
    this.notifyStateChange();
  }

  clearFilters(): void {
    this.state.selectedShoppingIds = [];
    this.params.onFilterChange?.([]);
    this.notifyStateChange();
  }

  // Loading state
  setLoading(loading: boolean): void {
    this.state.isLoading = loading;
    this.notifyStateChange();
  }

  setError(error: string | null): void {
    this.state.error = error;
    this.notifyStateChange();
  }
}
