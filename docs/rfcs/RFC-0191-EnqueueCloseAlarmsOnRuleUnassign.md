# RFC-0191 — Enqueue-Close Alarms on Rule Unassignment

- **Status**: Proposed
- **Date**: 2026-03-11
- **Branch**: `fix/rfc-0152-real-data`
- **Author**: MYIO Engineering

---

## Summary

When a user removes a device from an alarm rule's scope in the **AlarmsTab** (Settings modal),
display a premium confirmation modal warning that active or queued alarms tied to that rule may
be closed. Upon confirmation, call `POST /api/v1/alarms/enqueue-close` via a new
`MyIOOrchestrator.gcdrEnqueueCloseAlarms(ruleId, deviceId)` method exposed in
`MAIN_VIEW/controller.js`.

---

## Motivation

Currently, `AlarmsTab` Section 2 lets operators unassign alarm rules from a device by unchecking
a row and clicking **Save**. The save path calls `gcdrPatchRuleScope` (PATCH on the rule's
`scope.entityIds`), which removes the device from the rule — but leaves any open or
in-flight alarms untouched in the GCDR alarm engine.

This creates a silent data inconsistency:

- The rule no longer monitors the device, yet its alarms remain open.
- Operators have no visibility that stale alarms exist.
- Support teams receive spurious alarm notifications for devices that are no longer
  configured to produce them.

A confirmation gate with an explicit "enqueue close" call fixes both problems:

1. It forces a deliberate operator decision (not an accidental uncheck).
2. It instructs the GCDR alarm engine to close any matching alarms via a safe async job,
   preventing hard deletes and preserving audit history.

---

## Detailed Design

### 1. Trigger Condition — `AlarmsTab.ts`

The confirmation flow fires **only** when all three conditions are true:

| Condition | Detail |
|-----------|--------|
| The rule row was initially checked | `initialCheckedRuleIds.has(ruleId)` |
| The user unchecked it | `checkbox.checked === false` at save time |
| `handleSave()` is about to call `gcdrPatchRuleScope` for removal | `toRemove` set |

Regular rules being assigned for the first time (newly checked rows) are unaffected.

---

### 2. Confirmation Modal — Premium Warning

Before calling `gcdrPatchRuleScope` for any rule in `toRemove`, `AlarmsTab` renders an
inline premium modal. The modal **blocks the save flow** until the user makes a decision.

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠️  Attention — Active Alarm Rule Removal                       │
│  ──────────────────────────────────────────────────────────────  │
│  You are about to remove the device from the alarm rule:         │
│                                                                  │
│    Rule name  ·  CRITICAL                                        │
│                                                                  │
│  This action may close open or queued alarms associated with     │
│  this rule on this device. The alarm engine will enqueue a       │
│  close job; history and audit logs are preserved.                │
│                                                                  │
│  [ Cancel ]                    [ Confirm & Remove Rule ]         │
└──────────────────────────────────────────────────────────────────┘
```

Visual spec:
- Background overlay: `rgba(0,0,0,0.45)`, z-index above SettingsModal
- Panel: `border-left: 4px solid #f59e0b` (warning amber)
- Rule name rendered in **bold**, priority badge shown
- "Confirm & Remove Rule" button: `background: #dc2626` (destructive red)
- "Cancel" button restores the checkbox to checked state

If **multiple** rules are being removed in the same save operation, show one modal per rule
sequentially (await each confirmation before proceeding to the next).

---

### 3. New Orchestrator Method — `gcdrEnqueueCloseAlarms`

Added to `MAIN_VIEW/controller.js` alongside the existing RFC-0180 GCDR API methods
(`gcdrPatchRuleScope`, `gcdrPatchRuleValue`, etc.).

#### Stub (initial declaration in `window.MyIOOrchestrator`):

```javascript
// RFC-0191: enqueue-close alarms when a rule is unassigned from a device
gcdrEnqueueCloseAlarms: async () => {
  LogHelper.warn('[Orchestrator] ⚠️ gcdrEnqueueCloseAlarms called before orchestrator is ready');
  return false;
},
```

#### Real implementation (in the GCDR API methods block, ~line 6200):

```javascript
/**
 * RFC-0191 — Enqueue close of alarms for a given rule × device pair.
 * Called by AlarmsTab when the user confirms removal of a pre-checked rule.
 *
 * POST /api/v1/alarms/enqueue-close
 * Body: { customerId, ruleId, deviceId }
 * 202 → { data: { alarmId, jobId, message } }
 *
 * @param {string} ruleId   - GCDR rule UUID
 * @param {string} deviceId - GCDR device UUID (gcdrDeviceId)
 * @returns {Promise<boolean>} true if the job was accepted (202), false otherwise
 */
async gcdrEnqueueCloseAlarms(ruleId, deviceId) {
  const orch = window.MyIOOrchestrator;
  const url  = `${orch.alarmsApiBaseUrl}/api/v1/alarms/enqueue-close`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID':  orch.gcdrTenantId   || '',
      'X-API-KEY':    orch.gcdrApiKey      || '',
    },
    body: JSON.stringify({
      customerId: orch.gcdrCustomerId,
      ruleId,
      deviceId,
    }),
  });

  if (response.status === 202) {
    const json = await response.json().catch(() => ({}));
    LogHelper.log('[Orchestrator] RFC-0191 enqueue-close accepted:', json?.data);
    return true;
  }

  LogHelper.warn('[Orchestrator] RFC-0191 enqueue-close failed:', response.status);
  return false;
},
```

---

### 4. `AlarmsTab.ts` — Save Flow Change

`handleSave()` is extended to intercept the `toRemove` set and run the confirmation + enqueue
loop before delegating to `gcdrPatchRuleScope`:

```typescript
// RFC-0191: for each rule being removed, confirm + enqueue-close
for (const ruleId of toRemove) {
  const rule = ruleMap.get(ruleId);
  if (!rule) continue;

  // 1. Show premium confirmation modal — awaits user decision
  const confirmed = await this.confirmRuleUnassign(rule);
  if (!confirmed) {
    // User cancelled — restore checkbox state, skip this rule
    this.restoreRuleCheckbox(ruleId);
    continue;
  }

  // 2. Enqueue close — fire-and-forget; failure is non-blocking
  const enqueued = await this.orch.gcdrEnqueueCloseAlarms(ruleId, this.config.gcdrDeviceId);
  if (!enqueued) {
    // Log warning but still proceed with scope patch
    console.warn('[AlarmsTab] RFC-0191: enqueue-close failed for rule', ruleId);
  }

  // 3. Patch rule scope (existing behaviour)
  const ids = (rule.scope?.entityIds ?? []).filter(id => id !== this.config.gcdrDeviceId);
  const ok  = await this.orch.gcdrPatchRuleScope(ruleId, ids);
  if (ok) {
    rule.scope = { ...rule.scope, entityIds: ids };
  } else {
    errors.push(rule.name);
  }
}
```

New private methods on `AlarmsTab`:

```typescript
/**
 * Renders and awaits a premium confirmation modal for rule unassignment.
 * Resolves true (confirm) or false (cancel).
 */
private confirmRuleUnassign(rule: GCDRCustomerRule): Promise<boolean>;

/**
 * Re-checks the checkbox for a rule (user cancelled the confirmation).
 */
private restoreRuleCheckbox(ruleId: string): void;
```

---

### 5. API Contract

#### Request

```
POST {alarmsApiBaseUrl}/api/v1/alarms/enqueue-close
Content-Type: application/json
X-Tenant-ID: <gcdrTenantId>
X-API-KEY:   <gcdrApiKey>

{
  "customerId": "a4c64215-...",
  "ruleId":     "92d45741-...",
  "deviceId":   "abc123"
}
```

#### 202 Accepted Response

```json
{
  "data": {
    "alarmId": "RLm7bnpLcCuzwpbfdAcG1",
    "jobId":   "1234",
    "message": "triggered=false enqueued — orchestrator will close the alarm if dedupKey matches"
  }
}
```

The 202 means the job was **enqueued**; the alarm engine may or may not find a matching
open alarm. Both outcomes are valid — the job is idempotent and safe to replay.

#### Non-202 Responses

| Status | Behaviour |
|--------|-----------|
| `4xx` | Log warning; proceed with `gcdrPatchRuleScope` anyway (non-blocking) |
| `5xx` | Log warning; proceed with `gcdrPatchRuleScope` anyway (non-blocking) |
| Network error | Catch + log; proceed |

The enqueue-close call is **best-effort**. A failure must not prevent the scope patch from
completing, since the scope change is the authoritative mutation.

---

### 6. Sequence Diagram

```
User unchecks pre-checked rule
        │
        ▼
  [Save Alarms] clicked
        │
        ▼
  toRemove = [ruleId, ...]
        │
        ▼
  for each ruleId in toRemove:
    │
    ├─► confirmRuleUnassign(rule)  ──────────────────────────────────┐
    │         (premium modal)                                        │
    │                                                                │
    │   User: [ Cancel ]  ────────── restoreRuleCheckbox(ruleId)     │
    │                                skip to next rule               │
    │   User: [ Confirm ] ──────────────────────────────────────────►│
    │                                                                │
    ├─► gcdrEnqueueCloseAlarms(ruleId, gcdrDeviceId)                 │
    │         POST /api/v1/alarms/enqueue-close  (fire-and-forget)   │
    │                                                                │
    └─► gcdrPatchRuleScope(ruleId, entityIds without deviceId)       │
              PATCH /api/v1/rules/{ruleId}                           │
              scope.entityIds updated                                │
```

---

## Drawbacks

- Adds a modal per removed rule, which may feel disruptive when bulk-removing many rules.
  Mitigation: a future iteration can batch all removed rules into a single confirmation modal.
- The enqueue-close is fire-and-forget; the UI has no way to confirm the alarm was actually
  closed (GCDR engine is async). This is acceptable — the `message` field in the 202 response
  already communicates the async nature.

---

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Call enqueue-close silently without confirmation | Operators must be aware; silent destructive actions are a UX anti-pattern |
| Block save until enqueue-close resolves | The alarm engine is async (job queue); a synchronous response on closure is not guaranteed |
| Add a "Close open alarms" toggle instead of automatic call | Extra UI complexity; the desired behaviour is always to close when unassigning |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` | Add `gcdrEnqueueCloseAlarms` stub + real impl (RFC-0191 block) |
| `src/components/premium-modals/settings/alarms/AlarmsTab.ts` | `handleSave()` interceptor + `confirmRuleUnassign()` + `restoreRuleCheckbox()` |

---

## Unresolved Questions

1. Should the confirmation modal list the **count of currently open alarms** for the
   rule × device pair (from `AlarmServiceOrchestrator`) to give operators better context?
2. When multiple rules are removed in the same save, should they be confirmed in a **single
   batched modal** (listing all affected rules) or sequentially one-by-one?
3. Should a successful `jobId` be stored locally (e.g., in `localStorage`) for audit trail
   purposes, or is the server-side job log sufficient?
