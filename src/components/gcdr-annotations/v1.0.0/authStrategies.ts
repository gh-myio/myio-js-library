/**
 * RFC-0218 §Strategy — auth is decided once at construction, request code
 * stays auth-agnostic. `apply()` mutates a plain headers bag so the client
 * doesn't need to know which strategy it holds.
 */
import type { GcdrAnnotationsAuthConfig } from './types';

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
    const resolved = typeof this.token === 'function' ? await this.token() : this.token;
    headers['Authorization'] = `Bearer ${resolved}`;
  }
}

/**
 * Exactly one of `apiKey` / `bearerToken` is required — both or neither is a
 * caller bug, so it throws rather than silently picking one (RFC-0218 §Constructor).
 */
export function createAuthStrategy(auth: GcdrAnnotationsAuthConfig): AuthStrategy {
  const hasApiKey = !!auth.apiKey;
  const hasBearer = auth.bearerToken !== undefined && auth.bearerToken !== null && auth.bearerToken !== '';

  if (hasApiKey && hasBearer) {
    throw new Error(
      'GcdrAnnotationsClient: provide exactly one of auth.apiKey or auth.bearerToken, not both.'
    );
  }
  if (hasApiKey) return new ApiKeyAuth(auth.apiKey as string);
  if (hasBearer) return new BearerAuth(auth.bearerToken as string | (() => Promise<string> | string));

  throw new Error('GcdrAnnotationsClient: auth.apiKey or auth.bearerToken is required.');
}
