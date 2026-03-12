# RFC-0190 — User Management Modal

- **Status**: Proposed
- **Date**: 2026-03-12
- **Branch**: `fix/rfc-0152-real-data`
- **Author**: MYIO Engineering

---

## Summary

Introduce a **User Management** premium modal accessible from the MENU widget's Settings
picker. V1 is restricted to **SuperAdmin MYIO** users (`@myio.com.br`, excluding
`alarme@` and `alarmes@`). The modal is a full 16:9 panel with backdrop blur, architecturally
identical to the existing `SettingsModal`, and contains four tab types:

- **User List** — searchable table with inline Edit and "View Details" actions
- **New User** — form to create a ThingsBoard user under the current customer
- **Profile Management** — view/edit customer user groups and permissions
- **Dynamic User Detail** — created on demand when "View Details" is clicked; tab label is
  `FIRSTNAME L.` (first name + first letter of last name, all caps); closeable

---

## Motivation

Dashboard operators at the customer level currently have no self-service interface to
manage which users have access to the MYIO platform. All user provisioning must go through
MYIO support. A gated, in-dashboard modal that exposes ThingsBoard's User API gives
SuperAdmin MYIO users direct control over the user lifecycle without leaving the dashboard.

---

## Detailed Design

### 1. Access Gate — SuperAdmin MYIO Only (V1)

The feature is gated exclusively on **SuperAdmin MYIO** in V1:

```javascript
// Condition used in MENU controller (consistent with existing isSuperAdmin check)
const isSuperAdminMyio = window.MyIOUtils?.SuperAdmin === true;
```

`window.MyIOUtils.SuperAdmin` is set to `true` by `MAIN_VIEW/controller.js` when
`detectSuperAdminMyio()` returns `true` — i.e., the authenticated user's email ends with
`@myio.com.br` (excluding `alarme@` and `alarmes@`).

SuperAdmin Holding (`isUserAdmin` attribute) does **not** grant access in V1.

---

### 2. MENU Widget — New Settings Option

**File**: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js`

A new option **"Gestão de Usuários"** is added to the `showSettingsModal(user)` picker,
rendered conditionally after the existing "Setup de Integração" option — both require
`isSuperAdminMyio`:

```javascript
// Existing option (unchanged)
${isSuperAdmin ? `
<button class="myio-settings-option myio-settings-option--myio" data-action="integration">
  ...
</button>` : ''}

// NEW — RFC-0190
${isSuperAdmin ? `
<button class="myio-settings-option myio-settings-option--myio" data-action="user-management">
  <span class="myio-settings-option__icon">👥</span>
  <div class="myio-settings-option__text">
    <span class="myio-settings-option__title">Gestão de Usuários</span>
    <span class="myio-settings-option__desc">Usuários e perfis — apenas MyIO</span>
  </div>
</button>` : ''}
```

Click handler added to the existing `querySelectorAll` block:

```javascript
} else if (action === 'user-management') {
  openUserManagementModal(user);
}
```

---

### 3. File Structure

```
src/components/premium-modals/user-management/
├── openUserManagementModal.ts     — public entry point (mirrors openDashboardPopupSettings)
├── UserManagementController.ts    — lifecycle: show(), destroy()
├── UserManagementModalView.ts     — shell: 16:9 modal, blur, tab bar, dynamic tabs
├── types.ts                       — OpenUserManagementParams, UserManagementConfig, TBUser
└── tabs/
    ├── UserListTab.ts             — Tab 1: searchable user table
    ├── NewUserTab.ts              — Tab 2: create user form
    ├── ProfileManagementTab.ts    — Tab 3: groups & permissions
    └── UserDetailTab.ts           — Tab N (dynamic): per-user detail + edit + reset password
```

---

### 4. Modal Shell — `UserManagementModalView`

**Visual spec** (mirrors SettingsModal):

```
┌────────────────────────────────────────────────────────────┐  ← backdrop blur
│  👥 Gestão de Usuários          · Moxuara Shopping     ✕   │  ← header
│────────────────────────────────────────────────────────────│
│  [📋 Usuários] [➕ Novo Usuário] [🏷 Perfis] [JOAO S. ✕]  │  ← tab bar
│────────────────────────────────────────────────────────────│
│                                                            │
│  (tab content)                                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

- Aspect ratio: 16:9, `max-width: 960px`, `width: 92vw`
- Background: `rgba(0,0,0,0.55)` backdrop with `backdrop-filter: blur(4px)`
- `z-index: 99999` (above all other modals)
- Appended to `document.body` (not shadow DOM container)

#### Tab bar rules

| Tab | Key | Closeable | Created by |
|-----|-----|-----------|------------|
| Usuários | `user-list` | No (always present) | Static |
| Novo Usuário | `new-user` | No (always present) | Static |
| Perfis | `profiles` | No (always present) | Static |
| `FIRSTNAME L.` | `user-detail-{userId}` | Yes (✕ button) | `UserListTab` → View Details |

Only one dynamic User Detail tab per user at a time. If the same user's detail is opened
again, the existing tab is activated (not duplicated).

---

### 5. ThingsBoard API Usage

All calls use the JWT token from `localStorage.getItem('jwt_token')` and the TB base URL
from `self.ctx.settings.tbBaseUrl`. Only APIs needed for V1 are included.

| Operation | Method + Endpoint | Used by |
|-----------|------------------|---------|
| List users for customer | `GET /api/customer/{customerId}/users?pageSize=50&page=0&textSearch={q}` | UserListTab |
| Get single user | `GET /api/user/{userId}` | UserDetailTab |
| Get enriched user info | `GET /api/user/info/{userId}` | UserDetailTab |
| Create user | `POST /api/user?sendActivationMail=true` | NewUserTab |
| Update user | `POST /api/user` (body includes `id`) | UserDetailTab (Edit mode) |
| Delete user | `DELETE /api/user/{userId}` | UserDetailTab |
| Send reset password email | `POST /api/noauth/resetPasswordByEmail` body: `{email}` | UserDetailTab |
| Resend activation email | `POST /api/user/sendActivationMail?email={email}` | UserDetailTab |
| Get activation link | `GET /api/user/{userId}/activationLink` | UserDetailTab |

**Excluded from V1** (out of scope):
- `GET /api/userGroup/…` — group permission management (V2)
- `GET /api/audit/logs/user/{userId}` — audit trail (V2)
- OAuth2, sign-up, mobile session endpoints

#### `TBUser` type (derived from TB API response)

```typescript
interface TBUser {
  id: { id: string; entityType: 'USER' };
  tenantId: { id: string };
  customerId: { id: string };
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  authority: 'CUSTOMER_USER' | 'TENANT_ADMIN';
  additionalInfo?: { description?: string; [key: string]: unknown };
  createdTime?: number;
}
```

---

### 6. Tab: User List (`UserListTab`)

**Default tab.** Shows a paginated, searchable table of users under the current customer.

```
┌──────────────────────────────────────────────────────────┐
│  🔍 [Buscar por nome ou email...          ]   [ + Novo ] │
│──────────────────────────────────────────────────────────│
│  Nome              Email                  Perfil  Ações  │
│  João Silva        joao@cliente.com.br    Admin   ✏ 👁   │
│  Maria Santos      maria@cliente.com.br   Usuário ✏ 👁   │
│  ...                                                      │
│──────────────────────────────────────────────────────────│
│  ← Anterior    Página 1 de 3    Próxima →                │
└──────────────────────────────────────────────────────────┘
```

- Search box: debounced (300 ms), calls `GET /api/customer/{id}/users?textSearch={q}`
- Each row: **Edit** (✏) opens UserDetailTab in edit mode; **View Details** (👁) opens
  UserDetailTab in view mode
- **Dynamic tab label**: `FIRSTNAME L.` — `user.firstName.toUpperCase()` +
  `' ' + user.lastName[0].toUpperCase() + '.'`
  Example: `João Silva` → `JOÃO S.`
- "+ Novo" button switches to the New User tab

---

### 7. Tab: New User (`NewUserTab`)

Form to create a ThingsBoard `CUSTOMER_USER` under the current customer.

```
First Name *     [                    ]
Last Name  *     [                    ]
Email *          [                    ]
Phone            [                    ]
Description      [                    ]

☑  Enviar email de ativação

                             [ Cancelar ] [ Criar Usuário ]
```

- **Required**: `firstName`, `lastName`, `email`
- On submit: `POST /api/user?sendActivationMail={checked}` with body:
  ```json
  {
    "email": "...",
    "firstName": "...",
    "lastName": "...",
    "phone": "...",
    "authority": "CUSTOMER_USER",
    "customerId": { "id": "{customerId}", "entityType": "CUSTOMER" },
    "tenantId":   { "id": "{tenantId}",   "entityType": "TENANT"   },
    "additionalInfo": { "description": "..." }
  }
  ```
- On success: show toast, switch to User List tab and highlight the new row

---

### 8. Tab: Profile Management (`ProfileManagementTab`) — V1 Minimal

V1 shows a **read-only** list of user groups under the customer, with a note that full
group editing will be available in V2.

```
┌──────────────────────────────────────────────────────────┐
│  Perfis configurados para este cliente                    │
│──────────────────────────────────────────────────────────│
│  Nome do Grupo            Tipo         Nº de membros      │
│  Administradores          USER_GROUP   3                  │
│  Operadores               USER_GROUP   12                 │
│──────────────────────────────────────────────────────────│
│  ℹ️  Edição de perfis disponível em versão futura.        │
└──────────────────────────────────────────────────────────┘
```

Data source: `GET /api/userGroup/{entityGroupId}/users` (reads existing groups; write
operations deferred to V2).

---

### 9. Tab: User Detail (`UserDetailTab`) — Dynamic

Created when "View Details" (👁) is clicked in the User List.

#### View mode

```
┌─────────────────────────────────────────────────────────┐
│  JOÃO S.                                           ✕    │  ← tab header
│─────────────────────────────────────────────────────────│
│  Nome       João Silva                                   │
│  Email      joao@cliente.com.br                          │
│  Telefone   +55 11 99999-9999                            │
│  Perfil     CUSTOMER_USER                                │
│  Criado em  10/02/2026                                   │
│─────────────────────────────────────────────────────────│
│         [ Editar ]  [ Redefinir Senha ]  [ Excluir ]     │
└─────────────────────────────────────────────────────────┘
```

#### Edit mode (toggled by "Editar")

Same form as View mode but fields become editable. On save: `POST /api/user` with updated
body. After save, returns to View mode.

#### Actions

| Button | API call | Confirmation required |
|--------|----------|-----------------------|
| **Editar** | Toggles form to editable | No |
| **Redefinir Senha** | `POST /api/noauth/resetPasswordByEmail { email }` | Yes — confirm dialog |
| **Excluir** | `DELETE /api/user/{userId}` | Yes — confirm dialog with user name |

On delete success: close the dynamic tab, refresh User List.

---

### 10. `OpenUserManagementParams` Interface

```typescript
export interface OpenUserManagementParams {
  /** ThingsBoard customer UUID */
  customerId: string;
  /** ThingsBoard tenant UUID */
  tenantId: string;
  /** Human-readable customer name (shown in modal header) */
  customerName?: string;
  /** JWT token from localStorage */
  jwtToken: string;
  /** TB base URL */
  tbBaseUrl: string;
  /** Authenticated user object (passed from MENU's fetchUserInfo) */
  currentUser: { id: string; email: string; firstName?: string; lastName?: string };
}
```

---

### 11. Entry Point — `openUserManagementModal`

```typescript
// src/components/premium-modals/user-management/openUserManagementModal.ts

export async function openUserManagementModal(
  params: OpenUserManagementParams
): Promise<void> {
  const controller = new UserManagementController(params);
  await controller.show();
}
```

Called from MENU's `showSettingsModal`:

```javascript
// MENU/controller.js — inside action handler
} else if (action === 'user-management') {
  const jwt = localStorage.getItem('jwt_token') || '';
  const orch = window.MyIOOrchestrator;
  window.MyIOLibrary.openUserManagementModal({
    customerId:   orch?.customerTB_ID || self.ctx.settings?.customerTB_ID || '',
    tenantId:     /* from TB user object */ user.tenantId?.id || '',
    customerName: orch?.customerName  || '',
    jwtToken:     jwt,
    tbBaseUrl:    self.ctx.settings?.tbBaseUrl || '',
    currentUser:  { id: user.id?.id, email: user.email,
                    firstName: user.firstName, lastName: user.lastName },
  });
}
```

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/components/premium-modals/user-management/openUserManagementModal.ts` | **New** — public entry point |
| `src/components/premium-modals/user-management/UserManagementController.ts` | **New** — lifecycle manager |
| `src/components/premium-modals/user-management/UserManagementModalView.ts` | **New** — modal shell + tab bar |
| `src/components/premium-modals/user-management/types.ts` | **New** — shared types |
| `src/components/premium-modals/user-management/tabs/UserListTab.ts` | **New** — user table |
| `src/components/premium-modals/user-management/tabs/NewUserTab.ts` | **New** — create form |
| `src/components/premium-modals/user-management/tabs/ProfileManagementTab.ts` | **New** — groups (read-only V1) |
| `src/components/premium-modals/user-management/tabs/UserDetailTab.ts` | **New** — dynamic detail/edit |
| `src/components/premium-modals/user-management/index.ts` | **New** — re-exports |
| `src/index.ts` | **Modify** — export `openUserManagementModal` |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js` | **Modify** — add "Gestão de Usuários" option + `openUserManagementModal` call |

---

## Drawbacks

- All ThingsBoard User API calls require `TENANT_ADMIN` or `CUSTOMER_USER` authority with
  sufficient permissions. If the logged-in user (a `CUSTOMER_USER`) does not have
  `TENANT_ADMIN` rights, some endpoints (e.g. `DELETE /api/user/{userId}`) may return 403.
  In V1, SuperAdmin MYIO users are expected to have `TENANT_ADMIN` authority, so this is
  acceptable.
- The Profile Management tab is intentionally minimal in V1. Showing read-only group data
  sets operator expectations without committing to write operations before the group
  permission API is fully understood.

---

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Extend SettingsModal with a "Users" tab | SettingsModal is device-scoped; user management is customer-scoped — different lifecycle and params |
| Separate ThingsBoard dashboard state | Requires ThingsBoard state/route configuration outside of library control |
| Expose to SuperAdmin Holding in V1 | V1 scope is deliberately narrow (`@myio.com.br` only); Holding admins can be added in V2 after UX validation |

---

## Unresolved Questions

1. When a SuperAdmin MYIO creates a user via "Novo Usuário", what `authority` should be
   assigned — always `CUSTOMER_USER`, or should the operator be able to select a role?
2. Should the "Excluir" action perform a hard delete (`DELETE /api/user/{userId}`) or
   disable credentials (`POST /api/user/{userId}/userCredentialsEnabled?userCredentialsEnabled=false`)?
3. Is a V1 read-only Profile Management tab acceptable, or should inline editing of at
   least group membership be included?
