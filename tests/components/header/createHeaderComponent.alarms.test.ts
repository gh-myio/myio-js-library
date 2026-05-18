/**
 * RFC-0183 / RFC-0201 Phase-1 — AC-RFC-0183-3 + isInternalSupportRule
 *
 * Verifies that:
 *   1. `createHeaderComponent({ tooltipWidth: 320 })` injects the desktop
 *      tooltip-width CSS var to the page (Sally's UX spec).
 *   2. `getAlarmCount()` reads from `window.AlarmServiceOrchestrator` and
 *      filters internal-support entries when `isInternalSupportRule = true`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHeaderComponent } from '../../../src/components/header/createHeaderComponent';

/** Minimal fake AlarmServiceOrchestrator stub matching the shape the
 *  Header component reads (deviceAlarmMap with alarm objects). */
function fakeAlarmOrch(alarmsByDevice: Record<string, Array<Record<string, unknown>>>) {
  const map = new Map<string, Array<Record<string, unknown>>>();
  for (const [k, v] of Object.entries(alarmsByDevice)) map.set(k, v);
  return { deviceAlarmMap: map };
}

let mountEl: HTMLElement;

beforeEach(() => {
  mountEl = document.createElement('div');
  document.body.appendChild(mountEl);
});

afterEach(() => {
  // Clean up DOM between tests so the injected style tag doesn't leak.
  document.getElementById('myio-header-tooltip-width-vars')?.remove();
  mountEl.remove();
  delete (window as unknown as { AlarmServiceOrchestrator?: unknown }).AlarmServiceOrchestrator;
});

describe('RFC-0201 Phase-1 — Header alarm tooltip + count', () => {
  describe('AC-RFC-0183-3 — desktop tooltip width pinned to 320px', () => {
    it('injects --myio-tooltip-width-desktop = 320px on render (default)', () => {
      createHeaderComponent({ container: mountEl });
      const styleEl = document.getElementById('myio-header-tooltip-width-vars');
      expect(styleEl).not.toBeNull();
      expect(styleEl!.textContent).toContain('--myio-tooltip-width-desktop: 320px');
    });

    it('honors a custom tooltipWidth value', () => {
      createHeaderComponent({ container: mountEl, tooltipWidth: 400 });
      const styleEl = document.getElementById('myio-header-tooltip-width-vars');
      expect(styleEl!.textContent).toContain('--myio-tooltip-width-desktop: 400px');
    });
  });

  describe('getAlarmCount — reads from AlarmServiceOrchestrator', () => {
    it('returns the deduplicated total alarm count across all devices', () => {
      (window as unknown as { AlarmServiceOrchestrator?: unknown }).AlarmServiceOrchestrator =
        fakeAlarmOrch({
          'gcdr-A': [{ id: 'a1' }, { id: 'a2' }],
          'gcdr-B': [{ id: 'a3' }],
        });

      const header = createHeaderComponent({ container: mountEl });
      expect(header.getAlarmCount()).toBe(3);
    });

    it('deduplicates alarms that appear under multiple devices (id-keyed)', () => {
      (window as unknown as { AlarmServiceOrchestrator?: unknown }).AlarmServiceOrchestrator =
        fakeAlarmOrch({
          'gcdr-A': [{ id: 'shared-1' }, { id: 'a2' }],
          'gcdr-B': [{ id: 'shared-1' }, { id: 'a3' }], // shared-1 dedup'd
        });

      const header = createHeaderComponent({ container: mountEl });
      expect(header.getAlarmCount()).toBe(3); // a2, a3, shared-1
    });

    it('returns 0 when AlarmServiceOrchestrator is not set', () => {
      const header = createHeaderComponent({ container: mountEl });
      expect(header.getAlarmCount()).toBe(0);
    });
  });

  describe('isInternalSupportRule — filters internal-support entries', () => {
    it('filters out alarms with internal_support tag when rule is enabled', () => {
      (window as unknown as { AlarmServiceOrchestrator?: unknown }).AlarmServiceOrchestrator =
        fakeAlarmOrch({
          'gcdr-A': [
            { id: 'a1' },
            { id: 'a2', tags: ['internal_support'] },
            { id: 'a3', category: 'internal_support' },
          ],
        });

      const header = createHeaderComponent({
        container: mountEl,
        isInternalSupportRule: true,
      });
      // Only a1 should be counted (a2 + a3 are internal-support).
      expect(header.getAlarmCount()).toBe(1);
    });

    it('does not filter when isInternalSupportRule = false (default)', () => {
      (window as unknown as { AlarmServiceOrchestrator?: unknown }).AlarmServiceOrchestrator =
        fakeAlarmOrch({
          'gcdr-A': [
            { id: 'a1' },
            { id: 'a2', tags: ['internal_support'] },
            { id: 'a3', category: 'internal_support' },
          ],
        });

      const header = createHeaderComponent({ container: mountEl }); // default = false
      expect(header.getAlarmCount()).toBe(3);
    });
  });
});
