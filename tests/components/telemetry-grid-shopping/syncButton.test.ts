/**
 * RFC-0195 / RFC-0201 Phase-2 (Pod G) — AC-RFC-0195-1.
 *
 * Verifies the per-card sync button on `TelemetryGridShoppingView`:
 *   - When `window.MyIOUtils.enableSyncButton = true`, every rendered card
 *     gets a `.myio-sync-btn` inside its `.card-wrapper`.
 *   - When `enableSyncButton = false` (default), no button is rendered.
 *   - Clicking the button calls `window.MyIOOrchestrator.syncDevice(entityId)`
 *     with the correct device id, applies an `is-loading` class while the
 *     promise is pending, and toggles to `is-success` (with the
 *     `MyIOLibrary.MyIOToast.info` toast) when it resolves.
 *   - Errors clear the loading state and surface via `MyIOToast.error`.
 *
 * Strategy: we cannot exercise `renderCardComponentV5` (it's a heavy
 * jQuery-flavored library export). We mock it into a no-op stub so the
 * `TelemetryGridShoppingView` reaches the sync-button injection branch
 * with the real DOM (jsdom), then assert against the rendered DOM.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TelemetryGridShoppingView } from '../../../src/components/telemetry-grid-shopping/TelemetryGridShoppingView';
import { TelemetryGridShoppingController } from '../../../src/components/telemetry-grid-shopping/TelemetryGridShoppingController';
import type {
  TelemetryDevice,
  TelemetryGridShoppingParams,
} from '../../../src/components/telemetry-grid-shopping/types';

function makeDevice(overrides: Partial<TelemetryDevice> = {}): TelemetryDevice {
  return {
    entityId: 'entity-123',
    ingestionId: 'ing-1',
    labelOrName: 'Test Device',
    deviceIdentifier: 'TST-001',
    deviceType: '3F_MEDIDOR',
    deviceProfile: '3F_MEDIDOR',
    deviceStatus: 'online',
    connectionStatus: 'online',
    customerId: 'cust-1',
    val: 100,
    perc: 50,
    domain: 'energy',
    ...overrides,
  };
}

let container: HTMLElement;
let toastInfo: ReturnType<typeof vi.fn>;
let toastError: ReturnType<typeof vi.fn>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);

  toastInfo = vi.fn();
  toastError = vi.fn();

  // Mock MyIOLibrary.renderCardComponentV5 as a stub that returns a single
  // jQuery-like wrapper around a tiny DOM node. The View injects badges
  // and the sync button into the same `.card-wrapper`, so we just need
  // the wrapper child to exist.
  (window as unknown as { MyIOLibrary: any }).MyIOLibrary = {
    renderCardComponentV5: () => {
      const inner = document.createElement('div');
      inner.className = 'mock-card-inner';
      // jQuery-like array semantics: [0] returns the DOM node.
      const ret: any = [inner];
      ret.update = () => {};
      ret.destroy = () => {};
      return ret;
    },
    MyIOToast: {
      info: toastInfo,
      error: toastError,
      warning: () => {},
      success: () => {},
      show: () => {},
      hide: () => {},
    },
  };

  (window as unknown as { MyIOUtils: any }).MyIOUtils = {};
});

afterEach(() => {
  // Reset window globals between tests so flag-state doesn't leak.
  delete (window as unknown as { MyIOOrchestrator?: unknown }).MyIOOrchestrator;
  delete (window as unknown as { AlarmServiceOrchestrator?: unknown }).AlarmServiceOrchestrator;
  delete (window as unknown as { TicketServiceOrchestrator?: unknown }).TicketServiceOrchestrator;
  delete (window as unknown as { MyIOLibrary?: unknown }).MyIOLibrary;
  delete (window as unknown as { MyIOUtils?: unknown }).MyIOUtils;

  document.querySelectorAll('style').forEach((s) => {
    if (s.id?.startsWith('myio-')) s.remove();
  });
  container.remove();
});

function mountView(devices: TelemetryDevice[]): TelemetryGridShoppingView {
  const params: TelemetryGridShoppingParams = {
    container,
    domain: 'energy',
    context: 'stores',
    devices,
    themeMode: 'light',
    debugActive: false,
  };
  const controller = new TelemetryGridShoppingController(params);
  const view = new TelemetryGridShoppingView(params, controller);
  const root = view.render();
  container.appendChild(root);
  return view;
}

describe('TelemetryGridShoppingView — RFC-0195 sync button', () => {
  describe('AC-RFC-0195-1 — sync button visibility honors enableSyncButton flag', () => {
    it('does NOT render a sync button when enableSyncButton is false (default)', () => {
      (window as unknown as { MyIOUtils: any }).MyIOUtils.enableSyncButton = false;
      const devices = [makeDevice()];
      mountView(devices);
      const btn = container.querySelector('.myio-sync-btn');
      expect(btn).toBeNull();
    });

    it('renders one .myio-sync-btn per device when enableSyncButton is true', () => {
      (window as unknown as { MyIOUtils: any }).MyIOUtils.enableSyncButton = true;
      const devices = [
        makeDevice({ entityId: 'd1' }),
        makeDevice({ entityId: 'd2' }),
        makeDevice({ entityId: 'd3' }),
      ];
      mountView(devices);
      const buttons = container.querySelectorAll('.myio-sync-btn');
      expect(buttons.length).toBe(3);
      const ids = Array.from(buttons).map((b) =>
        (b as HTMLElement).dataset.entityId
      );
      expect(ids.sort()).toEqual(['d1', 'd2', 'd3']);
    });
  });

  describe('AC-RFC-0195-1 — click triggers MyIOOrchestrator.syncDevice with spinner', () => {
    it('calls syncDevice with the card entityId, shows spinner, then success toast', async () => {
      (window as unknown as { MyIOUtils: any }).MyIOUtils.enableSyncButton = true;
      let resolveSync: (val: unknown) => void = () => {};
      const syncPromise = new Promise((res) => {
        resolveSync = res;
      });
      const syncDevice = vi.fn(() => syncPromise);
      (window as unknown as { MyIOOrchestrator: any }).MyIOOrchestrator = { syncDevice };

      const devices = [makeDevice({ entityId: 'entity-A' })];
      mountView(devices);

      const btn = container.querySelector<HTMLButtonElement>('.myio-sync-btn');
      expect(btn).not.toBeNull();
      btn!.click();

      // Spinner state on click.
      expect(syncDevice).toHaveBeenCalledTimes(1);
      expect(syncDevice).toHaveBeenCalledWith('entity-A');
      expect(btn!.classList.contains('is-loading')).toBe(true);
      expect(btn!.disabled).toBe(true);

      // Resolve the sync — let the async handler run to completion.
      resolveSync({ data: { jobId: 'job-1' } });
      await syncPromise;
      // Microtask flush
      await new Promise((r) => setTimeout(r, 0));

      // Loading cleared, success class applied, info toast shown.
      expect(btn!.classList.contains('is-loading')).toBe(false);
      expect(btn!.classList.contains('is-success')).toBe(true);
      expect(toastInfo).toHaveBeenCalledWith('Sincronização concluída');
      expect(toastError).not.toHaveBeenCalled();
    });

    it('clears spinner and surfaces error toast when syncDevice rejects', async () => {
      (window as unknown as { MyIOUtils: any }).MyIOUtils.enableSyncButton = true;
      const syncDevice = vi.fn(() =>
        Promise.reject(new Error('HTTP 500 internal'))
      );
      (window as unknown as { MyIOOrchestrator: any }).MyIOOrchestrator = { syncDevice };

      const devices = [makeDevice({ entityId: 'entity-Err' })];
      mountView(devices);

      const btn = container.querySelector<HTMLButtonElement>('.myio-sync-btn');
      btn!.click();
      expect(syncDevice).toHaveBeenCalledWith('entity-Err');
      expect(btn!.classList.contains('is-loading')).toBe(true);

      // Wait a tick for the rejected promise to settle through the handler.
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));

      expect(btn!.classList.contains('is-loading')).toBe(false);
      expect(btn!.classList.contains('is-success')).toBe(false);
      expect(btn!.disabled).toBe(false);
      expect(toastError).toHaveBeenCalled();
      const msg = (toastError.mock.calls[0]?.[0] ?? '') as string;
      expect(msg).toMatch(/Falha na sincronização/);
      expect(msg).toMatch(/HTTP 500/);
    });

    it('shows an error toast and aborts when MyIOOrchestrator.syncDevice is not available', () => {
      (window as unknown as { MyIOUtils: any }).MyIOUtils.enableSyncButton = true;
      // Orchestrator absent — simulating a misconfigured environment.
      delete (window as unknown as { MyIOOrchestrator?: unknown }).MyIOOrchestrator;

      const devices = [makeDevice({ entityId: 'entity-no-orch' })];
      mountView(devices);

      const btn = container.querySelector<HTMLButtonElement>('.myio-sync-btn');
      btn!.click();
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/orchestrator não inicializado/)
      );
      expect(btn!.classList.contains('is-loading')).toBe(false);
    });
  });
});
