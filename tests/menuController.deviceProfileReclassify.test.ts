/**
 * ED-983 — regression coverage for the "Gestão de Perfil de Dispositivos"
 * post-save refresh.
 *
 * Extracts the REAL `triggerDeviceProfileReclassify` function from the MENU
 * widget controller (v-5.2.0) and runs it in a sandbox, so the test locks in
 * the actual production behavior instead of a mirrored copy of the logic.
 *
 * Root cause being covered: after saving the device classification profile,
 * the MENU controller used to (1) call `window.MyIOOrchestrator.invalidateCache`,
 * a method that was never implemented on the real orchestrator (silently a
 * no-op via optional chaining), and then (2) dispatch `myio:update-date` with
 * an EMPTY `detail` — which the orchestrator's own listener treats as "no
 * period", clobbering `currentPeriod` to `undefined` and skipping the
 * re-hydrate entirely. Net effect: nothing ever refreshed, so stale
 * classification data stayed on screen until a full page reload (F5).
 *
 * The fix calls the orchestrator's own exposed `getVisibleTab` /
 * `getCurrentPeriod` / `hydrateDomain` API directly (the same primitives the
 * "Carregar" button already relies on), only falling back to the legacy event
 * dispatch when a period genuinely isn't available yet.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTROLLER = resolve(
  __dirname,
  '../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js',
);

/** Extrai o texto de uma função top-level `function NAME(...) { ... }`. */
function extractFn(src: string, name: string): string {
  const lines = src.replace(/\r/g, '').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`function ${name}(`));
  if (start < 0) throw new Error(`função não encontrada: ${name}`);
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === '}') {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error(`fim da função não encontrado: ${name}`);
  return lines.slice(start, end + 1).join('\n');
}

function makeTrigger(win: unknown): (orchestrator: unknown, logHelper: unknown) => boolean {
  const src = readFileSync(CONTROLLER, 'utf8');
  const body = extractFn(src, 'triggerDeviceProfileReclassify') + '\nreturn triggerDeviceProfileReclassify;';
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function('window', 'CustomEvent', body) as (
    w: unknown,
    CE: unknown,
  ) => (orchestrator: unknown, logHelper: unknown) => boolean;
  return factory(win, (globalThis as any).CustomEvent ?? function CustomEventPolyfill(this: any, type: string, init: any) {
    this.type = type;
    this.detail = init?.detail;
  });
}

function silentLog() {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('MENU controller — triggerDeviceProfileReclassify (ED-983)', () => {
  it('calls hydrateDomain(visibleTab, currentPeriod, {force:true}) when the orchestrator has a period — and does NOT rely on the legacy event', () => {
    const dispatchEvent = vi.fn();
    const hydrateDomain = vi.fn();
    const trigger = makeTrigger({ dispatchEvent });

    const period = { startISO: '2026-09-01T00:00:00Z', endISO: '2026-09-24T00:00:00Z' };
    const orchestrator = {
      getVisibleTab: () => 'energy',
      getCurrentPeriod: () => period,
      hydrateDomain,
    };
    const log = silentLog();

    const result = trigger(orchestrator, log);

    expect(result).toBe(true);
    expect(hydrateDomain).toHaveBeenCalledTimes(1);
    expect(hydrateDomain).toHaveBeenCalledWith('energy', period, { force: true });
    // The old (broken) refresh path must NOT be used when the direct call succeeds.
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('falls back to getFirstEnabledDomain when the visible tab was never set', () => {
    const hydrateDomain = vi.fn();
    const trigger = makeTrigger({ dispatchEvent: vi.fn() });
    const period = { startISO: '2026-09-01', endISO: '2026-09-24' };

    const orchestrator = {
      getVisibleTab: () => null,
      getFirstEnabledDomain: () => 'water',
      getCurrentPeriod: () => period,
      hydrateDomain,
    };

    const result = trigger(orchestrator, silentLog());

    expect(result).toBe(true);
    expect(hydrateDomain).toHaveBeenCalledWith('water', period, { force: true });
  });

  it('falls back to the legacy myio:update-date dispatch when no period is available yet (and returns false)', () => {
    const dispatchEvent = vi.fn();
    const hydrateDomain = vi.fn();
    const trigger = makeTrigger({ dispatchEvent });

    const orchestrator = {
      getVisibleTab: () => 'energy',
      getCurrentPeriod: () => null, // not ready yet
      hydrateDomain,
    };

    const result = trigger(orchestrator, silentLog());

    expect(result).toBe(false);
    expect(hydrateDomain).not.toHaveBeenCalled();
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const evt = dispatchEvent.mock.calls[0][0];
    expect(evt.type).toBe('myio:update-date');
  });

  it('does not throw when the orchestrator is missing entirely, and still falls back to the event', () => {
    const dispatchEvent = vi.fn();
    const trigger = makeTrigger({ dispatchEvent });

    expect(() => trigger(undefined, silentLog())).not.toThrow();
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('falls back to the event dispatch when hydrateDomain itself throws synchronously', () => {
    const dispatchEvent = vi.fn();
    const hydrateDomain = vi.fn(() => {
      throw new Error('boom');
    });
    const trigger = makeTrigger({ dispatchEvent });
    const period = { startISO: '2026-09-01', endISO: '2026-09-24' };

    const orchestrator = {
      getVisibleTab: () => 'energy',
      getCurrentPeriod: () => period,
      hydrateDomain,
    };

    const result = trigger(orchestrator, silentLog());

    expect(result).toBe(false);
    expect(hydrateDomain).toHaveBeenCalledTimes(1);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });
});
