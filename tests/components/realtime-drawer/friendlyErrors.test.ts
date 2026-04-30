/**
 * RFC-0201 Phase-2 pod J — Friendly errors.
 *
 * Verifies the realtime drawer maps thrown fetch errors into PT-BR strings
 * the user can act on, and never leaks raw `Error: ...` messages or stack
 * traces into the DOM. The technical detail must still be logged to the
 * console for debugging.
 */

import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import {
  toFriendlyError,
  REALTIME_DEFAULT_FRIENDLY_ERROR,
} from '../../../src/components/realtime-drawer/helpers';

describe('realtime-drawer / friendly errors', () => {
  let consoleSpy: MockInstance;
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('default fallback is the actionable PT-BR retry message', () => {
    expect(REALTIME_DEFAULT_FRIENDLY_ERROR).toBe(
      'Não foi possível carregar dados em tempo real. Tente novamente.',
    );
  });

  it('never returns raw .message — generic Errors are mapped, not echoed', () => {
    // A real fetch failure inside the realtime drawer typically reads
    // "Failed to fetch telemetry: <statusText>" — this should be mapped to
    // a friendly PT-BR string, NOT bubbled to the user as-is.
    const err = new Error('Failed to fetch telemetry: 500 Internal Server Error');
    const friendly = toFriendlyError(err);

    // Mapped via /failed to fetch/ -> "Falha de rede..."
    expect(friendly).toContain('Falha de rede');
    expect(friendly).not.toContain('Error');
    expect(friendly).not.toContain('500');
    expect(friendly).not.toContain('Internal Server');

    // Technical detail is still logged for debugging
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0]?.[1]).toBe(err);
  });

  it('truly opaque errors fall through to the default PT-BR retry message', () => {
    // No keyword match — should hit the default fallback.
    const err = new Error('quux something cryptic 12345');
    const friendly = toFriendlyError(err);
    expect(friendly).toBe(REALTIME_DEFAULT_FRIENDLY_ERROR);
    expect(friendly).not.toContain('Error');
    expect(friendly).not.toContain('cryptic');
  });

  it('maps token-expired errors to a re-login PT-BR message', () => {
    expect(toFriendlyError(new Error('JWT expired'))).toContain('Sessão expirada');
    expect(toFriendlyError(new Error('Authentication token has expired'))).toContain('Sessão expirada');
  });

  it('maps 401/403 to permission PT-BR message', () => {
    expect(toFriendlyError(new Error('401 Unauthorized'))).toContain('Sem permissão');
    expect(toFriendlyError(new Error('403 Forbidden'))).toContain('Sem permissão');
    expect(toFriendlyError(new Error('Insufficient permissions'))).toContain('Sem permissão');
  });

  it('maps 404 / not-found to "Dispositivo não encontrado" PT-BR message', () => {
    expect(toFriendlyError(new Error('404 Not Found'))).toContain('Dispositivo não encontrado');
    expect(toFriendlyError(new Error('Device not found'))).toContain('Dispositivo não encontrado');
  });

  it('maps network failures to a "Falha de rede" PT-BR message', () => {
    expect(toFriendlyError(new Error('Failed to fetch'))).toContain('Falha de rede');
    expect(toFriendlyError(new TypeError('NetworkError when attempting to fetch resource.'))).toContain(
      'Falha de rede',
    );
    expect(toFriendlyError(new Error('Request timed out after 30s'))).toContain('Falha de rede');
  });

  it('handles non-Error throws (string, number, undefined) without leaking', () => {
    expect(toFriendlyError('boom')).toBe(REALTIME_DEFAULT_FRIENDLY_ERROR);
    expect(toFriendlyError(undefined)).toBe(REALTIME_DEFAULT_FRIENDLY_ERROR);
    expect(toFriendlyError(42)).toBe(REALTIME_DEFAULT_FRIENDLY_ERROR);
  });

  it('renders into the DOM error-state node without leaking Error: prefix or stack', () => {
    // Simulate the realtime drawer rendering a fetch failure into the
    // overlay's #error-state element, the way the modal does after pod J.
    const root = document.createElement('div');
    root.innerHTML = `<div class="myio-telemetry-error" id="error-state" style="display:none;"></div>`;
    document.body.appendChild(root);
    const errEl = root.querySelector<HTMLDivElement>('#error-state')!;

    // Mock fetch failure path
    const fetchErr = new Error('TypeError: Failed to fetch — at https://x/api/...');
    errEl.textContent = toFriendlyError(fetchErr);
    errEl.style.display = 'block';

    const text = errEl.textContent ?? '';
    // PT-BR contains
    expect(text).toMatch(/Falha de rede|Não foi possível/);
    // No raw stack trace fragments
    expect(text).not.toContain('Error:');
    expect(text).not.toContain('TypeError');
    expect(text).not.toContain('https://');
    expect(text).not.toContain('at ');
    expect(text).not.toMatch(/[Aa]t \w/);

    document.body.removeChild(root);
  });
});
