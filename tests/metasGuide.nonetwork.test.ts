/**
 * RFC-0227 §P0 — "sem rede" é CONTRATO DE TESTE.
 *
 * This suite stubs every network primitive (fetch, XMLHttpRequest, Image,
 * sendBeacon, WebSocket, EventSource) and FAILS if opening or navigating the
 * guide fires ANY request. Footer "MYIO Academy" links must stay inert until an
 * explicit user click.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openMetasGuide } from '../src/components/metas-guide';

const ROOT = '#myio-metas-guide-root';

let violations: string[];

function guardNetwork(): void {
  violations = [];

  // fetch
  (global as any).fetch = vi.fn((...args: any[]) => {
    violations.push(`fetch(${String(args[0])})`);
    return Promise.reject(new Error('network blocked'));
  });
  (window as any).fetch = (global as any).fetch;

  // XMLHttpRequest
  class BlockedXHR {
    open(_method: string, url: string) {
      violations.push(`XHR.open(${url})`);
    }
    send() {
      violations.push('XHR.send()');
    }
    setRequestHeader() {}
    addEventListener() {}
    abort() {}
  }
  (global as any).XMLHttpRequest = BlockedXHR as any;
  (window as any).XMLHttpRequest = BlockedXHR as any;

  // Image loading (data-uri / remote)
  const RealImage = (global as any).Image;
  class BlockedImage {
    private _src = '';
    set src(v: string) {
      violations.push(`Image.src(${v})`);
      this._src = v;
    }
    get src() {
      return this._src;
    }
  }
  (global as any).Image = BlockedImage as any;
  (window as any).Image = BlockedImage as any;
  void RealImage;

  // beacon / websocket / SSE
  if (navigator) {
    (navigator as any).sendBeacon = vi.fn((url: string) => {
      violations.push(`sendBeacon(${url})`);
      return false;
    });
  }
  (global as any).WebSocket = class {
    constructor(url: string) {
      violations.push(`WebSocket(${url})`);
    }
  } as any;
  (global as any).EventSource = class {
    constructor(url: string) {
      violations.push(`EventSource(${url})`);
    }
  } as any;
}

beforeEach(() => {
  guardNetwork();
});

afterEach(() => {
  document.querySelectorAll(ROOT).forEach((el) => el.remove());
  vi.restoreAllMocks();
});

describe('RFC-0227 no-network contract', () => {
  it('fires ZERO requests when opening the guide', () => {
    const handle = openMetasGuide();
    expect(document.querySelector(ROOT)).not.toBeNull();
    expect(violations, `unexpected requests: ${violations.join(', ')}`).toEqual([]);
    handle.close();
  });

  it('fires ZERO requests while navigating all 11 sections (forward + back)', () => {
    const handle = openMetasGuide();
    const nextBtn = document.querySelector<HTMLButtonElement>('[data-mg-next]')!;
    const prevBtn = document.querySelector<HTMLButtonElement>('[data-mg-prev]')!;

    // walk forward to the last section
    for (let i = 0; i < 10; i++) nextBtn.click();
    // and back to the first
    for (let i = 0; i < 10; i++) prevBtn.click();

    expect(violations, `unexpected requests: ${violations.join(', ')}`).toEqual([]);
    handle.close();
  });

  it('fires ZERO requests on keyboard navigation', () => {
    const handle = openMetasGuide();
    for (let i = 0; i < 12; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    }
    for (let i = 0; i < 12; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    }
    expect(violations, `unexpected requests: ${violations.join(', ')}`).toEqual([]);
    handle.close();
  });

  it('footer MYIO Academy links are inert (no auto-navigation) until clicked', () => {
    const handle = openMetasGuide();
    const links = document.querySelectorAll<HTMLAnchorElement>('.myio-mg-academy__links a');
    expect(links.length).toBeGreaterThan(0);
    // links exist but nothing was requested by merely rendering them
    links.forEach((a) => {
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
    });
    expect(violations).toEqual([]);
    handle.close();
  });
});
