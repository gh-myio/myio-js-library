/**
 * RFC-0242 — auth strategies (RFC-0218 pattern): decided once at construction,
 * request code stays auth-agnostic. Exactly one of `apiKey` / `bearerToken`.
 *
 * - API key: a GCDR customer API key with scope `bot:use` → `X-API-Key`
 *   (`X-Tenant-Id` optional: GCDR discovers the tenant from the key).
 * - Bearer: a GCDR JWT (myio-gcdr-login or the host session) → `Authorization`;
 *   GCDR's JWT path reads the tenant from `X-Tenant-Id`, so pass `tenantId`.
 *
 * Strategies never log and never expose the credential (no toString/JSON of it).
 */
import { MyIOBotError } from './errors';

export interface MyIOBotAuth {
  /** Customer API key with scope `bot:use` (X-API-Key). */
  apiKey?: string;
  /** GCDR JWT, static or resolved per request (refreshable sessions). */
  bearerToken?: string | (() => string | Promise<string>);
  /** Sent as X-Tenant-Id with either strategy when present. */
  tenantId?: string;
}

export interface MyIOBotAuthStrategy {
  readonly kind: 'apiKey' | 'bearer';
  apply(headers: Record<string, string>): Promise<void>;
}

export function createBotAuthStrategy(auth: MyIOBotAuth | undefined): MyIOBotAuthStrategy {
  const a = auth || {};
  const hasKey = typeof a.apiKey === 'string' && a.apiKey.length > 0;
  const hasBearer = typeof a.bearerToken === 'function' || (typeof a.bearerToken === 'string' && a.bearerToken.length > 0);
  if (hasKey && hasBearer) {
    throw new MyIOBotError('CONFIG_ERROR', 'MyIO Bot: provide exactly one of auth.apiKey or auth.bearerToken, not both.');
  }
  if (!hasKey && !hasBearer) {
    throw new MyIOBotError('CONFIG_ERROR', 'MyIO Bot: auth.apiKey or auth.bearerToken is required.');
  }
  const tenantId = a.tenantId;
  if (hasKey) {
    const key = a.apiKey as string;
    return {
      kind: 'apiKey',
      async apply(h) {
        h['X-API-Key'] = key;
        if (tenantId) h['X-Tenant-Id'] = tenantId;
      },
    };
  }
  const token = a.bearerToken as string | (() => string | Promise<string>);
  return {
    kind: 'bearer',
    async apply(h) {
      const v = typeof token === 'function' ? await token() : token;
      if (!v) throw new MyIOBotError('UNAUTHORIZED', 'MyIO Bot: the bearer token provider returned an empty token.', 401);
      h['Authorization'] = `Bearer ${v}`;
      if (tenantId) h['X-Tenant-Id'] = tenantId;
    },
  };
}
