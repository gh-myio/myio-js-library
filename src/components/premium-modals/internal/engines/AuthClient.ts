// engines/AuthClient.ts
export class AuthClient {
  private token?: { value: string; exp: number };
  
  constructor(private cfg: { clientId?: string; clientSecret?: string; base?: string }) {}
  
  async getBearer(): Promise<string> {
    const now = Date.now()/1000;
    if (this.token && this.token.exp - now > 60) return this.token.value;
    
    // TODO: implement real auth; for now return empty string for mocked demos
    this.token = { value: '', exp: now + 300 };
    return this.token.value;
  }
  
  clearCache(): void {
    this.token = undefined;
  }
}
