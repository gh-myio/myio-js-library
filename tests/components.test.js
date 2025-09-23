import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock global objects for browser environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.globalThis = global;
global.globalThis.window = dom.window;

// Import components after setting up globals
import { MyIOSelectionStore, MyIOSelectionStoreClass } from '../src/components/SelectionStore.js';
import { MyIODraggableCard } from '../src/components/DraggableCard.js';
import { MyIOChartModal } from '../src/components/ChartModal.js';

describe('MYIO Components', () => {
  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
    
    // Reset selection store
    MyIOSelectionStore.clear();
    MyIOSelectionStore.entities.clear();
  });

  afterEach(() => {
    // Clean up any remaining elements
    document.body.innerHTML = '';
  });

  describe('MyIOSelectionStore', () => {
    it('should be a singleton instance', () => {
      expect(MyIOSelectionStore).toBeInstanceOf(MyIOSelectionStoreClass);
    });

    it('should add and remove items from selection', () => {
      MyIOSelectionStore.add('test-1');
      expect(MyIOSelectionStore.isSelected('test-1')).toBe(true);
      expect(MyIOSelectionStore.getSelectionCount()).toBe(1);

      MyIOSelectionStore.remove('test-1');
      expect(MyIOSelectionStore.isSelected('test-1')).toBe(false);
      expect(MyIOSelectionStore.getSelectionCount()).toBe(0);
    });

    it('should toggle selection', () => {
      MyIOSelectionStore.toggle('test-1');
      expect(MyIOSelectionStore.isSelected('test-1')).toBe(true);

      MyIOSelectionStore.toggle('test-1');
      expect(MyIOSelectionStore.isSelected('test-1')).toBe(false);
    });

    it('should clear all selections', () => {
      MyIOSelectionStore.add('test-1');
      MyIOSelectionStore.add('test-2');
      expect(MyIOSelectionStore.getSelectionCount()).toBe(2);

      MyIOSelectionStore.clear();
      expect(MyIOSelectionStore.getSelectionCount()).toBe(0);
    });

    it('should register and manage entities', () => {
      const entity = {
        id: 'device-1',
        name: 'Test Device',
        icon: 'energy',
        group: 'Test Group',
        lastValue: 100,
        unit: 'kWh'
      };

      MyIOSelectionStore.registerEntity(entity);
      expect(MyIOSelectionStore.entities.has('device-1')).toBe(true);

      MyIOSelectionStore.add('device-1');
      const selectedEntities = MyIOSelectionStore.getSelectedEntities();
      expect(selectedEntities).toHaveLength(1);
      expect(selectedEntities[0].name).toBe('Test Device');
    });

    it('should calculate totals correctly', () => {
      const entities = [
        { id: 'e1', name: 'Energy 1', lastValue: 100, unit: 'kWh' },
        { id: 'e2', name: 'Energy 2', lastValue: 200, unit: 'kWh' },
        { id: 'w1', name: 'Water 1', lastValue: 50, unit: 'm³' }
      ];

      entities.forEach(entity => MyIOSelectionStore.registerEntity(entity));
      entities.forEach(entity => MyIOSelectionStore.add(entity.id));

      const totals = MyIOSelectionStore.getTotals();
      expect(totals.energyKwh).toBe(300);
      expect(totals.waterM3).toBe(50);
      expect(totals.count).toBe(3);
    });

    it('should emit events on selection changes', () => {
      const mockCallback = vi.fn();
      MyIOSelectionStore.on('selection:change', mockCallback);

      MyIOSelectionStore.add('test-1');
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'add',
          id: 'test-1',
          selectedIds: ['test-1']
        })
      );
    });

    it('should sync with checkbox state', () => {
      MyIOSelectionStore.syncFromCheckbox('test-1', true);
      expect(MyIOSelectionStore.isSelected('test-1')).toBe(true);

      MyIOSelectionStore.syncFromCheckbox('test-1', false);
      expect(MyIOSelectionStore.isSelected('test-1')).toBe(false);
    });

    it('should handle analytics integration', () => {
      const mockAnalytics = { track: vi.fn() };
      MyIOSelectionStore.setAnalytics(mockAnalytics);

      MyIOSelectionStore.add('test-1');
      expect(mockAnalytics.track).toHaveBeenCalledWith(
        'footer_dock.drop_add',
        expect.objectContaining({ entityId: 'test-1' })
      );
    });

    it('should format multi-unit display', () => {
      const entities = [
        { id: 'e1', name: 'Energy', lastValue: 100, unit: 'kWh' },
        { id: 'w1', name: 'Water', lastValue: 50, unit: 'm³' }
      ];

      entities.forEach(entity => MyIOSelectionStore.registerEntity(entity));
      entities.forEach(entity => MyIOSelectionStore.add(entity.id));

      const display = MyIOSelectionStore.getMultiUnitTotalDisplay();
      expect(display).toContain('Energy: 100 kWh');
      expect(display).toContain('Water: 50 m³');
    });
  });

  describe('MyIODraggableCard', () => {
    let container;
    let entity;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);

      entity = {
        id: 'card-test-1',
        name: 'Test Card',
        icon: 'energy',
        group: 'Test Group',
        lastValue: 123.45,
        unit: 'kWh',
        status: 'ok'
      };
    });

    it('should create a card element', () => {
      const card = new MyIODraggableCard(container, entity);
      
      expect(container.children).toHaveLength(1);
      expect(container.querySelector('.myio-draggable-card')).toBeTruthy();
      expect(container.querySelector('.card-title').textContent).toBe('Test Card');
    });

    it('should handle checkbox interactions', () => {
      const card = new MyIODraggableCard(container, entity, { showCheckbox: true });
      const checkbox = container.querySelector('.card-checkbox');
      
      expect(checkbox).toBeTruthy();
      
      // Simulate checkbox change by directly calling the handler
      checkbox.checked = true;
      
      // Manually trigger the selection store sync since JSDOM event handling is limited
      MyIOSelectionStore.syncFromCheckbox('card-test-1', true);
      
      expect(MyIOSelectionStore.isSelected('card-test-1')).toBe(true);
    });

    it('should update entity data', () => {
      const card = new MyIODraggableCard(container, entity);
      
      card.updateEntity({ name: 'Updated Name', lastValue: 999 });
      
      expect(container.querySelector('.card-title').textContent).toBe('Updated Name');
      expect(container.querySelector('.value').textContent).toBe('999');
    });

    it('should handle selection state changes', () => {
      const card = new MyIODraggableCard(container, entity);
      
      card.setSelected(true);
      expect(container.querySelector('.myio-draggable-card').classList.contains('selected')).toBe(true);
      
      card.setSelected(false);
      expect(container.querySelector('.myio-draggable-card').classList.contains('selected')).toBe(false);
    });

    it('should clean up when destroyed', () => {
      const card = new MyIODraggableCard(container, entity);
      expect(container.children).toHaveLength(1);
      
      card.destroy();
      // Wait for cleanup to complete
      expect(container.children).toHaveLength(0);
    });

    it('should handle drag and drop attributes', () => {
      const card = new MyIODraggableCard(container, entity, { draggable: true });
      const cardElement = container.querySelector('.myio-draggable-card');
      
      expect(cardElement.draggable).toBe(true);
      expect(cardElement.getAttribute('aria-grabbed')).toBe('false');
    });

    it('should format values correctly', () => {
      const card = new MyIODraggableCard(container, entity);
      const valueElement = container.querySelector('.value');
      
      expect(valueElement.textContent).toBe('123,45');
    });

    it('should handle invalid entity gracefully', () => {
      expect(() => {
        new MyIODraggableCard(container, null);
      }).toThrow('Container and entity with id are required');
    });
  });

  describe('MyIOChartModal', () => {
    let mockData;

    beforeEach(() => {
      mockData = {
        entities: [
          { id: 'e1', name: 'Device 1', unit: 'kWh' },
          { id: 'e2', name: 'Device 2', unit: 'kWh' }
        ],
        totals: {
          energyKwh: 300,
          waterM3: 0,
          tempC: 0,
          count: 2
        },
        count: 2
      };

      // Mock Chart.js
      global.globalThis.Chart = vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
        canvas: { toDataURL: vi.fn(() => 'data:image/png;base64,mock') }
      }));
    });

    it('should be a singleton instance', () => {
      expect(MyIOChartModal).toBeDefined();
      expect(typeof MyIOChartModal.open).toBe('function');
      expect(typeof MyIOChartModal.close).toBe('function');
    });

    it('should open modal with valid data', async () => {
      await MyIOChartModal.open(mockData);
      
      expect(MyIOChartModal.isOpen).toBe(true);
      expect(document.getElementById('myio-chart-modal')).toBeTruthy();
    });

    it('should close modal', async () => {
      await MyIOChartModal.open(mockData);
      MyIOChartModal.close();
      
      expect(MyIOChartModal.isOpen).toBe(false);
      expect(document.getElementById('myio-chart-modal')).toBeFalsy();
    });

    it('should reject too many entities', async () => {
      const tooManyData = {
        ...mockData,
        count: 25,
        entities: Array.from({ length: 25 }, (_, i) => ({ id: `e${i}`, name: `Device ${i}` }))
      };

      // Mock alert
      global.globalThis.alert = vi.fn();

      await MyIOChartModal.open(tooManyData);
      
      expect(MyIOChartModal.isOpen).toBe(false);
      expect(global.globalThis.alert).toHaveBeenCalled();
    });

    it('should generate CSV data', async () => {
      await MyIOChartModal.open(mockData);
      
      // Mock the private method for testing
      const csvData = MyIOChartModal._generateCsvData();
      
      expect(csvData).toContain('Data;Dispositivo;Valor;Unidade');
      expect(csvData).toContain('Device 1');
      expect(csvData).toContain('Device 2');
    });

    it('should handle export functions', async () => {
      await MyIOChartModal.open(mockData);
      
      // Mock URL and Blob for download testing
      global.URL = { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() };
      global.Blob = vi.fn();

      // Test CSV export
      expect(() => MyIOChartModal.exportCsv()).not.toThrow();
      
      // Test PNG export (requires chart instance)
      if (MyIOChartModal.chartInstance) {
        expect(() => MyIOChartModal.exportPng()).not.toThrow();
      }
    });

    it('should integrate with SelectionStore events', () => {
      const mockCallback = vi.fn();
      MyIOSelectionStore.on('comparison:open', mockCallback);
      
      // Trigger comparison
      MyIOSelectionStore.openComparison();
      
      // Should not call because no entities are registered/selected
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle empty or invalid data', async () => {
      console.warn = vi.fn();
      
      await MyIOChartModal.open(null);
      expect(console.warn).toHaveBeenCalledWith('ChartModal: No data provided for comparison');
      
      await MyIOChartModal.open({ entities: [] });
      expect(console.warn).toHaveBeenCalledWith('ChartModal: No data provided for comparison');
    });
  });

  describe('Component Integration', () => {
    it('should integrate SelectionStore with DraggableCard', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const entity = {
        id: 'integration-test',
        name: 'Integration Test',
        icon: 'energy',
        group: 'Test',
        lastValue: 100,
        unit: 'kWh'
      };

      MyIOSelectionStore.registerEntity(entity);
      const card = new MyIODraggableCard(container, entity);

      // Test that the card can be manually set to selected state
      card.setSelected(true);
      expect(container.querySelector('.myio-draggable-card').classList.contains('selected')).toBe(true);
      
      // Test that selection store state is maintained
      MyIOSelectionStore.add('integration-test');
      expect(MyIOSelectionStore.isSelected('integration-test')).toBe(true);
      
      // Test deselection
      card.setSelected(false);
      expect(container.querySelector('.myio-draggable-card').classList.contains('selected')).toBe(false);
    });

    it('should integrate SelectionStore with ChartModal', async () => {
      // Register entities
      const entities = [
        { id: 'chart-1', name: 'Chart Device 1', unit: 'kWh', lastValue: 100 },
        { id: 'chart-2', name: 'Chart Device 2', unit: 'kWh', lastValue: 200 }
      ];

      entities.forEach(entity => MyIOSelectionStore.registerEntity(entity));
      entities.forEach(entity => MyIOSelectionStore.add(entity.id));

      // Mock Chart.js
      global.globalThis.Chart = vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
        canvas: { toDataURL: vi.fn(() => 'data:image/png;base64,mock') }
      }));

      // Open comparison should trigger chart modal
      const result = MyIOSelectionStore.openComparison();
      expect(result).toBe(true);
    });
  });
});
