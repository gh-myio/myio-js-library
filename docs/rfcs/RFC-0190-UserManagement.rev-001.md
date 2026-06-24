# RFC-0190 rev-001 — User Management Modal (Implementado)

- **Status**: Implemented
- **Date**: 2026-03-16
- **Branch**: `fix/rfc-0152-real-data`
- **Supersedes**: `RFC-0190-UserManagement.md` (Proposed)
- **Author**: MYIO Engineering

---

## Resumo

Modal premium de **Gestão de Usuários** acessível via MENU widget → Configurações →
"Gestão de Usuários". Restrita a **SuperAdmin MYIO** (`@myio.com.br`). Interface 16:9
com backdrop blur, sistema de abas dinâmico e suporte a temas claro/escuro.

A implementação concluída inclui **cinco tipos de aba**:

| Aba | Chave | Dinâmica | Fechável |
|-----|-------|----------|----------|
| Usuários | `user-list` | Não | Não |
| Novo Usuário | `new-user` | Não | Não |
| Perfis (grupos TB) | `profiles` | Não | Não |
| Grupos de Notificação (GCDR) | `groups` | Não | Não |
| Detalhe de Usuário | `user-detail-{userId}` | Sim | Sim |

> **Diferença em relação ao Proposed**: O tab "Perfis" (leitura de grupos TB) foi
> complementado com um novo tab fixo "Grupos" — gestão de canais de notificação e
> grupos de despacho via GCDR API, não previsto na RFC-0190 original.

---

## Estrutura de Arquivos

```
src/components/premium-modals/user-management/
├── openUserManagementModal.ts         — entry point público
├── UserManagementController.ts        — ciclo de vida: show()
├── UserManagementModalView.ts         — shell: backdrop, header, tab bar, toast
├── types.ts                           — tipos e helpers
├── index.ts                           — re-exports (barrel)
└── tabs/
    ├── UserListTab.ts                 — Tab 1: tabela paginada + busca
    ├── NewUserTab.ts                  — Tab 2: formulário de criação
    ├── ProfileManagementTab.ts        — Tab 3: grupos TB (leitura)
    ├── GroupManagementTab.ts          — Tab 4: canais + grupos GCDR
    └── UserDetailTab.ts               — Tab N (dinâmico): ver/editar/excluir
```

---

## Controle de Acesso

### Acesso ao menu

```javascript
// MENU/controller.js — condição aplicada em showSettingsModal()
const isSuperAdminMyio = window.MyIOUtils?.SuperAdmin === true;
// Renderiza botão "Gestão de Usuários" apenas se true
```

`window.MyIOUtils.SuperAdmin` é setado por `MAIN_VIEW/controller.js` via
`detectSuperAdminMyio()`:

```javascript
email.endsWith('@myio.com.br')
  && !email.startsWith('alarme@')
  && !email.startsWith('alarmes@')
```

**V1**: exclusivo SuperAdmin MYIO. SuperAdmin Holding (`isUserAdmin` = true) não
tem acesso nesta versão.

### Validação na entrada

```typescript
// openUserManagementModal.ts
if (!params.jwtToken) throw new Error('JWT token não informado');
if (!params.customerId) throw new Error('Customer ID não informado');
```

---

## Interface — `OpenUserManagementParams`

```typescript
export interface OpenUserManagementParams {
  customerId: string;        // UUID do Customer TB
  tenantId: string;          // UUID do Tenant TB
  customerName?: string;     // exibido no header da modal
  jwtToken: string;          // localStorage.jwt_token
  tbBaseUrl: string;         // https://thingsboard.example.com
  currentUser: TBCurrentUser;
  themeMode?: 'light' | 'dark';
}

export interface TBCurrentUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}
```

---

## Shell da Modal — `UserManagementModalView`

### Visual

```
┌────────────────────────────────────────────────────────────┐  ← backdrop blur
│  👥 Gestão de Usuários — Moxuara Shopping      ⤢  ✕        │  ← header #3e1a7d
│────────────────────────────────────────────────────────────│
│ [📋 Usuários][➕ Novo][🏷 Perfis][👥 Grupos][JOÃO S. ✕]   │  ← tab bar
│────────────────────────────────────────────────────────────│
│                                                            │
│  (conteúdo da aba ativa)                                   │
│                                                            │
│────────────────────────────────────────────────────────────│
│  [toast de sucesso/erro]                                   │
└────────────────────────────────────────────────────────────┘
```

### Especificações

| Propriedade | Valor |
|-------------|-------|
| Aspect ratio | 16:9, `max-width: 960px`, `width: 92vw` |
| Header | `background: #3e1a7d`, `color: white`, `font-size: 18px/600` |
| Botões header | Maximizar (32×32) + Fechar (32×32), hover `rgba(255,255,255,0.1)` |
| Backdrop | `rgba(0,0,0,0.55)` + `backdrop-filter: blur(4px)` |
| z-index | `99999` |
| Tema | Variáveis CSS `--um-bg`, `--um-text`, etc; `dark` / `light` |

### Maximizar

```javascript
// UserManagementModalView.ts
maximizeBtn.addEventListener('click', () => {
  this.modalEl.classList.toggle('is-maximized');
});
// .is-maximized → width/height: 100vw/100vh, border-radius: 0
```

### Toast

```typescript
this.showToast(message: string, type: 'success' | 'error', duration = 4000)
```

Toast interno da modal (não usa `MyIOToast` global).

---

## Tipos ThingsBoard

```typescript
export interface TBUser {
  id: TBUserId;
  tenantId: { id: string; entityType: 'TENANT' };
  customerId: { id: string; entityType: 'CUSTOMER' };
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  authority: 'CUSTOMER_USER' | 'TENANT_ADMIN';
  additionalInfo?: { description?: string; [key: string]: unknown };
  createdTime?: number;
}

export interface TBUserPage {
  data: TBUser[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}
```

### Helpers

```typescript
buildUserTabLabel(user: TBUser): string
// → "JOÃO S." (firstName uppercase + inicial do lastName)

buildUserDisplayName(user: TBUser): string
// → "João Silva" | "joao@example.com" (fallback)
```

---

## Tab 1 — User List (`UserListTab`)

**Aba padrão.** Tabela paginada e buscável dos usuários do Customer.

```
┌──────────────────────────────────────────────────────────┐
│  🔍 [Buscar por nome ou email...          ]   [ + Novo ] │
│──────────────────────────────────────────────────────────│
│  Nome              Email                  Perfil  Ações  │
│  João Silva        joao@cliente.com.br    CUST…   ✏ 👁   │
│  Maria Santos      maria@cliente.com.br   CUST…   ✏ 👁   │
│──────────────────────────────────────────────────────────│
│  ← Anterior    Página 1 de 3    Próxima →                │
└──────────────────────────────────────────────────────────┘
```

### API

```
GET /api/customer/{customerId}/users
    ?pageSize=20&page={p}&textSearch={q}
    Authorization: Bearer {jwtToken}
```

### Comportamento

- Busca com debounce de 300 ms, reinicia para página 0
- Paginação: 20 itens por página
- **✏ (Editar)** → abre `UserDetailTab` em modo edição
- **👁 (Ver Detalhes)** → abre `UserDetailTab` em modo leitura
- **+ Novo** → muda para aba `new-user`
- Novos usuários recém-criados são destacados visualmente (linha colorida)
- Se o mesmo usuário já tem uma aba de detalhe aberta, ativa-a em vez de duplicar

---

## Tab 2 — New User (`NewUserTab`)

```
First Name *     [                    ]
Last Name  *     [                    ]
Email *          [                    ]
Phone            [                    ]
Description      [                    ]

☑  Enviar email de ativação

                             [ Cancelar ] [ Criar Usuário ]
```

### API

```
POST /api/user?sendActivationMail={true|false}
Body:
{
  "email": "...",
  "firstName": "...",
  "lastName": "...",
  "phone": "...",
  "authority": "CUSTOMER_USER",
  "customerId": { "id": "{customerId}", "entityType": "CUSTOMER" },
  "tenantId":   { "id": "{tenantId}",   "entityType": "TENANT" },
  "additionalInfo": { "description": "..." }
}
```

### Comportamento extra

- Integração com RFC-0194: se `window.MyIOOrchestrator?.defaultDashboardId` está
  disponível, inclui `defaultDashboardId` no payload do usuário
- Após criação com sucesso: exibe toast, reseta o formulário, muda para tab
  `user-list` e destaca a linha do novo usuário

---

## Tab 3 — Profile Management (`ProfileManagementTab`)

**Leitura apenas.** Exibe os grupos de entidades do tipo `USER` cadastrados no
ThingsBoard para o tenant atual.

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

### API

```
GET /api/entityGroups/CUSTOMER/{customerId}/USER
    Authorization: Bearer {jwtToken}
```

Trata graciosamente 403/404 (nem todas as edições do TB suportam entity groups).

---

## Tab 4 — Group Management (`GroupManagementTab`) ★ NOVO

> Não previsto na RFC-0190 original. Integra gestão de canais de notificação e
> grupos de despacho via **GCDR API**.

Organizado em dois sub-tabs:

### Sub-tab A — Canais

Lista e gerencia canais de notificação suportados:

| Tipo | Descrição |
|------|-----------|
| `EMAIL_RELAY` | Relay de e-mail |
| `TELEGRAM` | Bot Telegram |
| `WHATSAPP` | WhatsApp Business |
| `WEBHOOK` | Webhook HTTP |
| `SMS` | SMS |
| `SLACK` | Slack |
| `TEAMS` | Microsoft Teams |

Ações: listar, criar, editar, excluir canais.
API: `GET/POST/PATCH/DELETE /api/v1/notification-channels` (GCDR).

### Sub-tab B — Grupos

Gerencia grupos de despacho de alarmes com membros e matriz de ações.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Grupo: "Equipe Técnica"           [ + Novo Grupo ]                      │
│──────────────────────────────────────────────────────────────────────────│
│  Membros:                                                                │
│  João Silva    (PRIMARY)   [Canal: Telegram]   [Remover]                 │
│  Maria Santos  (BACKUP)    [Canal: Email]      [Remover]                 │
│                                               [ + Adicionar Membro ]    │
│──────────────────────────────────────────────────────────────────────────│
│  Matriz de Despacho:                                                     │
│              OPEN  ACK  ESCALATE  SNOOZE  CLOSE  STATE_HISTORY           │
│  Telegram    ✅    ✅   ✅        ❌      ✅     ❌                       │
│  Email       ✅    ❌   ✅        ❌      ✅     ✅                       │
└──────────────────────────────────────────────────────────────────────────┘
```

Funções de membro: `PRIMARY`, `BACKUP`, `ESCALATION`.

Ações de alarme na matriz: `OPEN`, `ACK`, `ESCALATE`, `SNOOZE`, `CLOSE`,
`STATE_HISTORY`.

API: `GET/POST/PATCH/DELETE /api/v1/notification-groups` (GCDR).

Credenciais GCDR: `window.MyIOOrchestrator?.gcdrTenantId` + integration API key.

---

## Tab N (Dinâmica) — User Detail (`UserDetailTab`)

Criada sob demanda pelo `UserListTab`. Apenas uma aba por usuário (deduplicada).

### Modo Leitura

```
┌─────────────────────────────────────────────────────────┐
│  Nome       João Silva                                   │
│  Email      joao@cliente.com.br                          │
│  Telefone   +55 11 99999-9999                            │
│  Perfil     CUSTOMER_USER                                │
│  Criado em  10/02/2026                                   │
│─────────────────────────────────────────────────────────│
│         [ Editar ]  [ Redefinir Senha ]  [ Excluir ]     │
└─────────────────────────────────────────────────────────┘
```

### Modo Edição

Mesmos campos em inputs editáveis. Salvar via `POST /api/user` (corpo com `id`).
Após salvar, retorna ao modo leitura e atualiza o rótulo da aba.

### Ações

| Botão | API | Confirmação |
|-------|-----|-------------|
| **Editar** | — (toggle) | Não |
| **Redefinir Senha** | `POST /api/noauth/resetPasswordByEmail { email }` | Sim — diálogo |
| **Excluir** | `DELETE /api/user/{userId}` | Sim — diálogo com nome do usuário |

Após exclusão: fecha a aba dinâmica + recarrega a lista de usuários.

---

## APIs ThingsBoard Usadas (V1)

| Operação | Método + Endpoint | Tab |
|----------|------------------|-----|
| Listar usuários do customer | `GET /api/customer/{id}/users?pageSize=20&page={p}&textSearch={q}` | UserListTab |
| Buscar usuário por ID | `GET /api/user/{userId}` | UserDetailTab |
| Criar usuário | `POST /api/user?sendActivationMail={bool}` | NewUserTab |
| Atualizar usuário | `POST /api/user` (body com `id`) | UserDetailTab |
| Excluir usuário | `DELETE /api/user/{userId}` | UserDetailTab |
| Redefinir senha | `POST /api/noauth/resetPasswordByEmail` | UserDetailTab |
| Listar entity groups | `GET /api/entityGroups/CUSTOMER/{id}/USER` | ProfileManagementTab |

---

## APIs GCDR Usadas (Tab Grupos)

| Operação | Método + Endpoint |
|----------|------------------|
| Listar canais | `GET /api/v1/notification-channels` |
| Criar canal | `POST /api/v1/notification-channels` |
| Editar canal | `PATCH /api/v1/notification-channels/{id}` |
| Excluir canal | `DELETE /api/v1/notification-channels/{id}` |
| Listar grupos | `GET /api/v1/notification-groups` |
| Criar grupo | `POST /api/v1/notification-groups` |
| Editar grupo | `PATCH /api/v1/notification-groups/{id}` |
| Excluir grupo | `DELETE /api/v1/notification-groups/{id}` |

Auth GCDR: `X-API-Key: gcdr_cust_tb_integration_key_2026` + `X-Tenant-ID: {gcdrTenantId}`.

---

## Integração — MENU Widget

```javascript
// MENU/controller.js — showSettingsModal(user)
${isSuperAdmin ? `
<button class="myio-settings-option myio-settings-option--myio" data-action="user-management">
  <span class="myio-settings-option__icon">👥</span>
  <div class="myio-settings-option__text">
    <span class="myio-settings-option__title">Gestão de Usuários</span>
    <span class="myio-settings-option__desc">Usuários e perfis — apenas MyIO</span>
  </div>
</button>` : ''}

// Handler no mesmo arquivo
} else if (action === 'user-management') {
  const jwt = localStorage.getItem('jwt_token') || '';
  const orch = window.MyIOOrchestrator;
  window.MyIOLibrary.openUserManagementModal({
    customerId:   orch?.customerTB_ID || '',
    tenantId:     user.tenantId?.id || '',
    customerName: orch?.customerName || '',
    jwtToken:     jwt,
    tbBaseUrl:    self.ctx.settings?.tbBaseUrl || '',
    currentUser:  {
      id: user.id?.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
}
```

---

## Exports Públicos (`src/index.ts`)

```typescript
export { openUserManagementModal } from './components/premium-modals/user-management';
export type {
  OpenUserManagementParams,
  TBUser,
  TBUserPage,
  TBCurrentUser,
  UserManagementConfig,
} from './components/premium-modals/user-management';
```

---

## Decisões de Implementação

### Por que tab dinâmica para detalhe de usuário?

Permite abrir múltiplos usuários em paralelo sem perder o contexto da lista,
seguindo o padrão de IDEs (abas fecháveis). A deduplicação (ativar aba
existente em vez de abrir nova) evita proliferação de abas.

### Por que tab separada para Grupos GCDR?

O "Perfis" original do Proposed cobria apenas grupos do TB (entidade `USER_GROUP`).
Na prática, o sistema de alarmes usa canais e grupos de despacho no GCDR — um
conceito diferente. Separar em duas abas (Perfis = TB, Grupos = GCDR) mantém a
separação de responsabilidades.

### Por que toast interno e não `MyIOToast`?

A modal existe num overlay no `document.body` a z-index 99999. O `MyIOToast` global
pode aparecer abaixo da modal. Toast interno garante visibilidade correta.

---

## Perguntas em Aberto (V2)

1. Permitir ao operator selecionar a `authority` (`CUSTOMER_USER` vs `TENANT_ADMIN`)
   ao criar usuário, ou sempre `CUSTOMER_USER`?
2. "Excluir" deve ser hard delete (`DELETE /api/user/{id}`) ou disable credentials
   (`POST /api/user/{id}/userCredentialsEnabled?userCredentialsEnabled=false`)?
3. Edição inline de membros de grupos TB (`USER_GROUP`) — incluir em V2?
4. Audit trail por usuário (`GET /api/audit/logs/user/{userId}`) como sub-tab em
   `UserDetailTab` — V2?
5. Expandir acesso para SuperAdmin Holding após validação de UX?
