/**
 * Shopping v-5.2.0 — tempo de vida de cada avaliação do controller do MAIN_VIEW.
 *
 * Cada avaliação registra listeners em `window` e intervals. Antes, o onDestroy não removia nada:
 * avaliações antigas seguiam ouvindo eventos, buscando dados e regravando window.STATE (Taboão:
 * manuais sumindo de Lojas ao trocar de aba). Agora tudo passa por `_onWindow` / `_everyMs`,
 * ligados a um AbortController que o onDestroy aborta, e as emissões em voo são descartadas.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractBlockAfter, extractFunction, readControllerSource } from './helpers/extractControllerFunction';

const MAIN_SRC = readControllerSource('MAIN_VIEW');

/** Linhas de código (sem comentários) que contêm `needle`. */
const codeLines = (needle: string) =>
  MAIN_SRC.split('\n').filter((line) => line.includes(needle) && !/^\s*(\*|\/\/|\/\*)/.test(line));

function loadLifetimeHelpers() {
  const lifetime = new AbortController();
  // eslint-disable-next-line no-new-func
  const helpers = new Function(
    'window',
    '_mainViewLifetime',
    `${extractFunction(MAIN_SRC, '_onWindow')}\n${extractFunction(MAIN_SRC, '_everyMs')}\nreturn { _onWindow, _everyMs };`
  )(window, lifetime) as {
    _onWindow: (type: string, handler: EventListener, options?: boolean | AddEventListenerOptions) => void;
    _everyMs: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
  };
  return { lifetime, ...helpers };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('v-5.2.0 MAIN_VIEW — _onWindow / _everyMs (código real)', () => {
  it('listener registrado por _onWindow para de receber eventos depois do abort', () => {
    const { lifetime, _onWindow } = loadLifetimeHelpers();
    const handler = vi.fn();
    _onWindow('myio:test-lifetime', handler);
    window.dispatchEvent(new CustomEvent('myio:test-lifetime'));
    expect(handler).toHaveBeenCalledTimes(1);

    lifetime.abort(); // onDestroy
    window.dispatchEvent(new CustomEvent('myio:test-lifetime'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('preserva as opções do chamador ({ once: true }, capture booleano)', () => {
    const { _onWindow } = loadLifetimeHelpers();
    const once = vi.fn();
    const capture = vi.fn();
    _onWindow('myio:test-once', once, { once: true });
    _onWindow('myio:test-capture', capture, true);
    window.dispatchEvent(new CustomEvent('myio:test-once'));
    window.dispatchEvent(new CustomEvent('myio:test-once'));
    window.dispatchEvent(new CustomEvent('myio:test-capture'));
    expect(once).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('interval registrado por _everyMs para depois do abort', () => {
    vi.useFakeTimers();
    const { lifetime, _everyMs } = loadLifetimeHelpers();
    const tick = vi.fn();
    _everyMs(tick, 2000);
    vi.advanceTimersByTime(4000);
    expect(tick).toHaveBeenCalledTimes(2);

    lifetime.abort(); // onDestroy
    vi.advanceTimersByTime(10000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('duas avaliações: destruir a antiga não afeta os listeners da atual', () => {
    const antiga = loadLifetimeHelpers();
    const atual = loadLifetimeHelpers();
    const deAntiga = vi.fn();
    const deAtual = vi.fn();
    antiga._onWindow('myio:dashboard-state-test', deAntiga);
    atual._onWindow('myio:dashboard-state-test', deAtual);

    antiga.lifetime.abort();
    window.dispatchEvent(new CustomEvent('myio:dashboard-state-test'));
    expect(deAntiga).not.toHaveBeenCalled();
    expect(deAtual).toHaveBeenCalledTimes(1);
    atual.lifetime.abort();
  });
});

describe('v-5.2.0 MAIN_VIEW — nada fica registrado fora do tempo de vida', () => {
  it('window.addEventListener só dentro de _onWindow', () => {
    const lines = codeLines('window.addEventListener(');
    expect(lines).toHaveLength(1);
    expect(extractFunction(MAIN_SRC, '_onWindow')).toContain(lines[0].trim());
  });

  it('setInterval só em _everyMs e nos dois timers globais que o onDestroy limpa', () => {
    const lines = codeLines('setInterval(').map((l) => l.trim());
    expect(lines).toHaveLength(3);
    expect(extractFunction(MAIN_SRC, '_everyMs')).toContain(lines.find((l) => l.startsWith('const id'))!);
    expect(lines.some((l) => l.startsWith('window.__myioTbTokenKeepAlive = setInterval('))).toBe(true);
    expect(lines.some((l) => l.includes('_wellEquipment.timer = setInterval('))).toBe(true);

    const onDestroy = extractBlockAfter(MAIN_SRC, 'self.onDestroy = function');
    expect(onDestroy).toContain('clearInterval(window.__myioTbTokenKeepAlive)');
    expect(onDestroy).toContain('clearInterval(_wellEquipment.timer)');
  });

  it('onDestroy aborta o tempo de vida antes de qualquer outra coisa e desconta a avaliação viva', () => {
    const onDestroy = extractBlockAfter(MAIN_SRC, 'self.onDestroy = function');
    const abortAt = onDestroy.indexOf('_mainViewLifetime.abort()');
    expect(abortAt).toBeGreaterThan(0);
    expect(abortAt).toBeLessThan(onDestroy.indexOf('clearInterval('));
    expect(onDestroy).toContain('window.__myioMainViewLive');
  });

  it('emissões e hidratações de uma avaliação destruída são descartadas', () => {
    const guard = '_mainViewLifetime.signal.aborted';
    const emit = extractFunction(MAIN_SRC, 'emitProvide');
    expect(emit.indexOf(guard)).toBeGreaterThan(0);
    expect(emit.indexOf(guard)).toBeLessThan(emit.indexOf('_splitManualItems'));

    const populate = extractFunction(MAIN_SRC, 'populateState');
    expect(populate.indexOf(guard)).toBeGreaterThan(0);
    expect(populate.indexOf(guard)).toBeLessThan(populate.indexOf('_splitManualItems'));

    const hydrate = extractFunction(MAIN_SRC, 'hydrateDomain');
    expect(hydrate.indexOf(guard)).toBeGreaterThan(0);
    expect(hydrate.indexOf(guard)).toBeLessThan(hydrate.indexOf('DATA_DOMAINS'));
  });

  it('ResizeObserver do layout é desconectado no abort', () => {
    expect(extractFunction(MAIN_SRC, 'setupResizeObserver')).toContain('resizeObserver.disconnect()');
  });
});
