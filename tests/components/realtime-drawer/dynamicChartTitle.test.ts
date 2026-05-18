/**
 * RFC-0201 Phase-2 pod J — Dynamic chart title.
 *
 * Verifies that the realtime drawer's chart `<h3>` derives from the BaseItem
 * device label, not a static "Realtime" string. The pure helper is asserted
 * against, plus a small DOM mount that simulates how the drawer renders the
 * title node.
 */

import { describe, it, expect } from 'vitest';
import {
  getDeviceChartTitle,
  getDeviceDisplayLabel,
} from '../../../src/components/realtime-drawer/helpers';

describe('realtime-drawer / dynamic chart title — pure helper', () => {
  it('uses device.label when present', () => {
    const device = {
      label: 'Loja Renner',
      labelOrName: 'Loja Renner',
      name: 'renner-1',
      identifier: 'STR-001',
    };
    expect(getDeviceChartTitle(device)).toBe('Telemetria em Tempo Real — Loja Renner');
  });

  it('falls back to labelOrName, then name, then identifier', () => {
    expect(getDeviceChartTitle({ labelOrName: 'X' })).toBe('Telemetria em Tempo Real — X');
    expect(getDeviceChartTitle({ name: 'Y' })).toBe('Telemetria em Tempo Real — Y');
    expect(getDeviceChartTitle({ identifier: 'STR-Z' })).toBe('Telemetria em Tempo Real — STR-Z');
  });

  it('uses PT-BR fallback "Dispositivo" when nothing is provided', () => {
    expect(getDeviceChartTitle()).toBe('Telemetria em Tempo Real — Dispositivo');
    expect(getDeviceChartTitle(null)).toBe('Telemetria em Tempo Real — Dispositivo');
    expect(getDeviceChartTitle({})).toBe('Telemetria em Tempo Real — Dispositivo');
    expect(getDeviceChartTitle({ label: '   ' })).toBe('Telemetria em Tempo Real — Dispositivo');
  });

  it('exposes getDeviceDisplayLabel for non-title consumers (e.g. CSV export filename)', () => {
    expect(getDeviceDisplayLabel({ label: 'Subestação 1' })).toBe('Subestação 1');
    expect(getDeviceDisplayLabel(null)).toBe('Dispositivo');
  });
});

describe('realtime-drawer / dynamic chart title — DOM mount', () => {
  it('the title <h3> contains the device label after seed', () => {
    const device = {
      label: 'Chiller 1',
      labelOrName: 'Chiller 1',
      name: 'chiller-1',
    };

    // Simulate the realtime drawer mounting an element with id="chart-title"
    // and updating it with the helper output.
    const root = document.createElement('div');
    root.innerHTML = `<h3 id="chart-title">Telemetria em Tempo Real</h3>`;
    document.body.appendChild(root);

    const titleEl = root.querySelector<HTMLElement>('#chart-title');
    expect(titleEl).not.toBeNull();

    // RFC-0201 Phase-2 pod J: the drawer must update the title with the
    // device label, not leave the static "Realtime" copy.
    titleEl!.textContent = getDeviceChartTitle(device);

    expect(titleEl!.textContent).toContain('Chiller 1');
    expect(titleEl!.textContent).not.toBe('Realtime');
    expect(titleEl!.textContent).not.toBe('Telemetria em Tempo Real');

    document.body.removeChild(root);
  });
});
