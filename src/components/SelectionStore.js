/**
 * MYIO SelectionStore Component
 * Global singleton for managing selection state, multi-unit totals, time-series data, and analytics
 * 
 * @version 1.0.0
 * @author MYIO Frontend Guild
 */
/* eslint-disable */


class MyIOSelectionStoreClass {
  constructor() {
    console.log('[SelectionStore] 🏗️ NEW INSTANCE CREATED at:', new Date().toISOString());
    console.trace('[SelectionStore] Constructor called from:');

    this.state =  {selectedDevice: null}
    this.selectedIds = new Set();
    this.entities = new Map();
    this.eventListeners = new Map();
    this.analytics = null;
    this.timeSeriesCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes

    // Initialize event listener maps
    this.eventListeners.set('selection:change', []);
    this.eventListeners.set('selection:totals', []);
    this.eventListeners.set('comparison:open', []);
    this.eventListeners.set('comparison:too_many', []);
  }

  // Core Selection Methods
  add(id) {
    console.log("[MyIOSelectionStoreClass] Entrou na LIB", id)
    const wasSelected = this.selectedIds.has(id);
    this.selectedIds.add(id);

    if (!wasSelected) {
      this._emitSelectionChange('add', id);
      this._trackEvent('footer_dock.drop_add', { entityId: id });
    }
  }

  remove(id) {
    console.log("[MyIOSelectionStoreClass] ITEM PARA REMOÇÃO ID",id);
    // Check if ID exists in the Set
    if (!this.selectedIds.has(id)) return; // not found
    console.log("[MyIOSelectionStoreClass] DELETE ID",id)
    this.selectedIds.delete(id); // remove the ID string
    this._emitSelectionChange('remove', id);
    this._trackEvent('footer_dock.remove_chip', { entityId: id });
  }


  toggle(id) {
    if (this.isSelected(id)) {
      this.remove(id);
    } else {
      this.add(id);
    }
  }

  clear() {
    if (this.selectedIds.size === 0) return;
    
    this.selectedIds.clear();
    this._emitSelectionChange('clear');
    this._trackEvent('footer_dock.clear_all', { count: 0 });
  }

  syncFromCheckbox(id, checked) {
    if (typeof id !== 'string' || typeof checked !== 'boolean') return;
    
    if (checked && !this.isSelected(id)) {
      this.add(id);
    } else if (!checked && this.isSelected(id)) {
      this.remove(id);
    }
    
    this._trackEvent('card.checkbox_toggle', { entityId: id, checked });
  }

  // Entity Management
  registerEntity(entity) {
    if (!entity || typeof entity !== 'object' || !entity.id) {
      throw new Error('Entity must be an object with an id property');
    }

    const normalizedEntity = {
      id: entity.id,
      name: entity.name || '',
      icon: entity.icon || 'generic',
      group: entity.group || '',
      lastValue: Number(entity.lastValue) || 0,
      unit: entity.unit || '',
      status: entity.status || 'unknown'
    };

    this.entities.set(entity.id, normalizedEntity);
  }

  unregisterEntity(id) {
    if (typeof id !== 'string') return;
    
    this.entities.delete(id);
    this.remove(id); // Remove from selection if selected
  }

  // State Getters
  getSelectedIds() {
    return Array.from(this.selectedIds);
  }

  getSelectedEntities() {
    console.log("[MyIOSelectionStoreClass] biblioteca:",this.getSelectedIds() )
    // Return full entity objects from entities Map based on selected IDs
    return this.getSelectedIds()
      .map(id => this.entities.get(id))
      .filter(entity => entity !== undefined);
  }

  getTotals() {
    const selectedEntities = this.getSelectedEntities();
    const totals = {
      energyKwh: 0,
      waterM3: 0,
      tempC: 0,
      percentage: 0,
      count: selectedEntities.length,
      unitBreakdown: {}
    };

    selectedEntities.forEach(entity => {
      const value = entity.lastValue || 0;
      const unit = entity.unit || '';

      // Add to unit breakdown
      if (!totals.unitBreakdown[unit]) {
        totals.unitBreakdown[unit] = 0;
      }
      totals.unitBreakdown[unit] += value;

      // Add to specific totals based on unit
      switch (unit.toLowerCase()) {
        case 'kwh':
        case 'mwh':
        case 'gwh':
          totals.energyKwh += this._convertToKwh(value, unit);
          break;
        case 'm³':
        case 'm3':
          totals.waterM3 += value;
          break;
        case '°c':
        case 'celsius':
          totals.tempC += value;
          break;
        case '%':
        case 'percent':
          totals.percentage += value;
          break;
      }
    });

    return totals;
  }

  isSelected(id) {
    return this.selectedIds.has(id);
  }

  getSelectionCount() {
    return this.selectedIds.size;
  }

  getMultiUnitTotalDisplay() {
    const totals = this.getTotals();
    const parts = [];

    if (totals.energyKwh > 0) {
      parts.push(`Energy: ${this._formatNumber(totals.energyKwh)} kWh`);
    }
    if (totals.waterM3 > 0) {
      parts.push(`Water: ${this._formatNumber(totals.waterM3)} m³`);
    }
    if (totals.tempC > 0) {
      parts.push(`Temp: ${this._formatNumber(totals.tempC)} °C`);
    }
    if (totals.percentage > 0) {
      parts.push(`${this._formatNumber(totals.percentage)}%`);
    }

    return parts.join(' | ') || 'No selection';
  }

  // Event System
  on(event, callback) {
    console.log(`[SelectionStore] 📝 Registering listener for event: ${event}`);

    if (typeof event !== 'string' || typeof callback !== 'function') {
      console.error(`[SelectionStore] ❌ Invalid registration: event=${typeof event}, callback=${typeof callback}`);
      return;
    }

    if (!this.eventListeners.has(event)) {
      console.log(`[SelectionStore] 🆕 Creating new listener array for: ${event}`);
      this.eventListeners.set(event, []);
    }

    this.eventListeners.get(event).push(callback);
    console.log(`[SelectionStore] ✅ Listener registered! Total for ${event}: ${this.eventListeners.get(event).length}`);
  }

  off(event, callback) {
    if (!this.eventListeners.has(event)) return;
    
    const listeners = this.eventListeners.get(event);
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  // Time-Series Data (Phase 2)
  async getTimeSeriesData(entityIds, startDate, endDate) {
    if (!Array.isArray(entityIds) || entityIds.length === 0) {
      return {};
    }

    const cacheKey = `${entityIds.join(',')}_${startDate.getTime()}_${endDate.getTime()}`;
    const cached = this.timeSeriesCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.data;
    }

    // Placeholder implementation - in real usage, this would fetch from API
    const mockData = {};
    entityIds.forEach(id => {
      mockData[id] = this._generateMockTimeSeriesData(startDate, endDate);
    });

    this.timeSeriesCache.set(cacheKey, {
      data: mockData,
      timestamp: Date.now()
    });

    return mockData;
  }

  invalidateCache(reason = 'manual') {
    this.timeSeriesCache.clear();
    this._trackEvent('cache.invalidated', { reason });
  }

  // Analytics Integration
  setAnalytics(analyticsInstance) {
    if (!analyticsInstance || typeof analyticsInstance.track !== 'function') {
      throw new Error('Analytics instance must have a track method');
    }
    this.analytics = analyticsInstance;
  }

  trackEvent(eventName, payload = {}) {
    this._trackEvent(eventName, payload);
  }

  // Comparison Actions
  openComparison() {
    const count = this.getSelectionCount();
    
    if (count === 0) {
      this.announceToScreenReader('No items selected for comparison');
      return false;
    }
    
    if (count > 20) {
      this._emit('comparison:too_many', {
        count,
        maxAllowed: 20,
        selectedIds: this.getSelectedIds()
      });
      this._trackEvent('chart_modal.too_many_entities', { count });
      return false;
    }

    const data = {
      entities: this.getSelectedEntities(),
      totals: this.getTotals(),
      count
    };

    this._emit('comparison:open', data);
    this._trackEvent('chart_modal.open', { entityCount: count });
    return true;
  }

  startDrag(id) {
    if (typeof id !== 'string') return;
    this._trackEvent('drag.start', { entityId: id });
  }

  // Accessibility
  announceToScreenReader(message) {
    if (typeof message !== 'string' || typeof document === 'undefined') return;
    
    // Create or update screen reader announcement element
    let announcer = document.getElementById('myio-sr-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'myio-sr-announcer';
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.position = 'absolute';
      announcer.style.left = '-10000px';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.overflow = 'hidden';
      document.body.appendChild(announcer);
    }
    
    announcer.textContent = message;
  }

  // Private Methods
  _emitSelectionChange(action, id = null) {
    const data = {
      action,
      id,
      selectedIds: this.getSelectedIds(),
      totals: this.getTotals()
    };

    this._emit('selection:change', data);
    this._emit('selection:totals', data.totals);
    
    this._trackEvent('footer_dock.total_update', {
      action,
      count: data.selectedIds.length,
      totals: data.totals
    });
  }

  _emit(event, data) {
    console.log(`[SelectionStore] 🔔 Emitting event: ${event}, listeners: ${this.eventListeners.get(event)?.length || 0}`);
    console.log(`[SelectionStore] 📦 Event data:`, data);

    if (!this.eventListeners.has(event)) {
      console.warn(`[SelectionStore] ⚠️ No listener map for event: ${event}`);
      return;
    }

    const listeners = this.eventListeners.get(event);
    if (listeners.length === 0) {
      console.warn(`[SelectionStore] ⚠️ No listeners registered for event: ${event}`);
    }

    listeners.forEach((callback, index) => {
      console.log(`[SelectionStore] 🎯 Calling listener #${index} for ${event}`);
      try {
        callback(data);
      } catch (error) {
        console.error(`[SelectionStore] ❌ Error in ${event} listener #${index}:`, error);
      }
    });
  }

  _trackEvent(eventName, payload = {}) {
    if (!this.analytics) return;
    
    try {
      this.analytics.track(eventName, {
        timestamp: Date.now(),
        ...payload
      });
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  _convertToKwh(value, unit) {
    switch (unit.toLowerCase()) {
      case 'mwh':
        return value * 1000;
      case 'gwh':
        return value * 1000000;
      case 'kwh':
      default:
        return value;
    }
  }

  _formatNumber(value) {
    if (typeof value !== 'number' || isNaN(value)) return '0';
    
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  _generateMockTimeSeriesData(startDate, endDate) {
    const data = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      data.push({
        timestamp: current.getTime(),
        value: Math.random() * 100 + 50, // Random value between 50-150
        unit: 'kWh'
      });
      current.setHours(current.getHours() + 1); // Hourly data
    }
    
    return data;
  }
}

// Create singleton instance using Object.defineProperty to prevent overwrites
let MyIOSelectionStore;

if (typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined') {
  // Check if property descriptor exists and is non-configurable (already locked)
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.window, 'MyIOSelectionStore');

  if (descriptor && !descriptor.configurable) {
    // Property is locked, use existing instance
    console.log('[SelectionStore] 🔄 REUSING locked global instance');
    MyIOSelectionStore = globalThis.window.MyIOSelectionStore;
  } else if (globalThis.window.MyIOSelectionStore) {
    // Instance exists but isn't locked yet - lock it now
    console.log('[SelectionStore] 🔒 LOCKING existing instance');
    MyIOSelectionStore = globalThis.window.MyIOSelectionStore;

    // Lock the property to prevent future overwrites
    Object.defineProperty(globalThis.window, 'MyIOSelectionStore', {
      value: MyIOSelectionStore,
      writable: false,
      configurable: false,
      enumerable: true
    });
  } else {
    // Create new instance and lock it immediately
    console.log('[SelectionStore] 🆕 Creating new global singleton instance');
    MyIOSelectionStore = new MyIOSelectionStoreClass();

    // Define property as non-configurable and non-writable to prevent overwrites
    Object.defineProperty(globalThis.window, 'MyIOSelectionStore', {
      value: MyIOSelectionStore,
      writable: false,
      configurable: false,
      enumerable: true
    });

    console.log('[SelectionStore] 🔒 Instance locked and ready');
  }

  // Always export the class (writable so it can be overridden if needed)
  if (!globalThis.window.MyIOSelectionStoreClass) {
    globalThis.window.MyIOSelectionStoreClass = MyIOSelectionStoreClass;
  }
} else {
  // Non-browser environment (Node.js, etc.)
  MyIOSelectionStore = new MyIOSelectionStoreClass();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MyIOSelectionStore, MyIOSelectionStoreClass };
}

// Export for ES modules
export { MyIOSelectionStore, MyIOSelectionStoreClass };
