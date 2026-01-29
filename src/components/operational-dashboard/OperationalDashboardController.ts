/**
 * RFC-0152 Phase 5: Operational Dashboard Controller
 * Manages state and coordinates between view and data
 */

import type {
  DashboardKPIs,
  TrendDataPoint,
  DowntimeEntry,
  DashboardPeriod,
  DashboardThemeMode,
  OperationalDashboardState,
  OnPeriodChangeCallback,
  OnRefreshCallback,
  DEFAULT_DASHBOARD_KPIS,
} from './types';
import { OperationalDashboardView } from './OperationalDashboardView';

export class OperationalDashboardController {
  private view: OperationalDashboardView;
  private state: OperationalDashboardState;
  private onPeriodChange?: OnPeriodChangeCallback;
  private onRefresh?: OnRefreshCallback;
  private enableDebugMode: boolean;

  constructor(params: {
    container: HTMLElement;
    themeMode?: DashboardThemeMode;
    enableDebugMode?: boolean;
    initialPeriod?: DashboardPeriod;
    kpis?: DashboardKPIs;
    trendData?: TrendDataPoint[];
    downtimeList?: DowntimeEntry[];
    onPeriodChange?: OnPeriodChangeCallback;
    onRefresh?: OnRefreshCallback;
  }) {
    this.enableDebugMode = params.enableDebugMode || false;
    this.onPeriodChange = params.onPeriodChange;
    this.onRefresh = params.onRefresh;

    // Initialize state
    this.state = {
      themeMode: params.themeMode || 'dark',
      period: params.initialPeriod || 'month',
      kpis: params.kpis || {
        fleetAvailability: 0,
        availabilityTrend: 0,
        fleetMTBF: 0,
        fleetMTTR: 0,
        totalEquipment: 0,
        onlineCount: 0,
        offlineCount: 0,
        maintenanceCount: 0,
      },
      trendData: params.trendData || [],
      downtimeList: params.downtimeList || [],
      isLoading: false,
    };

    this.log('Initializing OperationalDashboardController', this.state);

    // Create view
    this.view = new OperationalDashboardView({
      container: params.container,
      themeMode: this.state.themeMode,
      period: this.state.period,
      kpis: this.state.kpis,
      trendData: this.state.trendData,
      downtimeList: this.state.downtimeList,
      onPeriodChange: this.handlePeriodChange.bind(this),
      onRefresh: this.handleRefresh.bind(this),
    });

    // Listen for theme changes
    this.setupEventListeners();
  }

  private log(...args: unknown[]): void {
    if (this.enableDebugMode) {
      console.log('[OperationalDashboardController]', ...args);
    }
  }

  private setupEventListeners(): void {
    // Theme change event
    window.addEventListener('myio:theme-change', this.handleThemeEvent);
  }

  private handleThemeEvent = (event: Event): void => {
    const customEvent = event as CustomEvent;
    const newTheme = customEvent.detail?.theme || customEvent.detail?.themeMode;
    if (newTheme === 'light' || newTheme === 'dark') {
      this.setThemeMode(newTheme);
    }
  };

  private handlePeriodChange(period: DashboardPeriod): void {
    this.log('Period changed:', period);
    this.state.period = period;

    if (this.onPeriodChange) {
      this.onPeriodChange(period);
    }
  }

  private handleRefresh(): void {
    this.log('Refresh requested');

    if (this.onRefresh) {
      this.onRefresh();
    }
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * Update KPIs data
   */
  public updateKPIs(kpis: DashboardKPIs): void {
    this.log('Updating KPIs:', kpis);
    this.state.kpis = kpis;
    this.view.updateKPIs(kpis);
  }

  /**
   * Update trend data
   */
  public updateTrendData(data: TrendDataPoint[]): void {
    this.log('Updating trend data:', data.length, 'points');
    this.state.trendData = data;
    this.view.updateTrendData(data);
  }

  /**
   * Update downtime list
   */
  public updateDowntimeList(list: DowntimeEntry[]): void {
    this.log('Updating downtime list:', list.length, 'entries');
    this.state.downtimeList = list;
    this.view.updateDowntimeList(list);
  }

  /**
   * Set loading state
   */
  public setLoading(isLoading: boolean): void {
    this.log('Setting loading:', isLoading);
    this.state.isLoading = isLoading;
    this.view.setLoading(isLoading);
  }

  /**
   * Set period
   */
  public setPeriod(period: DashboardPeriod): void {
    this.log('Setting period:', period);
    this.state.period = period;
    this.view.setPeriod(period);
  }

  /**
   * Get current period
   */
  public getPeriod(): DashboardPeriod {
    return this.state.period;
  }

  /**
   * Set theme mode
   */
  public setThemeMode(mode: DashboardThemeMode): void {
    this.log('Setting theme mode:', mode);
    this.state.themeMode = mode;
    this.view.setThemeMode(mode);
  }

  /**
   * Get current theme mode
   */
  public getThemeMode(): DashboardThemeMode {
    return this.state.themeMode;
  }

  /**
   * Trigger refresh
   */
  public refresh(): void {
    this.handleRefresh();
  }

  /**
   * Get root element
   */
  public getElement(): HTMLElement {
    return this.view.getElement();
  }

  /**
   * Get current state
   */
  public getState(): Readonly<OperationalDashboardState> {
    return { ...this.state };
  }

  /**
   * Destroy and cleanup
   */
  public destroy(): void {
    this.log('Destroying controller');
    window.removeEventListener('myio:theme-change', this.handleThemeEvent);
    this.view.destroy();
  }
}
