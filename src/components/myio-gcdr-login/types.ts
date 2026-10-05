/**
 * RFC-0236 rev. 5 — MYIO GCDR shell and login view: public types.
 *
 * Owner defaults applied for the first implementation (2026-10-04, "just go"):
 * - only the `credentials` strategy is public; unknown `auth.kind` values are
 *   rejected at runtime with code MYIO_GCDR_AUTH_UNSUPPORTED (R4-D1);
 * - `gcdr: {…}` always means credentials against GCDR (R4-D2);
 * - the shell is exported but `@experimental` (R4-D3);
 * - the view exposes a restricted shell handle, absent in the modal (R4-D5).
 */

export type MyioGcdrLocale = 'pt-BR' | 'en';
export type MyioGcdrTheme = 'light' | 'dark';
export type MyioGcdrThemeSetting = MyioGcdrTheme | 'system';
export type Localized = string | Partial<Record<MyioGcdrLocale, string>>;

// ── Layer 1: shell ──────────────────────────────────────────────────────────

export type MyioGcdrShellSize = 'md' | 'lg' | 'xl';
export type MyioGcdrShellWidth = 'auto' | 'cockpit';
/** May grow in minor versions. */
export type MyioGcdrSlotName = 'top' | 'topRight' | 'aside' | 'main' | 'below';

export interface MyioGcdrWallpaper {
  light?: string;
  dark?: string;
  mobileLight?: string;
  mobileDark?: string;
}

/** @experimental The shell contract may change in minor versions until GCDR validates it (RFC-0236 R4-C3). */
export interface MyioGcdrShellOptions {
  size?: MyioGcdrShellSize;
  width?: MyioGcdrShellWidth;
  wallpaper?: MyioGcdrWallpaper | false;
  theme?: MyioGcdrThemeSetting;
  locale?: MyioGcdrLocale;
  show?: { themeToggle?: boolean; languageSelector?: boolean };
  buildInfo?: string;
  storageKeyPrefix?: string;
  fonts?: { load?: boolean };
  cspNonce?: string;
  /** Aside behaviour below 1024 px: 'hide' (GCDR login) or 'stack' (below main). Default 'hide'. */
  asideCompact?: 'hide' | 'stack';
  onThemeChange?: (theme: MyioGcdrTheme) => void;
  onLocaleChange?: (locale: MyioGcdrLocale) => void;
}

export interface MyioGcdrSlotContext {
  readonly theme: MyioGcdrTheme;
  readonly locale: MyioGcdrLocale;
  /** Subscribe to theme/locale changes. Cancelled automatically when `signal` aborts. */
  on(event: 'theme' | 'locale', fn: (value: string) => void): () => void;
  /** Builds a GCDR card panel (band + optional title + body + optional footer) inside the slot. */
  panel(opts: MyioGcdrPanelOptions): { root: HTMLElement; body: HTMLElement; footer?: HTMLElement; title?: HTMLElement };
  readonly signal: AbortSignal;
}

export interface MyioGcdrPanelOptions {
  eyebrow: Localized;
  title?: Localized;
  footer?: boolean;
  fill?: boolean;
  accent?: string;
  tint?: string;
  logo?: boolean;
  logoUrl?: string;
  bandColor?: string;
}

export type MyioGcdrSlotRenderer = (el: HTMLElement, ctx: MyioGcdrSlotContext) => void | (() => void);

export type MyioGcdrBuiltInSlot =
  | { kind: 'about'; healthUrl?: string | false }
  | { kind: 'signedOutPrompt'; text?: Localized }
  | { kind: 'buildInfo'; text: string };

export interface MyioGcdrSetSlotOptions {
  /** 'auto' (default): when focus was inside the replaced slot, focus the slot container. */
  focus?: 'auto' | 'none' | HTMLElement;
  /** Polite announcement after the swap. */
  announce?: Localized;
}

/** @experimental */
export interface MyioGcdrShellHandle {
  setSlot(name: MyioGcdrSlotName, content: MyioGcdrSlotRenderer | MyioGcdrBuiltInSlot | null, opts?: MyioGcdrSetSlotOptions): void;
  setTheme(theme: MyioGcdrThemeSetting): void;
  setLocale(locale: MyioGcdrLocale): void;
  setSize(size: MyioGcdrShellSize, width?: MyioGcdrShellWidth): void;
  setShow(show: { themeToggle?: boolean; languageSelector?: boolean }): void;
  getState(): {
    theme: MyioGcdrTheme;
    locale: MyioGcdrLocale;
    size: MyioGcdrShellSize;
    width: MyioGcdrShellWidth;
    slots: Record<MyioGcdrSlotName, 'empty' | 'builtIn' | 'host'>;
  };
  readonly element: HTMLElement;
  destroy(): void;
}

/** What the login view exposes of its own shell (never 'main', which holds the card). */
export interface MyioGcdrRestrictedShell {
  setSlot(name: 'top' | 'topRight' | 'aside' | 'below', content: MyioGcdrSlotRenderer | MyioGcdrBuiltInSlot | null, opts?: MyioGcdrSetSlotOptions): void;
  setShow(show: { themeToggle?: boolean; languageSelector?: boolean }): void;
}

// ── Layer 3: authentication strategy ────────────────────────────────────────

export interface MyioGcdrCredentials {
  /** Trimmed (as GCDR's Zod schema); case preserved. */
  email: string;
  /** As typed — never trimmed, never logged, never stored. */
  password: string;
  remember: boolean;
  captchaToken?: string;
  locale: MyioGcdrLocale;
}

export interface MyioGcdrLoginSubmitContext {
  signal: AbortSignal;
  attempt: number;
}

/** May grow in minor versions — consumers need a default branch. */
export type MyioGcdrLoginErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'CAPTCHA_FAILED'
  | 'TOO_MANY_REQUESTS'
  | 'MFA_REQUIRED'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER'
  | 'INTEGRATION_ERROR'
  | 'CUSTOM';

export type MyioGcdrLoginResult =
  | { ok: true; session?: unknown }
  | {
      ok: false;
      code: MyioGcdrLoginErrorCode | string;
      remainingAttempts?: number;
      message?: string;
      clearPassword?: boolean;
    };

export type MyioGcdrLoginSubmitFn = (
  input: MyioGcdrCredentials,
  ctx: MyioGcdrLoginSubmitContext
) => Promise<MyioGcdrLoginResult>;

/** Public strategy union. Only 'credentials' exists today; other kinds are rejected at runtime. */
export type MyioGcdrAuth = { kind: 'credentials'; submit: MyioGcdrLoginSubmitFn };

export interface MyioGcdrClientOptions {
  apiUrl: string;
  tenantId: string;
  fetch?: typeof fetch;
  extraHeaders?: Record<string, string>;
  /** Default 15000. */
  timeoutMs?: number;
}

// ── Layer 2: login view ─────────────────────────────────────────────────────

export interface MyioGcdrLoginNotice {
  code: 'SESSION_EXPIRED';
}

export type MyioGcdrAside =
  | { kind: 'about'; healthUrl?: string | false }
  | { kind: 'signedOutPrompt'; text?: Localized }
  | { kind: 'custom'; render: MyioGcdrSlotRenderer }
  | { kind: 'none' };

export interface MyioGcdrLoginLinks {
  forgotPassword?: string | ((ctx: { email: string }) => void) | false;
  register?: string | (() => void) | false;
  gcdrWebUrl?: string;
  target?: '_self' | '_blank';
}

export interface MyioGcdrLoginViewOptions {
  onSubmit?: MyioGcdrLoginSubmitFn;
  gcdr?: MyioGcdrClientOptions;
  auth?: MyioGcdrAuth;
  /** onSubmit/auth only. Default 30000. */
  submitTimeoutMs?: number;
  onSuccess: (session: unknown, ctx: { signal: AbortSignal }) => void | Promise<void>;
  onError?: (error: { code: MyioGcdrLoginErrorCode; remainingAttempts?: number }) => void;

  /** Render only the card into `container`, following a host shell's slot context. */
  embed?: false | { context: MyioGcdrSlotContext };

  size?: MyioGcdrShellSize;
  theme?: MyioGcdrThemeSetting;
  locale?: MyioGcdrLocale;
  show?: {
    themeToggle?: boolean;
    languageSelector?: boolean;
    rememberMe?: boolean;
    passwordToggle?: boolean;
    wallpaper?: boolean;
  };
  aside?: MyioGcdrAside;
  submitStyle?: 'auth' | 'hotPage';
  notice?: MyioGcdrLoginNotice;

  brand?: {
    /** Band label ("ACESSO", "ACESSO ALARMES", "ACESSO GCDR"…), rendered uppercase. Default: login.eyebrow. */
    label?: Localized;
    /** Brand colour: band, submit button, links, focus ring. Default '#6B4ABF'. */
    accent?: string;
    /** Band background only (overrides `accent` for the band). Default: `accent`. */
    bandColor?: string;
    /** Optional colour layered over the band, below label and logo. */
    tint?: string;
    /** "Sobre a MYIO" band. Default '#2E8B57'. */
    asideHeaderColor?: string;
  };
  assets?: { logoUrl?: string; wallpaper?: MyioGcdrWallpaper | false };

  links?: MyioGcdrLoginLinks;
  support?: { label: Localized; href: string } | false;
  footerText?: Localized;
  buildInfo?: string;
  messages?: Partial<Record<MyioGcdrLocale, Partial<Record<string, string>>>>;
  initialEmail?: string;
  autoFocus?: boolean;
  storageKeyPrefix?: string;
  fonts?: { load?: boolean };
  cspNonce?: string;
  onThemeChange?: (theme: MyioGcdrTheme) => void;
  onLocaleChange?: (locale: MyioGcdrLocale) => void;
}

export type MyioGcdrLoginPhase = 'idle' | 'submitting' | 'success' | 'leaving' | 'destroyed';

export interface MyioGcdrLoginState {
  phase: MyioGcdrLoginPhase;
  error?: MyioGcdrLoginErrorCode;
  message?: string;
  locked: boolean;
  notice?: 'SESSION_EXPIRED';
  captcha: 'none' | 'pending' | 'ready' | 'failed';
  email?: string;
  locale: MyioGcdrLocale;
  theme: MyioGcdrTheme;
}

export interface MyioGcdrLoginViewHandle {
  getState(): MyioGcdrLoginState;
  setLocale(locale: MyioGcdrLocale): void;
  setTheme(theme: MyioGcdrThemeSetting): void;
  showError(code: MyioGcdrLoginErrorCode, extra?: { message?: string; remainingAttempts?: number }): void;
  clearError(): void;
  setNotice(notice: MyioGcdrLoginNotice | null): void;
  reset(): void;
  focus(): void;
  readonly shell?: MyioGcdrRestrictedShell;
  destroy(): void;
}

// ── Modal ───────────────────────────────────────────────────────────────────

export interface MyioGcdrLoginModalOptions extends Omit<MyioGcdrLoginViewOptions, 'embed'> {
  overlay?: {
    backdrop?: 'solid' | 'blur' | 'image';
    opacity?: number;
    blur?: number;
    dismissible?: boolean;
    closeOnSuccess?: boolean;
    scope?: 'viewport' | { element: HTMLElement };
    exit?: { label: Localized; href: string };
    zIndex?: number;
  };
  onOpen?: () => void;
  onClose?: (reason: 'success' | 'dismiss' | 'api' | 'exit') => void;
}

export interface MyioGcdrLoginModalHandle extends Omit<MyioGcdrLoginViewHandle, 'shell'> {
  close(): void;
  readonly isOpen: boolean;
}
