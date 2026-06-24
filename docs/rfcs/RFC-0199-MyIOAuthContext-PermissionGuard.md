# RFC-0199 — MyIOAuthContext: Client-Side GCDR Permission Guard

- **Status**: Draft — Design In Progress
- **Date**: 2026-04-08
- **Author**: MYIO Engineering
- **Depends on**: RFC-0197 (Roles & Policies), RFC-0198 (gcdrUserConfigs sync)

---

## Summary

Introduce a client-side authorization context (`MyIOAuthContext`) + `AuthGuard`
helper that resolve the currently authenticated user's GCDR role assignments and
derived policy permissions, then enforce a **specificity-first, deny-absolute**
permission model across every widget of `main-dashboard-shopping/v-5.2.0/WIDGET`.

| Widget | Guard surface |
|---|---|
| `TELEMETRY` | Device cards locked per access level |
| `TELEMETRY_INFO` | KPI info cards locked per domain |
| `ALARM` | Action buttons (ack/escalate/snooze/close) locked |
| `MENU` | Admin buttons locked; reports locked |
| `HEADER` | KPI panels locked per domain |
| `FOOTER` | Comparison / export actions locked |
| `MAIN_VIEW` | Auth context init; `myio:auth-ready` dispatch |

**Locked = always visible, grayed out with lock icon, non-interactive.**
Elements are never hidden — layout is always preserved.

---

## Motivation

The existing model is binary (`isUserAdmin` flag or `TENANT_ADMIN` authority).
As customers onboard multi-role teams, they need fine-grained control:

- A maintenance tech sees only elevator cards, can write annotations, but cannot
  change alarm rules.
- An auditor sees everything read-only.
- A holding user has access to three different customer accounts with different
  roles in each.
- A contractor has write access to specific devices (by TB UUID) for 30 days.

GCDR already models Policies → Roles → Assignments (RFC-0197). This RFC
makes those decisions take effect in the dashboard UI.

---

## Design Decisions (resolved 2026-04-08)

| # | Question | Decision |
|---|---|---|
| 1 | Card without read perm: hide or lock? | **Always lock** — never hide. Layout preserved. |
| 2 | Wildcard parent-covers-child? | **Specificity-first** — see below |
| 3 | GCDR strings vs. intermediate mapping? | **No mapping** — `permissions.ts` is canonical source of truth; GCDR is configured to match. |
| 4 | Settings modal: per-tab or per-field? | **Both** — tab-level access + individual field `disabled`. |
| 5 | No permission = block dashboard entirely? | **No** — each widget locks independently. Dashboard always accessible. |
| 6 | Timing race before `myio:auth-ready`? | **Optimistic default** — surfaces start interactive; lock applied on `myio:auth-ready`. |

---

## Permission Model: Specificity-First, Deny-Absolute

### Access levels (ascending)

| Level | Card renders | Telemetry data | Settings | Dashboard | Report | Compare |
|---|---|---|---|---|---|---|
| *(no match)* | 🔒 locked overlay | — | 🔒 | 🔒 | 🔒 | 🔒 |
| `list` | visible | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| `read` | visible | ✅ | read-only modal | ✅ | ✅ | ✅ |
| `write` | visible | ✅ | fully editable | ✅ | ✅ | ✅ |

`list` means: the card and its telemetry data are visible, but
`handleActionSettings`, `handleActionDashboard`, `handleActionReport` and the
compare select are all locked.

### Specificity resolution

When a user has multiple permissions that could match a given resource, the
**most specific permission wins** — even if it grants a lower access level.

Specificity = number of path segments (more segments = more specific):

```
energy.commonarea.escalator.list   ← 4 segments — most specific
energy.commonarea.list             ← 3 segments
energy.commonarea.read             ← 3 segments (same level, different action)
energy.list                        ← 2 segments
energy.read                        ← 2 segments
*.read                             ← wildcard — least specific
```

**Example — technician with a specialization:**

```
User assignments resolve to allow set:
  energy.commonarea.read            ← covers all commonarea
  energy.commonarea.escalator.list  ← specifically for escalators (more specific)

For an elevator card   → best match: energy.commonarea.read  (3 seg)  → level: read
For an escalator card  → best match: energy.commonarea.escalator.list (4 seg) → level: list
                                     (all actions locked despite having commonarea.read)
```

### Scope specificity (Assignment-level)

A user may hold **multiple assignments**. Each has a `scope` that also has specificity:

| Scope type | Example | Specificity |
|---|---|---|
| Device list | `devices:tb-uuid1,tb-uuid2` | Highest |
| Customer | `customer:<uuid>` | Medium |
| Global | `*` | Lowest |

When a device matches multiple scopes, the **tightest scope's role wins**:

```
Assignment A: scope=customer:abc   role=energy-operator  → energy.commonarea.read
Assignment B: scope=devices:elv-01 role=elevator-tech    → energy.commonarea.elevator.write

For device elv-01 → Assignment B wins (device scope > customer scope)
For device esc-01 → Assignment A applies (no device-scope override)
```

### Deny is absolute

A `deny` entry in any policy matching the resource immediately returns `false`,
regardless of what any `allow` entry says or how many assignments the user has.

### Full resolution algorithm

```
canAccess(device, action):

  1. Collect all assignments that match device scope:
       - assignments with scope="devices:..." containing this device's TB ID
       - assignments with scope="customer:<customerId>"
       - assignments with scope="*"

  2. For each matching assignment, evaluate its role's effective permission
     for this device's category using specificity-first:
       - generate candidates: exact → parent → parent-parent → * → *.action
       - pick the most specific match in allow set
       - record (scopeSpecificity, permSpecificity, level)

  3. From all matching (scope + perm) pairs, pick the highest combined specificity.

  4. If ANY deny entry matches this device/action across any assignment → false.

  5. Return the resolved access level (list / read / write / none).
```

---

## Permission Taxonomy

### Card + device actions (`TELEMETRY`, `TELEMETRY_INFO`)

| Permission | Level | Device category |
|---|---|---|
| `energy.entry.list` / `.read` / `.write` | list/read/write | Entrada |
| `energy.store.list` / `.read` / `.write` | | Lojas |
| `energy.commonarea.list` / `.read` / `.write` | | Toda área comum (umbrella) |
| `energy.commonarea.elevator.list` / `.read` / `.write` | | Elevadores |
| `energy.commonarea.escalator.list` / `.read` / `.write` | | Escadas Rolantes |
| `energy.commonarea.hvac.list` / `.read` / `.write` | | Climatização |
| `energy.commonarea.other.list` / `.read` / `.write` | | Outros |
| `water.entry.list` / `.read` / `.write` | | Hidrômetro entrada |
| `water.bathroom.list` / `.read` / `.write` | | Banheiros |
| `water.commonarea.list` / `.read` / `.write` | | Hidrômetro área comum |
| `temperature.list` / `.read` / `.write` | | Termostatos |

### Settings modal — tab + field level

| Tab | read perm | write perm | Field-level example |
|---|---|---|---|
| Geral | `device.settings.read` | `device.settings.write` | `device.settings.power.write` |
| Anotações | `device.annotations.read` | `device.annotations.write` | `device.annotations.text.write` |
| Alarmes | `device.alarms.read` | `device.alarms.write` | `device.alarms.threshold.write` |
| Chamados | `device.tickets.read` | *(always read-only)* | — |
| Exclusão de Grupos | `device.exclusiongroups.read` | `device.exclusiongroups.write` | — |

### Alarm actions (`ALARM`)

| Permission | Action gated |
|---|---|
| `alarm.list` | Can see alarm list, all actions locked |
| `alarm.ack` | Acknowledge |
| `alarm.escalate` | Escalate |
| `alarm.snooze` | Snooze |
| `alarm.close` | Close |

### MENU / admin

| Permission | Surface |
|---|---|
| `settings.view` | Settings ⚙ button |
| `user.view` / `user.manage` | User Management |
| `integration.edit` | Integration Setup |
| `dashboard.configure` | Default Dashboard |
| `report.view` / `report.export` | Relatórios |

---

## Comprehensive Examples

### Policies (atomic)

```jsonc
// Full energy read — can see all energy cards and open settings (read-only)
{
  "key": "policy-energy-full-read",
  "displayName": "Energy — Full Read",
  "allow": ["energy.*.read", "device.settings.read", "device.annotations.read",
            "device.alarms.read", "device.tickets.read", "report.view"],
  "deny": []
}

// Full energy write — can configure everything in energy
{
  "key": "policy-energy-full-write",
  "displayName": "Energy — Full Write",
  "allow": ["energy.*.write", "device.settings.write", "device.annotations.write",
            "device.alarms.write", "device.exclusiongroups.write", "report.export"],
  "deny": []
}

// Only list energy — sees cards, no actions at all
{
  "key": "policy-energy-list-only",
  "displayName": "Energy — List Only",
  "allow": ["energy.*.list"],
  "deny": []
}

// Commonarea read but escalators are list-only
{
  "key": "policy-energy-commonarea-no-escalator-config",
  "displayName": "Energy CommonArea — Escalator Restricted",
  "allow": ["energy.commonarea.read", "energy.commonarea.escalator.list",
            "device.settings.read", "device.annotations.write"],
  "deny": []
}

// Elevator write access only
{
  "key": "policy-energy-elevator-write",
  "displayName": "Energy — Elevator Technician",
  "allow": ["energy.commonarea.elevator.write", "device.settings.write",
            "device.annotations.write"],
  "deny": []
}

// Alarm supervisor — can ack and snooze, never escalate or close
{
  "key": "policy-alarm-supervisor",
  "displayName": "Alarm — Supervisor",
  "allow": ["alarm.list", "alarm.ack", "alarm.snooze"],
  "deny": ["alarm.escalate", "alarm.close"]
}

// Alarm operator — can ack, snooze and close, but not escalate
{
  "key": "policy-alarm-operator",
  "displayName": "Alarm — Operator",
  "allow": ["alarm.list", "alarm.ack", "alarm.snooze", "alarm.close"],
  "deny": ["alarm.escalate"]
}

// Full alarm management
{
  "key": "policy-alarm-full",
  "displayName": "Alarm — Full",
  "allow": ["alarm.list", "alarm.ack", "alarm.snooze", "alarm.close", "alarm.escalate"],
  "deny": []
}

// Water full read
{
  "key": "policy-water-full-read",
  "displayName": "Water — Full Read",
  "allow": ["water.*.read", "device.settings.read", "device.annotations.read",
            "device.tickets.read", "report.view"],
  "deny": []
}

// Water maintenance — can configure water devices
{
  "key": "policy-water-maintenance",
  "displayName": "Water — Maintenance",
  "allow": ["water.*.write", "device.settings.write", "device.annotations.write",
            "device.alarms.read"],
  "deny": []
}

// Temperature list only
{
  "key": "policy-temperature-list",
  "displayName": "Temperature — List Only",
  "allow": ["temperature.list"],
  "deny": []
}

// Full read across all domains (auditor)
{
  "key": "policy-auditor-global-read",
  "displayName": "Auditor — Global Read",
  "allow": ["energy.*.read", "water.*.read", "temperature.read",
            "alarm.list", "device.settings.read", "device.annotations.read",
            "device.alarms.read", "device.tickets.read", "report.view"],
  "deny": ["device.settings.write", "device.annotations.write",
           "device.alarms.write", "alarm.ack", "alarm.close",
           "alarm.escalate", "alarm.snooze"]
}

// Reports only
{
  "key": "policy-reports-export",
  "displayName": "Reports — Export",
  "allow": ["energy.*.list", "water.*.list", "temperature.list",
            "report.view", "report.export"],
  "deny": []
}

// Customer admin — can manage users and all settings
{
  "key": "policy-customer-admin",
  "displayName": "Customer — Admin",
  "allow": ["energy.*.write", "water.*.write", "temperature.write",
            "alarm.list", "alarm.ack", "alarm.snooze", "alarm.close",
            "device.settings.write", "device.annotations.write",
            "device.alarms.write", "device.exclusiongroups.write",
            "device.tickets.read", "report.export",
            "settings.view", "user.view", "user.manage"],
  "deny": []
}

// Deny escalation explicitly (used to restrict a broad role)
{
  "key": "policy-deny-escalation",
  "displayName": "Restrict — No Escalation",
  "allow": [],
  "deny": ["alarm.escalate"]
}
```

---

### Roles (bundles of policies)

```jsonc
// Full customer administrator
{
  "key": "role-customer-admin",
  "displayName": "Customer Admin",
  "policies": [
    "policy-customer-admin",
    "policy-alarm-full"
  ]
}

// Energy read-only operator — sees energy, can ack alarms
{
  "key": "role-energy-operator",
  "displayName": "Energy Operator",
  "policies": [
    "policy-energy-full-read",
    "policy-alarm-supervisor"
  ]
}

// Elevator maintenance technician
// Can write elevator settings; for everything else (commonarea) → read; escalators → list
{
  "key": "role-elevator-technician",
  "displayName": "Elevator Technician",
  "policies": [
    "policy-energy-elevator-write",
    "policy-energy-commonarea-no-escalator-config",
    "policy-alarm-supervisor"
  ]
}

// Escalator-restricted operator (as per RFC example)
// commonarea.read + escalator.list (escalator overrides via specificity)
{
  "key": "role-technical-not-visible-escalator-config",
  "displayName": "Technical — Escalator View Only",
  "policies": [
    "policy-energy-commonarea-no-escalator-config"
  ]
}

// Auditor — global read, no write, no alarm actions
{
  "key": "role-auditor",
  "displayName": "Auditor",
  "policies": [
    "policy-auditor-global-read"
  ]
}

// Water maintenance tech
{
  "key": "role-water-maintenance",
  "displayName": "Water Maintenance",
  "policies": [
    "policy-water-maintenance",
    "policy-alarm-supervisor"
  ]
}

// Alarm supervisor — sees everything (list) + can ack/snooze
{
  "key": "role-alarm-supervisor",
  "displayName": "Alarm Supervisor",
  "policies": [
    "policy-energy-list-only",
    "policy-water-full-read",
    "policy-temperature-list",
    "policy-alarm-supervisor"
  ]
}

// Reports analyst — list cards, export reports only
{
  "key": "role-reports-analyst",
  "displayName": "Reports Analyst",
  "policies": [
    "policy-reports-export"
  ]
}

// Holding energy viewer — read energy across multiple customers (assigned per customer)
{
  "key": "role-holding-energy-viewer",
  "displayName": "Holding — Energy Viewer",
  "policies": [
    "policy-energy-full-read",
    "policy-alarm-supervisor",
    "policy-reports-export"
  ]
}
```

---

### Assignments — Real-World Scenarios

#### 1. Standard customer admin
```jsonc
{
  "id": "asgn-001",
  "userId": "user-joao-supervisor",
  "roleKey": "role-customer-admin",
  "scope": "customer:shopping-morumbi-uuid",
  "status": "active",
  "expiresAt": null,
  "grantedBy": "admin@myio.com.br",
  "reason": "Administrador principal do Shopping Morumbi"
}
```

#### 2. Elevator technician — customer scope
*Has commonarea.read for everything, but escalator is list-only (specificity wins)*
```jsonc
{
  "id": "asgn-002",
  "userId": "user-carlos-tech",
  "roleKey": "role-elevator-technician",
  "scope": "customer:shopping-morumbi-uuid",
  "status": "active",
  "expiresAt": "2026-12-31T23:59:59Z",
  "grantedBy": "joao@shopping-morumbi.com",
  "reason": "Contrato manutenção elevadores 2026"
}
```

#### 3. Temporary contractor — device-list scope
*Can only see and configure the 3 specific elevators in their contract*
```jsonc
{
  "id": "asgn-003",
  "userId": "user-contractor-thyssenkrupp",
  "roleKey": "role-elevator-technician",
  "scope": "devices:tb-uuid-elv-01,tb-uuid-elv-02,tb-uuid-elv-03",
  "status": "active",
  "expiresAt": "2026-05-01T00:00:00Z",
  "grantedBy": "joao@shopping-morumbi.com",
  "reason": "Manutenção preventiva Q2 — Elevadores bloco A"
}
```

#### 4. Auditor — temporary, read-only everything
```jsonc
{
  "id": "asgn-004",
  "userId": "user-auditora-iso",
  "roleKey": "role-auditor",
  "scope": "customer:shopping-morumbi-uuid",
  "status": "active",
  "expiresAt": "2026-04-30T23:59:59Z",
  "grantedBy": "admin@myio.com.br",
  "reason": "Auditoria ISO 50001 — Abril 2026"
}
```

#### 5. Holding user — multiple customers, same role
*One user, three assignments for three shoppings in the holding*
```jsonc
[
  {
    "id": "asgn-005a",
    "userId": "user-holding-analista",
    "roleKey": "role-holding-energy-viewer",
    "scope": "customer:shopping-sp-001",
    "status": "active",
    "expiresAt": null,
    "reason": "Shopping Morumbi — Holding acesso"
  },
  {
    "id": "asgn-005b",
    "userId": "user-holding-analista",
    "roleKey": "role-holding-energy-viewer",
    "scope": "customer:shopping-rj-002",
    "status": "active",
    "expiresAt": null,
    "reason": "Shopping Barra da Tijuca — Holding acesso"
  },
  {
    "id": "asgn-005c",
    "userId": "user-holding-analista",
    "roleKey": "role-reports-analyst",
    "scope": "customer:shopping-bsb-003",
    "status": "active",
    "expiresAt": null,
    "reason": "Shopping Brasília — Somente relatórios"
  }
]
```

#### 6. Holding user — customer-wide + device-list override
*Has energy-read for the whole customer, but write access only for specific devices*
```jsonc
[
  {
    "id": "asgn-006a",
    "userId": "user-holding-tech-senior",
    "roleKey": "role-energy-operator",
    "scope": "customer:shopping-sp-001",
    "status": "active",
    "expiresAt": null,
    "reason": "Acesso geral SP — leitura"
  },
  {
    "id": "asgn-006b",
    "userId": "user-holding-tech-senior",
    "roleKey": "role-elevator-technician",
    "scope": "devices:tb-uuid-elv-A1,tb-uuid-elv-A2",
    "status": "active",
    "expiresAt": null,
    "reason": "Responsável técnico — Elevadores bloco A"
  }
]
// Device elv-A1: device-scope wins → role-elevator-technician → elevator.write
// Device esc-01:  customer-scope only → role-energy-operator → energy.commonarea.read
// Device store-medidor-01: customer-scope → role-energy-operator
//   → energy.commonarea.read matches? No — store needs energy.store.read → locked
```

#### 7. Alarm supervisor — overlapping assignments (deny wins)
*Has supervisor role + a policy that explicitly denies escalation*
```jsonc
[
  {
    "id": "asgn-007a",
    "userId": "user-supervisor-turno",
    "roleKey": "role-alarm-supervisor",
    "scope": "customer:shopping-sp-001",
    "status": "active",
    "expiresAt": null
  },
  {
    "id": "asgn-007b",
    "userId": "user-supervisor-turno",
    "roleKey": "role-customer-admin",
    "scope": "customer:shopping-sp-001",
    "status": "active",
    "expiresAt": null,
    "reason": "Acesso admin temporário — deny escalation via role-alarm-supervisor"
  }
]
// role-customer-admin allows alarm.escalate
// role-alarm-supervisor has policy-deny-escalation → deny: ["alarm.escalate"]
// DENY is absolute → alarm.escalate = false regardless of customer-admin allow
```

#### 8. Inactive / expired assignment (not computed)
```jsonc
{
  "id": "asgn-008",
  "userId": "user-ex-contractor",
  "roleKey": "role-elevator-technician",
  "scope": "customer:shopping-sp-001",
  "status": "expired",
  "expiresAt": "2026-03-31T23:59:59Z",
  "reason": "Contrato encerrado"
}
// status != 'active' → assignment ignored entirely
```

---

## `AuthGuard` — planned API

```typescript
class AuthGuard {
  // Core permission check (deny-absolute + specificity-first)
  static can(action: string): boolean;
  static canAny(...actions: string[]): boolean;

  // Device card
  static deviceAccessLevel(item: DeviceItem): 'none' | 'list' | 'read' | 'write';
  static canViewDevice(item: DeviceItem): boolean;  // level !== 'none'

  // Settings modal
  static settingsTabAccess(tab: SettingsTab): 'none' | 'read' | 'write';
  static fieldAccess(permKey: string): 'none' | 'read' | 'write';

  // Lifecycle
  static waitForReady(timeoutMs?: number): Promise<void>;
  static onReady(cb: () => void): void;
}
```

---

## What Was Shipped (commit `45562093` — WIP Foundation)

| File | Status | Outstanding work |
|---|---|---|
| `src/components/gcdr-auth/MyIOAuthContext.ts` | ✅ committed | Wildcard + specificity resolver; `waitForReady()` |
| `src/components/gcdr-auth/permissions.ts` | ✅ committed | Add full device taxonomy + `list` level |
| `src/components/gcdr-auth/types.ts` | ✅ committed | Add `SettingsTab`, scope types |
| `src/components/gcdr-auth/index.ts` | ✅ committed | Add `AuthGuard` export |
| `src/index.ts` | ✅ committed | — |
| `WIDGET/ALARM/controller.js` | ⏸ reverted | Re-add with UI lock, not just callback gate |
| `WIDGET/MAIN_VIEW/controller.js` | ⏸ reverted | Re-add `_initAuthContext()` after resolver is ready |

### Implementation checklist

- [ ] `MyIOAuthContext.can()` — specificity-first resolver + scope-specificity ranking
- [ ] `MyIOAuthContext` — device-list scope parsing (`devices:id1,id2`)
- [ ] `AuthGuard` class — all methods above
- [ ] `PERM` constants extended with full `list`/`read`/`write` taxonomy
- [ ] Lock UI component — card overlay, button lock, tab lock, field disabled
- [ ] `renderCardComponentV5` — `locked`, `readOnly`, `accessLevel` props
- [ ] `SettingsModalView` — `authContext` param; tab + field access levels
- [ ] `TELEMETRY` — apply lock per card after `myio:auth-ready`
- [ ] `TELEMETRY_INFO` — lock per domain
- [ ] `ALARM` — lock action buttons in UI (not only callbacks)
- [ ] `MENU` — lock admin buttons via `AuthGuard.can()`
- [ ] `HEADER` — lock KPI panels per domain
- [ ] `FOOTER` — lock comparison / export
- [ ] `MAIN_VIEW` — re-integrate `_initAuthContext()`

---

## Open Questions

1. **`devices:` scope format** — is `devices:tb-uuid1,tb-uuid2` the right encoding
   for GCDR, or should it be a structured object in the assignment?

2. **Multi-assignment conflict resolution** — when two assignments with the same
   scope specificity grant different levels for the same resource, which wins?
   Current proposal: highest level wins (most permissive when scopes are equal).

3. **`SettingsModalView` global access** — pass `window.MyIOAuthContext` via
   `openDashboardPopupSettings` param, or read it directly inside the modal?

---

## Drawbacks

- ~3 extra GCDR API calls at session start (assignments + roles + policies).
- GCDR policy strings must match `permissions.ts` exactly — drift causes silent bugs.
- If GCDR is unreachable, non-admins are denied all GCDR permissions (safe but disruptive).
- Optimistic default means a brief window where locked actions can be triggered.

---

## Future Possibilities

- **Per-asset scope**: `scope: asset:<tbDeviceId>` for single-device grants.
- **Real-time revocation**: `myio:auth-revoked` event re-locks without reload.
- **Audit trail**: denied `can()` calls logged to GCDR for compliance.
- **Permission diff UI**: show user what they could access with a higher role.
