// engines/AuthClient.ts
// Thin wrapper that delegates to buildMyioIngestionAuth for OAuth2 client-credentials.
// RFC-0224: fetch() sends Data API requests through ingestionFetch, so an expired or revoked
// token is renewed once and the request repeated, instead of failing with 401.

import { buildMyioIngestionAuth, type MyIOAuthInstance } from '../../../../services/ingestion/buildMyioIngestionAuth';
import { ingestionAuthScopeId, ingestionFetch } from '../../../../services/ingestion/ingestionFetch';

export class AuthClient {
  private auth: MyIOAuthInstance | null = null;
  private scopeId = '';

  constructor(private cfg: { clientId?: string; clientSecret?: string; base?: string }) {
    if (cfg.clientId && cfg.clientSecret && cfg.base) {
      this.auth = buildMyioIngestionAuth({
        dataApiHost: cfg.base,
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
      });
      this.scopeId = ingestionAuthScopeId(cfg.base, cfg.clientId);
    }
  }

  /** True when client credentials were given (token renewal is possible). */
  hasCredentials(): boolean {
    return !!this.auth;
  }

  async getBearer(): Promise<string> {
    if (!this.auth) {
      throw new Error('AuthClient: clientId, clientSecret and base are required');
    }
    return this.auth.getToken();
  }

  /**
   * Data API request with the bearer. With client credentials it goes through `ingestionFetch`
   * (RFC-0224); without them — or if the credentials cannot produce a token at all — it uses
   * `fallbackToken` as before, without recovery.
   */
  async fetch(
    url: string,
    init: RequestInit = {},
    opts: { context?: string; fallbackToken?: string } = {},
  ): Promise<Response> {
    const auth = this.auth;
    if (auth) {
      let tokenReady = true;
      try {
        await auth.getTokenInfo();
      } catch (err) {
        if (!opts.fallbackToken) throw err;
        tokenReady = false;
      }
      if (tokenReady) {
        return ingestionFetch(url, init, {
          authScopeId: this.scopeId,
          getAuth: () => auth,
          context: opts.context || 'premium-modal',
        });
      }
    }
    if (!opts.fallbackToken) {
      throw new Error('ingestionToken is required for Data API calls to data.apps.myio-bas.com');
    }
    const headers = new Headers(init.headers || undefined);
    headers.set('Authorization', `Bearer ${opts.fallbackToken}`);
    return fetch(url, { ...init, headers });
  }

  clearCache(): void {
    this.auth?.invalidate('AuthClient.clearCache');
  }
}
