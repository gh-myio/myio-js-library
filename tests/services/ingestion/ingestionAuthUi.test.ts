// tests/services/ingestion/ingestionAuthUi.test.ts
// RFC-0224 — dashboard adapter: versioned myio:* events and one set of toasts per scope per window.
import { describe, it, expect, vi } from 'vitest';
import {
  createIngestionAuthUiAdapter,
  INGESTION_AUTH_MESSAGES,
} from '../../../src/services/ingestion/ingestionAuthUi';
import type { IngestionAuthLifecycleEvent } from '../../../src/services/ingestion/ingestionFetch';

const ev = (type: IngestionAuthLifecycleEvent['type'], extra: Partial<IngestionAuthLifecycleEvent> = {}): IngestionAuthLifecycleEvent => ({
  version: 1,
  type,
  scopeId: 'ing_scope_a',
  context: 'fetchGoalsDayTotals',
  at: 1000,
  generation: 3,
  ...extra,
});

function setup(debounceMs = 60_000) {
  let t = 0;
  const toast = { error: vi.fn(), warning: vi.fn(), success: vi.fn() };
  const dispatched: CustomEvent[] = [];
  const ui = createIngestionAuthUiAdapter({
    toast,
    dispatchEvent: (e) => dispatched.push(e as CustomEvent),
    debounceMs,
    now: () => t,
  });
  return { ui, toast, dispatched, advance: (ms: number) => (t += ms) };
}

describe('createIngestionAuthUiAdapter', () => {
  it('a recovery shows error → warning → short success, with the approved copy', () => {
    const { ui, toast } = setup();
    ui(ev('expired', { status: 401 }));
    ui(ev('refresh-started'));
    ui(ev('refreshed', { credentialsRotated: false }));
    expect(toast.error).toHaveBeenCalledWith(INGESTION_AUTH_MESSAGES.expired, 5000);
    expect(toast.warning).toHaveBeenCalledWith(INGESTION_AUTH_MESSAGES.refreshing, 3500);
    expect(toast.success).toHaveBeenCalledWith(INGESTION_AUTH_MESSAGES.refreshed, 2500);
  });

  it('a failure shows one error with the manual-retry copy', () => {
    const { ui, toast } = setup();
    ui(ev('failed', { category: 'invalid_client', retryable: false }));
    expect(toast.error).toHaveBeenCalledWith(
      'Não foi possível renovar o acesso aos dados. Tente novamente.',
      6000,
    );
  });

  it('AC-11: a burst on one scope shows at most one set of toasts per window; another scope has its own', () => {
    const { ui, toast, advance } = setup(60_000);
    for (let i = 0; i < 20; i++) ui(ev('expired', { status: 401 }));
    ui(ev('refresh-started'));
    ui(ev('refresh-started'));
    ui(ev('refreshed'));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    ui(ev('expired', { scopeId: 'ing_scope_b' }));
    expect(toast.error).toHaveBeenCalledTimes(2);
    advance(59_000);
    ui(ev('expired'));
    expect(toast.error).toHaveBeenCalledTimes(2);
    advance(2_000);
    ui(ev('expired'));
    expect(toast.error).toHaveBeenCalledTimes(3);
  });

  it('dispatches the versioned myio:* events (every event, not debounced) without secrets', () => {
    const { ui, dispatched } = setup();
    ui(ev('expired', { status: 401 }));
    ui(ev('refresh-started'));
    ui(ev('refreshed', { credentialsRotated: true }));
    ui(ev('failed', { category: 'unauthorized', retryable: false }));
    ui(ev('expired', { status: 401 }));
    expect(dispatched.map((e) => e.type)).toEqual([
      'myio:token-expired',
      'myio:session-refresh-started',
      'myio:session-refreshed',
      'myio:session-refresh-failed',
      'myio:token-expired',
    ]);
    expect(dispatched[0].detail).toEqual({ version: 1, scopeId: 'ing_scope_a', context: 'fetchGoalsDayTotals', status: 401, at: 1000, generation: 3 });
    expect(dispatched[1].detail).toEqual({ version: 1, scopeId: 'ing_scope_a', at: 1000, generation: 3 });
    expect(dispatched[2].detail).toEqual({ version: 1, scopeId: 'ing_scope_a', at: 1000, generation: 3, credentialsRotated: true });
    expect(dispatched[3].detail).toEqual({ version: 1, scopeId: 'ing_scope_a', at: 1000, generation: 3, category: 'unauthorized', retryable: false });
  });

  it('toast or dispatch failures never throw; works with no toast and no dispatch', () => {
    const throwing = createIngestionAuthUiAdapter({
      toast: { error: () => { throw new Error('x'); } },
      dispatchEvent: () => { throw new Error('y'); },
    });
    expect(() => throwing(ev('expired'))).not.toThrow();
    expect(() => createIngestionAuthUiAdapter()(ev('failed'))).not.toThrow();
  });

  it('custom copy can be supplied (product copy decision, RFC-0224 §6.6)', () => {
    const toast = { error: vi.fn() };
    createIngestionAuthUiAdapter({ toast, messages: { expired: 'Token de acesso expirado.' } })(ev('expired'));
    expect(toast.error).toHaveBeenCalledWith('Token de acesso expirado.', 5000);
  });
});
