// tests/components/cards/head-office/v5.2.0/card-head-office.test.js
// Smoke test for the Head Office card after the move to
// src/components/cards/head-office/v5.2.0 (was v-4.0.0/card/head-office).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderCardComponentHeadOffice } from '../../../../../src/components/cards/head-office/v5.2.0/index.js';

describe('renderCardComponentHeadOffice (components/cards/head-office/v5.2.0)', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('is exported as a function', () => {
    expect(typeof renderCardComponentHeadOffice).toBe('function');
  });

  it('throws when containerEl is missing', () => {
    expect(() => renderCardComponentHeadOffice(undefined, { entityObject: {} })).toThrow(
      /containerEl is required/
    );
  });

  it('throws when entityObject is missing', () => {
    expect(() => renderCardComponentHeadOffice(container, {})).toThrow(/entityObject is required/);
  });

  it('renders a card into the container and returns a handle', () => {
    const handle = renderCardComponentHeadOffice(container, {
      entityObject: {
        entityId: 'TEST-001',
        labelOrName: 'Test Device',
        deviceIdentifier: 'TEST-001',
        deviceType: 'ELEVADOR',
        val: 25.0,
        valType: 'power_kw',
        connectionStatus: 'RUNNING',
        temperatureC: 26,
        operationHours: '12h 30m',
        timaVal: Date.now() - 60000 * 5,
        consumptionTargetValue: 100.0,
        consumptionToleranceValue: 110.0,
        consumptionExcessValue: 120.0,
      },
    });

    expect(container.children.length).toBeGreaterThan(0);
    expect(handle).toBeTruthy();
    expect(typeof handle.update).toBe('function');
  });
});
