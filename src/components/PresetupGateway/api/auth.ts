import type { AuthConfig } from '../types';

/**
 * OAuth2 client-credentials token manager.
 * Caches the token in memory and auto-refreshes before expiry.
 * Deduplicates concurrent renewal calls via a single in-flight Promise.
 *
 * Ported faithfully from presetup-nextjs/src/services/auth.ts.
 */
export class PresetupAuth {
  private config: AuthConfig;
  private token: string | null = null;
  private expiresAt = 0;
  private inFlight: Promise<string> | null = null;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  private now(): number {
    return Date.now();
  }

  private aboutToExpire(): boolean {
    if (!this.token) return true;
    return this.now() >= this.expiresAt - this.config.renewSkewSeconds * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  private async requestNewToken(): Promise<string> {
    let attempt = 0;

    while (true) {
      try {
        const res = await fetch(this.config.authUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Auth failed: HTTP ${res.status} ${text}`);
        }

        const json = await res.json();

        if (!json?.access_token || !json?.expires_in) {
          throw new Error('Auth response is missing access_token or expires_in');
        }

        this.token = json.access_token as string;
        this.expiresAt = this.now() + Number(json.expires_in) * 1000;

        return this.token;
      } catch (err) {
        attempt++;
        if (attempt >= this.config.retryMaxAttempts) throw err;
        await this.sleep(this.config.retryBaseMs * Math.pow(2, attempt - 1));
      }
    }
  }

  async getToken(): Promise<string> {
    if (this.inFlight) return this.inFlight;

    if (this.aboutToExpire()) {
      this.inFlight = this.requestNewToken().finally(() => {
        this.inFlight = null;
      });
      return this.inFlight;
    }

    return this.token!;
  }

  clearCache(): void {
    this.token = null;
    this.expiresAt = 0;
    this.inFlight = null;
  }

  isValid(): boolean {
    return this.token !== null && !this.aboutToExpire();
  }
}
