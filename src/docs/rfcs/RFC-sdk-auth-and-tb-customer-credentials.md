- Feature Name: `sdk-auth-and-tb-customer-credentials`
- Start Date: 2025-08-27
- RFC PR: [myio-js-library#0000](https://github.com/gh-myio/myio-js-library/pull/0000)
- Tracking Issue: [myio-js-library#0000](https://github.com/gh-myio/myio-js-library/issues/0000)

# Summary
[summary]: #summary

Introduce a small, composable Auth Client and a ThingsBoard Customer Credentials Provider to myio-js-library.
This splits credential discovery (from ThingsBoard Customer attributes) from token acquisition (against the MyIO auth endpoint), provides safe token caching/renewal, and exposes a clear API for both UMD (ThingsBoard widgets) and ESM/CJS (apps and services).

Additionally, we include a formatNumberReadable utility for consistent localized numeric formatting.

# Motivation
[motivation]: #motivation

Today, several widgets/controllers contain hand-rolled logic to obtain tokens or hard-coded client credentials. This:

- duplicates code across controllers,
- couples auth to UI code,
- adds security risks (client secrets in widget code),
- makes testing/mocking hard,
- complicates future changes (e.g., new auth endpoint or credential rotation).

By componentizing this logic into a library:

- **Maintainability**: widgets call a stable SDK API instead of duplicating logic.
- **Security**: credentials are fetched from Customer attributes on ThingsBoard; only the access_token gets cached, not secrets.
- **Testability**: clear interfaces (fetcher, storage) enable unit tests with Vitest.
- **Compatibility**: works in ThingsBoard via UMD and in Node/bundlers via ESM/CJS.

# Guide-level explanation
[guide-level-explanation]: #guide-level-explanation

## What are we adding?

### Auth Client (createAuthClient)
Fetches and caches an access token from https://data.myio-bas.com/api/v1/auth, with:

- early renewal (skew),
- exponential backoff on errors,
- pluggable storage and fetch.

### ThingsBoard Customer Credentials Provider (createTBCustomerCredentialsProvider)
Reads client_id and client_secret from Customer attributes using the logged-in user JWT, then supplies them to the Auth Client on demand.

### Utility formatNumberReadable(value, locale?, minFD?, maxFD?)
Safe, localized numeric formatting for reports and UIs.

## Typical UMD usage in a ThingsBoard widget

```html
<script src="https://unpkg.com/myio-js-library@0.1.4/dist/myio-js-library.umd.min.js"></script>
<script>
  (async () => {
    const { 
      createAuthClient, 
      createTBCustomerCredentialsProvider, 
      formatNumberReadable 
    } = MyIOLibrary;

    const jwt = localStorage.getItem('jwt_token');

    // Discover client_id/client_secret from TB Customer attributes:
    const getCredentials = createTBCustomerCredentialsProvider({
      jwt,
      baseUrl: '',                     // relative to TB host
      clientIdKey: 'myioClientId',     // attribute key on Customer
      clientSecretKey: 'myioClientSecret',
      scope: 'SERVER_SCOPE'
    });

    // Create the auth client:
    const auth = createAuthClient({
      authUrl: 'https://data.myio-bas.com/api/v1/auth',
      getCredentials
    });

    // Use it:
    const headers = await auth.withAuthHeaders();
    const resp = await fetch('https://ingestion.myio-bas.com/api/v1/secure-endpoint', { headers });
    const data = await resp.json();

    // Format a number:
    console.log(formatNumberReadable(12345.678)); // "12.345,68" in pt-BR default
  })();
</script>
```

## ESM usage

```javascript
import { 
  createAuthClient, 
  createTBCustomerCredentialsProvider 
} from 'myio-js-library';

const getCredentials = createTBCustomerCredentialsProvider({
  jwt: process.env.TB_JWT!,
  baseUrl: 'https://tb.example.com',
});

const auth = createAuthClient({
  authUrl: 'https://data.myio-bas.com/api/v1/auth',
  getCredentials
});

const token = await auth.getToken();
```

# Reference-level explanation
[reference-level-explanation]: #reference-level-explanation

## Module Layout

### src/auth/oauth.ts

- `createAuthClient(options): AuthClient`
- `createMemoryStorage(): TokenStorage`
- Types: `AuthClient`, `CreateAuthClientOptions`, `TokenStorage`, `StoredToken`

### src/thingsboard/customerCredentials.ts

- `createTBCustomerCredentialsProvider(options): () => Promise<{ clientId, clientSecret }>`
- Types: `TBCustomerProviderOptions`

### src/format/number.ts (or similar)

- `formatNumberReadable(value, locale?, minFD?, maxFD?)`

## createAuthClient(options)

```typescript
interface StoredToken {
  access_token: string;
  expires_at: number; // epoch ms
}

interface TokenStorage {
  get(): Promise<StoredToken | null> | StoredToken | null;
  set(v: StoredToken | null): Promise<void> | void;
}

interface CreateAuthClientOptions {
  authUrl: string;
  getCredentials: () => Promise<{ clientId: string; clientSecret: string }>;
  renewSkewSec?: number;                 // default 60
  retry?: { baseMs?: number; maxAttempts?: number }; // default 500ms / 3 attempts
  fetcher?: typeof fetch;                // default global fetch
  storage?: TokenStorage;                // default in-memory
}

interface AuthClient {
  getToken(): Promise<string>;
  getExpiryInfo(): { expiresAt: number; expiresInSeconds: number };
  clear(): void;
  withAuthHeaders(init?: HeadersInit): Promise<HeadersInit>; // adds `Authorization: Bearer <token>`
}
```

### Behavior:

- Reads token from storage. If missing or expiring within renewSkewSec, obtains a new token.
- Coalesces concurrent refreshes with inFlight promise.
- Retries with exponential backoff up to maxAttempts.
- Only the access token is stored; credentials are never persisted.

## createTBCustomerCredentialsProvider(options)

```typescript
interface TBCustomerProviderOptions {
  jwt: string;                           // logged-in user's JWT
  baseUrl?: string;                      // e.g., '', '/api', or full TB base
  customerId?: string;                   // optional; if not provided, resolve via /api/auth/user
  clientIdKey?: string;                  // default 'myioClientId'
  clientSecretKey?: string;              // default 'myioClientSecret'
  scope?: 'SERVER_SCOPE' | 'CLIENT_SCOPE' | 'SHARED_SCOPE'; // default SERVER_SCOPE
  fetcher?: typeof fetch;                // default global fetch
}
```

### Behavior:

- If customerId not provided, calls `GET {baseUrl}/api/auth/user` to resolve it.
- Reads attributes: `GET {baseUrl}/api/plugins/telemetry/CUSTOMER/{customerId}/values/attributes?scope={scope}`
- Locates clientIdKey / clientSecretKey, throws if missing.

## formatNumberReadable(value, locale='pt-BR', minFD=2, maxFD=2)

- Accepts `number | string | unknown`.
- Returns '-' for invalid/NaN input.
- Handles -0 → 0.
- Uses toLocaleString for the given locale and fraction digits.

## Packaging & Exports

- ESM/CJS via tsup.
- UMD via rollup & terser.
- exports field exposes:
  - import → ESM
  - require → CJS
  - UMD global: MyIOLibrary.

# Drawbacks
[drawbacks]: #drawbacks

- Slightly increases library surface area and maintenance burden.
- Still obtains tokens in the browser (inevitable for TB widget use-cases).
- Depends on Customer attributes being present and correctly named.

# Rationale and alternatives
[rationale-and-alternatives]: #rationale-and-alternatives

**Why a provider?** Decouples where credentials come from (TB Customer) from how tokens are acquired (Auth endpoint). Makes tests and future sources straightforward (e.g., environment variables or a proxy).

**Why not store secrets?** Minimizes risk if storage is compromised; only access tokens (short-lived) are cached.

**Alternative: Backend proxy** for all calls to ingestion (server signs requests). More secure, but not viable for TB widgets without custom infra.

**Alternative: OAuth2 PKCE** in browser with dedicated auth server. Heavier flow and infra; can be a future step.

# Prior art
[prior-art]: #prior-art

- Token caches in HTTP clients (axios interceptors, MSAL).
- Provider patterns in AWS SDKs and GCP clients.
- ThingsBoard attribute-based configuration for multi-tenant customization.

# Unresolved questions
[unresolved-questions]: #unresolved-questions

- Exact attribute keys: we default to myioClientId / myioClientSecret. Confirm final names.
- Base URL differences in various TB deployments ('' vs '/api' vs full origin). We currently expect '' or full.
- Token TTL and renewSkewSec default (60s). Adjust after observing production TTLs.
- Whether to provide an optional localStorage TokenStorage (disabled by default due to security considerations).

# Future possibilities
[future-possibilities]: #future-possibilities

- PKCE or service-to-service flows where feasible.
- Auto-rotation and a helper to write new credentials back to Customer attributes (admin-only).
- Retry / rate-limit helpers that read Retry-After and honor server backoff.
- Telemetry hooks to measure token refresh and error rates.
- Credential Provider variants (e.g., pull from Tenant attributes or Device profiles).

# Security Considerations
[security-considerations]: #security-considerations

- Do not persist client_secret. Only keep short-lived access_token in memory by default.
- Use HTTPS. Ensure CORS is configured server-side for widget host(s).
- Apply least privilege: credentials should be scoped to the minimal APIs needed.
- Consider rotating credentials regularly and automating rotation out of band.
- Avoid logging sensitive values. The library logs only timings and statuses (no secrets).

# Implementation Plan
[implementation-plan]: #implementation-plan

## Milestone 1 — Core

- [ ] Add src/auth/oauth.ts and tests (Vitest).
- [ ] Add src/thingsboard/customerCredentials.ts and tests with mocked fetch.
- [ ] Add formatNumberReadable and tests.
- [ ] Export in src/index.ts (ESM/CJS/UMD).
- [ ] Update README with UMD and ESM examples.

## Milestone 2 — Integration

- [ ] Replace ad-hoc token logic in MAIN_WATER/ and TO_CHECK/ controllers with SDK calls.
- [ ] Create a migration doc (see below).

## Milestone 3 — Release

- [ ] Version bump (minor).
- [ ] npm run build, npm pack --dry-run, smoke tests in a TB widget.
- [ ] Publish and tag release.

# Migration Guide
[migration-guide]: #migration-guide

## From custom MyIOAuth IIFE to SDK

**Before:**

```javascript
const token = await MyIOAuth.getToken();
```

**After:**

```javascript
const getCredentials = MyIOLibrary.createTBCustomerCredentialsProvider({
  jwt: localStorage.getItem('jwt_token'),
  baseUrl: '',
  clientIdKey: 'myioClientId',
  clientSecretKey: 'myioClientSecret',
  scope: 'SERVER_SCOPE'
});

const auth = MyIOLibrary.createAuthClient({
  authUrl: 'https://data.myio-bas.com/api/v1/auth',
  getCredentials
});

const token = await auth.getToken();
```

## Replace direct fetch with withAuthHeaders

```javascript
const headers = await auth.withAuthHeaders();
const resp = await fetch('https://ingestion.myio-bas.com/api/v1/energy-readings/batch-period-sum', {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify(params)
});
```

## Numeric formatting

Replace inline formatting utilities with:

```javascript
const pretty = MyIOLibrary.formatNumberReadable(totalConsumptionKwh); // "1.234,00" (pt-BR)
```

# Testing Plan
[testing-plan]: #testing-plan

## Unit tests

### Auth:
- returns cached token when fresh
- refreshes near expiry (skew)
- coalesces concurrent refreshes
- retries with exponential backoff

### TB Provider:
- resolves customerId via /api/auth/user
- reads attributes and maps keys
- errors when keys missing

### Number formatting:
- strings/numbers, NaN, -0, locales

## Integration smoke
- UMD in a TB widget: obtain token and call a test endpoint.

## CI
- Vitest in GitHub Actions, lint, build.

# Drawbacks & Risks
[drawbacks-risks]: #drawbacks-risks

- If Customer attributes are misconfigured, auth fails. We surface clear error messages; dashboards should handle this gracefully.
- Browser token presence: minimize visibility (no logging) and storage (memory by default).

# Alternatives Considered
[alternatives-considered]: #alternatives-considered

- **Bake a specific ThingsBoard service into the SDK**: rejected to keep concerns separate and testable.
- **Global singleton token manager**: chosen factory approach for flexibility and testability.

# Adoption & Rollout
[adoption-rollout]: #adoption-rollout

- Release as myio-js-library@0.2.0 (minor version).
- Announce in CHANGELOG and docs with migration steps.
- Update example widgets to use the new APIs.

# Appendix A — Public API (final)
[appendix-a]: #appendix-a

```typescript
// auth
export {
  createAuthClient,
  createMemoryStorage,
  type AuthClient,
  type CreateAuthClientOptions
} from './auth/oauth';

// thingsboard
export {
  createTBCustomerCredentialsProvider,
  type TBCustomerProviderOptions
} from './thingsboard/customerCredentials';

// format
export { formatNumberReadable } from './format/number';
```

# Appendix B — Success Metrics
[appendix-b]: #appendix-b

- 0 hard-coded secrets in widget/controllers.
- ≥ 90% unit test coverage on auth/provider.
- No regressions in data fetching latency (token reuse).
- Reduced support incidents related to token expiry/renewal.
