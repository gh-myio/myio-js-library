// engines/AuthClient.ts
// Thin wrapper that delegates to buildMyioIngestionAuth for OAuth2 client-credentials.

import { buildMyioIngestionAuth, type MyIOAuthInstance } from '../../../../thingsboard/auth/buildMyioIngestionAuth';

export class AuthClient {
  private auth: MyIOAuthInstance | null = null;

  constructor(private cfg: { clientId?: string; clientSecret?: string; base?: string }) {
    if (cfg.clientId && cfg.clientSecret && cfg.base) {
      this.auth = buildMyioIngestionAuth({
        dataApiHost: cfg.base,
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
      });
    }
  }

  async getBearer(): Promise<string> {
    if (!this.auth) {
      throw new Error('AuthClient: clientId, clientSecret and base are required');
    }
    return this.auth.getToken();
  }

  clearCache(): void {
    this.auth?.clearCache();
  }
}
