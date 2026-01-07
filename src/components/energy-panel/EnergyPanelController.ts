import {
  EnergyPanelParams,
  EnergyPanelState,
  EnergySummaryData,
  ThemeMode,
  PeriodDays,
  VizMode,
  ChartType,
} from './types';

export class EnergyPanelController {
  private state: EnergyPanelState;
  private params: EnergyPanelParams;
  private onStateChange: ((state: EnergyPanelState) => void) | null = null;

  constructor(params: EnergyPanelParams) {
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

  setOnStateChange(callback: (state: EnergyPanelState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  getState(): EnergyPanelState {
    return { ...this.state };
  }

  getSummary(): EnergySummaryData | null {
    return this.state.summary ? { ...this.state.summary } : null;
  }

  updateSummary(data: EnergySummaryData): void {
    this.state.summary = { ...data };
    this.notifyStateChange();
  }

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

  setLoading(loading: boolean): void {
    this.state.isLoading = loading;
    this.notifyStateChange();
  }

  setError(error: string | null): void {
    this.state.error = error;
    this.notifyStateChange();
  }
}
