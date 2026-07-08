- Feature Name: `presetup-gateway`
- Start Date: 2026-03-02
- RFC PR: [myio-js-library#0000](https://github.com/gh-myio/myio-js-library/pull/0000)
- Tracking Issue: [myio-js-library#0000](https://github.com/gh-myio/myio-js-library/issues/0000)

# RFC-0185 — PresetupGateway

# Summary

Add a self-contained, framework-agnostic component `createPresetupGateway` to `myio-js-library` that embeds a complete single-gateway device pre-setup workflow into any host page via a vanilla JS factory function.

The component authenticates against the MyIO Ingestion API (OAuth2 client credentials), loads the existing device list for a gateway, allows operators to add new devices through an inline form, performs a two-phase idempotent sync (Ingestion API → Provisioning Central API), and exports label sheets as PDF with QR codes — all without depending on React or any frontend framework.

---

# Motivation

The existing pre-setup workflow lives exclusively inside `presetup-nextjs`, a standalone Next.js 14 application. Several internal projects (dashboards, admin panels, integration tools) need to embed a trimmed-down version of this workflow for a **single, already-existing gateway** without adopting the full Next.js app or replicating its sync logic.

Key pain points today:

- **Code duplication**: Each consumer project manually re-implements or copy-pastes the three-step idempotent device creation, Provisioning API polling, and QR URL encoding.
- **Inconsistency**: Small drift accumulates between copies (different XOR keys, different addr fallback logic, incomplete lookup step).
- **Bundle mismatch**: The full `presetup-nextjs` app carries ThingsBoard sync, customer hierarchy traversal, and Next.js runtime overhead — none of which is needed when the gateway already exists in the Ingestion API.
- **No reusable primitive**: `myio-js-library` already ships utility functions (codec, format, date) following the factory pattern; a gateway pre-setup component fits naturally in the same ecosystem.

**Non-goals**

- Full customer/asset hierarchy management (ThingsBoard sync, asset tree traversal).
- React or framework-specific APIs.
- Node.js server-side usage — this is a browser component.
- Creating gateways (the gateway must already exist in the Ingestion API).

---

# Guide-level explanation

## Intended usage

```typescript
import { createPresetupGateway } from 'myio-js-library';

const instance = createPresetupGateway({
  mount: document.getElementById('presetup-root')!,
  gatewayId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  clientId: 'my-oauth-client-id',
  clientSecret: 'my-oauth-client-secret',
  // Optional — defaults to MyIO production URLs
  ingestionApiUrl: 'https://management.myio-bas.com',
  ingestionAuthUrl: 'https://api.myio-bas.com/auth/token',
  provisioningApiUrl: 'https://provisioning.apps.myio-bas.com',
  onSyncComplete(result) {
    console.log('Sync done', result);
  },
  onError(err) {
    console.error('Presetup error', err);
  },
});

// Later — re-fetch devices from the API (e.g. after external changes)
await instance.refresh();

// Unmount and clean up DOM
instance.destroy();
```

## What the operator sees

1. **Header** — Gateway name and a status badge (loading / device count / error).
2. **Device table** — All devices currently registered in the Ingestion API for this gateway (`remote`), plus any locally added but not yet synced (`local`) or failed (`error`) devices.
3. **Add-device form** — Inline form with fields: type (dropdown with all 12 device types), name, slave ID, addr low, addr high, identifier. A single click appends the new device to the table with status `local`.
4. **Sync button** — Triggers the two-phase sync:
   - Phase 1 (Ingestion API): creates or updates each local device using the three-step idempotent strategy.
   - Phase 2 (Provisioning API): sends the full device list to `POST /centrals/:uuid/provision` and streams live job logs to the log panel.
5. **PDF export button** — Generates a label sheet (Grid 4×7, Grid 2×4, or one-per-page) with QR codes for each device and saves the PDF via jsPDF.
6. **Live log panel** — Scrollable monospace pane that shows per-step provisioning progress in real time.

---

# Reference-level explanation

## Package surface

```
src/components/PresetupGateway/
├── types.ts                   Public TypeScript interfaces & constants
├── types/
│   └── qrious.d.ts            Module declaration for QRious
├── api/
│   ├── auth.ts                PresetupAuth — OAuth2 client-credentials token manager
│   ├── ingestion.ts           IngestionApiClient — CRUD, paginated fetch, bulk lookup
│   └── provisioning.ts        ProvisioningApiClient — POST provision, job polling
├── utils/
│   ├── device.ts              Type mappings, name generation, QR URL builder, addr helpers
│   └── pdf.ts                 exportDeviceTagsPdf — jsPDF + QRious label sheet
└── index.ts                   createPresetupGateway factory function
```

Exported from `src/index.ts`:

```typescript
export { createPresetupGateway } from './components/PresetupGateway';
export type {
  PresetupGatewayOptions,
  PresetupGatewayInstance,
  PresetupDevice,
  GatewayInfo,
  DeviceType,
  DeviceMultipliers,
  SyncResult,
} from './components/PresetupGateway/types';
export { DEVICE_TYPES } from './components/PresetupGateway/types';
export type { PdfLayout } from './components/PresetupGateway/utils/pdf';
```

## Public API

### `createPresetupGateway(opts: PresetupGatewayOptions): PresetupGatewayInstance`

#### `PresetupGatewayOptions`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `mount` | `HTMLElement` | ✅ | — | DOM node where the component renders |
| `gatewayId` | `string` | ✅ | — | UUID of the existing gateway in the Ingestion API |
| `clientId` | `string` | ✅ | — | OAuth2 client ID |
| `clientSecret` | `string` | ✅ | — | OAuth2 client secret |
| `ingestionApiUrl` | `string` | — | `https://management.myio-bas.com` | Ingestion Management API base URL |
| `ingestionAuthUrl` | `string` | — | `https://api.myio-bas.com/auth/token` | OAuth2 token endpoint |
| `provisioningApiUrl` | `string` | — | `https://provisioning.apps.myio-bas.com` | Provisioning API base URL |
| `onSyncComplete` | `(result: SyncResult) => void` | — | — | Called after a successful two-phase sync |
| `onError` | `(error: Error) => void` | — | — | Called on unrecoverable error |

#### `PresetupGatewayInstance`

```typescript
interface PresetupGatewayInstance {
  refresh(): Promise<void>;  // Re-fetch devices from Ingestion API
  destroy(): void;           // Unmount and clear DOM
}
```

### `SyncResult`

```typescript
interface SyncResult {
  ingestion: {
    success: boolean;
    created: number;
    updated: number;
    failed: number;
  };
  provisioning: {
    success: boolean;
    jobId?: string;
    skipped?: boolean;
    skipReason?: string;    // e.g. "ipv6 (Yggdrasil) ausente no gateway"
  };
}
```

### `PresetupDevice`

```typescript
interface PresetupDevice {
  _localId: string;               // Temporary UI tracking key
  ingestion_device_id?: string;   // Ingestion API device ID (after sync)
  uuid: string;                   // Device UUID (used in QR + provisioning)
  name: string;
  type: DeviceType;
  slaveId: number;
  addr_low?: string;
  addr_high?: string;
  identifier?: string;
  multipliers?: DeviceMultipliers;
  status: 'remote' | 'local' | 'synced' | 'error';
  statusMessage?: string;
}
```

### `DeviceType` (12 supported types)

```typescript
type DeviceType =
  | '3F_MEDIDOR' | 'HIDROMETRO' | 'COMPRESSOR' | 'VENTILADOR'
  | 'TERMOSTATO' | 'MOTOR' | 'ESCADA_ROLANTE' | 'ELEVADOR'
  | 'SOLENOIDE' | 'CONTROLE_REMOTO' | 'CAIXA_D_AGUA' | 'CONTROLE_AUTOMACAO';
```

---

## Sync pipeline

### Phase 1 — Ingestion API (three-step idempotent strategy)

Ported faithfully from `presetup-nextjs/src/services/sync/ingestion-sync.ts`.

For each device with status `local`:

```
1. If device.ingestion_device_id is set
   → PUT /devices/:id  (update by stored ID)

2. Else bulk POST /devices/lookup [{gatewayId, slaveId}, ...]
   → If found → PUT /devices/:id + store ID

3. Else POST /devices  (create new)
   → Store result.data.id
```

Device payload sent to the Ingestion API:

```json
{
  "name": "<generated name with prefix>",
  "description": "<same as name>",
  "deviceType": "energy" | "water",
  "customerId": "<from GatewayInfo>",
  "assetId": "<from GatewayInfo>",
  "gatewayId": "<from opts>",
  "slaveId": 42,
  "uuid": "<device uuid>",
  "multipliers": { "amperage": 1, "voltage": 1, "power": 1, "temperature": 1 }
}
```

Device type → Ingestion API mapping:

| DeviceType | Ingestion `deviceType` |
|---|---|
| `HIDROMETRO`, `CAIXA_D_AGUA`, `SOLENOIDE` | `water` |
| All others | `energy` |

### Phase 2 — Provisioning API

Ported faithfully from `presetup-nextjs/src/services/sync/central-sync.ts`.

#### Precondition check (`canProvision`)

The component skips provisioning and reports `skipped: true` if any of these are missing from `GatewayInfo`:
- `ipv6` (Yggdrasil address)
- `id` (valid UUID — zero-width characters stripped before validation)
- `credentials.mqtt.clientId`
- `credentials.mqtt.username`
- `credentials.mqtt.password`

#### Provision request

```
POST {provisioningApiUrl}/centrals/{uuid}/provision
Content-Type: application/json
```

Payload:

```json
{
  "central_id": [21, 0, 0, 0],
  "frequency": 915,
  "name": "Gateway Name",
  "ipv6": "200:xxxx::1",
  "credentials": {
    "mqtt": {
      "server": "mqtt://mqtt.myio-bas.com",
      "clientId": "...",
      "username": "...",
      "password": "..."
    }
  },
  "devices": [
    {
      "name": "...",
      "originalName": "...",
      "type": "three_phase_sensor" | "infrared" | "outlet",
      "identifier": "...",
      "addr_low": 1,
      "addr_high": 1,
      "slave_id": 42,
      "uuid": "...",
      "description": "...",
      "multipliers": { ... },
      "channels": [...]       // HIDROMETRO only
    }
  ],
  "ambients": [
    { "id": 1, "name": "Gateway Name", "devices": [42, 43, ...] }
  ]
}
```

Device type → Provisioning API mapping:

| DeviceType | Provisioning `type` |
|---|---|
| `3F_MEDIDOR`, `ELEVADOR`, `ESCADA_ROLANTE`, `MOTOR`, `REPETIDOR_3F`, `3F` | `three_phase_sensor` |
| `REPETIDOR_RM`, `REMOTE` | `infrared` |
| All others | `outlet` |

`HIDROMETRO` additionally receives:
```json
"channels": [
  { "name": "Energia", "channel": 0, "type": "presence_sensor" },
  { "name": "<device name>", "channel": 1, "type": "flow_sensor" }
]
```

#### Job polling

The provisioning API returns `{ jobId }`. The component polls until `COMPLETED` or `FAILED`:

```
GET {provisioningApiUrl}/jobs/{jobId}          — check status (every 1 s)
GET {provisioningApiUrl}/jobs/{jobId}/logs     — fetch incremental log entries
```

- Maximum 600 iterations (10-minute timeout).
- Incremental: only entries with `id > lastLogId` are appended to the live log panel.
- `INFO` level entries are shown; internal `Progress updated to` messages are suppressed.

Step icons streamed to the log panel:

| Step | Icon |
|---|---|
| `CREATION` | 🔄 |
| `GETTING_IPV6` | 🌐 |
| `CONNECTING_SSH` | 🔐 |
| `CHECKING_DATABASE` | 🗃️ |
| `UPDATING_ENVIRONMENT` | ⚙️ |
| `ADDING_DEVICES` | 📟 |
| `ADDING_AMBIENTS` | 🏢 |
| `INSTALLING_PACKAGES` | 📦 |
| `WRITING_NODE_RED` | 🔗 |
| `RESTARTING_SERVICES` | 🔄 |
| `COMPLETED` | ✅ |

---

## QR URL format

Ported from `presetup-nextjs/src/lib/utils.ts` and `pdf-export.ts`.

```
https://produto.myio.com.br/{safeName}/{encodedPayload}
```

Where:
- `encodedPayload = base64(XOR(payload bytes, 0x49))` — key `73` (0x49).
- `payload = "{addrLow}/{addrHigh}/{freq}/{centralId}/{identifier}"`
- `centralId = "{arr[0]}.{arr[1]:03d}.{arr[2]:03d}.{arr[3]:03d}"` from `GatewayInfo.centralId`
- `safeName` — generated device name with prefix, spaces → `_`, special chars stripped.

Device name prefix map:

| DeviceType | Prefix |
|---|---|
| `COMPRESSOR` | `3F COMP.` |
| `VENTILADOR` | `3F VENT.` |
| `TERMOSTATO` | `TEMP.` |
| `3F_MEDIDOR` | `3F` |
| `MOTOR` | `3F MOTR.` |
| `ESCADA_ROLANTE` | `3F ESRL.` |
| `ELEVADOR` | `3F ELEV.` |
| `HIDROMETRO` | `HIDR.` |
| `SOLENOIDE` | `ABFE.` |
| `CONTROLE_REMOTO` | `AC` |
| `CAIXA_D_AGUA` | `SCD` |
| `CONTROLE_AUTOMACAO` | `GW_AUTO.` |

---

## PDF label export (`exportDeviceTagsPdf`)

Ported from `presetup-nextjs/src/services/pdf-export.ts`.

```typescript
export type PdfLayout = 'grid_4x7' | 'grid_2x4' | 'per_page';

export async function exportDeviceTagsPdf(
  devices: PresetupDevice[],
  gateway: GatewayInfo,
  layout?: PdfLayout,     // default: 'grid_4x7'
): Promise<void>
```

- A4 portrait, 8 mm margins, 16 mm header, 14 mm footer.
- **`grid_4x7`**: 28 tags per page (default).
- **`grid_2x4`**: 8 larger tags per page.
- **`per_page`**: one device per full page (for large tags).
- Each tag: device name with prefix, QR code (QRious size 520, level M), identifier + addr range below.
- Filename: `presetup-tags-{gatewayName}-{timestamp}.pdf`.

---

## Authentication (`PresetupAuth`)

Ported from `presetup-nextjs/src/services/auth.ts`.

- In-memory token cache with configurable `renewSkewSeconds` buffer (default: 30 s).
- Deduplicates concurrent refresh calls via a single `inFlight` Promise.
- Exponential-backoff retry on token fetch failure (`retryBaseMs`, `retryMaxAttempts`).
- Defaults used by the component: `renewSkewSeconds=30`, `retryBaseMs=500`, `retryMaxAttempts=3`.

---

## New dependencies

| Package | Version | Size (min+gz) | Purpose |
|---|---|---|---|
| `jspdf` | `^2.5.2` | ~300 KB | PDF generation |
| `qrious` | `^4.0.2` | ~15 KB | QR code canvas rendering |

Both are runtime `dependencies` (not peer dependencies) because the component handles PDF generation internally. Tree-shaking ensures they are only bundled when `createPresetupGateway` is actually imported.

---

## Build & types

- `"lib": ["ES2022", "DOM"]` added to `tsconfig.json` to enable browser API types (`fetch`, `HTMLElement`, `document`, `crypto`, etc.).
- `src/components/PresetupGateway/types/qrious.d.ts` declares the QRious module shape.
- No changes to the ESM/CJS/UMD build pipeline — `tsup` and `rollup` pick up new sources automatically.

---

# Drawbacks

- **Bundle size increase**: Adding `jspdf` (~300 KB) and `qrious` (~15 KB) to the package. Consumers who import `createPresetupGateway` will include both. Consumers who do not import it are unaffected due to tree-shaking.
- **Browser-only**: The component depends on `document`, `fetch`, `crypto`, and `btoa` — it cannot run in Node.js. This is intentional but must be clearly documented to avoid misuse in SSR or server contexts.
- **Type defaulting for remote devices**: The Ingestion API response does not include `DeviceType`. Remote devices loaded from the API are defaulted to `3F_MEDIDOR`. This affects the type dropdown pre-selection if an operator edits a remote device.
- **Single ambient**: The Provisioning API payload groups all devices under one ambient named after the gateway. The full presetup-nextjs app uses asset-based ambients. This simplified model is correct for the single-gateway scope but diverges from the hierarchy-aware behavior.

---

# Rationale and alternatives

## Why a vanilla JS factory function?

`myio-js-library` has no React dependency and targets the broadest possible consumer set (plain HTML pages, ThingsBoard widgets, Vue/Angular apps, custom dashboards). A `createXxx(opts) → { method }` factory pattern is already established by other components in the library and requires zero runtime framework.

**Alternative: React component** — Rejected. It would force React as a peer dependency on all consumers and conflict with non-React environments (e.g., ThingsBoard, Vanilla JS apps).

**Alternative: Web Component (`<presetup-gateway>`)** — Considered. Would provide better encapsulation and framework agnosticism. Deferred to a future RFC because it requires additional build configuration, polyfill decisions, and attribute/property API design. The factory function can be wrapped into a Web Component later without breaking changes.

## Why bundle jsPDF and QRious as `dependencies`?

Shipping them as `peerDependencies` would require every consumer to install and manage the correct versions, adding friction. These libraries are purpose-specific (PDF generation + QR codes) and unlikely to conflict with other dependencies in consumer projects.

**Alternative: Lazy import / dynamic `import()`** — Would allow the PDF path to be code-split. This adds complexity to the module graph and requires consumers to configure their bundler. Deferred to a future optimization.

## Why inline CSS-in-JS (`style.cssText`) for styling?

The component must work in environments with no CSS bundler, no `<style>` injection, and strict CSP policies for external stylesheets. Inline styles are the safest, most portable approach.

**Alternative: Shadow DOM + CSS**: Would provide true style encapsulation. Adds complexity and breaks some host styling patterns. A viable future enhancement.

---

# Prior art

- **`presetup-nextjs`** (`data-ingestion-prod.git`): Source of truth for all business logic. This RFC is a faithful port of its sync pipeline, constrained to the single-gateway scope.
- **`energy-chart-sdk`** (`data-ingestion-prod.git`): Established the factory function pattern and rollup configuration used across the library.
- **RFC-0003** (`myio-js-library`): Defined the extraction process and API design principles followed here.

---

# Unresolved questions

1. **Remote device type**: The Ingestion API does not return `DeviceType`. Should we add a `type` field to the Ingestion API response, or store the type as device metadata/attribute in ThingsBoard and fetch it separately?

2. **Multi-ambient support**: Should the Provisioning payload support grouping devices by sub-asset (mirroring the full presetup-nextjs behavior) or is the single-ambient model sufficient for all known consumers?

3. **Inline editing**: Should remote devices be editable (type change, multiplier override) in the component, or remain read-only? Currently they are read-only to avoid unintended writes.

4. **CSP and `btoa`**: `btoa` is used for QR payload encoding. Environments with strict CSP may restrict `eval`-adjacent APIs in certain browsers. Should we switch to `TextEncoder` + `Uint8Array` + `btoa` (already done) or add an explicit escape hatch?

5. **Conflict resolution for duplicate slave IDs**: If an operator adds a device with a `slaveId` already present in the remote list, the lookup step will find it and issue a `PUT`. Should the UI warn the operator before sync?

6. **PDF in SSR / headless environments**: jsPDF has no Node.js DOM — calling `exportDeviceTagsPdf` in a Node context will throw. Should we guard with a runtime `typeof document` check?

---

# Future possibilities

- **Web Component wrapper**: `<presetup-gateway gateway-id="..." client-id="...">` using the factory function internally, enabling declarative usage in any HTML page.
- **Multiplier editor**: Inline editing of `amperage`, `voltage`, `power`, `temperature` multipliers per device before sync.
- **Import from CSV**: Allow operators to paste or upload a CSV of devices instead of adding them one by one.
- **Conflict detection UI**: Visual diff between local state and current Ingestion API state before committing sync.
- **Offline / optimistic mode**: Queue sync operations and retry when connectivity is restored.
- **Sub-path export**: `import { createPresetupGateway } from 'myio-js-library/presetup-gateway'` for consumers who want to exclude the PDF/QR heavy path from their main bundle.
- **`@myio/presetup-gateway` standalone package**: If the bundle size impact becomes a concern, the component can be extracted to its own versioned npm package with `jspdf` and `qrious` as peer dependencies.
