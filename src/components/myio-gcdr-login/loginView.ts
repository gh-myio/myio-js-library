/**
 * RFC-0236 §4 — Layer 2: the GCDR login view (inline, or embedded in a host
 * shell slot). The modal (§5) composes this view.
 */
import { defaultSupportHref } from './about';
import {
  emailKey,
  normaliseResult,
  normaliseThrown,
  present,
  validate,
  type ErrorPresentation,
} from './controller';
import { h, icon, isCoarsePointer, safeCall, storageGet, storageSet } from './dom';
import { createMyioGcdrLoginSubmit } from './gcdrClient';
import { localize, translate } from './i18n';
import { ICONS } from './icons';
import { acquireStyles } from './styles';
import { buildPanel, createShellImpl, type ShellImpl } from './shell';
import type {
  MyioGcdrLocale,
  MyioGcdrLoginErrorCode,
  MyioGcdrLoginNotice,
  MyioGcdrLoginState,
  MyioGcdrLoginSubmitFn,
  MyioGcdrLoginViewHandle,
  MyioGcdrLoginViewOptions,
  MyioGcdrRestrictedShell,
  MyioGcdrSlotContext,
  MyioGcdrTheme,
} from './types';

const DEFAULT_SUBMIT_TIMEOUT_MS = 30000;

/** Internal wiring used by the modal (not public). */
export interface ViewInternals {
  presentation?: 'inline' | 'modal';
  /** Called with the card footer so the modal can add its exit link. */
  decorateFooter?: (footer: HTMLElement, api: ViewInternalApi) => void;
  /** Overrides of the shell options (the modal draws its own backdrop). */
  shellWallpaper?: false;
  /** Called after onSuccess resolved (modal closes). */
  afterSuccess?: () => void;
}

export interface ViewInternalApi {
  abortAttempt(): void;
  clearPassword(): void;
  showLeaveFailed(): void;
  t(key: string): string;
  locale(): MyioGcdrLocale;
  phase(): MyioGcdrLoginState['phase'];
}

interface ErrorState {
  code?: MyioGcdrLoginErrorCode;
  messageKey?: string;
  pres?: ErrorPresentation;
  help?: boolean;
}

function fail(msg: string, code?: string): never {
  const e = new TypeError(`[MYIO Login] ${msg}`);
  if (code) (e as TypeError & { code: string }).code = code;
  throw e;
}

function validateOptions(container: HTMLElement, o: MyioGcdrLoginViewOptions): void {
  if (!(container instanceof HTMLElement)) fail('container must be an HTMLElement');
  if (!o || typeof o !== 'object') fail('options are required');
  const n = [o.onSubmit, o.gcdr, o.auth].filter((x) => x != null).length;
  if (n !== 1) fail('exactly one of onSubmit, gcdr or auth is required');
  if (o.auth && (o.auth as { kind?: string }).kind !== 'credentials') {
    fail(`auth.kind "${String((o.auth as { kind?: string }).kind)}" is not supported`, 'MYIO_GCDR_AUTH_UNSUPPORTED');
  }
  if (o.auth && typeof o.auth.submit !== 'function') fail('auth.submit must be a function');
  if (o.onSubmit && typeof o.onSubmit !== 'function') fail('onSubmit must be a function');
  if (typeof o.onSuccess !== 'function') fail('onSuccess must be a function');
  if (o.submitTimeoutMs != null && !(Number.isFinite(o.submitTimeoutMs) && o.submitTimeoutMs > 0)) fail('submitTimeoutMs must be a positive number');
  if ((o as { captcha?: unknown }).captcha) fail('captcha is not available in this version (RFC-0236 PR 2)', 'MYIO_GCDR_CAPTCHA_UNSUPPORTED');
  const kinds = ['about', 'signedOutPrompt', 'custom', 'none'];
  if (o.aside && !kinds.includes(o.aside.kind)) fail(`unknown aside.kind "${String(o.aside.kind)}"`);
  if (o.aside?.kind === 'custom' && typeof o.aside.render !== 'function') fail('aside.render must be a function');
  if (o.support && (typeof o.support.href !== 'string' || !o.support.href)) fail('support.href must be a non-empty string');
  if (o.embed) {
    const bad = ['aside', 'buildInfo', 'theme', 'locale', 'assets'].filter((k) => (o as unknown as Record<string, unknown>)[k] !== undefined);
    if (o.show?.themeToggle !== undefined || o.show?.languageSelector !== undefined || o.show?.wallpaper !== undefined) bad.push('show.(theme|language|wallpaper)');
    if (bad.length) fail(`with embed, these options belong to the host shell: ${bad.join(', ')}`);
    if (!o.embed.context || typeof o.embed.context.on !== 'function') fail('embed.context must be a slot context');
  }
}

export function createLoginViewImpl(
  container: HTMLElement,
  options: MyioGcdrLoginViewOptions,
  internals: ViewInternals = {}
): MyioGcdrLoginViewHandle & { _api: ViewInternalApi } {
  validateOptions(container, options);
  const doc = container.ownerDocument;
  const presentation = internals.presentation ?? 'inline';
  const prefix = options.storageKeyPrefix ?? 'myio.login.';
  const isGcdr = !!options.gcdr;
  const webUrl = options.links?.gcdrWebUrl?.replace(/\/+$/, '');
  const strategy: MyioGcdrLoginSubmitFn = options.gcdr
    ? createMyioGcdrLoginSubmit(options.gcdr)
    : options.auth
      ? options.auth.submit
      : (options.onSubmit as MyioGcdrLoginSubmitFn);
  const viewTimeoutMs = isGcdr ? undefined : options.submitTimeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS;

  // ── Shell (own) or host context (embed) ──────────────────────────────────
  let shell: ShellImpl | undefined;
  let embedCtx: MyioGcdrSlotContext | undefined;
  let releaseEmbedStyles: (() => void) | undefined;
  let cardHost: HTMLElement;

  if (options.embed) {
    embedCtx = options.embed.context;
    releaseEmbedStyles = acquireStyles(container, { nonce: options.cspNonce, loadFont: options.fonts?.load !== false });
    container.textContent = '';
    cardHost = container;
  } else {
    const wpOpt = internals.shellWallpaper === false || options.show?.wallpaper === false ? false : options.assets?.wallpaper ?? {};
    shell = createShellImpl(
      container,
      {
        size: options.size ?? 'md',
        theme: options.theme,
        locale: options.locale,
        show: { themeToggle: options.show?.themeToggle, languageSelector: options.show?.languageSelector },
        buildInfo: options.buildInfo,
        storageKeyPrefix: options.storageKeyPrefix,
        fonts: options.fonts,
        cspNonce: options.cspNonce,
        wallpaper: wpOpt === false ? false : wpOpt,
        onThemeChange: options.onThemeChange,
        onLocaleChange: options.onLocaleChange,
      },
      {
        messages: options.messages,
        logoUrl: options.assets?.logoUrl,
        about: { webUrl, fetchImpl: options.gcdr?.fetch, bandColor: options.brand?.asideHeaderColor },
      }
    );
    cardHost = h(doc, 'div', { style: 'display:flex;width:100%' });
  }

  const getLocale = (): MyioGcdrLocale => (shell ? shell.getState().locale : embedCtx!.locale);
  const getTheme = (): MyioGcdrTheme => (shell ? shell.getState().theme : embedCtx!.theme);
  const t = (key: string, vars?: Record<string, string | number>) => translate(getLocale(), key, vars, options.messages);

  // ── State ────────────────────────────────────────────────────────────────
  let phase: MyioGcdrLoginState['phase'] = 'idle';
  let destroyed = false;
  let attempt = 0;
  let attemptAbort: AbortController | null = null;
  let abortCause: 'timeout' | 'destroy' | 'exit' | null = null;
  let successAbort: AbortController | null = null;
  let err: ErrorState = {};
  let lockedKey: string | null = null;
  let noCounterStreak = 0;
  let streakKey: string | null = null;
  let notice: MyioGcdrLoginNotice | null = options.notice ?? null;
  let fieldErrors: { email?: string; password?: string } = {};
  const remembered = storageGet(`${prefix}rememberedEmail`);
  let emailValue = options.initialEmail ?? remembered ?? '';
  let rememberValue = !options.initialEmail && !!remembered;
  let passwordValue = '';
  let passwordVisible = false;
  let leaving = false;

  // ── Links / support ──────────────────────────────────────────────────────
  const linkTarget = options.links?.target ?? (presentation === 'modal' ? '_blank' : '_self');
  const forgot = options.links?.forgotPassword;
  const forgotShown = forgot === false ? false : !!forgot || (isGcdr && !!webUrl);
  const supportHref =
    options.support === false
      ? undefined
      : options.support
        ? options.support.href
        : (options.aside?.kind ?? 'about') === 'about'
          ? defaultSupportHref(webUrl)
          : undefined;

  // ── DOM refs (rebuilt on render) ─────────────────────────────────────────
  let els: {
    root?: HTMLElement;
    title?: HTMLElement;
    notice?: HTMLElement;
    alerts?: HTMLElement;
    email?: HTMLInputElement;
    password?: HTMLInputElement;
    submit?: HTMLButtonElement;
    caps?: HTMLElement;
    banner?: HTMLElement;
  } = {};

  const linkEl = (label: string, target: string | ((ctx: { email: string }) => void) | (() => void), cls = 'myio-gcdr-login__link'): HTMLElement => {
    if (typeof target === 'function') {
      const b = h(doc, 'button', { type: 'button', class: cls, text: label });
      b.addEventListener('click', () => safeCall('link', target as (c: { email: string }) => void, { email: emailValue.trim() }));
      return b;
    }
    const a = h(doc, 'a', { class: cls, href: target, target: linkTarget, rel: linkTarget === '_blank' ? 'noopener noreferrer' : null }, label);
    if (linkTarget === '_blank') a.appendChild(h(doc, 'span', { class: 'myio-gcdr-sr', text: ` ${t('login.newTab')}` }));
    return a;
  };
  const forgotTarget = (): string | ((ctx: { email: string }) => void) | undefined =>
    !forgotShown ? undefined : typeof forgot === 'string' || typeof forgot === 'function' ? forgot : `${webUrl}/forgot-password`;

  const renderNotice = () => {
    if (!els.notice) return;
    els.notice.textContent = '';
    if (!notice) return;
    const key = presentation === 'modal' ? 'notice.sessionExpiredModal' : 'notice.sessionExpired';
    els.notice.appendChild(
      h(doc, 'div', { class: 'myio-gcdr-banner myio-gcdr-banner--info' },
        icon(doc, ICONS.info(16), 'myio-gcdr-banner__icon'),
        h(doc, 'div', { class: 'myio-gcdr-banner__body' }, h(doc, 'span', { text: t(key) })))
    );
  };

  const renderAlerts = () => {
    if (!els.alerts) return;
    els.alerts.textContent = '';
    els.banner = undefined;
    if (!err.pres && !err.messageKey) return;
    const p = err.pres;
    const tone = p?.tone ?? 'error';
    const body = h(doc, 'div', { class: 'myio-gcdr-banner__body' });
    if (p?.title) body.appendChild(h(doc, 'span', { class: 'myio-gcdr-banner__title', text: t(p.title) }));
    if (p) {
      if (p.text) body.appendChild(h(doc, 'span', { text: p.text }));
      p.keys.forEach((k, i) => body.appendChild(h(doc, 'span', { text: t(k, i === 0 && p.count !== undefined ? { count: p.count } : undefined) })));
      if (p.forgotLink) {
        const ft = forgotTarget();
        if (ft) body.appendChild(linkEl(t('errors.goToForgot'), ft, ''));
      }
      if (p.gcdrWebLink && webUrl) body.appendChild(linkEl(t('login.gcdrWeb'), `${webUrl}/login`, ''));
      if (p.support && supportHref) body.appendChild(linkEl(t('login.support'), supportHref, ''));
    } else if (err.messageKey) {
      body.appendChild(h(doc, 'span', { text: t(err.messageKey) }));
    }
    if (err.help) {
      const who = supportHref ? t('errors.helpSupport') : t('errors.helpAdmin');
      body.appendChild(h(doc, 'span', { text: t('errors.invalidCredentialsHelp', { who }) }));
      if (supportHref) body.appendChild(linkEl(t('login.support'), supportHref, ''));
    }
    const ic = p?.icon === 'lock' ? ICONS.lock(16) : p?.icon === 'shieldAlert' ? ICONS.shieldAlert(16) : ICONS.alert(16);
    const banner = h(doc, 'div', { class: `myio-gcdr-banner myio-gcdr-banner--${tone}`, tabindex: '-1' }, icon(doc, ic, 'myio-gcdr-banner__icon'), body);
    els.alerts.appendChild(banner);
    els.banner = banner;
  };

  const syncControls = () => {
    if (!els.submit || !els.email || !els.password) return;
    const busy = phase === 'submitting' || phase === 'success';
    const blocked = busy || leaving || !!lockedKey;
    els.submit.setAttribute('aria-disabled', blocked ? 'true' : 'false');
    els.submit.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (lockedKey && els.banner) {
      if (!els.banner.id) els.banner.id = `myio-gcdr-lock-${Math.random().toString(36).slice(2, 8)}`;
      els.submit.setAttribute('aria-describedby', els.banner.id);
    } else els.submit.removeAttribute('aria-describedby');
    els.submit.textContent = '';
    if (busy) {
      els.submit.append(icon(doc, ICONS.spinner(18), 'myio-gcdr-login__spin'), h(doc, 'span', { text: t('login.signingIn') }));
    } else els.submit.append(h(doc, 'span', { text: t('login.signIn') }));
    els.email.readOnly = busy || leaving;
    els.password.readOnly = busy || leaving;
  };

  const render = () => {
    if (destroyed) return;
    if (els.email) emailValue = els.email.value;
    if (els.password) passwordValue = els.password.value;
    const hadFocusId = doc.activeElement && cardHost.contains(doc.activeElement) ? (doc.activeElement as HTMLElement).getAttribute('data-k') : null;
    cardHost.textContent = '';
    const locale = getLocale();
    const { root, body, footer, title } = buildPanel(
      doc, cardHost,
      { eyebrow: options.brand?.label ?? t('login.eyebrow'), title: t('login.title'), footer: true, accent: options.brand?.accent, bandColor: options.brand?.bandColor, tint: options.brand?.tint, logoUrl: options.assets?.logoUrl },
      locale
    );
    if (options.size && options.embed) root.style.maxWidth = options.size === 'xl' ? '37rem' : options.size === 'lg' ? '32rem' : '28rem';
    else if (options.embed) root.style.maxWidth = '28rem';
    root.style.margin = '0 auto';
    if (options.brand?.accent) root.style.setProperty('--myio-gcdr-accent-hover', options.brand.accent);
    root.setAttribute('data-theme', getTheme());
    els = { root, title };
    const noticeEl = h(doc, 'div', { class: 'myio-gcdr-login__alerts', role: 'status', 'aria-live': 'polite' });
    const alerts = h(doc, 'div', { class: 'myio-gcdr-login__alerts', role: 'alert' });
    els.notice = noticeEl;
    els.alerts = alerts;

    const form = h(doc, 'form', { class: 'myio-gcdr-login__form', novalidate: true });
    const uid = Math.random().toString(36).slice(2, 8);

    // e-mail
    const email = h(doc, 'input', {
      id: `myio-gcdr-email-${uid}`, 'data-k': 'email', class: 'myio-gcdr-login__input', type: 'email', inputmode: 'email',
      autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: t('login.emailPlaceholder'),
      'aria-invalid': fieldErrors.email ? 'true' : 'false',
    }) as HTMLInputElement;
    email.value = emailValue;
    const emailErr = h(doc, 'span', { id: `myio-gcdr-email-err-${uid}`, class: 'myio-gcdr-login__fielderror', text: fieldErrors.email ? t(fieldErrors.email) : '' });
    if (fieldErrors.email) email.setAttribute('aria-describedby', emailErr.id);
    const emailField = h(doc, 'div', { class: 'myio-gcdr-login__field' },
      h(doc, 'label', { class: 'myio-gcdr-login__label', for: email.id, text: t('login.email') }), email, fieldErrors.email ? emailErr : null);
    if (options.initialEmail) {
      const notYou = h(doc, 'button', { type: 'button', class: 'myio-gcdr-login__link', text: t('login.notYou') });
      notYou.addEventListener('click', () => {
        email.value = '';
        emailValue = '';
        onEmailInput();
        email.focus();
      });
      emailField.appendChild(notYou);
    }

    // password
    const password = h(doc, 'input', {
      id: `myio-gcdr-pass-${uid}`, 'data-k': 'password', class: 'myio-gcdr-login__input myio-gcdr-login__input--password',
      type: passwordVisible ? 'text' : 'password', autocomplete: 'current-password', enterkeyhint: 'go',
      placeholder: '••••••••', 'aria-invalid': fieldErrors.password ? 'true' : 'false',
    }) as HTMLInputElement;
    password.value = passwordValue;
    const passErr = h(doc, 'span', { id: `myio-gcdr-pass-err-${uid}`, class: 'myio-gcdr-login__fielderror', text: fieldErrors.password ? t(fieldErrors.password) : '' });
    if (fieldErrors.password) password.setAttribute('aria-describedby', passErr.id);
    const control = h(doc, 'div', { class: 'myio-gcdr-login__control' }, password);
    if (options.show?.passwordToggle !== false) {
      const eye = h(doc, 'button', { type: 'button', class: 'myio-gcdr-login__eye', 'aria-pressed': passwordVisible ? 'true' : 'false', 'aria-label': t(passwordVisible ? 'login.hidePassword' : 'login.showPassword'), 'aria-controls': password.id });
      eye.appendChild(icon(doc, passwordVisible ? ICONS.eyeOff(18) : ICONS.eye(18)));
      eye.addEventListener('click', () => {
        passwordVisible = !passwordVisible;
        password.type = passwordVisible ? 'text' : 'password';
        eye.setAttribute('aria-pressed', passwordVisible ? 'true' : 'false');
        eye.setAttribute('aria-label', t(passwordVisible ? 'login.hidePassword' : 'login.showPassword'));
        eye.textContent = '';
        eye.appendChild(icon(doc, passwordVisible ? ICONS.eyeOff(18) : ICONS.eye(18)));
      });
      control.appendChild(eye);
    }
    const caps = h(doc, 'span', { class: 'myio-gcdr-login__hint', 'aria-live': 'polite' });
    const capsCheck = (e: KeyboardEvent) => {
      const on = typeof e.getModifierState === 'function' && e.getModifierState('CapsLock');
      caps.textContent = on ? t('login.capsLockOn') : '';
    };
    password.addEventListener('keydown', capsCheck);
    password.addEventListener('keyup', capsCheck);
    const passField = h(doc, 'div', { class: 'myio-gcdr-login__field' },
      h(doc, 'label', { class: 'myio-gcdr-login__label', for: password.id, text: t('login.password') }), control, caps, fieldErrors.password ? passErr : null);

    // remember + forgot
    const row = h(doc, 'div', { class: 'myio-gcdr-login__row' });
    if (options.show?.rememberMe !== false) {
      const cb = h(doc, 'input', { type: 'checkbox' }) as HTMLInputElement;
      cb.checked = rememberValue;
      cb.addEventListener('change', () => { rememberValue = cb.checked; });
      row.appendChild(h(doc, 'label', { class: 'myio-gcdr-login__remember' }, cb, h(doc, 'span', { text: t('login.rememberMe') })));
    } else row.appendChild(h(doc, 'span'));
    const ft = forgotTarget();
    if (ft) row.appendChild(linkEl(t('login.forgotPassword'), ft));

    const submit = h(doc, 'button', { type: 'submit', 'data-k': 'submit', class: 'myio-gcdr-login__submit', 'data-style': options.submitStyle ?? 'auth' }) as HTMLButtonElement;
    form.append(emailField, passField, row, submit);
    form.addEventListener('submit', (e) => { e.preventDefault(); void doSubmit(); });

    email.addEventListener('input', () => { emailValue = email.value; onEmailInput(); });
    password.addEventListener('input', () => {
      passwordValue = password.value;
      if (fieldErrors.password) { fieldErrors.password = validate(email.value, password.value).passwordError; if (!fieldErrors.password) { password.setAttribute('aria-invalid', 'false'); passErr.remove(); } }
    });

    body.append(noticeEl, alerts, form);
    // footer
    if (footer) {
      const reg = options.links?.register;
      if (reg) {
        footer.append(h(doc, 'span', { text: `${t('login.noAccount')} ` }), linkEl(t('login.createAccount'), reg));
      } else footer.appendChild(h(doc, 'span', { text: options.footerText ? localize(options.footerText, locale) : t('login.askAdmin') }));
      internals.decorateFooter?.(footer, api);
    }
    els = { ...els, email, password, submit, caps };
    renderNotice();
    renderAlerts();
    syncControls();
    if (hadFocusId) (cardHost.querySelector(`[data-k="${hadFocusId}"]`) as HTMLElement | null)?.focus();
  };

  const onEmailInput = () => {
    const key = emailKey(emailValue);
    if (fieldErrors.email) {
      fieldErrors.email = validate(emailValue, '').emailError;
      if (!fieldErrors.email) render();
    }
    if (lockedKey && key !== lockedKey) {
      lockedKey = null;
      err = {};
      renderAlerts();
      syncControls();
    }
    if (streakKey && key !== streakKey) { noCounterStreak = 0; streakKey = null; }
  };

  const focusTarget = (f: ErrorPresentation['focus']) => {
    const el = f === 'password' ? els.password : f === 'email' ? els.email : f === 'banner' ? els.banner : els.submit;
    el?.focus();
  };

  const setError = (code: MyioGcdrLoginErrorCode, pres: ErrorPresentation, opts: { help?: boolean; notify?: boolean; remaining?: number }) => {
    err = { code, pres, help: opts.help };
    if (pres.clearPassword && els.password) { els.password.value = ''; passwordValue = ''; }
    renderAlerts();
    syncControls();
    focusTarget(pres.focus);
    if (opts.notify !== false) safeCall('onError', options.onError, { code, remainingAttempts: opts.remaining });
  };

  const doSubmit = async () => {
    if (destroyed || phase !== 'idle' || leaving || lockedKey) return;
    const email = els.email!.value;
    const password = els.password!.value;
    const v = validate(email, password);
    fieldErrors = { email: v.emailError, password: v.passwordError };
    if (v.emailError || v.passwordError) {
      render();
      (v.emailError ? els.email : els.password)?.focus();
      return;
    }
    fieldErrors = {};
    attempt += 1;
    const my = attempt;
    phase = 'submitting';
    err = { ...err, pres: undefined, messageKey: undefined, help: false, code: undefined };
    if (passwordVisible) { passwordVisible = false; els.password!.type = 'password'; }
    renderAlerts();
    syncControls();
    const ac = new AbortController();
    attemptAbort = ac;
    abortCause = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      if (viewTimeoutMs) timer = setTimeout(() => { abortCause = 'timeout'; ac.abort(); reject(Object.assign(new Error('timeout'), { myioGcdrCode: 'TIMEOUT' })); }, viewTimeoutMs);
    });
    let outcome: ReturnType<typeof normaliseResult> | { kind: 'thrown'; err: unknown };
    try {
      const raw = await Promise.race([strategy({ email: v.email, password, remember: rememberValue, locale: getLocale() }, { signal: ac.signal, attempt: my }), timeout]);
      outcome = normaliseResult(raw);
      if (outcome.kind === 'error' && outcome.code === 'INTEGRATION_ERROR' && !(raw && typeof raw === 'object' && typeof (raw as { ok?: unknown }).ok === 'boolean')) {
        console.error('[MYIO Login] INTEGRATION_ERROR: invalid onSubmit result');
      }
    } catch (e) {
      outcome = { kind: 'thrown', err: e };
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (destroyed || my !== attempt || abortCause === 'destroy' || abortCause === 'exit') return;
    attemptAbort = null;

    if (outcome.kind === 'thrown') {
      phase = 'idle';
      const code = abortCause === 'timeout' ? 'TIMEOUT' : normaliseThrown(outcome.err);
      setError(code, present({ kind: 'error', code }), {});
      return;
    }
    if (outcome.kind === 'error') {
      phase = 'idle';
      const k = emailKey(v.email);
      let help = false;
      if (outcome.code === 'INVALID_CREDENTIALS' && outcome.remainingAttempts === undefined) {
        noCounterStreak = streakKey === k ? noCounterStreak + 1 : 1;
        streakKey = k;
        help = noCounterStreak >= 2;
      } else { noCounterStreak = 0; streakKey = null; }
      if (outcome.code === 'ACCOUNT_LOCKED') lockedKey = k;
      setError(outcome.code, present(outcome), { help, remaining: outcome.remainingAttempts });
      return;
    }
    // success
    phase = 'success';
    if (els.password) els.password.value = '';
    passwordValue = '';
    err = {};
    noCounterStreak = 0;
    if (options.show?.rememberMe !== false) storageSet(`${prefix}rememberedEmail`, rememberValue ? v.email : null);
    renderAlerts();
    syncControls();
    const sa = new AbortController();
    successAbort = sa;
    try {
      await options.onSuccess(outcome.session, { signal: sa.signal });
    } catch {
      if (destroyed || sa.signal.aborted) return;
      console.error('[MYIO Login] onSuccess failed');
      phase = 'idle';
      err = { messageKey: 'errors.postLoginFailed', pres: { tone: 'error', keys: ['errors.postLoginFailed'], icon: 'alert', clearPassword: true, focus: 'password' } };
      renderAlerts();
      syncControls();
      els.password?.focus();
      return;
    }
    if (destroyed || sa.signal.aborted) return;
    internals.afterSuccess?.();
  };

  const api: ViewInternalApi = {
    abortAttempt() {
      if (attemptAbort) { abortCause = 'exit'; attemptAbort.abort(); attemptAbort = null; attempt += 1; }
      if (phase === 'submitting') phase = 'idle';
      leaving = true;
      syncControls();
    },
    clearPassword() { if (els.password) els.password.value = ''; passwordValue = ''; },
    showLeaveFailed() {
      leaving = false;
      err = { messageKey: 'errors.leaveFailed', pres: { tone: 'error', keys: ['errors.leaveFailed'], icon: 'alert', clearPassword: false, focus: 'submit' } };
      renderAlerts();
      syncControls();
    },
    t: (k) => t(k),
    locale: getLocale,
    phase: () => phase,
  };

  // ── Mount ────────────────────────────────────────────────────────────────
  let offChange: (() => void) | undefined;
  if (shell) {
    const asideOpt = options.aside ?? { kind: 'about' as const };
    if (asideOpt.kind === 'about') {
      const healthUrl = asideOpt.healthUrl !== undefined ? asideOpt.healthUrl : options.gcdr ? `${options.gcdr.apiUrl.replace(/\/+$/, '').replace(/\/api\/v\d+$/, '')}/health` : false;
      shell.setSlot('aside', { kind: 'about', healthUrl });
    } else if (asideOpt.kind === 'signedOutPrompt') shell.setSlot('aside', { kind: 'signedOutPrompt', text: asideOpt.text });
    else if (asideOpt.kind === 'custom') shell.setSlot('aside', asideOpt.render);
    shell.setSlot('main', (el) => { el.appendChild(cardHost); });
    offChange = shell.onChange(() => render());
  } else if (embedCtx) {
    const offT = embedCtx.on('theme', () => render());
    const offL = embedCtx.on('locale', () => render());
    offChange = () => { offT(); offL(); };
    embedCtx.signal.addEventListener('abort', () => handle.destroy(), { once: true });
  }
  render();
  const autoFocus = options.autoFocus ?? !isCoarsePointer();
  if (autoFocus && presentation === 'inline') (options.initialEmail ? els.password : els.email)?.focus();

  const restricted: MyioGcdrRestrictedShell | undefined = shell
    ? {
        setSlot: (name, content, o) => {
          if ((name as string) === 'main') fail('the main slot belongs to the login view');
          shell!.setSlot(name, content, o);
        },
        setShow: (s) => shell!.setShow(s),
      }
    : undefined;

  const handle: MyioGcdrLoginViewHandle & { _api: ViewInternalApi } = {
    getState() {
      return {
        phase: destroyed ? 'destroyed' : leaving ? 'leaving' : phase,
        error: err.code,
        message: err.messageKey ?? err.pres?.keys[0],
        locked: !!lockedKey,
        notice: notice?.code,
        captcha: 'none',
        email: emailValue.trim() || undefined,
        locale: getLocale(),
        theme: getTheme(),
      };
    },
    setLocale(l) { if (shell) shell.setLocale(l); },
    setTheme(th) { if (shell) shell.setTheme(th); },
    showError(code, extra) {
      if (destroyed) return;
      const o = normaliseResult({ ok: false, code, remainingAttempts: extra?.remainingAttempts, message: extra?.message });
      if (o.kind !== 'error') return;
      if (o.code === 'ACCOUNT_LOCKED') lockedKey = emailKey(emailValue);
      const pres = present(o);
      err = { code: o.code, pres };
      renderAlerts();
      syncControls();
    },
    clearError() {
      if (destroyed) return;
      err = {};
      lockedKey = null;
      renderAlerts();
      syncControls();
    },
    setNotice(n) {
      if (destroyed) return;
      notice = n && n.code === 'SESSION_EXPIRED' ? n : null;
      renderNotice();
    },
    reset() {
      if (destroyed || phase !== 'success') return;
      successAbort?.abort();
      phase = 'idle';
      syncControls();
    },
    focus() { (options.initialEmail ? els.password : els.email)?.focus(); },
    get shell() { return restricted; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      abortCause = 'destroy';
      attemptAbort?.abort();
      successAbort?.abort();
      offChange?.();
      if (els.password) els.password.value = '';
      passwordValue = '';
      if (shell) shell.destroy();
      else { cardHost.textContent = ''; releaseEmbedStyles?.(); }
    },
    _api: api,
  };
  return handle;
}

/** RFC-0236 Layer 2 — the GCDR login, inline in `container` (or embedded in a host shell slot). */
export function createMyioGcdrLoginView(container: HTMLElement, options: MyioGcdrLoginViewOptions): MyioGcdrLoginViewHandle {
  const impl = createLoginViewImpl(container, options, { presentation: 'inline' });
  const { _api, ...pub } = impl;
  void _api;
  return Object.defineProperty(pub, 'shell', { get: () => impl.shell, enumerable: true }) as MyioGcdrLoginViewHandle;
}
