import { describe, expect, it } from 'vitest';
import {
  EMAIL_PATTERN,
  normaliseCode,
  normaliseResult,
  normaliseThrown,
  present,
  usableCounter,
  validate,
} from '../../../src/components/myio-gcdr-login/controller';

describe('RFC-0236 controller — validation (Zod 4.3.5 e-mail)', () => {
  it.each([
    ['nome@empresa.com', true],
    ['a.b+tag@sub.dominio.com.br', true],
    ["o'neil@x.io", true],
    ['.lead@x.com', false],
    ['a..b@x.com', false],
    ['semarroba.com', false],
    ['a@b', false],
    ['a@b.c', false],
  ])('%s → %s', (email, ok) => {
    expect(EMAIL_PATTERN.test(email)).toBe(ok);
  });

  it('trims the e-mail (case preserved), never the password', () => {
    const v = validate('  Nome@Empresa.com ', ' pass ');
    expect(v.email).toBe('Nome@Empresa.com');
    expect(v.emailError).toBeUndefined();
    expect(v.passwordError).toBeUndefined();
  });

  it('reports required and invalid fields', () => {
    expect(validate('', '').emailError).toBe('login.emailRequired');
    expect(validate('x', '').emailError).toBe('login.emailInvalid');
    expect(validate('a@b.com', '').passwordError).toBe('login.passwordRequired');
  });
});

describe('RFC-0236 controller — outcome normalisation (§4.5, §4.7)', () => {
  it('maps aliases', () => {
    expect(normaliseCode('UNAUTHORIZED')).toBe('INVALID_CREDENTIALS');
    expect(normaliseCode('HTTP_401')).toBe('INVALID_CREDENTIALS');
    expect(normaliseCode('PENDING_APPROVAL')).toBe('INVALID_CREDENTIALS');
    expect(normaliseCode('EMAIL_NOT_VERIFIED')).toBe('INVALID_CREDENTIALS');
    expect(normaliseCode('RATE_LIMITED')).toBe('TOO_MANY_REQUESTS');
    expect(normaliseCode('NETWORK_ERROR')).toBe('NETWORK');
    expect(normaliseCode('SESSION_EXPIRED')).toBe('SERVER');
    expect(normaliseCode(42)).toBe('SERVER');
  });

  it('invalid shapes become INTEGRATION_ERROR', () => {
    for (const raw of [undefined, null, 'ok', {}, { ok: 'yes' }]) {
      expect(normaliseResult(raw)).toEqual({ kind: 'error', code: 'INTEGRATION_ERROR' });
    }
  });

  it('keeps the counter only for INVALID_CREDENTIALS and only as an integer ≥ 1', () => {
    expect(usableCounter(0)).toBeUndefined();
    expect(usableCounter(2.5)).toBeUndefined();
    expect(usableCounter(-1)).toBeUndefined();
    expect(usableCounter(Number.NaN)).toBeUndefined();
    expect(usableCounter(3)).toBe(3);
    const r = normaliseResult({ ok: false, code: 'NETWORK', remainingAttempts: 2 });
    expect(r).toMatchObject({ kind: 'error', code: 'NETWORK', remainingAttempts: undefined });
  });

  it('shows host text only for CUSTOM', () => {
    expect(normaliseResult({ ok: false, code: 'SERVER', message: 'raw' })).toMatchObject({ message: undefined });
    expect(normaliseResult({ ok: false, code: 'CUSTOM', message: 'Manutenção' })).toMatchObject({ message: 'Manutenção', clearPassword: true });
    expect(normaliseResult({ ok: false, code: 'CUSTOM', clearPassword: false })).toMatchObject({ clearPassword: false });
  });

  it('thrown values', () => {
    expect(normaliseThrown(new TypeError('Failed to fetch'))).toBe('NETWORK');
    expect(normaliseThrown(new Error('boom'))).toBe('SERVER');
    expect(normaliseThrown(Object.assign(new Error('t'), { myioGcdrCode: 'TIMEOUT' }))).toBe('TIMEOUT');
  });
});

describe('RFC-0236 controller — messages per code (§4.8)', () => {
  const p = (code: string, remainingAttempts?: number) =>
    present(normaliseResult({ ok: false, code, remainingAttempts }) as never);

  it('INVALID_CREDENTIALS thresholds', () => {
    expect(p('INVALID_CREDENTIALS', 5)).toMatchObject({ tone: 'error', keys: ['errors.invalidWithAttempts'], count: 5 });
    expect(p('INVALID_CREDENTIALS', 3)).toMatchObject({ tone: 'warning', keys: ['errors.attemptsLeft', 'errors.lockWarning'], count: 3, forgotLink: true });
    expect(p('INVALID_CREDENTIALS', 2)).toMatchObject({ tone: 'warning', count: 2 });
    expect(p('INVALID_CREDENTIALS', 1)).toMatchObject({ tone: 'warning', keys: ['errors.lastAttempt', 'errors.lockWarning'] });
    expect(p('INVALID_CREDENTIALS', 0)).toMatchObject({ tone: 'error', keys: ['errors.invalidCredentials'] });
    expect(p('INVALID_CREDENTIALS')).toMatchObject({ clearPassword: true, focus: 'password' });
  });

  it('password policy and focus', () => {
    expect(p('ACCOUNT_LOCKED')).toMatchObject({ clearPassword: true, focus: 'banner', title: 'errors.lockedTitle', support: true });
    expect(p('MFA_REQUIRED')).toMatchObject({ clearPassword: true, focus: 'banner', gcdrWebLink: true });
    for (const c of ['NETWORK', 'TIMEOUT', 'SERVER', 'TOO_MANY_REQUESTS', 'INTEGRATION_ERROR']) {
      expect(p(c)).toMatchObject({ clearPassword: false, focus: 'submit' });
    }
    expect(p('CAPTCHA_FAILED')).toMatchObject({ clearPassword: false, focus: 'captcha' });
  });
});
