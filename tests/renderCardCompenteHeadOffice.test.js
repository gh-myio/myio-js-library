// tests/renderCardCompenteHeadOffice.test.js

/* eslint-env browser */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderCardCompenteHeadOffice } from '../src/thingsboard/main-dashboard-shopping/v-4.0.0/card/head-office/card-head-office.js';

// Mock DOM environment
const { JSDOM } = await import('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;

describe('renderCardCompenteHeadOffice', () => {
  let container;
  let mockEntityObject;

  beforeEach(() => {
    // Create a fresh container for each test
    container = document.createElement('div');
    document.body.appendChild(container);

    // Mock entity object
    mockEntityObject = {
      entityId: 'TEST-001',
      labelOrName: 'Test Device',
      deviceIdentifier: 'TEST-001',
      deviceType: 'ELEVADOR',
      val: 25.5,
      valType: 'power_kw',
      perc: 85,
      connectionStatus: 'RUNNING',
      temperatureC: 26,
      operationHours: 12.5,
      timaVal: Date.now()
    };
  });

  afterEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
  });

  describe('Basic Rendering', () => {
    it('should render a card with minimal entity object', () => {
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      expect(container.children.length).toBe(1);
      expect(container.querySelector('.myio-ho-card')).toBeTruthy();
      expect(card).toHaveProperty('update');
      expect(card).toHaveProperty('destroy');
      expect(card).toHaveProperty('getRoot');
    });

    it('should throw error if container is null', () => {
      expect(() => {
        renderCardCompenteHeadOffice(null, { entityObject: mockEntityObject });
      }).toThrow('renderCardCompenteHeadOffice: containerEl is required');
    });

    it('should throw error if entityObject is missing', () => {
      expect(() => {
        renderCardCompenteHeadOffice(container, {});
      }).toThrow('renderCardCompenteHeadOffice: entityObject is required');
    });

    it('should generate temporary ID if entityId is missing', () => {
      const entityWithoutId = { ...mockEntityObject };
      delete entityWithoutId.entityId;

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: entityWithoutId
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('entityId is missing')
      );
      expect(card.getRoot().getAttribute('data-entity-id')).toMatch(/^temp-/);
      
      consoleSpy.mockRestore();
    });
  });

  describe('DOM Structure', () => {
    it('should create correct DOM structure', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      const card = container.querySelector('.myio-ho-card');
      expect(card).toBeTruthy();
      expect(card.getAttribute('data-entity-id')).toBe('TEST-001');

      // Check main sections
      expect(card.querySelector('.myio-ho-card__header')).toBeTruthy();
      expect(card.querySelector('.myio-ho-card__status')).toBeTruthy();
      expect(card.querySelector('.myio-ho-card__primary')).toBeTruthy();
      expect(card.querySelector('.myio-ho-card__eff')).toBeTruthy();
      expect(card.querySelector('.myio-ho-card__footer')).toBeTruthy();
    });

    it('should display device name and identifier', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      const nameEl = container.querySelector('.myio-ho-card__name');
      const codeEl = container.querySelector('.myio-ho-card__code');

      expect(nameEl.textContent).toBe('Test Device');
      expect(codeEl.textContent).toBe('TEST-001');
    });

    it('should show selection checkbox when enabled', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject,
        enableSelection: true
      });

      const checkbox = container.querySelector('.myio-ho-card__select input[type="checkbox"]');
      expect(checkbox).toBeTruthy();
    });

    it('should hide selection checkbox when disabled', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject,
        enableSelection: false
      });

      const selectLabel = container.querySelector('.myio-ho-card__select');
      expect(selectLabel).toBeFalsy();
    });

    it('should set draggable attribute when drag and drop enabled', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject,
        enableDragDrop: true
      });

      const card = container.querySelector('.myio-ho-card');
      expect(card.getAttribute('draggable')).toBe('true');
    });
  });

  describe('Status Display', () => {
    it('should display correct status chip for RUNNING status', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, connectionStatus: 'RUNNING' }
      });

      const chip = container.querySelector('.chip');
      expect(chip.classList.contains('chip--ok')).toBe(true);
      expect(chip.textContent).toBe('Em operação');
    });

    it('should display correct status chip for ALERT status', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, connectionStatus: 'ALERT' }
      });

      const chip = container.querySelector('.chip');
      const card = container.querySelector('.myio-ho-card');
      
      expect(chip.classList.contains('chip--alert')).toBe(true);
      expect(chip.textContent).toBe('Alerta');
      expect(card.classList.contains('is-alert')).toBe(true);
    });

    it('should display correct status chip for FAILURE status', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, connectionStatus: 'FAILURE' }
      });

      const chip = container.querySelector('.chip');
      const card = container.querySelector('.myio-ho-card');
      
      expect(chip.classList.contains('chip--failure')).toBe(true);
      expect(chip.textContent).toBe('Falha');
      expect(card.classList.contains('is-failure')).toBe(true);
    });

    it('should display correct status chip for OFFLINE status', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, connectionStatus: 'OFFLINE' }
      });

      const chip = container.querySelector('.chip');
      expect(chip.classList.contains('chip--offline')).toBe(true);
      expect(chip.textContent).toBe('Offline');
    });
  });

  describe('Value Formatting', () => {
    it('should format power values correctly', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, val: 25.567, valType: 'power_kw' }
      });

      const numSpan = container.querySelector('.myio-ho-card__value .num');
      const unitSpan = container.querySelector('.myio-ho-card__value .unit');

      expect(numSpan.textContent).toBe('25.6');
      expect(unitSpan.textContent).toBe('kW');
    });

    it('should format flow values correctly', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, val: 15.234, valType: 'flow_m3h' }
      });

      const numSpan = container.querySelector('.myio-ho-card__value .num');
      const unitSpan = container.querySelector('.myio-ho-card__value .unit');

      expect(numSpan.textContent).toBe('15.2');
      expect(unitSpan.textContent).toBe('m³/h');
    });

    it('should handle null/undefined values gracefully', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, val: null }
      });

      const numSpan = container.querySelector('.myio-ho-card__value .num');
      expect(numSpan.textContent).toBe('—');
    });

    it('should format efficiency percentage correctly', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, perc: 87.6 }
      });

      const percSpan = container.querySelector('.myio-ho-card__eff .perc');
      const barFill = container.querySelector('.bar__fill');

      expect(percSpan.textContent).toBe('88%');
      expect(barFill.style.width).toBe('87.6%');
    });

    it('should format temperature correctly', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, temperatureC: 26.7 }
      });

      const tempVal = container.querySelector('.myio-ho-card__footer .metric:nth-child(1) .val');
      expect(tempVal.textContent).toBe('27°C');
    });

    it('should format operation hours correctly', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, operationHours: 12.847 }
      });

      const opTimeVal = container.querySelector('.myio-ho-card__footer .metric:nth-child(2) .val');
      expect(opTimeVal.textContent).toBe('12.847h');
    });
  });

  describe('Event Handling', () => {
    it('should call handleActionDashboard when dashboard menu item clicked', () => {
      const handleActionDashboard = vi.fn();
      
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject,
        handleActionDashboard
      });

      const dashboardBtn = container.querySelector('[data-action="dashboard"]');
      dashboardBtn.click();

      expect(handleActionDashboard).toHaveBeenCalledWith(
        expect.any(Event),
        mockEntityObject
      );
    });

    it('should call handleSelect when checkbox is toggled', () => {
      const handleSelect = vi.fn();
      
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject,
        enableSelection: true,
        handleSelect
      });

      const checkbox = container.querySelector('.myio-ho-card__select input[type="checkbox"]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      expect(handleSelect).toHaveBeenCalledWith(true, mockEntityObject);
    });

    it('should toggle selected visual state when checkbox is checked', () => {
      const handleSelect = vi.fn();
      
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject,
        enableSelection: true,
        handleSelect
      });

      const card = container.querySelector('.myio-ho-card');
      const checkbox = container.querySelector('.myio-ho-card__select input[type="checkbox"]');

      // Initially not selected
      expect(card.classList.contains('is-selected')).toBe(false);

      // Check the checkbox
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      // Should have selected class
      expect(card.classList.contains('is-selected')).toBe(true);

      // Uncheck the checkbox
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));

      // Should not have selected class
      expect(card.classList.contains('is-selected')).toBe(false);
    });

    it('should call handleClickCard when card is clicked', () => {
      const handleClickCard = vi.fn();
      
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject,
        handleClickCard
      });

      const card = container.querySelector('.myio-ho-card');
      card.click();

      expect(handleClickCard).toHaveBeenCalledWith(
        expect.any(Event),
        mockEntityObject
      );
    });

    it('should toggle menu visibility when kebab button clicked', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      const kebabBtn = container.querySelector('.myio-ho-card__kebab');
      const menu = container.querySelector('.myio-ho-card__menu');

      // Initially hidden
      expect(menu.hasAttribute('hidden')).toBe(true);

      // Click to show
      kebabBtn.click();
      expect(menu.hasAttribute('hidden')).toBe(false);

      // Click to hide
      kebabBtn.click();
      expect(menu.hasAttribute('hidden')).toBe(true);
    });
  });

  describe('Update Functionality', () => {
    it('should update values when update() is called', () => {
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      card.update({
        val: 30.5,
        perc: 92,
        connectionStatus: 'ALERT'
      });

      const numSpan = container.querySelector('.myio-ho-card__value .num');
      const percSpan = container.querySelector('.myio-ho-card__eff .perc');
      const chip = container.querySelector('.chip');
      const cardEl = container.querySelector('.myio-ho-card');

      expect(numSpan.textContent).toBe('30.5');
      expect(percSpan.textContent).toBe('92%');
      expect(chip.classList.contains('chip--alert')).toBe(true);
      expect(cardEl.classList.contains('is-alert')).toBe(true);
    });

    it('should handle partial updates', () => {
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      const originalVal = container.querySelector('.myio-ho-card__value .num').textContent;
      
      card.update({
        perc: 95
      });

      const numSpan = container.querySelector('.myio-ho-card__value .num');
      const percSpan = container.querySelector('.myio-ho-card__eff .perc');

      expect(numSpan.textContent).toBe(originalVal); // Should remain unchanged
      expect(percSpan.textContent).toBe('95%'); // Should be updated
    });
  });

  describe('Cleanup', () => {
    it('should remove DOM element when destroy() is called', () => {
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      expect(container.children.length).toBe(1);

      card.destroy();

      expect(container.children.length).toBe(0);
    });

    it('should clean up event listeners when destroy() is called', () => {
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      const root = card.getRoot();
      expect(root._cleanup).toBeDefined();

      card.destroy();

      // After destroy, the cleanup function should have been called
      // and the element should be removed from DOM
      expect(container.contains(root)).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      const card = container.querySelector('.myio-ho-card');
      const progressBar = container.querySelector('.bar');
      const kebabBtn = container.querySelector('.myio-ho-card__kebab');
      const menu = container.querySelector('.myio-ho-card__menu');

      expect(card.getAttribute('role')).toBe('group');
      expect(progressBar.getAttribute('role')).toBe('progressbar');
      expect(progressBar.getAttribute('aria-valuemin')).toBe('0');
      expect(progressBar.getAttribute('aria-valuemax')).toBe('100');
      expect(kebabBtn.getAttribute('aria-label')).toBe('Open actions');
      expect(kebabBtn.getAttribute('aria-haspopup')).toBe('menu');
      expect(menu.getAttribute('role')).toBe('menu');
    });

    it('should update ARIA attributes when values change', () => {
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      card.update({ perc: 75 });

      const progressBar = container.querySelector('.bar');
      expect(progressBar.getAttribute('aria-valuenow')).toBe('75');
      expect(progressBar.getAttribute('aria-label')).toBe('Eficiência 75%');
    });
  });

  describe('Internationalization', () => {
    it('should use custom i18n labels when provided', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject,
        i18n: {
          in_operation: 'Operating',
          efficiency: 'Performance',
          temperature: 'Temp'
        }
      });

      const chip = container.querySelector('.chip');
      const effLabel = container.querySelector('.myio-ho-card__eff .label');
      const tempLabel = container.querySelector('.myio-ho-card__footer .metric:nth-child(1) .label');

      expect(chip.textContent).toBe('Operating');
      expect(effLabel.textContent).toBe('Performance');
      expect(tempLabel.textContent).toBe('Temp');
    });
  });

  describe('CSS Injection', () => {
    it('should inject CSS only once', () => {
      // Clear any existing styles
      document.head.innerHTML = '';

      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      const styleElements = document.querySelectorAll('style[data-myio-css="head-office-card-v1"]');
      expect(styleElements.length).toBe(1);

      // Create another card
      const container2 = document.createElement('div');
      document.body.appendChild(container2);

      renderCardCompenteHeadOffice(container2, {
        entityObject: { ...mockEntityObject, entityId: 'TEST-002' }
      });

      const styleElementsAfter = document.querySelectorAll('style[data-myio-css="head-office-card-v1"]');
      expect(styleElementsAfter.length).toBe(1); // Should still be only one
    });
  });

  describe('Device Type Icons', () => {
    it('should use correct icon for known device types', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, deviceType: 'CHILLER' }
      });

      const iconContainer = container.querySelector('.myio-ho-card__icon');
      expect(iconContainer.innerHTML).toContain('svg');
      expect(iconContainer.innerHTML).toContain('stroke="currentColor"'); // Chiller uses stroke
    });

    it('should use fallback icon for unknown device types', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, deviceType: 'UNKNOWN_TYPE' }
      });

      const iconContainer = container.querySelector('.myio-ho-card__icon');
      expect(iconContainer.innerHTML).toContain('svg');
      // Should contain the gear icon (fallback)
      expect(iconContainer.innerHTML).toContain('path');
    });
  });
});
