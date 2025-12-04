/**
 * MYIO SelectionStore Component
 * Global singleton for managing selection state, multi-unit totals, time-series data, and analytics
 * 
 * @version 1.0.0
 * @author MYIO Frontend Guild
 */
/* eslint-disable */


class MyIOSelectionStoreClass {
  // Global debug flag - controls all console logs
  static GlobalDebug = false;

  /**
   * Enable or disable all console logs from SelectionStore
   * @param {boolean} enabled - true to enable logs, false to disable
   */
  static setGlobalDebug(enabled) {
    MyIOSelectionStoreClass.GlobalDebug = !!enabled;
    console.log(`[SelectionStore] 🔧 Global debug ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Internal logging method - respects GlobalDebug flag
   */
  _log(level, ...args) {
    if (!MyIOSelectionStoreClass.GlobalDebug) return;

    const logMethod = console[level] || console.log;
    logMethod.apply(console, args);
  }

  constructor() {
    this._log('log', '[SelectionStore] 🔍 Constructor called - checking for existing instance...');
    this._log('log', '[SelectionStore] typeof document:', typeof document);

    // DEBUG: Check if we're in an iframe
    if (typeof window !== 'undefined') {
      this._log('log', '[SelectionStore] window.top === window:', window.top === window);
      this._log('log', '[SelectionStore] document location:', window.location.href);
      this._log('log', '[SelectionStore] Is in iframe:', window !== window.top);
    }

    this._log('log', '[SelectionStore] document.__MyIOSelectionStore_INSTANCE__:', !!document?.__MyIOSelectionStore_INSTANCE__);

    // DEBUG: List all __MyIO* properties on document to debug
    if (typeof document !== 'undefined') {
      const myioProps = Object.getOwnPropertyNames(document).filter(key => key.startsWith('__MyIO'));
      this._log('log', '[SelectionStore] All __MyIO* properties on document:', myioProps);
    }

    // CRITICAL: Check if singleton already exists BEFORE initializing
    // Try window.top first (shared across iframes), then document, then window
    let existingInstance = null;

    try {
      const targetWindow = (typeof window !== 'undefined' && window.top) ? window.top : window;
      existingInstance = targetWindow?.__MyIOSelectionStore_INSTANCE__;
      this._log('log', '[SelectionStore] Checking window.top.__MyIOSelectionStore_INSTANCE__:', !!existingInstance);
    } catch (e) {
      this._log('warn', '[SelectionStore] Cannot access window.top:', e.message);
    }

    if (!existingInstance) {
      existingInstance = (typeof document !== 'undefined' && document.__MyIOSelectionStore_INSTANCE__)
        || (typeof window !== 'undefined' && window.__MyIOSelectionStore_INSTANCE__);
    }

    if (existingInstance) {
      this._log('warn', '[SelectionStore] ⚠️ Constructor called but instance already exists! Returning existing instance.');
      this._log('log', '[SelectionStore] Existing instance has listeners:', existingInstance.eventListeners.get('selection:change')?.length || 0);
      return existingInstance;
    }

    this._log('log', '[SelectionStore] 🏗️ NEW INSTANCE CREATED at:', new Date().toISOString());
    if (MyIOSelectionStoreClass.GlobalDebug) {
      console.trace('[SelectionStore] Constructor called from:');
    }

    // Constants
    this.MAX_SELECTION = 6; // Limite máximo de dispositivos selecionados

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
    this.eventListeners.set('selection:limit-reached', []);
    this.eventListeners.set('comparison:open', []);
    this.eventListeners.set('comparison:too_many', []);

    // Store this instance in a hidden global variable
    // Strategy: Store in the top-most window to share across iframes
    try {
      const targetWindow = (typeof window !== 'undefined' && window.top) ? window.top : window;
      if (targetWindow) {
        this._log('log', '[SelectionStore] 💾 Storing instance in window.top.__MyIOSelectionStore_INSTANCE__');
        targetWindow.__MyIOSelectionStore_INSTANCE__ = this;
        this._log('log', '[SelectionStore] ✅ Stored in top window! Verify:', !!targetWindow.__MyIOSelectionStore_INSTANCE__);
      }
    } catch (e) {
      // Cross-origin iframe - can't access window.top
      this._log('warn', '[SelectionStore] ⚠️ Cannot access window.top (cross-origin iframe):', e.message);

      // Fallback to document
      if (typeof document !== 'undefined') {
        this._log('log', '[SelectionStore] 💾 Storing instance in document.__MyIOSelectionStore_INSTANCE__ (fallback)');
        document.__MyIOSelectionStore_INSTANCE__ = this;
        this._log('log', '[SelectionStore] ✅ Stored! Verify:', !!document.__MyIOSelectionStore_INSTANCE__);
      }
    }
  }

  // Core Selection Methods
  add(id) {
    this._log('log', "[MyIOSelectionStoreClass] Entrou na LIB", id)
    const wasSelected = this.selectedIds.has(id);

    // Se já está selecionado, não faz nada
    if (wasSelected) {
      this._log('log', "[MyIOSelectionStoreClass] Item já está selecionado:", id);
      return;
    }

    // Verifica se atingiu o limite máximo
    if (this.selectedIds.size >= this.MAX_SELECTION) {
      this._log('warn', `[MyIOSelectionStoreClass] Limite de seleção atingido (${this.MAX_SELECTION})`);
      this._emit('selection:limit-reached', {
        maxAllowed: this.MAX_SELECTION,
        currentCount: this.selectedIds.size,
        attemptedId: id
      });
      this._trackEvent('selection.limit_reached', {
        entityId: id,
        limit: this.MAX_SELECTION
      });
      return;
    }

    this.selectedIds.add(id);
    this._emitSelectionChange('add', id);
    this._trackEvent('footer_dock.drop_add', { entityId: id });
  }

  remove(id) {
    this._log('log', "[MyIOSelectionStoreClass] ITEM PARA REMOÇÃO ID",id);
    // Check if ID exists in the Set
    if (!this.selectedIds.has(id)) return; // not found
    this._log('log', "[MyIOSelectionStoreClass] DELETE ID",id)
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
      status: entity.status || 'unknown',
      ingestionId: entity.ingestionId || entity.id,  // ⭐ ADD: Store ingestionId for API calls
      customerName: entity.customerName || '',
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
    this._log('log', "[MyIOSelectionStoreClass] biblioteca:",this.getSelectedIds() )
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
    this._log('log', `[SelectionStore] 📝 Registering listener for event: ${event}`);

    if (typeof event !== 'string' || typeof callback !== 'function') {
      this._log('error', `[SelectionStore] ❌ Invalid registration: event=${typeof event}, callback=${typeof callback}`);
      return;
    }

    if (!this.eventListeners.has(event)) {
      this._log('log', `[SelectionStore] 🆕 Creating new listener array for: ${event}`);
      this.eventListeners.set(event, []);
    }

    this.eventListeners.get(event).push(callback);
    this._log('log', `[SelectionStore] ✅ Listener registered! Total for ${event}: ${this.eventListeners.get(event).length}`);
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
    this._log('log', `[SelectionStore] 🔔 Emitting event: ${event}, listeners: ${this.eventListeners.get(event)?.length || 0}`);
    this._log('log', `[SelectionStore] 📦 Event data:`, data);

    if (!this.eventListeners.has(event)) {
      this._log('warn', `[SelectionStore] ⚠️ No listener map for event: ${event}`);
      return;
    }

    const listeners = this.eventListeners.get(event);
    if (listeners.length === 0) {
      this._log('warn', `[SelectionStore] ⚠️ No listeners registered for event: ${event}`);
    }

    listeners.forEach((callback, index) => {
      this._log('log', `[SelectionStore] 🎯 Calling listener #${index} for ${event}`);
      try {
        callback(data);
      } catch (error) {
        this._log('error', `[SelectionStore] ❌ Error in ${event} listener #${index}:`, error);
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
      this._log('error', 'Analytics tracking error:', error);
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

// Module-level logging helper (respects GlobalDebug)
function _moduleLog(level, ...args) {
  if (!MyIOSelectionStoreClass.GlobalDebug) return;

  const logMethod = console[level] || console.log;
  logMethod.apply(console, args);
}

// Create singleton instance with getter/setter pattern to prevent overwrites
let MyIOSelectionStore;
let _singletonInstance = null; // Hidden instance holder

if (typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined') {
  _moduleLog('log', '[SelectionStore] 🔧 Module initialization - checking for existing instance...');

  // CRITICAL: Protect window.MyIOLibrary from being overwritten by UMD
  // The UMD does: global.MyIOLibrary = {} on each load, destroying previous references
  // We need to preserve the object across loads
  if (!globalThis.window.__MyIOLibrary_PROTECTED__) {
    _moduleLog('log', '[SelectionStore] 🛡️ Protecting window.MyIOLibrary object from UMD overwrites...');

    // Store reference to existing MyIOLibrary object (if any)
    const existingLib = globalThis.window.MyIOLibrary;

    // Define a getter/setter that preserves the object
    Object.defineProperty(globalThis.window, 'MyIOLibrary', {
      get: function() {
        // Return existing object or create new one if needed
        if (!globalThis.window.__MyIOLibrary_INSTANCE__) {
          _moduleLog('log', '[SelectionStore] 📦 Creating protected MyIOLibrary container object');
          globalThis.window.__MyIOLibrary_INSTANCE__ = existingLib || {};
        }
        return globalThis.window.__MyIOLibrary_INSTANCE__;
      },
      set: function(value) {
        // UMD tries to assign: global.MyIOLibrary = {}
        // We intercept this and merge properties instead of replacing
        _moduleLog('log', '[SelectionStore] 🔄 UMD tried to overwrite MyIOLibrary - merging properties instead');

        if (value && typeof value === 'object') {
          const currentLib = globalThis.window.__MyIOLibrary_INSTANCE__ || {};

          // Merge new properties from UMD into existing object
          Object.keys(value).forEach(key => {
            // Skip MyIOSelectionStore if it's already set correctly
            if (key === 'MyIOSelectionStore' && currentLib.MyIOSelectionStore) {
              _moduleLog('log', '[SelectionStore] ⏭️ Skipping MyIOSelectionStore - already set');
              return;
            }
            currentLib[key] = value[key];
          });

          globalThis.window.__MyIOLibrary_INSTANCE__ = currentLib;
        }
      },
      configurable: false,
      enumerable: true
    });

    globalThis.window.__MyIOLibrary_PROTECTED__ = true;
    _moduleLog('log', '[SelectionStore] ✅ window.MyIOLibrary protected!');
  }

  // Check window.top first (shared across iframes), then document and window
  let existingInstance = null;

  try {
    const targetWindow = (globalThis.window.top) ? globalThis.window.top : globalThis.window;
    existingInstance = targetWindow.__MyIOSelectionStore_INSTANCE__;
    _moduleLog('log', '[SelectionStore] window.top.__MyIOSelectionStore_INSTANCE__:', !!existingInstance);
  } catch (e) {
    _moduleLog('warn', '[SelectionStore] Cannot access window.top during module init:', e.message);
  }

  if (!existingInstance) {
    existingInstance = (typeof document !== 'undefined' && document.__MyIOSelectionStore_INSTANCE__)
      || globalThis.window.__MyIOSelectionStore_INSTANCE__;
    _moduleLog('log', '[SelectionStore] document.__MyIOSelectionStore_INSTANCE__:', !!(typeof document !== 'undefined' && document.__MyIOSelectionStore_INSTANCE__));
    _moduleLog('log', '[SelectionStore] window.__MyIOSelectionStore_INSTANCE__:', !!globalThis.window.__MyIOSelectionStore_INSTANCE__);
  }

  // FIRST: Check if constructor already created an instance (hidden global)
  if (existingInstance) {
    _moduleLog('log', '[SelectionStore] 🔄 REUSING constructor-created instance from __MyIOSelectionStore_INSTANCE__');
    _singletonInstance = existingInstance;
    MyIOSelectionStore = _singletonInstance;

    // CRITICAL: Also define window.MyIOSelectionStore to point to the same instance
    if (!Object.getOwnPropertyDescriptor(globalThis.window, 'MyIOSelectionStore')?.get) {
      _moduleLog('log', '[SelectionStore] 🔗 Defining window.MyIOSelectionStore getter to point to singleton');
      Object.defineProperty(globalThis.window, 'MyIOSelectionStore', {
        get: function() {
          return _singletonInstance;
        },
        set: function(value) {
          _moduleLog('warn', '[SelectionStore] ⚠️ Attempted to overwrite singleton - ignoring');
        },
        configurable: false,
        enumerable: true
      });
    }

    // CRITICAL: Also update window.MyIOLibrary.MyIOSelectionStore (UMD export)
    // The UMD bundle exports the module-level variable, but when reloading,
    // it creates a new module scope, so we need to explicitly update the reference
    if (globalThis.window.MyIOLibrary && typeof globalThis.window.MyIOLibrary === 'object') {
      _moduleLog('log', '[SelectionStore] 🔗 Updating window.MyIOLibrary.MyIOSelectionStore to point to singleton');
      globalThis.window.MyIOLibrary.MyIOSelectionStore = _singletonInstance;
    }
  }
  // SECOND: Check if a getter is already defined (instance already protected)
  else if (Object.getOwnPropertyDescriptor(globalThis.window, 'MyIOSelectionStore')?.get) {
    // Getter already defined, reuse existing instance
    _moduleLog('log', '[SelectionStore] 🔄 REUSING protected global instance via getter');
    MyIOSelectionStore = globalThis.window.MyIOSelectionStore;
    _singletonInstance = MyIOSelectionStore;

    // Also update window.MyIOLibrary.MyIOSelectionStore (UMD export)
    if (globalThis.window.MyIOLibrary && typeof globalThis.window.MyIOLibrary === 'object') {
      _moduleLog('log', '[SelectionStore] 🔗 Updating window.MyIOLibrary.MyIOSelectionStore to point to singleton');
      globalThis.window.MyIOLibrary.MyIOSelectionStore = _singletonInstance;
    }
  }
  // THIRD: Check if instance exists as plain property - upgrade it to protected getter
  else if (globalThis.window.MyIOSelectionStore && typeof globalThis.window.MyIOSelectionStore === 'object') {
    // Instance exists as plain property - upgrade it to protected getter
    _moduleLog('log', '[SelectionStore] 🔒 UPGRADING existing instance to protected');
    _singletonInstance = globalThis.window.MyIOSelectionStore;
    MyIOSelectionStore = _singletonInstance;

    // Replace with getter that always returns same instance
    Object.defineProperty(globalThis.window, 'MyIOSelectionStore', {
      get: function() {
        return _singletonInstance;
      },
      set: function(value) {
        _moduleLog('warn', '[SelectionStore] ⚠️ Attempted to overwrite singleton - ignoring');
        // Silently ignore attempts to overwrite
      },
      configurable: false,
      enumerable: true
    });

    // Also update window.MyIOLibrary.MyIOSelectionStore (UMD export)
    if (globalThis.window.MyIOLibrary && typeof globalThis.window.MyIOLibrary === 'object') {
      _moduleLog('log', '[SelectionStore] 🔗 Updating window.MyIOLibrary.MyIOSelectionStore to point to singleton');
      globalThis.window.MyIOLibrary.MyIOSelectionStore = _singletonInstance;
    }
  } else {
    // Create new instance and protect it with getter
    _moduleLog('log', '[SelectionStore] 🆕 Creating new protected singleton instance');
    _singletonInstance = new MyIOSelectionStoreClass();
    MyIOSelectionStore = _singletonInstance;

    // Define getter/setter that protects the singleton
    Object.defineProperty(globalThis.window, 'MyIOSelectionStore', {
      get: function() {
        return _singletonInstance;
      },
      set: function(value) {
        _moduleLog('warn', '[SelectionStore] ⚠️ Attempted to overwrite singleton - ignoring');
        // Silently ignore attempts to overwrite
      },
      configurable: false,
      enumerable: true
    });

    // Also set window.MyIOLibrary.MyIOSelectionStore (UMD export)
    if (globalThis.window.MyIOLibrary && typeof globalThis.window.MyIOLibrary === 'object') {
      _moduleLog('log', '[SelectionStore] 🔗 Setting window.MyIOLibrary.MyIOSelectionStore to singleton');
      globalThis.window.MyIOLibrary.MyIOSelectionStore = _singletonInstance;
    }

    _moduleLog('log', '[SelectionStore] 🔒 Instance protected and ready');
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
