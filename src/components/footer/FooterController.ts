/**
 * RFC-0115: Footer Component Library
 * Controller for the Footer Component - handles business logic and state
 */

import {
  FooterComponentParams,
  SelectedEntity,
  SelectionStore,
  UnitType,
  DateRange,
} from './types';
import { FooterView } from './FooterView';
import { showMixedUnitsAlert, showLimitAlert, hideAlert, setAlertColors } from './AlertDialogs';
import { ComparisonHandler } from './ComparisonHandler';

/**
 * Logger helper for debug mode
 */
function createLogger(debug: boolean) {
  const prefix = '[FooterComponent]';
  return {
    log: (...args: unknown[]) => debug && console.log(prefix, ...args),
    warn: (...args: unknown[]) => debug && console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}

/**
 * Internal SelectionStore for standalone mode
 * Used when no external store is provided
 */
class InternalSelectionStore implements SelectionStore {
  private entities: Map<string, SelectedEntity> = new Map();
  private listeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();
  private maxSelections: number;

  constructor(maxSelections: number = 6) {
    this.maxSelections = maxSelections;
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }

  add(entity: SelectedEntity): boolean {
    if (this.entities.has(entity.id)) {
      return false; // Already exists
    }

    if (this.entities.size >= this.maxSelections) {
      this.emit('selection:limit-reached', this.maxSelections);
      return false;
    }

    this.entities.set(entity.id, entity);
    this.emit('selection:change', this.getSelectedEntities());
    return true;
  }

  remove(entityId: string): void {
    if (this.entities.has(entityId)) {
      this.entities.delete(entityId);
      this.emit('selection:change', this.getSelectedEntities());
    }
  }

  clear(): void {
    this.entities.clear();
    this.emit('selection:change', []);
  }

  getSelectedEntities(): SelectedEntity[] {
    return Array.from(this.entities.values());
  }

  getSelectionCount(): number {
    return this.entities.size;
  }
}

/**
 * FooterController class - handles business logic and SelectionStore integration
 */
export class FooterController {
  private store: SelectionStore | null = null;
  private view: FooterView;
  private comparisonHandler: ComparisonHandler;
  private log: ReturnType<typeof createLogger>;

  private currentUnitType: UnitType | null = null;
  private maxSelections: number;
  private dateRange: DateRange | null = null;

  // Bound event handlers (for removal)
  private boundHandleSelectionChange: () => void;
  private boundHandleLimitReached: () => void;
  private boundHandleDashboardState: (e: CustomEvent) => void;

  constructor(private params: FooterComponentParams, view: FooterView) {
    this.view = view;
    this.maxSelections = params.maxSelections ?? 6;
    this.log = createLogger(params.debug ?? false);

    // Set alert colors
    if (params.colors) {
      setAlertColors(params.colors);
    }

    // Create comparison handler
    this.comparisonHandler = new ComparisonHandler(params);

    // Bind event handlers
    this.boundHandleSelectionChange = this.handleSelectionChange.bind(this);
    this.boundHandleLimitReached = this.handleLimitReached.bind(this);
    this.boundHandleDashboardState = this.handleDashboardState.bind(this);

    // Initialize
    this.initStore();
    this.bindViewEvents();
    this.bindWindowEvents();

    // Initial render
    this.handleSelectionChange();
  }

  /**
   * Initialize the selection store
   */
  private initStore(): void {
    // Use provided store or try to get from window
    if (this.params.selectionStore) {
      this.store = this.params.selectionStore;
      this.log.log('Using provided SelectionStore');
    } else {
      // Try window.MyIOLibrary.MyIOSelectionStore or window.MyIOSelectionStore
      const win = window as any;
      const externalStore = win.MyIOLibrary?.MyIOSelectionStore || win.MyIOSelectionStore;

      if (externalStore) {
        this.store = externalStore;
        this.log.log('Using global SelectionStore');
      } else {
        // Create internal store for standalone mode
        this.store = new InternalSelectionStore(this.maxSelections);
        this.log.log('Using internal SelectionStore (standalone mode)');
      }
    }

    // Bind store events
    this.store.on('selection:change', this.boundHandleSelectionChange);
    this.store.on('selection:totals', this.boundHandleSelectionChange);
    this.store.on('selection:limit-reached', this.boundHandleLimitReached);

    this.log.log('SelectionStore initialized');
  }

  /**
   * Bind view events
   */
  private bindViewEvents(): void {
    this.view.on('compare-click', () => {
      this.openCompareModal();
    });

    this.view.on('clear-click', () => {
      this.clearSelection();
      this.params.onClearClick?.();
    });

    this.view.on('chip-remove', (entityId) => {
      if (typeof entityId === 'string') {
        this.removeEntity(entityId);
        this.params.onChipRemove?.(entityId);
      }
    });

    this.view.on('drop', (entityId) => {
      if (typeof entityId === 'string') {
        this.addEntityById(entityId);
      }
    });
  }

  /**
   * Bind window events (dashboard state changes)
   */
  private bindWindowEvents(): void {
    window.addEventListener('myio:dashboard-state', this.boundHandleDashboardState as EventListener);
    this.log.log('Window events bound');
  }

  /**
   * Handle dashboard state change (tab switch from MENU)
   */
  private handleDashboardState(e: CustomEvent): void {
    const domain = e.detail?.domain || e.detail?.tab;

    if (domain && ['energy', 'water', 'temperature', 'tank'].includes(domain)) {
      const count = this.getSelectionCount();
      if (count > 0) {
        this.log.log(`Clearing ${count} selections due to domain change to: ${domain}`);
        this.clearSelection();
      }
    }
  }

  /**
   * Handle selection change from store
   */
  private handleSelectionChange(): void {
    const entities = this.getSelectedEntities();
    const count = entities.length;

    this.log.log('Selection changed:', count, 'entities');

    // Validate unit types
    const detectedType = this.detectUnitType(entities);

    // Handle mixed types
    if (detectedType === 'mixed') {
      this.log.warn('Mixed unit types detected - clearing selection');
      const types = this.getUniqueTypes(entities);
      this.params.onMixedTypes?.(types);
      showMixedUnitsAlert();
      this.clearSelection();
      return;
    }

    // Handle type change
    if (detectedType && this.currentUnitType && detectedType !== this.currentUnitType) {
      this.log.warn(`Unit type changed from ${this.currentUnitType} to ${detectedType} - clearing`);
      this.currentUnitType = detectedType;
      this.clearSelection();
      return;
    }

    // Update current type
    this.currentUnitType = detectedType;

    // Calculate totals
    const { totalValue, displayValue } = this.calculateTotals(entities, detectedType);

    // Update view
    this.view.renderDock(entities);
    this.view.updateTotals(count, displayValue, detectedType);
    this.view.setCompareEnabled(count >= 2);
    this.view.setClearEnabled(count > 0);

    // Callback
    this.params.onSelectionChange?.(entities);
  }

  /**
   * Handle limit reached from store
   */
  private handleLimitReached(): void {
    this.log.log('Selection limit reached');
    showLimitAlert(this.maxSelections);
    this.params.onLimitReached?.(this.maxSelections);
  }

  /**
   * Detect unit type from entities
   */
  private detectUnitType(entities: SelectedEntity[]): UnitType | 'mixed' | null {
    if (!entities || entities.length === 0) return null;

    const types = new Set<string>();
    entities.forEach(entity => {
      if (entity?.icon) {
        types.add(entity.icon);
      }
    });

    if (types.size === 0) return null;
    if (types.size > 1) return 'mixed';

    return Array.from(types)[0] as UnitType;
  }

  /**
   * Get unique types from entities
   */
  private getUniqueTypes(entities: SelectedEntity[]): string[] {
    const types = new Set<string>();
    entities.forEach(entity => {
      if (entity?.icon) {
        types.add(entity.icon);
      }
    });
    return Array.from(types);
  }

  /**
   * Calculate total and display values
   */
  private calculateTotals(entities: SelectedEntity[], unitType: UnitType | null): {
    totalValue: number;
    displayValue: number;
  } {
    let totalValue = 0;
    let validCount = 0;

    entities.forEach(entity => {
      if (entity && typeof entity.lastValue === 'number') {
        totalValue += entity.lastValue;
        validCount++;
      }
    });

    // For temperature, show average
    let displayValue = totalValue;
    if (unitType === 'temperature' && validCount > 0) {
      displayValue = totalValue / validCount;
    }

    return { totalValue, displayValue };
  }

  // ============== Public Methods ==============

  /**
   * Add an entity to the selection by ID
   * Note: This requires entity data to be available via drag-drop dataTransfer
   * For now, it's a placeholder that logs a warning
   */
  addEntityById(entityId: string): boolean {
    this.log.warn('addEntityById not fully implemented - use addEntity with full entity data', entityId);
    // TODO: Implement entity lookup from orchestrator or params.entityResolver
    return false;
  }

  /**
   * Add an entity to the selection
   */
  addEntity(entity: SelectedEntity): boolean {
    if (!this.store) {
      this.log.error('Store not initialized');
      return false;
    }

    return this.store.add(entity);
  }

  /**
   * Remove an entity from the selection
   */
  removeEntity(entityId: string): void {
    if (this.store) {
      this.store.remove(entityId);
    }
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    if (this.store) {
      this.store.clear();
    }
    this.currentUnitType = null;
  }

  /**
   * Get all selected entities
   */
  getSelectedEntities(): SelectedEntity[] {
    return this.store?.getSelectedEntities() ?? [];
  }

  /**
   * Get selection count
   */
  getSelectionCount(): number {
    return this.store?.getSelectionCount() ?? 0;
  }

  /**
   * Get current unit type
   */
  getCurrentUnitType(): UnitType | null {
    return this.currentUnitType;
  }

  /**
   * Set date range for comparison modals
   */
  setDateRange(start: string, end: string): void {
    this.dateRange = { start, end };
    this.comparisonHandler.setDateRange(start, end);
  }

  /**
   * Open the comparison modal
   */
  async openCompareModal(): Promise<void> {
    const entities = this.getSelectedEntities();

    if (entities.length < 2) {
      this.log.warn('Need at least 2 entities for comparison');
      return;
    }

    const unitType = this.currentUnitType;
    if (!unitType) {
      this.log.warn('No unit type detected');
      return;
    }

    this.params.onCompareClick?.(entities, unitType);

    try {
      await this.comparisonHandler.openComparisonModal(entities, unitType);
    } catch (error) {
      this.log.error('Error opening comparison modal:', error);
      this.params.onError?.(error as Error);
    }
  }

  /**
   * Show limit alert
   */
  showLimitAlert(): void {
    showLimitAlert(this.maxSelections);
  }

  /**
   * Show mixed types alert
   */
  showMixedTypesAlert(): void {
    showMixedUnitsAlert();
  }

  /**
   * Hide any visible alert
   */
  hideAlert(): void {
    hideAlert();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Remove store listeners
    if (this.store) {
      this.store.off('selection:change', this.boundHandleSelectionChange);
      this.store.off('selection:totals', this.boundHandleSelectionChange);
      this.store.off('selection:limit-reached', this.boundHandleLimitReached);
    }

    // Remove window listeners
    window.removeEventListener('myio:dashboard-state', this.boundHandleDashboardState as EventListener);

    // Hide any alerts
    hideAlert();

    // Clear state
    this.store = null;
    this.currentUnitType = null;

    this.log.log('Controller destroyed');
  }
}
