import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMyioGcdrLoginView,
  createMyioGcdrShell,
  isMyioGcdrLoginModalOpen,
  openMyioGcdrLoginModal,
} from '../../../src/components/myio-gcdr-login';

const flush = () => new Promise((r) => setTimeout(r, 0));
let host: HTMLElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  try { localStorage.clear(); } catch { /* noop */ }
});
afterEach(() => {
  document.body.innerHTML = '';
  document.head.querySelectorAll('style[data-myio-gcdr-version]').forEach((s) => s.remove());
});

function fill(email: string, password: string) {
  const e = host.querySelector<HTMLInputElement>('[data-k="email"]')!;
  const p = host.querySelector<HTMLInputElement>('[data-k="password"]')!;
  e.value = email;
  e.dispatchEvent(new Event('input'));
  p.value = password;
  p.dispatchEvent(new Event('input'));
}
const submit = () => host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));

describe('RFC-0236 view — options', () => {
  it('requires exactly one strategy and rejects unsupported kinds/captcha', () => {
    expect(() => createMyioGcdrLoginView(host, { onSuccess() {} } as never)).toThrow(TypeError);
    expect(() => createMyioGcdrLoginView(host, { onSuccess() {}, onSubmit: async () => ({ ok: true }), gcdr: { apiUrl: 'x', tenantId: 'y' } })).toThrow(TypeError);
    try {
      createMyioGcdrLoginView(host, { onSuccess() {}, auth: { kind: 'redirect' } as never });
      throw new Error('should throw');
    } catch (e) {
      expect((e as { code?: string }).code).toBe('MYIO_GCDR_AUTH_UNSUPPORTED');
    }
    expect(() => createMyioGcdrLoginView(host, { onSuccess() {}, onSubmit: async () => ({ ok: true }), captcha: {} } as never)).toThrow(/captcha/);
    expect(host.children.length).toBe(0);
  });

  it('injects no style at import and one per root node on create', () => {
    expect(document.head.querySelectorAll('style[data-myio-gcdr-version]').length).toBe(0);
    const a = createMyioGcdrLoginView(host, { onSubmit: async () => ({ ok: true }), onSuccess() {} });
    const other = document.createElement('div');
    document.body.appendChild(other);
    const b = createMyioGcdrShell(other);
    const style = document.head.querySelectorAll('style[data-myio-gcdr-version]');
    expect(style.length).toBe(1);
    expect(style[0].getAttribute('data-myio-gcdr-refs')).toBe('2');
    a.destroy();
    b.destroy();
    expect(document.head.querySelectorAll('style[data-myio-gcdr-version]').length).toBe(0);
  });
});

describe('RFC-0236 view — submit flow', () => {
  it('validation blocks the strategy', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    createMyioGcdrLoginView(host, { onSubmit, onSuccess() {}, aside: { kind: 'none' }, locale: 'pt-BR' });
    fill('x', '');
    submit();
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Informe um e-mail válido');
  });

  it('success awaits onSuccess and stores only the e-mail', async () => {
    const onSuccess = vi.fn(async () => {});
    const onSubmit = vi.fn(async () => ({ ok: true as const, session: { token: 't' } }));
    const v = createMyioGcdrLoginView(host, { onSubmit, onSuccess, aside: { kind: 'none' }, locale: 'pt-BR' });
    (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    fill(' a@b.com ', 'segredo');
    submit();
    await flush();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ email: 'a@b.com', password: 'segredo', remember: true });
    expect(onSuccess).toHaveBeenCalledWith({ token: 't' }, expect.objectContaining({ signal: expect.any(Object) }));
    expect(v.getState().phase).toBe('success');
    expect(localStorage.getItem('myio.login.rememberedEmail')).toBe('a@b.com');
    expect(JSON.stringify(localStorage)).not.toContain('segredo');
    expect(host.querySelector<HTMLInputElement>('[data-k="password"]')!.value).toBe('');
  });

  it('INVALID with counter shows the warning and clears the password; NETWORK keeps it', async () => {
    let next: unknown = { ok: false, code: 'INVALID_CREDENTIALS', remainingAttempts: 2 };
    const onError = vi.fn();
    const v = createMyioGcdrLoginView(host, { onSubmit: async () => next as never, onSuccess() {}, onError, aside: { kind: 'none' }, locale: 'pt-BR' });
    fill('a@b.com', 'x1');
    submit();
    await flush();
    expect(host.textContent).toContain('restam 2 tentativas');
    expect(host.querySelector<HTMLInputElement>('[data-k="password"]')!.value).toBe('');
    expect(onError).toHaveBeenCalledWith({ code: 'INVALID_CREDENTIALS', remainingAttempts: 2 });
    next = { ok: false, code: 'NETWORK' };
    fill('a@b.com', 'x2');
    submit();
    await flush();
    expect(v.getState().error).toBe('NETWORK');
    expect(host.querySelector<HTMLInputElement>('[data-k="password"]')!.value).toBe('x2');
  });

  it('ACCOUNT_LOCKED blocks until the e-mail changes', async () => {
    const onSubmit = vi.fn(async () => ({ ok: false as const, code: 'ACCOUNT_LOCKED' }));
    const v = createMyioGcdrLoginView(host, { onSubmit, onSuccess() {}, aside: { kind: 'none' } });
    fill('a@b.com', 'x');
    submit();
    await flush();
    expect(v.getState().locked).toBe(true);
    expect(host.querySelector('[data-k="submit"]')!.getAttribute('aria-disabled')).toBe('true');
    fill('a@b.com', 'y');
    submit();
    await flush();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fill('outro@b.com', 'y');
    expect(v.getState().locked).toBe(false);
  });

  it('help line after the 2nd consecutive failure without a counter', async () => {
    createMyioGcdrLoginView(host, { onSubmit: async () => ({ ok: false, code: 'UNAUTHORIZED' }), onSuccess() {}, aside: { kind: 'none' }, locale: 'pt-BR' });
    fill('a@b.com', 'x');
    submit();
    await flush();
    expect(host.textContent).not.toContain('Confira o e-mail digitado');
    fill('a@b.com', 'x');
    submit();
    await flush();
    expect(host.textContent).toContain('Confira o e-mail digitado');
    expect(host.textContent).toContain('fale com o administrador do sistema');
  });

  it('timeout → TIMEOUT and a late result is ignored', async () => {
    vi.useFakeTimers();
    let resolveLate: (v: unknown) => void = () => {};
    const onSuccess = vi.fn();
    const v = createMyioGcdrLoginView(host, { onSubmit: () => new Promise((r) => { resolveLate = r as never; }), submitTimeoutMs: 500, onSuccess, aside: { kind: 'none' } });
    fill('a@b.com', 'x');
    submit();
    await vi.advanceTimersByTimeAsync(501);
    expect(v.getState().error).toBe('TIMEOUT');
    resolveLate({ ok: true });
    await vi.advanceTimersByTimeAsync(1);
    expect(onSuccess).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('destroy during onSuccess is legal (no postLoginFailed)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let v: ReturnType<typeof createMyioGcdrLoginView>;
    v = createMyioGcdrLoginView(host, {
      onSubmit: async () => ({ ok: true }),
      onSuccess: async () => { v.destroy(); throw new Error('after destroy'); },
      aside: { kind: 'none' },
    });
    fill('a@b.com', 'x');
    submit();
    await flush();
    expect(v.getState().phase).toBe('destroyed');
    expect(errSpy).not.toHaveBeenCalledWith('[MYIO Login] onSuccess failed');
    errSpy.mockRestore();
  });

  it('host strings are text, never HTML', async () => {
    createMyioGcdrLoginView(host, {
      onSubmit: async () => ({ ok: false, code: 'CUSTOM', message: '<img src=x onerror=alert(1)>' }),
      onSuccess() {}, aside: { kind: 'none' }, footerText: '<b>x</b>',
    });
    fill('a@b.com', 'x');
    submit();
    await flush();
    expect(host.querySelector('img[src="x"]')).toBeNull();
    expect(host.querySelector('b')).toBeNull();
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('band label and band colour are configurable independently of the accent', () => {
    createMyioGcdrLoginView(host, {
      onSubmit: async () => ({ ok: true }), onSuccess() {}, aside: { kind: 'none' },
      brand: { label: { 'pt-BR': 'Acesso GCDR', en: 'GCDR access' }, accent: '#AF3463', bandColor: '#1F2937' },
      locale: 'pt-BR',
    });
    const panel = host.querySelector('.myio-gcdr-login__form')!.closest('.myio-gcdr-panel') as HTMLElement;
    expect(panel.querySelector('.myio-gcdr-panel__eyebrow')!.textContent).toBe('Acesso GCDR');
    expect(panel.style.getPropertyValue('--myio-gcdr-band')).toBe('#1F2937');
    expect(panel.style.getPropertyValue('--myio-gcdr-accent')).toBe('#AF3463');
  });

  it('links hidden by default; forgot-password with gcdr + gcdrWebUrl', () => {
    createMyioGcdrLoginView(host, { onSubmit: async () => ({ ok: true }), onSuccess() {}, aside: { kind: 'none' } });
    expect(host.textContent).not.toContain('Esqueceu a senha?');
    expect(host.textContent).not.toContain('Criar conta');
    host.innerHTML = '';
    const h2 = document.createElement('div');
    document.body.appendChild(h2);
    createMyioGcdrLoginView(h2, { gcdr: { apiUrl: 'https://api.t', tenantId: 'T' }, links: { gcdrWebUrl: 'https://web.t' }, onSuccess() {}, aside: { kind: 'none' }, locale: 'pt-BR' });
    const a = Array.from(h2.querySelectorAll('a')).find((x) => x.textContent?.includes('Esqueceu'));
    expect(a?.getAttribute('href')).toBe('https://web.t/forgot-password');
  });
});

describe('RFC-0236 shell', () => {
  it('slot replace: abort → cleanup → render; built-ins validated by slot', () => {
    const shell = createMyioGcdrShell(host);
    const order: string[] = [];
    shell.setSlot('main', (el, ctx) => {
      ctx.signal.addEventListener('abort', () => order.push('abort'));
      el.textContent = 'A';
      return () => order.push('cleanup');
    });
    shell.setSlot('main', (el) => { order.push('render'); el.textContent = 'B'; });
    expect(order).toEqual(['abort', 'cleanup', 'render']);
    expect(shell.getState().slots.main).toBe('host');
    expect(() => shell.setSlot('main', { kind: 'about' })).toThrow(TypeError);
    shell.setSlot('aside', { kind: 'signedOutPrompt' });
    expect(shell.element.getAttribute('data-has-aside')).toBe('true');
    shell.destroy();
  });

  it('a throwing renderer leaves the slot empty', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const shell = createMyioGcdrShell(host);
    shell.setSlot('aside', () => { throw new Error('x'); });
    expect(shell.getState().slots.aside).toBe('empty');
    spy.mockRestore();
    shell.destroy();
  });

  it('view embedded in a host slot follows the host locale', () => {
    const shell = createMyioGcdrShell(host, { locale: 'pt-BR' });
    shell.setSlot('main', (el, ctx) => {
      const v = createMyioGcdrLoginView(el, { embed: { context: ctx }, onSubmit: async () => ({ ok: true }), onSuccess() {} });
      return () => v.destroy();
    });
    expect(host.textContent).toContain('Entrar');
    shell.setLocale('en');
    expect(host.textContent).toContain('Sign In');
    shell.destroy();
  });
});

describe('RFC-0236 modal', () => {
  it('requires a way out for a non-dismissible viewport gate; single instance', () => {
    expect(() => openMyioGcdrLoginModal({ onSubmit: async () => ({ ok: true }), onSuccess() {} })).toThrow(/way out/);
    const m = openMyioGcdrLoginModal({ onSubmit: async () => ({ ok: true }), onSuccess() {}, overlay: { exit: { label: 'Sair', href: '#out' } } });
    expect(isMyioGcdrLoginModalOpen()).toBe(true);
    try {
      openMyioGcdrLoginModal({ onSubmit: async () => ({ ok: true }), onSuccess() {}, overlay: { dismissible: true } });
      throw new Error('should throw');
    } catch (e) {
      expect((e as { code?: string }).code).toBe('LOGIN_MODAL_ALREADY_OPEN');
    }
    expect(host.hasAttribute('inert')).toBe(true);
    m.close();
    expect(isMyioGcdrLoginModalOpen()).toBe(false);
    expect(host.hasAttribute('inert')).toBe(false);
  });

  it('closes after onSuccess resolves, once', async () => {
    const onClose = vi.fn();
    const m = openMyioGcdrLoginModal({ onSubmit: async () => ({ ok: true }), onSuccess: async () => {}, onClose, overlay: { dismissible: true } });
    const overlay = document.querySelector('.myio-gcdr-overlay') as HTMLElement;
    (overlay.querySelector('[data-k="email"]') as HTMLInputElement).value = 'a@b.com';
    (overlay.querySelector('[data-k="password"]') as HTMLInputElement).value = 'x';
    overlay.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    await flush();
    expect(m.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('success');
  });
});
