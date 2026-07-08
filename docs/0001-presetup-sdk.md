# RFC 0001 — `@myio/presetup-sdk`: Embeddable Single-Gateway Pre-Setup Component

- **Start date**: 2026-03-02
- **Status**: Proposed — awaiting approval
- **Related package**: `packages/presetup-nextjs`
- **Proposed location**: `packages/presetup-sdk`

---

## Summary

Introduce a new Rollup-built SDK package — `@myio/presetup-sdk` — that exposes a self-contained
React component (`<PresetupGateway />`) capable of performing the **full** pre-setup workflow for a
**single, already-existing gateway** in the MyIO system.

The component receives a `gatewayId`, authenticates with both the Ingestion API and the
Provisioning API via OAuth2 client credentials, loads the gateway's context automatically, allows
the operator to manage devices for that gateway, syncs them to the Ingestion API, re-provisions the
physical central hardware via the Provisioning API, and generates a QR-code PDF label sheet — all
from a single component instance.

---

## Motivation

`packages/presetup-nextjs` is a full-featured standalone Next.js application that manages the
**complete device hierarchy** from scratch: importing customer structures from ThingsBoard, creating
customers/assets/gateways/devices in both ThingsBoard and the Ingestion API, and provisioning the
physical gateway hardware via the Provisioning API.

That application is not embeddable. It requires a full Next.js runtime, a running ThingsBoard
session, and knowledge of the entire hierarchy before any device can be provisioned.

There is a growing need to perform **unit pre-setup** — adding or updating devices of a **single
known gateway** that has already been provisioned and exists in the system — from within other
MyIO applications (e.g., a field technician portal, a dashboard widget, or a mobile-friendly
web app). In this context, the operator already knows which gateway they are working on; they do
not need to manage the full hierarchy, nor do they need ThingsBoard access.

This RFC proposes an SDK package that:

1. Is **embeddable** — built as ESM + CJS + UMD via Rollup, the same pattern as
   `@myio/energy-chart-sdk`.
2. Is **scoped to one gateway** — the entire component surface is driven by a single `gatewayId`
   (the UUID that exists in the Ingestion API and the Provisioning API).
3. Is **faithful to the existing logic** — the device sync, central provisioning, QR URL
   construction, PDF generation, and device type mapping are ported directly from `presetup-nextjs`
   with no behavioral changes.
4. Does **not** require ThingsBoard — the SDK targets the MyIO Ingestion API and the Provisioning
   API only.

---

## Detailed Design

### 1. Package structure

```
packages/presetup-sdk/
├── src/
│   ├── index.ts                      # Public exports
│   ├── components/
│   │   └── PresetupGateway.tsx       # Main embeddable React component
│   ├── services/
│   │   ├── auth.ts                   # OAuth2 client-credentials token manager
│   │   ├── ingestion-api.ts          # Ingestion API client (gateway, device CRUD + lookup)
│   │   ├── provisioning-api.ts       # Provisioning API client (provision + job polling)
│   │   └── pdf-export.ts             # QR code + jsPDF label sheet generator
│   ├── lib/
│   │   └── utils.ts                  # Device name generation, addr helpers, encodePayload
│   └── types/
│       └── index.ts                  # All shared TypeScript types
├── rollup.config.js
├── tsconfig.json
└── package.json
```

---

### 2. Public API — exported from `src/index.ts`

```ts
export { PresetupGateway } from './components/PresetupGateway';
export type { PresetupGatewayProps, PresetupDevice, PresetupGatewayInfo, SyncResult } from './types';
```

Only the component and its associated types are part of the public API. Internal services are
implementation details and are not exported.

---

### 3. Component props — `PresetupGatewayProps`

```ts
interface PresetupGatewayProps {
  /** UUID of the existing gateway in the Ingestion API and Provisioning API. */
  gatewayId: string;

  /** OAuth2 client credentials for the Ingestion API. */
  clientId: string;
  clientSecret: string;

  /**
   * Base URL of the MyIO Ingestion Management API.
   * Defaults to https://api.staging.data.apps.myio-bas.com/api/v1/management
   */
  ingestionApiUrl?: string;

  /**
   * Base URL of the MyIO Ingestion Auth API.
   * Defaults to https://api.staging.data.apps.myio-bas.com/api/v1/auth
   */
  ingestionAuthUrl?: string;

  /**
   * Base URL of the MyIO Provisioning API.
   * Defaults to https://provisioning.apps.myio-bas.com
   */
  provisioningApiUrl?: string;

  /** Optional callback fired after a successful full sync (Ingestion + Provisioning). */
  onSyncComplete?: (result: SyncResult) => void;

  /** Optional callback fired on any error. */
  onError?: (error: Error) => void;
}
```

The component is fully self-contained. The consumer application passes credentials and a
`gatewayId`; the component handles the rest.

---

### 4. Gateway context resolution

On mount, `<PresetupGateway />` authenticates with the Ingestion API and fetches the gateway
record via `GET /gateways/:gatewayId`. The response provides all fields required to run both
sync pipelines:

| Field              | Used for                                                         |
|--------------------|------------------------------------------------------------------|
| `customerId`       | Required when creating devices (`POST /devices`)                 |
| `assetId`          | Required when creating devices (`POST /devices`)                 |
| `frequency`        | Displayed in the UI; used in provisioning payload                |
| `centralId`        | QR URL payload (dotted address); provisioning `central_id` array |
| `name`             | Displayed in the UI header; provisioning `name` field            |
| `ipv6`             | Provisioning `ipv6` field (Yggdrasil address for SSH)            |
| `credentials.mqtt` | Provisioning `credentials.mqtt` (clientId, username, password)   |

If the gateway is not found (HTTP 404), or `customerId` / `assetId` are absent, the component
renders an error state and invokes `onError`. If `ipv6` or `credentials.mqtt` are absent, the
Provisioning step will be skipped with a warning (see section 7.2).

This mirrors the strategy in `ingestion-sync.ts:createAssetRecursive()` lines 279–301, where the
inherited gateway's `ingestion_gateway_id` is resolved before any device is created.

---

### 5. Device list — loading existing devices

After resolving the gateway context, the component calls `GET /devices?gatewayId=<uuid>` to load
the devices already registered under this gateway in the Ingestion API. These are displayed in a
table with their slave ID, device type, identifier, and address range.

This full list is also stored in component state and is **required by the Provisioning API** (see
section 7.2), which always receives the complete device list — not just the newly added device.

---

### 6. Device form — adding new devices

The operator opens a form to add a new device. The fields map directly to the `createDevice()`
payload from `ingestion-sync.ts:474` and to the `formatDeviceForProvisioning()` fields from
`central-sync.ts:449`:

| Form field    | Ingestion payload field | Provisioning payload field | Notes                                     |
|---------------|------------------------|----------------------------|-------------------------------------------|
| Name          | `name` / `description` | `name` / `originalName`    | `name` = generated with prefix            |
| Device type   | `deviceType`           | `type` (mapped separately) | Two different type-mapping functions apply|
| Slave ID      | `slaveId`              | `slave_id`                 | Integer; required                         |
| Addr Low      | via `getEffectiveAddrLow()`  | `addr_low`           | Optional, defaults to slaveId             |
| Addr High     | via `getEffectiveAddrHigh()` | `addr_high`          | Optional                                  |
| Identifier    | `identifier`           | `identifier`               | Used in QR URL and PDF label              |
| Multipliers   | `multipliers`          | `multipliers`              | Optional                                  |

Device types available in the form match those used in `presetup-nextjs`:
`3F_MEDIDOR`, `HIDROMETRO`, `COMPRESSOR`, `VENTILADOR`, `TERMOSTATO`, `MOTOR`, `ESCADA_ROLANTE`,
`ELEVADOR`, `SOLENOIDE`, `CONTROLE_REMOTO`, `CAIXA_D_AGUA`, `CONTROLE_AUTOMACAO`.

---

### 7. Complete sync flow

When the operator clicks **Sync**, two sequential phases execute:

```
Phase 1 — Ingestion API
Phase 2 — Provisioning API (Central)
```

Both phases are logged in real time in the component UI. A failure in Phase 1 prevents Phase 2
from running.

---

#### 7.1 Phase 1 — Ingestion API sync

Direct port of `IngestionSyncService.createDevice()` from `ingestion-sync.ts`, scoped to a single
gateway. The three-step idempotent check is preserved:

```
For each device in the local list:

1. Has stored ingestion_device_id?
   ├── Yes → GET /devices/:id
   │         ├── 404 → clear ID, continue to step 3
   │         └── Found → PUT /devices/:id if name/multipliers changed, DONE
   │
2. No ID → POST /devices/lookup  { pairs: [{ gatewayId, slaveId }] }
   ├── Found → store ID, PUT if name changed, DONE
   └── Not found → continue to step 3
   │
3. POST /devices
   {
     id: crypto.randomUUID(),
     name: <generateDeviceNameWithPrefix(device)>,
     description: device.name,
     deviceType: SyncUtils.mapToIngestionDeviceType(device.type),
     customerId,   ← from gateway context (section 4)
     assetId,      ← from gateway context (section 4)
     gatewayId,
     slaveId: getEffectiveSlaveId(device),
     multipliers?
   }
```

`deviceType` mapping (`SyncUtils.mapToIngestionDeviceType()`):
- `HIDROMETRO`, `CAIXA_D_AGUA`, `SOLENOIDE` → `"water"`
- Everything else → `"energy"`

---

#### 7.2 Phase 2 — Provisioning API (Central)

Direct port of `CentralSyncService.provisionCentralAPI()` from `central-sync.ts`.

**Preconditions checked before the request:**
- `gateway.ipv6` must be present (Yggdrasil address for SSH)
- `gateway.uuid` must be a valid UUID (cleaned of invisible Unicode characters)
- `gateway.credentials.mqtt` must have `clientId`, `username`, and `password`

If any precondition fails, Phase 2 is skipped and the component displays a warning. Phase 1
results are still preserved.

**Device list built for the payload:**

The provisioning payload requires **all devices** currently registered to this gateway, including
the newly synced one. The SDK builds this list from the component's in-memory device state (which
was refreshed after Phase 1 completes). Each device is formatted with
`formatDeviceForProvisioning()` from `central-sync.ts:424`:

```ts
{
  name: generateDeviceNameWithPrefix(device),   // same as Ingestion name
  originalName: device.name,
  type: mapDeviceTypeForProvisioning(device.type), // different mapping (see below)
  identifier: device.identifier,
  addr_low: Number(getEffectiveAddrLow(device)),
  addr_high: Number(getEffectiveAddrHigh(device)),
  slave_id: Number(getEffectiveSlaveId(device)),
  uuid: device.uuid,
  multipliers?: { amperage, voltage, power, temperature },
  channels?: [...]  // HIDROMETRO only
}
```

Provisioning device type mapping (from `central-sync.ts:436`):

| Original type                                          | Provisioning type      |
|--------------------------------------------------------|------------------------|
| `3F_MEDIDOR`, `ELEVADOR`, `ESCADA_ROLANTE`, `MOTOR`   | `three_phase_sensor`   |
| `REPETIDOR_RM`, `REMOTE`                               | `infrared`             |
| Everything else                                        | `outlet`               |

`HIDROMETRO` devices receive an extra `channels` field (pulse + flow sensors).

**Ambients built for the payload:**

Since the SDK operates without an asset hierarchy, a single ambient is built from the gateway's
`name` field, containing the slave IDs of all its devices:

```ts
ambients = [{
  id: 1,
  name: gateway.name,
  devices: allDevices.map(d => getEffectiveSlaveId(d))
}]
```

This is a simplification relative to `central-sync.ts:buildAmbientsForGateway()`, which
recursively maps assets to ambients. The single-ambient approach is appropriate for the unitário
scope.

**Provisioning request:**

```
POST {provisioningApiUrl}/centrals/{gateway.uuid}/provision
Content-Type: application/json

{
  central_id: gateway.centralId,         // e.g. [27, 95, 1, 1]
  frequency: getEffectiveFrequency(gateway),
  name: gateway.name,
  ipv6: gateway.ipv6,
  credentials: {
    mqtt: {
      server:   gateway.credentials.mqtt.server,
      clientId: gateway.credentials.mqtt.clientId,
      username: gateway.credentials.mqtt.username,
      password: gateway.credentials.mqtt.password
    }
  },
  devices: [...],
  ambients: [...]
}
```

**Job polling:**

The provisioning API responds with `{ jobId: "..." }`. The SDK polls
`GET /jobs/:jobId` (status) and `GET /jobs/:jobId/logs` (incremental logs) at 1-second intervals,
streaming each new log entry to the component UI in real time. This is a direct port of
`CentralSyncService.pollJobLogs()` from `central-sync.ts:182`.

Polling terminates when `job.status` becomes `COMPLETED` or `FAILED`, or after 600 iterations
(10 minutes timeout).

Step icons used in log output (from `central-sync.ts:261`):

| Step                  | Icon |
|-----------------------|------|
| `CREATION`            | 🔄   |
| `GETTING_IPV6`        | 🌐   |
| `CONNECTING_SSH`      | 🔐   |
| `CHECKING_DATABASE`   | 🗃️   |
| `UPDATING_ENVIRONMENT`| ⚙️   |
| `ADDING_DEVICES`      | 📟   |
| `ADDING_AMBIENTS`     | 🏢   |
| `INSTALLING_PACKAGES` | 📦   |
| `WRITING_NODE_RED`    | 🔗   |
| `RESTARTING_SERVICES` | 🔄   |
| `COMPLETED`           | ✅   |

---

### 8. QR code and PDF generation

The QR code generation logic is a direct port of `PDFExportService` from
`packages/presetup-nextjs/src/services/pdf-export.ts`.

#### QR URL format (unchanged)

```
https://produto.myio.com.br/{safeName}/{encodedPayload}

where encodedPayload = encodePayload(`${addrLow}/${addrHigh}/${freq}/${centralId}/${identifier}`)
and   centralId      = `${arr[0]}.${pad(arr[1])}.${pad(arr[2])}.${pad(arr[3])}`
                       derived from gateway.centralId (resolved in section 4)
```

#### QR image generation

Uses **QRious** (`qrious@^4.0.2`) with `size: 520`, `level: 'M'`, returning a PNG data URL
embedded directly in jsPDF — same as `PDFExportService.makeQrDataUrl()`.

#### PDF layout

The `exportTagsPdf()` method supports the same two modes:

| Mode       | Description                                        |
|------------|----------------------------------------------------|
| `grid`     | Multiple labels per A4 page (default: 4×7 or 2×4) |
| `per_page` | One label per A4 page                              |

Each label contains:
- **Bold title** — device name with generated prefix (e.g., `HIDR. L1101`)
- **QR code** — centered, sized to fill the label
- **Identifier** — shown below QR code
- **Address range** — `addrLow–addrHigh` at the bottom

---

### 9. Authentication — `auth.ts`

The SDK authenticates using OAuth2 **client credentials** flow against the Ingestion Auth API:

```
POST /auth/token
Content-Type: application/json

{ "clientId": "...", "clientSecret": "..." }

→ { "access_token": "...", "expires_in": 3600 }
```

The `auth.ts` service caches the token in memory and refreshes it automatically before expiry.
This is equivalent to `myIOAuth.getToken()` in `presetup-nextjs/src/services/auth.ts`, adapted
to accept credentials as constructor arguments rather than reading from the store.

The Provisioning API does **not** use a token — its `POST /centrals/:uuid/provision` endpoint is
called without an `Authorization` header, consistent with `central-sync.ts:75`.

---

### 10. Build system

Identical to `@myio/energy-chart-sdk`:

```js
// rollup.config.js
export default {
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.js',            format: 'cjs', sourcemap: true },
    { file: 'dist/index.es.js',         format: 'es',  sourcemap: true },
    { file: 'dist/presetup-sdk.umd.js', format: 'umd', name: 'PresetupSDK', sourcemap: true },
  ],
  plugins: [resolve({ browser: true }), commonjs(), typescript({ declaration: true })],
  external: ['react', 'react-dom'],  // peer deps — not bundled
};
```

`react` and `react-dom` are `peerDependencies`.
`jspdf` and `qrious` are **bundled** (not external).

---

### 11. State management

The component uses plain React `useState` / `useReducer` — **no Zustand**. The existing Zustand
store in `presetup-nextjs` manages a full multi-customer structure persisted to `localStorage`,
which is inappropriate for an embeddable component. The SDK's state is ephemeral and local to
the component instance.

---

### 12. Styling

Tailwind CSS utility classes are used internally but **purged at build time**. The final bundle
includes a small, scoped CSS file. The component does not inject global styles and does not
require Tailwind in the consumer application.

---

## Drawbacks

1. **Code duplication** — Device sync logic, provisioning, QR URL construction, and PDF
   generation are ported from `presetup-nextjs` rather than shared via a common internal package.
   Changes to the underlying logic must be applied in both places. This is an accepted trade-off
   to keep the SDK free from the Next.js application.

2. **No ThingsBoard integration** — The SDK deliberately excludes ThingsBoard. Consumers that
   need devices to also exist in ThingsBoard must handle that separately.

3. **Single gateway scope** — A consumer managing multiple gateways must mount multiple
   `<PresetupGateway />` instances. There is no multi-gateway batch mode in this RFC.

4. **Ambient simplification** — The SDK sends a single ambient containing all gateway devices,
   rather than the asset-based ambient structure used in `presetup-nextjs`. This may produce
   different Node-RED configuration on the gateway compared to a full presetup run.

---

## Rationale and Alternatives

### Why not extend `presetup-nextjs` with a shareable mode?

`presetup-nextjs` is a Next.js App Router application. Extracting embeddable components from it
would require significant refactoring of server/client boundaries, the Zustand store, and the
Next.js API routes used as proxies to ThingsBoard. A standalone SDK package with no Next.js
dependency is simpler and more portable.

### Why Rollup and not Vite lib mode?

`@myio/energy-chart-sdk` already uses Rollup with an established configuration for ESM + CJS +
UMD output. Reusing the same toolchain keeps the monorepo consistent.

### Why not a headless library (logic only, no UI)?

The core value of the SDK is the **operator workflow** — an integrated UI that guides the user
from loading the gateway, to adding devices, to syncing both APIs and watching live provisioning
logs, to printing labels. Splitting logic from UI would push significant complexity to every
consumer. A self-contained component with a default UI is the simpler starting point.

### Why include the Provisioning API in the SDK?

Without the Provisioning step (`POST /centrals/:uuid/provision`), a device added to the
Ingestion API would not be registered in the physical gateway's internal database. The gateway
would continue polling its pre-existing device list and would not know about the new slave.
Adding a device to the Ingestion API alone is therefore insufficient for a complete pre-setup.
The full three-system sync (Ingestion + Provisioning + QR label) matches exactly what
`presetup-nextjs` does today in its Steps 2 and 3.

---

## Prior Art

- `@myio/energy-chart-sdk` — establishes the Rollup + React + Tailwind build pattern used here.
- `packages/presetup-nextjs` — provides all business logic ported and scoped by this SDK:
  - `src/services/sync/ingestion-sync.ts` → Section 7.1
  - `src/services/sync/central-sync.ts`   → Section 7.2
  - `src/services/pdf-export.ts`           → Section 8

---

## Unresolved Questions

1. **Gateway fields from Ingestion API** — Sections 4 and 7.2 depend on `GET /gateways/:id`
   returning `customerId`, `assetId`, `centralId` (as `number[]`), `ipv6`, and
   `credentials.mqtt`. Confirmation is needed that all these fields are present in the response.
   If any are absent, additional props or fallback strategies must be defined before
   implementation.

2. **Device UUID on creation** — In `ingestion-sync.ts`, the `id` sent on `POST /devices` is a
   `centralUuid` stored in the JSON structure. In the SDK, device UUIDs are generated at
   creation time via `crypto.randomUUID()`. This must be confirmed as acceptable by the Ingestion
   API team (no server-side UUID assignment).

3. **Ambient structure for provisioning** — Section 7.2 proposes a single ambient containing all
   gateway devices. In `presetup-nextjs`, ambients map to assets and can be nested. If the
   Provisioning API or the gateway firmware requires a specific ambient structure, the SDK may
   need an `ambients` prop or a callback to let the consumer define the ambient layout.

4. **`generateDeviceNameWithPrefix()` without asset hierarchy** — This function generates names
   like `HIDR. L1101` using the asset hierarchy path. In the SDK there is no asset hierarchy.
   The naming convention must be decided:
   - Pass the gateway name as the single-element hierarchy path
   - Use a simplified prefix with no hierarchy codes
   - Expose a `deviceNameFormatter` prop

5. **Provisioning API authentication** — `central-sync.ts` calls the Provisioning API without
   any `Authorization` header. If the Provisioning API gains authentication in a future release,
   the SDK props must be updated accordingly.

6. **Language / i18n** — The existing `presetup-nextjs` UI is in Portuguese. The SDK component
   language (labels, error messages, log output) needs a decision: Portuguese-only, or an
   optional `locale` prop.

---

## Future Possibilities

- **`thingsboardToken` prop** — Optional prop to also write `ingestionId` attributes back to
  ThingsBoard, enabling full parity with the `presetup-nextjs` Step 2 + attribute sync flow.
- **Multi-gateway mode** — A `<PresetupCustomer customerId="..." />` component that renders
  multiple `<PresetupGateway />` instances.
- **Headless export** — Exposing the sync services and PDF export as standalone async functions
  for consumers that provide their own UI.
- **Shared `@myio/presetup-core`** — Extracting the common logic (device sync, provisioning,
  QR URL, PDF) into a separate internal package consumed by both `presetup-nextjs` and
  `presetup-sdk`, eliminating the code duplication noted in Drawbacks.
- **Asset-based ambients prop** — Allowing consumers to pass an `ambients` structure for
  provisioning, unlocking full parity with the multi-asset ambient layout of `presetup-nextjs`.
