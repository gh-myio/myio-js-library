/**
 * RFC-0236 — pure rules (no DOM): validation, outcome normalisation,
 * alias table, messages per code. Unit-tested in isolation.
 */
import type { MyioGcdrLoginErrorCode, MyioGcdrLoginResult } from './types';

/**
 * E-mail pattern of Zod 4.3.5 `z.string().email()` (zod/v4/core/regexes.js:26),
 * the version locked by gcdr-frontend at d71179b (src/schemas/auth.ts:7).
 */
export const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

export type FieldError = 'login.emailRequired' | 'login.emailInvalid' | 'login.passwordRequired';

/** GCDR schema: e-mail trimmed (case preserved), required, Zod e-mail; password required, untouched. */
export function validate(emailRaw: string, password: string): {
  email: string;
  emailError?: FieldError;
  passwordError?: FieldError;
} {
  const email = emailRaw.trim();
  let emailError: FieldError | undefined;
  if (!email) emailError = 'login.emailRequired';
  else if (!EMAIL_PATTERN.test(email)) emailError = 'login.emailInvalid';
  const passwordError: FieldError | undefined = password.length === 0 ? 'login.passwordRequired' : undefined;
  return { email, emailError, passwordError };
}

/** Comparison key for "the e-mail changed" (lock exit, help counter). */
export function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

const KNOWN: ReadonlySet<string> = new Set<MyioGcdrLoginErrorCode>([
  'INVALID_CREDENTIALS', 'ACCOUNT_LOCKED', 'CAPTCHA_FAILED', 'TOO_MANY_REQUESTS', 'MFA_REQUIRED',
  'NETWORK', 'TIMEOUT', 'SERVER', 'INTEGRATION_ERROR', 'CUSTOM',
]);

const ALIASES: Record<string, MyioGcdrLoginErrorCode> = {
  UNAUTHORIZED: 'INVALID_CREDENTIALS',
  HTTP_401: 'INVALID_CREDENTIALS',
  ACCOUNT_PENDING: 'INVALID_CREDENTIALS',
  PENDING_APPROVAL: 'INVALID_CREDENTIALS',
  ACCOUNT_SUSPENDED: 'INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'INVALID_CREDENTIALS',
  RATE_LIMITED: 'TOO_MANY_REQUESTS',
  NETWORK_ERROR: 'NETWORK',
};

export function normaliseCode(code: unknown): MyioGcdrLoginErrorCode {
  if (typeof code !== 'string') return 'SERVER';
  if (KNOWN.has(code)) return code as MyioGcdrLoginErrorCode;
  return ALIASES[code] ?? 'SERVER';
}

/** A counter is usable only as a finite integer ≥ 1 (0 and invalid values mean "no counter"). */
export function usableCounter(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : undefined;
}

export type Outcome =
  | { kind: 'ok'; session: unknown }
  | {
      kind: 'error';
      code: MyioGcdrLoginErrorCode;
      remainingAttempts?: number;
      message?: string;
      clearPassword?: boolean;
    };

/** Normalise whatever the strategy resolved with. Invalid shapes ⇒ INTEGRATION_ERROR. */
export function normaliseResult(raw: unknown): Outcome {
  if (!raw || typeof raw !== 'object' || typeof (raw as { ok?: unknown }).ok !== 'boolean') {
    return { kind: 'error', code: 'INTEGRATION_ERROR' };
  }
  const r = raw as MyioGcdrLoginResult;
  if (r.ok) return { kind: 'ok', session: r.session };
  const code = normaliseCode(r.code);
  return {
    kind: 'error',
    code,
    remainingAttempts: code === 'INVALID_CREDENTIALS' ? usableCounter(r.remainingAttempts) : undefined,
    message: code === 'CUSTOM' && typeof r.message === 'string' ? r.message : undefined,
    clearPassword: code === 'CUSTOM' ? r.clearPassword !== false : undefined,
  };
}

/** Thrown values: TypeError ⇒ NETWORK; anything else ⇒ SERVER. (Aborts are handled by the caller.) */
export function normaliseThrown(err: unknown): MyioGcdrLoginErrorCode {
  if (err && typeof err === 'object' && (err as { myioGcdrCode?: string }).myioGcdrCode === 'TIMEOUT') return 'TIMEOUT';
  return err instanceof TypeError ? 'NETWORK' : 'SERVER';
}

export type Tone = 'error' | 'warning';
export type Focus = 'password' | 'email' | 'banner' | 'submit' | 'captcha';

export interface ErrorPresentation {
  tone: Tone;
  /** Translation keys, first is the primary message; `count` applies to plural keys. */
  keys: string[];
  count?: number;
  title?: string;
  /** Show the forgot-password link inside the banner. */
  forgotLink?: boolean;
  /** Show "Entrar pelo GCDR Web" (MFA). */
  gcdrWebLink?: boolean;
  support?: boolean;
  icon: 'alert' | 'shieldAlert' | 'lock';
  clearPassword: boolean;
  focus: Focus;
  /** Raw host text (CUSTOM only), inserted as text. */
  text?: string;
}

export const ATTEMPTS_THRESHOLD = 3;

export function present(o: Extract<Outcome, { kind: 'error' }>): ErrorPresentation {
  switch (o.code) {
    case 'INVALID_CREDENTIALS': {
      const n = o.remainingAttempts;
      if (n === undefined)
        return { tone: 'error', keys: ['errors.invalidCredentials'], icon: 'alert', clearPassword: true, focus: 'password' };
      if (n > ATTEMPTS_THRESHOLD)
        return { tone: 'error', keys: ['errors.invalidWithAttempts'], count: n, icon: 'alert', clearPassword: true, focus: 'password' };
      if (n === 1)
        return { tone: 'warning', keys: ['errors.lastAttempt', 'errors.lockWarning'], icon: 'shieldAlert', forgotLink: true, clearPassword: true, focus: 'password' };
      return { tone: 'warning', keys: ['errors.attemptsLeft', 'errors.lockWarning'], count: n, icon: 'shieldAlert', forgotLink: true, clearPassword: true, focus: 'password' };
    }
    case 'ACCOUNT_LOCKED':
      return { tone: 'error', keys: ['errors.lockedText'], title: 'errors.lockedTitle', icon: 'lock', support: true, clearPassword: true, focus: 'banner' };
    case 'MFA_REQUIRED':
      return { tone: 'error', keys: ['errors.mfaUnsupported'], icon: 'shieldAlert', gcdrWebLink: true, support: true, clearPassword: true, focus: 'banner' };
    case 'CAPTCHA_FAILED':
      return { tone: 'error', keys: ['errors.captchaFailed'], icon: 'alert', clearPassword: false, focus: 'captcha' };
    case 'TOO_MANY_REQUESTS':
      return { tone: 'error', keys: ['errors.tooManyRequests'], icon: 'alert', clearPassword: false, focus: 'submit' };
    case 'NETWORK':
      return { tone: 'error', keys: ['errors.networkError'], icon: 'alert', clearPassword: false, focus: 'submit' };
    case 'TIMEOUT':
      return { tone: 'error', keys: ['errors.timeout'], icon: 'alert', clearPassword: false, focus: 'submit' };
    case 'INTEGRATION_ERROR':
      return { tone: 'error', keys: ['errors.integrationError'], icon: 'alert', clearPassword: false, focus: 'submit' };
    case 'CUSTOM': {
      const clear = o.clearPassword !== false;
      return {
        tone: 'error', keys: o.message ? [] : ['errors.loginFailed'], text: o.message, icon: 'alert',
        clearPassword: clear, focus: clear ? 'password' : 'submit',
      };
    }
    case 'SERVER':
    default:
      return { tone: 'error', keys: ['errors.loginFailed'], icon: 'alert', clearPassword: false, focus: 'submit' };
  }
}
