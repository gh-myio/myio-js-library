/**
 * RFC-0218 §Strategy — auth is decided once at construction, request code
 * stays auth-agnostic. `apply()` mutates a plain headers bag so the client
 * doesn't need to know which strategy it holds.
 */
import type { GcdrAnnotationsAuthConfig } from './types';

export interface AuthStrategy {
  apply(headers: Record<string, string>): Promise<void> | void;
}

type TokenSource = string | (() => Promise<string> | string);

async function resolveToken(token: TokenSource): Promise<string> {
  return typeof token === 'function' ? await token() : token;
}

export class ApiKeyAuth implements AuthStrategy {
  constructor(private readonly apiKey: string) {}

  apply(headers: Record<string, string>): void {
    headers['X-API-Key'] = this.apiKey;
  }
}

export class BearerAuth implements AuthStrategy {
  constructor(private readonly token: TokenSource) {}

  async apply(headers: Record<string, string>): Promise<void> {
    headers['Authorization'] = `Bearer ${await resolveToken(this.token)}`;
  }
}

/**
 * RFC-0219 — the ThingsBoard dashboard path: the user's TB JWT in
 * `X-TB-Authorization`, validated by GCDR against ThingsBoard. Resolved per
 * request, so pass a provider like `() => localStorage.getItem('jwt_token')`.
 */
export class TbSessionAuth implements AuthStrategy {
  constructor(private readonly token: TokenSource) {}

  async apply(headers: Record<string, string>): Promise<void> {
    headers['X-TB-Authorization'] = `Bearer ${await resolveToken(this.token)}`;
  }
}

function isSet(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

/**
 * Exactly one of `apiKey` / `bearerToken` / `tbSessionToken` is required —
 * more or none is a caller bug, so it throws rather than silently picking one
 * (RFC-0218 §Constructor).
 */
export function createAuthStrategy(auth: GcdrAnnotationsAuthConfig = {}): AuthStrategy {
  const provided = [auth.apiKey, auth.bearerToken, auth.tbSessionToken].filter(isSet).length;
  if (provided > 1) {
    throw new Error(
      'GcdrAnnotationsClient: provide exactly one of auth.apiKey, auth.bearerToken or auth.tbSessionToken.'
    );
  }
  if (isSet(auth.apiKey)) return new ApiKeyAuth(auth.apiKey as string);
  if (isSet(auth.bearerToken)) return new BearerAuth(auth.bearerToken as TokenSource);
  if (isSet(auth.tbSessionToken)) return new TbSessionAuth(auth.tbSessionToken as TokenSource);

  throw new Error('GcdrAnnotationsClient: auth.apiKey, auth.bearerToken or auth.tbSessionToken is required.');
}
