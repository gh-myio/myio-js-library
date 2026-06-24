# RFC-0197 — Roles and Policies Management in User Management Modal

- **Status**: Proposed
- **Date**: 2026-03-24
- **Author**: MYIO Engineering
- **Replaces draft**: `RFC-0197-UsersGroupsRolesProfiles.draft.md`

---

## Summary

Extend the `UserManagementModal` with two new tabs — **Permission Policies** and **Roles** — that surface the GCDR RBAC system directly in the dashboard UI.  A third interaction point, **Role Assignments**, is added to the existing user detail view, allowing authorised operators to bind a role to a user with a scope, status, and optional expiration date.  Policies and roles are read-only for non-`@myio.com.br` operators; only MYIO super-admins may create, edit, or delete them.  Every assignment is written to GCDR and mirrored as a versioned JSON attribute on the ThingsBoard user entity (`SERVER_SCOPE: user_role_assignments`).

---

## Motivation

The GCDR backend already implements a complete RBAC system (Policies → Roles → Assignments, documented in `gcdr.git/docs/RBAC-ACCESS-CONTROL.md`), but the dashboard has no surface to manage it.  As a result:

- Customer administrators must contact MYIO support to grant or revoke access for their team members.
- There is no visibility into what roles a user currently holds or when they expire.
- Temporary access grants (contractors, auditors, partners) cannot be tracked or revoked from within the product.
- Newly created users (RFC-0190 `NewUserTab`) receive no role assignment at creation time, leaving them without effective permissions until a manual out-of-band step is performed.

This RFC closes that gap by making the GCDR RBAC layer a first-class citizen of the User Management UI.

---

## Guide-Level Explanation

### For MYIO super-admins (`@myio.com.br`)

Two new tabs appear in the `UserManagementModal`:

**Permission Policies tab**

A read/write catalogue of all policies available in the tenant.  Each policy lists its `allow` and `deny` permission patterns, risk level, and whether it is a system policy (immutable).  Super-admins can create custom policies, edit non-system policies, and delete policies not currently referenced by any role.

**Roles tab**

A read/write catalogue of roles.  Each role aggregates one or more policies.  Super-admins can create, edit, and delete non-system roles.  The tab shows the effective permission set for each role (union of `allow` minus `deny` across all policies).

### For non-`@myio.com.br` operators (customer administrators)

The same two tabs are visible but **read-only** — no create/edit/delete actions are rendered.  Operators can browse policies and roles to understand what each one grants before making assignment decisions.

### Assigning a role to a user

Inside the existing user detail panel (any user row in the `UserManagementModal`), a new **Assignments** section appears below the user's basic information.  An operator can:

1. Select a role from the tenant's role catalogue.
2. Choose a scope (e.g. `customer:<uuid>` or `*`).
3. Optionally set an expiration date.
4. Add an optional reason note.
5. Save — this calls `POST /authorization/assignments` on GCDR and writes the updated assignment list to the user's ThingsBoard `SERVER_SCOPE` attribute `user_role_assignments`.

Existing assignments are listed in a table with their current status (`active`, `inactive`, `expired`) and a **Revoke** action.

---

## Reference-Level Explanation

### GCDR API surface used

All calls use the authenticated headers already established by the existing `UserManagementModal` flow (`X-API-Key` / `Authorization: Bearer`).

| Action | Endpoint | Required role |
|--------|----------|---------------|
| List policies | `GET /policies` | any authenticated user |
| Get policy | `GET /policies/:id` | any |
| Create policy | `POST /policies` | super-admin |
| Update policy | `PUT /policies/:id` | super-admin |
| Delete policy | `DELETE /policies/:id` | super-admin |
| List roles | `GET /roles` | any |
| Get role | `GET /roles/:id` | any |
| Create role | `POST /roles` | super-admin |
| Update role | `PUT /roles/:id` | super-admin |
| Delete role | `DELETE /roles/:id` | super-admin |
| List user assignments | `GET /authorization/users/:userId/assignments` | any |
| Create assignment | `POST /authorization/assignments` | any operator |
| Revoke assignment | `DELETE /authorization/assignments/:id` | any operator |
| Get effective permissions | `GET /authorization/users/:userId/permissions` | any |

### ThingsBoard mirror attribute

Every time an assignment is created or revoked for a user, the full assignment list is serialised and written to ThingsBoard:

```
POST /api/plugins/telemetry/USER/{tbUserId}/SERVER_SCOPE
{ "user_role_assignments": <UserRoleAssignmentsSnapshot> }
```

#### `UserRoleAssignmentsSnapshot` schema

```typescript
interface UserRoleAssignmentsSnapshot {
  /** ISO-8601 timestamp of the last write */
  updatedAt: string;

  /** Monotonically increasing version counter */
  version: number;

  /** Active assignments only — revoked entries are excluded */
  assignments: AssignmentEntry[];
}

interface AssignmentEntry {
  /** GCDR assignment UUID */
  id: string;

  /** e.g. "role:alarm-operator" */
  roleKey: string;

  /** Human-readable label for display without an extra API call */
  roleDisplayName: string;

  /** e.g. "customer:33333333-..." or "*" */
  scope: string;

  /** "active" | "inactive" | "expired" */
  status: string;

  /** ISO-8601 or null */
  expiresAt: string | null;

  /** ISO-8601 */
  grantedAt: string;

  /** TB userId of the operator who granted this assignment */
  grantedBy: string;

  /** Optional free-text reason */
  reason: string | null;
}
```

The attribute acts as a lightweight cache and audit snapshot.  It is not authoritative — GCDR is the source of truth.  The UI always hydrates from `GET /authorization/users/:userId/assignments` on open, and writes the snapshot after each successful GCDR mutation.

### Access control in the UI

The super-admin gate reuses the existing `isSuperAdminMyio` predicate (`src/utils/superAdminUtils.ts`):

```typescript
// Create / Edit / Delete actions are only rendered when:
isSuperAdminMyio(currentUserEmail)  // email ends with @myio.com.br,
                                    // excluding alarme@ and alarmes@
```

Non-super-admin users see the Policies and Roles tabs in read-only mode and retain full access to the Assignments section on any user they can view.

### New tabs in `UserManagementModal`

```
UserManagementModal
├── (existing) Users tab
├── (new) Permission Policies tab    ← PoliciesTab component
└── (new) Roles tab                  ← RolesTab component
```

Each user row expansion gains:

```
User detail panel
├── (existing) basic info / edit form
└── (new) Assignments section        ← AssignmentsSection component
```

### Component responsibilities

| Component | Responsibility |
|-----------|----------------|
| `PoliciesTab` | Fetch and display policy catalogue; create/edit/delete for super-admins |
| `RolesTab` | Fetch and display role catalogue with resolved permission set; create/edit/delete for super-admins |
| `AssignmentsSection` | List active assignments for a user; create and revoke assignments; write TB snapshot |

### Permission format reference

```
domain.function.action
```

Wildcards are supported at any segment level (`*.*.*`, `alarms.rules.*`, `*.*.read`).  All matching in the GCDR evaluation engine uses deny-wins: a single `deny` match short-circuits regardless of any `allow` entry.

---

## Drawbacks

- **Additional API surface**: each time the Policies or Roles tab is opened, two paginated GCDR calls are issued.  For tenants with many policies/roles this may be slow.  Mitigated by loading lazily on tab activation and caching within the modal lifecycle.
- **TB mirror drift**: the `user_role_assignments` snapshot can become stale if an assignment is modified externally (e.g. via GCDR API directly or by another operator concurrently).  The UI always re-fetches from GCDR on open, but the stored attribute may lag.
- **Scope complexity**: the GCDR scope model (hierarchical, wildcard) is powerful but non-trivial to represent in a dropdown.  The initial implementation limits scope input to predefined options (`*`, `customer:<current>`) to reduce UI complexity.

---

## Rationale and Alternatives

### Why mirror to ThingsBoard `SERVER_SCOPE`?

The ThingsBoard entity model does not natively understand GCDR roles.  Storing a snapshot on the user entity allows existing TB tooling (attribute viewers, rule-chain triggers) and future dashboard widgets to query a user's role state without a GCDR round-trip.  The pattern follows RFC-0194 (`customerDefaultDashboard`) and the existing `exclude_groups_totals` attribute.

### Why not a standalone Permissions modal?

The user management flow (invite, edit, assign permissions) is a natural workflow unit.  Splitting it into a separate modal would fragment the operator experience and duplicate the user-fetch logic.  The tab model within the existing `UserManagementModal` has already proven effective (RFC-0180 `AlarmsTab`, RFC-0190 `NewUserTab`).

### Alternative considered: permission gate via TB user group

ThingsBoard has a native "Customer Administrators" / "Customer Users" group concept.  Relying on TB groups alone would be simpler but provides no fine-grained scope or expiration, and couples permission logic to TB internals rather than the GCDR abstraction layer that the rest of the system already uses.

---

## Prior Art

- **RFC-0190** (`UserManagement`) established the `UserManagementModal` tab architecture and the GCDR identity API integration pattern this RFC extends.
- **RFC-0180** (`NewAlarmsTab`) demonstrated the pattern of embedding a GCDR-backed tab inside a settings modal with role-gated write access.
- **RFC-0194** (`CustomerDefaultDashboard`) established the convention of mirroring GCDR state as a versioned `SERVER_SCOPE` attribute on a ThingsBoard entity.
- `gcdr.git/docs/RBAC-ACCESS-CONTROL.md` is the authoritative specification for the GCDR RBAC data model and API that this RFC surfaces in the UI.

---

## Unresolved Questions

1. **Scope picker UX**: should the scope field be a free-text input, a predefined dropdown, or a hierarchical tree picker?  The initial proposal limits options to `*` (global) and `customer:<current-customer-id>`.  Broader scope selection can be added in a follow-up.

2. **Assignment creation by non-super-admins**: the draft specifies that any operator can assign roles to users.  Should the operator's own effective permissions constrain which roles they may assign (i.e. an operator cannot grant a role more powerful than their own)?  This "privilege escalation prevention" rule is not currently enforced by the GCDR API and would require either a client-side guard or a GCDR API change.

3. **TB snapshot write failures**: if the GCDR assignment creation succeeds but the subsequent ThingsBoard `SERVER_SCOPE` write fails, the data is inconsistent.  Should the UI surface this as a partial-success warning, or silently retry?

4. **Pagination**: for tenants with large policy or role catalogues, the initial `GET /policies?limit=100` call may not return all items.  Should the tab implement cursor-based infinite scroll or a simple "load more" button?

5. **`NewUserTab` integration**: RFC-0190 creates a user without any role assignment.  Should this RFC define an optional "Assign role at creation" step in `NewUserTab`, or is that deferred to a separate RFC?

---

## Future Possibilities

- **Role assignment at user creation**: extend `NewUserTab` (RFC-0190) to optionally select a role and scope during the invite flow, eliminating the two-step invite → assign workflow.
- **Expiration notifications**: a background check on `user_role_assignments` snapshots could surface a warning banner when an assignment is close to its `expiresAt` date.
- **Bulk assignment**: a "Grant role to all users in this customer" action for operators managing large teams.
- **Permission check gating in the UI**: after loading a user's effective permissions via `GET /authorization/users/:userId/permissions`, the dashboard could conditionally enable or disable UI controls (alarm rule deletion, settings edit, report export) based on the resolved permission set — replacing the current email-domain heuristics.
