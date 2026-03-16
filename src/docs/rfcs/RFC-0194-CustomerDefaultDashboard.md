# RFC-0194 — Customer Default Dashboard Configuration

- **Status**: Proposed
- **Date**: 2026-03-16
- **Author**: MYIO Engineering

---

## Summary

Define a canonical JSON schema for storing a customer's default dashboard
configuration as a ThingsBoard `SERVER_SCOPE` attribute, together with a
full change-log.  Expose a management UI inside the **Settings** menu
(accessible only to `@myio.com.br` users) in the MENU widget that lets
authorised operators read and update this configuration.

---

## Motivation

`NewUserTab` (RFC-0190) needs to assign a `defaultDashboardId` when
creating a new user.  Fetching "the most-recently-created dashboard" is
fragile and non-deterministic.  A stable, auditable source of truth in
`SERVER_SCOPE` solves this problem cleanly and enables future features
(e.g. tenant onboarding automation, user self-service portal) to rely on
the same contract.

---

## Attribute Key

```
customerDefaultDashboard   (SERVER_SCOPE on CUSTOMER entity)
```

Stored via:
```
POST /api/plugins/telemetry/CUSTOMER/{customerId}/attributes/SERVER_SCOPE
{ "customerDefaultDashboard": <CustomerDefaultDashboard> }
```

---

## Schema

```ts
interface CustomerDefaultDashboard {
  /** Human-readable dashboard name */
  dashboardName: string;

  /** ThingsBoard dashboard UUID */
  dashboardId: string;

  /** ISO-8601 timestamp of the last update */
  updatedAt: string;

  /** Ordered list of changes — newest first */
  changelog: DashboardChangeEntry[];
}

interface DashboardChangeEntry {
  /** ISO-8601 timestamp */
  changedAt: string;

  /** ThingsBoard version tag or semver label, e.g. "0.1.413" */
  version: string;

  /** Dashboard that was active BEFORE this change */
  previous: DashboardRef | null;

  /** Dashboard that became active AFTER this change */
  next: DashboardRef;

  /** User who performed the change */
  changedBy: DashboardChangeActor;
}

interface DashboardRef {
  dashboardId:   string;
  dashboardName: string;
}

interface DashboardChangeActor {
  userId: string;
  name:   string;
  email:  string;
}
```

---

## Example — stored JSON

```json
{
  "dashboardName": "Dashboard - Mestre Álvaro - v.5.2.0",
  "dashboardId": "6c188a90-b0cc-11f0-9722-210aa9448abc",
  "updatedAt": "2026-03-15T10:30:00.000Z",
  "changelog": [
    {
      "changedAt": "2026-03-15T10:30:00.000Z",
      "version": "0.1.413",
      "previous": {
        "dashboardId": "a3f5c210-b0cc-11f0-9722-210aa9448abc",
        "dashboardName": "Dashboard - Mestre Álvaro - v.5.1.2"
      },
      "next": {
        "dashboardId": "6c188a90-b0cc-11f0-9722-210aa9448abc",
        "dashboardName": "Dashboard - Mestre Álvaro - v.5.2.0"
      },
      "changedBy": {
        "userId": "d1a2b3c4-1111-2222-3333-444455556666",
        "name": "Rodrigo Lago",
        "email": "rodrigo@myio.com.br"
      }
    },
    {
      "changedAt": "2026-02-10T14:20:00.000Z",
      "version": "0.1.398",
      "previous": {
        "dashboardId": "88d1e430-9fa1-11f0-8811-bb0cc1234567",
        "dashboardName": "Dashboard - Mestre Álvaro - v.5.1.0"
      },
      "next": {
        "dashboardId": "a3f5c210-b0cc-11f0-9722-210aa9448abc",
        "dashboardName": "Dashboard - Mestre Álvaro - v.5.1.2"
      },
      "changedBy": {
        "userId": "f9081234-5678-90ab-cdef-123456789012",
        "name": "Victor Hugo Da Silva",
        "email": "victorhjoe@gmail.com"
      }
    },
    {
      "changedAt": "2025-12-05T09:15:00.000Z",
      "version": "0.1.385",
      "previous": {
        "dashboardId": "71bc5900-8e22-11ef-a100-aabbcc001122",
        "dashboardName": "Dashboard - Mestre Álvaro - v.5.0.1"
      },
      "next": {
        "dashboardId": "88d1e430-9fa1-11f0-8811-bb0cc1234567",
        "dashboardName": "Dashboard - Mestre Álvaro - v.5.1.0"
      },
      "changedBy": {
        "userId": "e5f6a7b8-aaaa-bbbb-cccc-ddddeeeeffff",
        "name": "Leandro Gadioli",
        "email": "gadioli@myio.com.br"
      }
    },
    {
      "changedAt": "2025-10-20T16:45:00.000Z",
      "version": "0.1.371",
      "previous": {
        "dashboardId": "55ab4780-7c11-11ef-b200-1122334455aa",
        "dashboardName": "Dashboard - Mestre Álvaro - v.5.0.0"
      },
      "next": {
        "dashboardId": "71bc5900-8e22-11ef-a100-aabbcc001122",
        "dashboardName": "Dashboard - Mestre Álvaro - v.5.0.1"
      },
      "changedBy": {
        "userId": "d1a2b3c4-1111-2222-3333-444455556666",
        "name": "Rodrigo Lago",
        "email": "rodrigo@myio.com.br"
      }
    },
    {
      "changedAt": "2025-08-14T11:00:00.000Z",
      "version": "0.1.355",
      "previous": {
        "dashboardId": "3390f560-6b00-11ef-c300-99887766aabb",
        "dashboardName": "Dashboard - Mestre Álvaro - v.4.9.0"
      },
      "next": {
        "dashboardId": "55ab4780-7c11-11ef-b200-1122334455aa",
        "dashboardName": "Dashboard - Mestre Álvaro - v.5.0.0"
      },
      "changedBy": {
        "userId": "f9081234-5678-90ab-cdef-123456789012",
        "name": "Victor Hugo Da Silva",
        "email": "victorhjoe@gmail.com"
      }
    },
    {
      "changedAt": "2025-06-03T08:30:00.000Z",
      "version": "0.1.340",
      "previous": null,
      "next": {
        "dashboardId": "3390f560-6b00-11ef-c300-99887766aabb",
        "dashboardName": "Dashboard - Mestre Álvaro - v.4.9.0"
      },
      "changedBy": {
        "userId": "e5f6a7b8-aaaa-bbbb-cccc-ddddeeeeffff",
        "name": "Leandro Gadioli",
        "email": "gadioli@myio.com.br"
      }
    }
  ]
}
```

---

## Reading the Attribute

`MAIN_VIEW/controller.js` already fetches all `SERVER_SCOPE` attributes via
`MyIO.fetchThingsboardCustomerAttrsFromStorage`.  After this RFC is
implemented, the value will be available as:

```js
const cfg = attrs?.customerDefaultDashboard; // CustomerDefaultDashboard | undefined
const defaultDashboardId = cfg?.dashboardId ?? null;
```

`NewUserTab` MUST await this value (via `window.MyIOOrchestrator`) rather
than independently querying the dashboards list.

---

## Management UI — "Default Dashboard" section inside Settings

### Access gate

Visible **only** when:

```ts
email.endsWith('@myio.com.br')
  && !email.startsWith('alarme@')
  && !email.startsWith('alarmes@')
```

(same predicate as `isSuperAdminMyio` — `src/utils/superAdminUtils.ts`,
RFC-0104).

### Location

New item inside the **Configurações** overlay (MENU widget,
`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js`),
rendered as a dedicated settings section or modal tab, following the same
visual language as the existing settings options.

### UI behaviour

1. **Read state**: loads `customerDefaultDashboard` from `SERVER_SCOPE` on
   open; displays current `dashboardName` + `dashboardId` + last `changedAt`
   + actor.
2. **Edit**: opens a search/select input that fetches
   `GET /api/customer/{customerId}/dashboards` (paginated, with text
   search).  User picks a dashboard from the list.
3. **Save**: `POST SERVER_SCOPE` with the updated `CustomerDefaultDashboard`
   object.  A new `DashboardChangeEntry` is prepended to `changelog` with
   the current actor (from `window.MyIOUtils.currentUserEmail` / TB JWT),
   current timestamp, and library version.
4. **Changelog view**: collapsible section below the current value showing
   the full `changelog` array in reverse-chronological order.

### MENU controller integration points

| Symbol | File | Purpose |
|---|---|---|
| `addSettingsMenuButton(user)` | `MENU/controller.js` | Gate: only wires the new item if `isSuperAdminMyio(user.email)` |
| `MyIO.fetchThingsboardCustomerAttrsFromStorage` | `MAIN_VIEW/controller.js` | Read `customerDefaultDashboard` |
| `POST /api/plugins/telemetry/CUSTOMER/{id}/attributes/SERVER_SCOPE` | ThingsBoard REST | Write updated value |
| `GET /api/customer/{customerId}/dashboards` | ThingsBoard REST | Dashboard search/select |

---

## Files to Change

| File | Change |
|---|---|
| `MENU/controller.js` | Add "Dashboard Padrão" section inside settings overlay; gate by `isSuperAdminMyio` |
| `MENU/styles.css` | Styles for the new section |
| `MENU/template.html` | No changes expected (dynamic section) |
| `MAIN_VIEW/controller.js` | Expose `window.MyIOOrchestrator.defaultDashboardId` from the loaded attr |
| `src/components/premium-modals/user-management/tabs/NewUserTab.ts` | Replace dashboard pre-fetch with `window.MyIOOrchestrator.defaultDashboardId` |

---

## Non-Goals

- This RFC does not define per-user dashboard overrides (each user may
  still have their own `additionalInfo.defaultDashboardId` set explicitly).
- This RFC does not implement access-level differentiation beyond the
  `@myio.com.br` gate.

---

## Open Questions

1. Should the changelog be capped (e.g. last 50 entries) to prevent the
   `SERVER_SCOPE` attribute from growing unboundedly?
2. Should the library version be read from `window.MyIOLibrary.version` or
   from a build-time constant?
