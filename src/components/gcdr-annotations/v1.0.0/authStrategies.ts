/**
 * RFC-0218 — auth Strategy pattern.
 *
 * `{ apiKey }` → `X-API-Key` header (M2M, hierarchy-scoped).
 * `{ bearerToken }` → `Authorization: Bearer` (users/frontends); the token may
 * be a plain string or an async provider (integrates with
 * `buildMyioIngestionAuth`-style token caches).
 *
 * Both schemes are accepted by the GCDR API (openapi.yaml top-level
 * `security: [{bearerAuth: []}, {apiKeyAuth: []}]`) — the caller picks one at
 * construction time; request code stays auth-agnostic.
 */

import type { GcdrAnnotationsAuth } from './types';

export interface AuthStrategy {
  apply(headers: Record<string, string>): Promise<void> | void;
}

export class ApiKeyAuth implements AuthStrategy {
  constructor(private readonly apiKey: string) {}

  apply(headers: Record<string, string>): void {
    headers['X-API-Key'] = this.apiKey;
  }
}

export class BearerAuth implements AuthStrategy {
  constructor(private readonly token: string | (() => Promise<string> | string)) {}

  async apply(headers: Record<string, string>): Promise<void> {
    const value = typeof this.token === 'function' ? await this.token() : this.token;
    headers['Authorization'] = `Bearer ${value}`;
  }
}

/**
 * Exactly one of `apiKey` / `bearerToken` is required — both or neither is a
 * construction error (explicitness over precedence rules, per RFC-0218).
 */
export function buildAuthStrategy(auth: GcdrAnnotationsAuth): AuthStrategy {
  const hasApiKey = typeof auth.apiKey === 'string' && auth.apiKey.length > 0;
  const hasBearer = auth.bearerToken !== undefined && auth.bearerToken !== null;

  if (hasApiKey && hasBearer) {
    throw new Error(
      'GcdrAnnotationsClient: provide exactly one of auth.apiKey or auth.bearerToken, not both'
    );
  }
  if (hasApiKey) return new ApiKeyAuth(auth.apiKey as string);
  if (hasBearer) return new BearerAuth(auth.bearerToken as string | (() => Promise<string> | string));

  throw new Error('GcdrAnnotationsClient: auth requires exactly one of apiKey or bearerToken');
}
