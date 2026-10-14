/**
 * RFC-0224 — dashboard adapter for the ingestion auth lifecycle. Turns `ingestionFetch` events into
 * versioned `myio:*` CustomEvents and toasts — at most one set of toasts per auth scope per window
 * (AC-11) — and never reloads the page. Toast and dispatch are injected, so the library core stays
 * free of browser globals.
 */
import type { IngestionAuthLifecycleEvent, IngestionAuthLifecycleType } from './ingestionFetch';

/** Default (technical) copy approved in RFC-0224 §6.6. */
export const INGESTION_AUTH_MESSAGES = Object.freeze({
  expired: 'Token de acesso expirado ou inválido.',
  refreshing: 'Renovando o acesso aos dados. Aguarde...',
  refreshed: 'Acesso aos dados renovado.',
  failed: 'Não foi possível renovar o acesso aos dados. Tente novamente.',
});

/** Browser event of each lifecycle step (RFC-0224 §8). */
export const INGESTION_AUTH_EVENT_NAMES: Readonly<Record<IngestionAuthLifecycleType, string>> = Object.freeze({
  expired: 'myio:token-expired',
  'refresh-started': 'myio:session-refresh-started',
  refreshed: 'myio:session-refreshed',
  failed: 'myio:session-refresh-failed',
});

interface ToastLike {
  error?(message: string, duration?: number): unknown;
  warning?(message: string, duration?: number): unknown;
  success?(message: string, duration?: number): unknown;
}

export interface IngestionAuthUiOptions {
  /** e.g. MyIOToast */
  toast?: ToastLike | null;
  /** e.g. (event) => window.dispatchEvent(event) */
  dispatchEvent?: ((event: Event) => unknown) | null;
  /** Toast debounce per scope and kind. Default 60 s. */
  debounceMs?: number;
  now?: () => number;
  messages?: Partial<Record<keyof typeof INGESTION_AUTH_MESSAGES, string>>;
}

/** Versioned detail of each browser event — never the bearer, URL or credentials (AC-09). */
export function ingestionAuthEventDetail(event: IngestionAuthLifecycleEvent): Record<string, unknown> {
  const { version, scopeId, at, generation } = event;
  switch (event.type) {
    case 'expired':
      return { version, scopeId, context: event.context, status: event.status, at, generation };
    case 'refreshed':
      return { version, scopeId, at, generation, credentialsRotated: !!event.credentialsRotated };
    case 'failed':
      return { version, scopeId, at, generation, category: event.category, retryable: !!event.retryable };
    default:
      return { version, scopeId, at, generation };
  }
}

export function createIngestionAuthUiAdapter(
  options: IngestionAuthUiOptions = {},
): (event: IngestionAuthLifecycleEvent) => void {
  const debounceMs = options.debounceMs ?? 60_000;
  const now = options.now ?? (() => Date.now());
  const messages = { ...INGESTION_AUTH_MESSAGES, ...(options.messages || {}) };
  const lastShown = new Map<string, number>();

  const showOnce = (scopeId: string, kind: string, method: keyof ToastLike, message: string, duration: number) => {
    const key = `${scopeId}:${kind}`;
    const t = now();
    const previous = lastShown.get(key);
    if (previous !== undefined && t - previous < debounceMs) return;
    lastShown.set(key, t);
    try {
      options.toast?.[method]?.(message, duration);
    } catch {
      // a toast failure never affects the recovery
    }
  };

  const dispatch = (event: IngestionAuthLifecycleEvent) => {
    if (!options.dispatchEvent || typeof CustomEvent !== 'function') return;
    try {
      options.dispatchEvent(
        new CustomEvent(INGESTION_AUTH_EVENT_NAMES[event.type], { detail: ingestionAuthEventDetail(event) }),
      );
    } catch {
      // a listener failure never affects the recovery
    }
  };

  return (event) => {
    dispatch(event);
    switch (event.type) {
      case 'expired':
        showOnce(event.scopeId, 'expired', 'error', messages.expired, 5000);
        break;
      case 'refresh-started':
        showOnce(event.scopeId, 'refreshing', 'warning', messages.refreshing, 3500);
        break;
      case 'refreshed':
        showOnce(event.scopeId, 'refreshed', 'success', messages.refreshed, 2500);
        break;
      case 'failed':
        showOnce(event.scopeId, 'failed', 'error', messages.failed, 6000);
        break;
    }
  };
}
