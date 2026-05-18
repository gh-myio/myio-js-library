/**
 * RFC-0201 Phase-2 pod J — Status icon next to telemetry value.
 *
 * Verifies the small dot adjacent to the numeric realtime value picks the
 * right colour bucket from the BaseItem `deviceStatus` field. The helper
 * is asserted against, plus a tiny DOM mount that mirrors the drawer's
 * "value + dot" layout.
 */

import { describe, it, expect } from 'vitest';
import {
  bucketStatus,
  statusDotClass,
  getRealtimeStatusIcon,
} from '../../../src/components/realtime-drawer/helpers';

describe('realtime-drawer / status icon — bucket + class helpers', () => {
  it('online statuses map to "online" -> green dot class', () => {
    for (const s of ['power_on', 'online', 'normal', 'ok', 'running', 'active']) {
      expect(bucketStatus(s)).toBe('online');
      expect(statusDotClass('online')).toContain('rtt-status-dot--online');
    }
  });

  it('offline statuses map to "offline" -> red dot class', () => {
    for (const s of ['offline', 'no_info']) {
      expect(bucketStatus(s)).toBe('offline');
    }
    expect(statusDotClass('offline')).toContain('rtt-status-dot--offline');
  });

  it('weak/bad statuses map to "weak" -> yellow dot class', () => {
    for (const s of ['weak_connection', 'conexao_fraca', 'bad', 'weak']) {
      expect(bucketStatus(s)).toBe('weak');
    }
    expect(statusDotClass('weak')).toContain('rtt-status-dot--weak');
  });

  it('unknown / null / undefined statuses fall through to "unknown" (NOT online)', () => {
    expect(bucketStatus(undefined)).toBe('unknown');
    expect(bucketStatus(null)).toBe('unknown');
    expect(bucketStatus('')).toBe('unknown');
    expect(bucketStatus('foobar')).toBe('unknown');
    expect(statusDotClass('unknown')).toContain('rtt-status-dot--unknown');
  });

  it('case-insensitive matching', () => {
    expect(bucketStatus('OFFLINE')).toBe('offline');
    expect(bucketStatus(' Online ')).toBe('online');
    expect(bucketStatus('Bad')).toBe('weak');
  });

  it('getRealtimeStatusIcon returns a structured object usable directly in render', () => {
    const off = getRealtimeStatusIcon('offline');
    expect(off.bucket).toBe('offline');
    expect(off.className).toContain('rtt-status-dot--offline');
    expect(off.ariaLabel).toBe('Dispositivo offline');

    const onl = getRealtimeStatusIcon('power_on');
    expect(onl.bucket).toBe('online');
    expect(onl.className).toContain('rtt-status-dot--online');

    const weak = getRealtimeStatusIcon('weak_connection');
    expect(weak.bucket).toBe('weak');
    expect(weak.className).toContain('rtt-status-dot--weak');
  });
});

describe('realtime-drawer / status icon — DOM render', () => {
  it("offline device renders a span with 'rtt-status-dot--offline' class adjacent to the value", () => {
    const device = { deviceStatus: 'offline' };
    const root = document.createElement('div');
    document.body.appendChild(root);

    // Simulate the drawer rendering "<value> <dot>"
    const valueEl = document.createElement('span');
    valueEl.className = 'rtt-value';
    valueEl.textContent = '0.85';
    const dotEl = document.createElement('span');
    const meta = getRealtimeStatusIcon(device.deviceStatus);
    dotEl.className = meta.className;
    dotEl.setAttribute('aria-label', meta.ariaLabel);
    root.appendChild(valueEl);
    root.appendChild(dotEl);

    const found = root.querySelector('.rtt-status-dot--offline');
    expect(found).not.toBeNull();
    expect(found?.getAttribute('aria-label')).toBe('Dispositivo offline');

    // Sibling layout: dot is adjacent to the numeric value
    expect(valueEl.nextElementSibling).toBe(dotEl);

    document.body.removeChild(root);
  });

  it('online device renders the green dot class', () => {
    const device = { deviceStatus: 'power_on' };
    const root = document.createElement('div');
    document.body.appendChild(root);
    const dotEl = document.createElement('span');
    dotEl.className = getRealtimeStatusIcon(device.deviceStatus).className;
    root.appendChild(dotEl);
    expect(root.querySelector('.rtt-status-dot--online')).not.toBeNull();
    expect(root.querySelector('.rtt-status-dot--offline')).toBeNull();
    document.body.removeChild(root);
  });
});
