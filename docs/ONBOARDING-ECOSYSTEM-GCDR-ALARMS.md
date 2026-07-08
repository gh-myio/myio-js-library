# Manual de Onboarding - Ecossistema GCDR x Alarmes

Bem-vindo ao time! Este manual consolida o conhecimento sobre o ecossistema integrado **GCDR** (Global Central Data Registry) e o **Alarm Orchestrator**, dois sistemas que trabalham em conjunto para fornecer uma solução completa de monitoramento e notificação.

## Sumário

1. [Visão Geral do Ecossistema](#1-visão-geral-do-ecossistema)
2. [GCDR: A Fonte Única da Verdade](#2-gcdr-a-fonte-única-da-verdade)
3. [Alarm Orchestrator: O Cérebro das Notificações](#3-alarm-orchestrator-o-cérebro-das-notificações)
4. [Integração GCDR x Alarmes](#4-integração-gcdr-x-alarmes)
5. [Arquitetura Consolidada](#5-arquitetura-consolidada)
6. [Fluxo de Dados End-to-End](#6-fluxo-de-dados-end-to-end)
7. [Camada de Dashboard (myio-js-library)](#7-camada-de-dashboard-myio-js-library)
8. [Configuração do Ambiente](#8-configuração-do-ambiente)
9. [Stack Tecnológica](#9-stack-tecnológica)
10. [Padrões e Convenções](#10-padrões-e-convenções)
11. [Checklist de Onboarding](#11-checklist-de-onboarding)

---

## 1. Visão Geral do Ecossistema

### O Problema que Resolvemos

O ecossistema MYIO monitora milhares de dispositivos (sensores de temperatura, medidores de energia, hidrômetros) em shopping centers. Quando algo está errado (temperatura alta, consumo anormal, sensor offline), precisamos:

1. **Saber QUEM notificar** → Isso vem do **GCDR**
2. **Decidir SE e COMO notificar** → Isso é feito pelo **Alarm Orchestrator**

### Os Dois Pilares

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           ECOSSISTEMA MYIO                                      │
│                                                                                 │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────┐    │
│  │                                 │    │                                 │    │
│  │            GCDR                 │    │      ALARM ORCHESTRATOR         │    │
│  │   (Global Central Data Registry)│    │                                 │    │
│  │                                 │    │                                 │    │
│  │  "Quem são os clientes?"        │    │  "Quando e como notificar?"     │    │
│  │  "Quem deve ser notificado?"    │    │  "Quais regras aplicar?"        │    │
│  │  "Quais as hierarquias?"        │    │  "Evitar alert fatigue?"        │    │
│  │  "Quais as configurações?"      │    │  "Enviar para qual canal?"      │    │
│  │                                 │    │                                 │    │
│  │         ARMAZENA                │◄──►│          PROCESSA               │    │
│  │     (Single Source of Truth)    │    │     (Decision Engine)           │    │
│  │                                 │    │                                 │    │
│  └─────────────────────────────────┘    └─────────────────────────────────┘    │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. GCDR: A Fonte Única da Verdade

### O que é o GCDR?

O **GCDR (Global Central Data Registry)** é o **Single Source of Truth** para todos os dados mestres do ecossistema MYIO. Ele centraliza:

| Dado | Descrição | Exemplo |
|------|-----------|---------|
| **Clientes** | Hierarquia completa (Holding → Empresa → Filial) | "Shopping Iguatemi SP" é filial de "Iguatemi S.A." |
| **Ativos** | Edifícios, andares, salas, áreas | "Praça de Alimentação - 3º Andar" |
| **Dispositivos** | Sensores, medidores, termostatos | "Termostato HVAC - Loja 42" |
| **Regras** | Configurações de alarme por cliente/domínio | "Temperatura crítica acima de 30°C" |
| **Grupos de Notificação** | Quem recebe alertas de quê | "Grupo Manutenção Shopping Norte" |
| **Parceiros** | Integradores externos com acesso via API | "Empresa XYZ - Integração Energia" |

### Por que o GCDR é Essencial?

Sem o GCDR, cada sistema (ThingsBoard, Alarm Orchestrator, Dashboard) manteria sua própria versão dos dados:

```
❌ ANTES (Sem GCDR)                    ✅ DEPOIS (Com GCDR)
┌─────────────┐                        ┌─────────────┐
│ ThingsBoard │──Cliente: "Iguatemi"   │             │
└─────────────┘                        │    GCDR     │
┌─────────────┐                        │   (Único)   │
│   Alarmes   │──Cliente: "IGUATEMI"   │             │
└─────────────┘                        │  "Iguatemi" │
┌─────────────┐                        │             │
│  Dashboard  │──Cliente: "iguatemi"   └──────┬──────┘
└─────────────┘                               │
                                        ┌─────▼─────┐
DIVERGÊNCIA! Qual nome está certo?      │  Todos    │
                                        │  usam a   │
                                        │  mesma    │
                                        │  fonte    │
                                        └───────────┘
```

### Hierarquia de Clientes no GCDR

O GCDR mantém a estrutura hierárquica completa:

```
Tenant (MYIO)
└── Holding (Iguatemi S.A.)
    ├── Empresa (Iguatemi São Paulo)
    │   ├── Filial (Shopping JK Iguatemi)
    │   └── Filial (Shopping Market Place)
    └── Empresa (Iguatemi Rio)
        ├── Filial (Shopping Iguatemi Rio)
        └── Filial (BarraShopping)
```

Cada nível herda configurações e pode ter suas próprias personalizações:

```typescript
interface Customer {
  id: string;
  tenantId: string;
  parentCustomerId: string | null;  // Referência ao pai
  path: string;                     // "/tenant/holding/empresa/filial"
  depth: number;                    // Nível na árvore (0=root)
  type: 'HOLDING' | 'COMPANY' | 'BRANCH' | 'FRANCHISE';
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}
```

### Grupos de Notificação

O GCDR define QUEM recebe notificações:

```typescript
interface NotificationGroup {
  id: string;
  customerId: string;           // A qual cliente pertence
  name: string;                 // "Manutenção Noturna"
  domain: 'energy' | 'water' | 'temperature';
  severity: 'critical' | 'high' | 'medium' | 'low';
  members: GroupMember[];       // Lista de destinatários
  channels: ('telegram' | 'email' | 'workorder' | 'webhook')[];
}

interface GroupMember {
  userId: string;
  name: string;
  email: string;
  telegramChatId?: string;
  role: 'PRIMARY' | 'BACKUP' | 'ESCALATION';
}
```

---

## 3. Alarm Orchestrator: O Cérebro das Notificações

### O que é o Alarm Orchestrator?

O **Alarm Orchestrator** é o serviço que processa eventos de alarme e decide:

1. **Se deve notificar** (ou ignorar, agrupar, suprimir)
2. **Quem notificar** (baseado nos grupos do GCDR)
3. **Como notificar** (Telegram, ordem de serviço, webhook)
4. **Quando notificar** (imediato, agrupado, escalado)

### Por que ele existe?

Sem o Orchestrator, cada alarme geraria uma notificação imediata, causando:

- **Alert Fatigue**: 100 notificações/dia = pessoas ignoram tudo
- **Duplicatas**: Sensor flapping gera 50 alertas em 5 minutos
- **Falta de Contexto**: "Temperatura alta" sem dizer onde, desde quando, quem atendeu

### O Decision Engine

O coração do Orchestrator é o **Decision Engine** com seus **Guards**:

```
┌────────────────────────────────────────────────────────────────────┐
│                        DECISION ENGINE                              │
│                                                                     │
│   Evento de Alarme                                                  │
│        │                                                            │
│        ▼                                                            │
│   ┌─────────────────┐                                               │
│   │   DedupGuard    │──► Já existe alarme ativo? → SUPPRESS         │
│   └────────┬────────┘                                               │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │  SilencedGuard  │──► Alarme silenciado? → SUPPRESS              │
│   └────────┬────────┘                                               │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │  CooldownGuard  │──► Notificado nos últimos X min? → SUPPRESS   │
│   └────────┬────────┘                                               │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │ HysteresisGuard │──► Sensor oscilando (flapping)? → SUPPRESS    │
│   └────────┬────────┘                                               │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │MaintenanceGuard │──► Equipamento em manutenção? → SUPPRESS      │
│   └────────┬────────┘                                               │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │   DigestGuard   │──► Agrupar em resumo periódico? → DIGEST      │
│   └────────┬────────┘                                               │
│            ▼                                                        │
│      Todos permitiram?                                              │
│            │                                                        │
│            ▼                                                        │
│       ACTION: OPEN                                                  │
│    (Criar alarme e notificar)                                       │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### Canais de Dispatch

O Orchestrator envia notificações por múltiplos canais:

| Canal | Uso | Formato |
|-------|-----|---------|
| **Telegram** | Alertas imediatos para equipe de plantão | Mensagem formatada com markdown |
| **WorkOrder** | Criação automática de ordem de serviço | Integração com sistema de OS |
| **Webhook** | Integração com sistemas externos | JSON padronizado |
| **Email** | Notificações formais e relatórios | HTML template |

---

## 4. Integração GCDR x Alarmes

### Como os Sistemas Conversam?

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FLUXO DE INTEGRAÇÃO                                 │
│                                                                                  │
│   ┌──────────┐         ┌──────────┐         ┌──────────────────┐                │
│   │ThingsBoard│────────►│   SQS    │────────►│ ALARM ORCHESTRATOR│               │
│   │ (Evento)  │         │ (Queue)  │         │                   │               │
│   └──────────┘         └──────────┘         └─────────┬─────────┘               │
│                                                       │                          │
│   "Temperatura 35°C no                       ┌───────▼───────┐                   │
│    Sensor X do Shopping Y"                   │ RULE RESOLVER │                   │
│                                              └───────┬───────┘                   │
│                                                      │                           │
│                                         ┌────────────▼────────────┐              │
│                                         │         GCDR            │              │
│                                         │                         │              │
│                                         │ 1. Busca Customer       │              │
│                                         │    (Shopping Y)         │              │
│                                         │                         │              │
│                                         │ 2. Busca Regras         │              │
│                                         │    (temp > 30 = CRITICAL)│             │
│                                         │                         │              │
│                                         │ 3. Busca Grupo          │              │
│                                         │    (Quem notificar)     │              │
│                                         │                         │              │
│                                         └────────────┬────────────┘              │
│                                                      │                           │
│                                         ┌────────────▼────────────┐              │
│                                         │    DECISION ENGINE      │              │
│                                         │    (Guards avaliam)     │              │
│                                         └────────────┬────────────┘              │
│                                                      │                           │
│                                         ┌────────────▼────────────┐              │
│                                         │      DISPATCHER         │              │
│                                         │                         │              │
│                                         │  ┌─────┐ ┌─────┐ ┌─────┐│              │
│                                         │  │ TG  │ │ OS  │ │ WH  ││              │
│                                         │  └──┬──┘ └──┬──┘ └──┬──┘│              │
│                                         └─────┼──────┼──────┼─────┘              │
│                                               │      │      │                    │
│                                               ▼      ▼      ▼                    │
│                                         Telegram  WorkOrder  Webhook             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### O Papel do GCDR na Decisão de Alarmes

O Alarm Orchestrator consulta o GCDR para obter:

#### 1. Informações do Cliente
```typescript
// Orchestrator busca no GCDR
const customer = await gcdrClient.getCustomer(event.customerId);
// {
//   id: "shopping-jk",
//   name: "Shopping JK Iguatemi",
//   path: "/myio/iguatemi-sa/iguatemi-sp/shopping-jk",
//   timezone: "America/Sao_Paulo",
//   businessHours: { start: "06:00", end: "22:00" }
// }
```

#### 2. Regras de Alarme
```typescript
// Orchestrator busca regras específicas do cliente/domínio
const rules = await gcdrClient.getAlarmRules({
  customerId: "shopping-jk",
  domain: "temperature",
  alarmType: "HIGH_TEMPERATURE"
});
// {
//   severity: "CRITICAL",
//   threshold: 30,
//   cooldownMinutes: 15,
//   escalationAfterMinutes: 60,
//   notificationGroupId: "group-manutencao-jk"
// }
```

#### 3. Grupo de Notificação
```typescript
// Orchestrator busca destinatários
const group = await gcdrClient.getNotificationGroup("group-manutencao-jk");
// {
//   name: "Manutenção JK",
//   members: [
//     { name: "João Silva", telegramChatId: "12345", role: "PRIMARY" },
//     { name: "Maria Santos", email: "maria@jk.com", role: "BACKUP" }
//   ],
//   channels: ["telegram", "workorder"],
//   escalationGroupId: "group-gerencia-iguatemi"
// }
```

### Eventos entre Sistemas

O GCDR emite eventos via EventBridge quando dados mudam:

| Evento GCDR | Impacto no Orchestrator |
|-------------|-------------------------|
| `customer.updated` | Atualiza cache de cliente |
| `customer.suspended` | Para de processar alarmes desse cliente |
| `rule.updated` | Atualiza regras de decisão |
| `group.updated` | Atualiza lista de destinatários |
| `group.deleted` | Remove referência, usa fallback |

---

## 5. Arquitetura Consolidada

### Visão Completa do Ecossistema

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ECOSSISTEMA MYIO COMPLETO                                     │
│                                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                    CAMADA DE DADOS                                          │  │
│  │                                                                                             │  │
│  │  ┌──────────────────────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                               GCDR (Backend)                                          │ │  │
│  │  │                         AWS Lambda + API Gateway + DynamoDB                           │ │  │
│  │  │                                                                                       │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │ │  │
│  │  │  │ Customers  │  │  Partners  │  │   Rules    │  │   Groups   │  │   Assets   │     │ │  │
│  │  │  │ (Clientes) │  │(Parceiros) │  │  (Regras)  │  │(Notificação)│ │  (Ativos)  │     │ │  │
│  │  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │ │  │
│  │  │                                                                                       │ │  │
│  │  └───────────────────────────────────────┬───────────────────────────────────────────────┘ │  │
│  │                                          │                                                 │  │
│  │                                   EventBridge                                              │  │
│  │                                          │                                                 │  │
│  └──────────────────────────────────────────┼─────────────────────────────────────────────────┘  │
│                                             │                                                    │
│  ┌──────────────────────────────────────────┼─────────────────────────────────────────────────┐  │
│  │                              CAMADA DE PROCESSAMENTO                                        │  │
│  │                                          │                                                  │  │
│  │  ┌───────────────────────────────────────┼───────────────────────────────────────────────┐ │  │
│  │  │                        ALARM ORCHESTRATOR (Backend)                                    │ │  │
│  │  │                       Node.js + Fastify + DynamoDB + SQS                               │ │  │
│  │  │                                       │                                                │ │  │
│  │  │   ┌────────────────┐           ┌──────▼──────┐           ┌────────────────┐           │ │  │
│  │  │   │ SQS Consumer   │           │  Decision   │           │   Dispatcher   │           │ │  │
│  │  │   │ (Eventos)      │──────────►│   Engine    │──────────►│   (Notifica)   │           │ │  │
│  │  │   └────────────────┘           │             │           └───────┬────────┘           │ │  │
│  │  │                                │  ┌───────┐  │                   │                    │ │  │
│  │  │                                │  │Guards │  │         ┌────────┼────────┐            │ │  │
│  │  │                                │  └───────┘  │         ▼        ▼        ▼            │ │  │
│  │  │                                └─────────────┘      Telegram  WorkOrder  Webhook      │ │  │
│  │  │                                                                                        │ │  │
│  │  └────────────────────────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                                             │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                  CAMADA DE APRESENTAÇÃO                                      │  │
│  │                                                                                              │  │
│  │  ┌────────────────────────────┐           ┌────────────────────────────┐                    │  │
│  │  │      GCDR Frontend         │           │   Alarm Console Frontend   │                    │  │
│  │  │   React + Vite + Tailwind  │           │  Next.js + shadcn + Zustand │                   │  │
│  │  │                            │           │                             │                    │  │
│  │  │  - Gestão de Clientes      │           │  - Dashboard de Alarmes     │                    │  │
│  │  │  - Configuração de Regras  │           │  - Ack/Snooze/Escalate      │                    │  │
│  │  │  - Grupos de Notificação   │           │  - Timeline de Eventos      │                    │  │
│  │  │  - Marketplace de Partners │           │  - Métricas e Analytics     │                    │  │
│  │  │                            │           │                             │                    │  │
│  │  └────────────────────────────┘           └────────────────────────────┘                    │  │
│  │                                                                                              │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Repositórios do Ecossistema

| Repositório | Descrição | Porta Local |
|-------------|-----------|-------------|
| `gcdr.git` | GCDR Backend (API Serverless) | `:3000` |
| `gcdr-frontend.git` | GCDR Frontend (React/Vite) | `:5173` |
| `alarms-backend.git` | Alarm Orchestrator Backend (Fastify) | `:3000` |
| `alarms-frontend.git` | Alarm Console Frontend (Next.js) | `:3010` |

---

## 6. Fluxo de Dados End-to-End

### Exemplo: Alarme de Temperatura Alta

```
1. DISPOSITIVO
   ThingsBoard detecta: Sensor "TEMP-JK-PA-001" = 35°C

2. PROCESSADOR DE TELEMETRIA
   Compara com threshold (30°C) → Gera AlarmCandidateRaised
   Envia para SQS: alarm-events-queue

3. ALARM ORCHESTRATOR
   ├─ Consome mensagem do SQS
   │
   ├─ RULE RESOLVER → Consulta GCDR
   │   └─ GET /rules?customerId=shopping-jk&domain=temperature
   │   └─ Retorna: { severity: "CRITICAL", cooldown: 15min, groupId: "grp-001" }
   │
   ├─ DECISION ENGINE
   │   ├─ DedupGuard: Não há alarme ativo para este sensor ✓
   │   ├─ CooldownGuard: Última notificação há 2 horas ✓
   │   ├─ HysteresisGuard: Sensor estável (não flapping) ✓
   │   └─ DECISÃO: OPEN
   │
   ├─ PERSISTÊNCIA
   │   └─ Cria registro no DynamoDB
   │       {
   │         id: "alarm-20240115-001",
   │         state: "OPEN",
   │         severity: "CRITICAL",
   │         ...
   │       }
   │
   └─ DISPATCH
       ├─ Consulta GCDR: GET /groups/grp-001
       │   └─ Retorna: { channels: ["telegram", "workorder"], members: [...] }
       │
       ├─ Telegram
       │   └─ Envia mensagem para Chat ID 12345
       │       "🔴 CRÍTICO: Temperatura Alta
       │        📍 Shopping JK - Praça de Alimentação
       │        🌡️ Valor: 35°C (Limite: 30°C)
       │        ⏰ 15/01/2024 14:32"
       │
       └─ WorkOrder
           └─ Cria OS no sistema
               {
                 type: "PREVENTIVE",
                 priority: "HIGH",
                 description: "Verificar sistema HVAC..."
               }

4. ALARM CONSOLE (Frontend)
   └─ Operador visualiza alarme no dashboard
   └─ Clica "Acknowledge"
   └─ POST /alarms/alarm-20240115-001/ack
   └─ Estado muda para ACKNOWLEDGED
   └─ Grupo é notificado do ack
```

---

## 7. Camada de Dashboard (myio-js-library)

A biblioteca `myio-js-library` é a **camada de apresentação** que integra os dados de alarmes
do ecossistema GCDR diretamente nos dashboards ThingsBoard.

### `window.AlarmServiceOrchestrator` (RFC-0183)

Criado no widget `MAIN_VIEW` após o prefetch de alarmes (`_prefetchCustomerAlarms`):

```javascript
window.AlarmServiceOrchestrator = {
  alarms,            // GCDRAlarm[] — array bruto completo do customer
  deviceAlarmMap,    // Map<gcdrDeviceId, GCDRAlarm[]>
  deviceAlarmTypes,  // Map<gcdrDeviceId, Set<alarmType>>

  getAlarmCountForDevice(gcdrDeviceId),  // → number
  getAlarmsForDevice(gcdrDeviceId),      // → GCDRAlarm[]
  getAlarmTypesForDevice(gcdrDeviceId),  // → Set<string>
  async refresh(),                       // re-fetcha e reconstrói os mapas
};
```

A chave de ligação entre ThingsBoard e GCDR é o atributo `gcdrDeviceId`:

```
ThingsBoard device attr: gcdrDeviceId = "gcdr-uuid-xxx"
    ↓  ctx.data → MAIN_VIEW buildMetadataMapFromCtxData
    ↓  createOrchestratorItem → window.STATE items
    ↓  TELEMETRY STATE.itemsBase
    ↓
addAlarmBadge(cardElement, gcdrDeviceId) → AlarmServiceOrchestrator lookup → badge
```

### Alarm Badge nos Device Cards

Badge vermelho (🔴 sino + contador) injetado sobre cada card com alarmes ativos:

| Widget | Função | Onde |
|--------|--------|------|
| TELEMETRY v5.2.0 | `addAlarmBadge(cardElement, gcdrDeviceId)` | Após `addAnnotationIndicator()` |
| TelemetryGridShoppingView (v5.4.0) | `_createAlarmBadge(count)` | Após `wrapper.appendChild(card)` |

CSS: `.myio-alarm-badge { position: absolute; top: 6px; left: 6px; background: #dc2626 }`

### AlarmsTab — Aba de Alarmes no SettingsModal

Localização: `src/components/premium-modals/settings/alarms/AlarmsTab.ts`

**Fonte de dados** (prioridade):
1. `AlarmServiceOrchestrator.getAlarmsForDevice(gcdrDeviceId)` — pré-fetchados (zero latência)
2. `config.prefetchedAlarms` filtrados por `deviceId`
3. `fetchActiveAlarms(alarmsBaseUrl)` — chamada à API (fallback)

**Ações** (com fallback):
- `batchAcknowledge` / `batchSilence('4h')` / `batchEscalate` via `window.MyIOLibrary.AlarmService`
- Após ação: `AlarmServiceOrchestrator.refresh()` reconstrói os mapas

### AllReportModal — Filtro API-driven por grupo (RFC-0182)

Quando o MENU abre um relatório de grupo (ex.: `temperature > climatizavel`), o AllReportModal
recebe um `itemsList` com os `ingestionId`s do orquestrador. A API retorna **todos** os devices
do customer (ex.: 99 mistos), mas apenas os que fazem match com `orchIdSet` são renderizados:

```
Menu clica "Ambientes Climatizáveis"
    ↓  _buildItemsList('temperature', 'climatizavel') → 13 ingestionIds
    ↓  openDashboardPopupAllReport({ itemsList: [13 items] })
    ↓  API retorna 99 devices (temperature + water misturados)
    ↓  mapCustomerTotalsResponse: filtra por orchIdSet → 13 devices ✓
```

### Globals do Dashboard Relevantes para Alarmes

| Global | Quem cria | O que contém |
|--------|-----------|--------------|
| `window.MyIOOrchestrator.customerAlarms` | MAIN_VIEW `_prefetchCustomerAlarms()` | Array bruto de GCDRAlarm[] |
| `window.AlarmServiceOrchestrator` | MAIN_VIEW `_buildAlarmServiceOrchestrator()` | Mapas device×alarme + métodos |
| `window.MyIOOrchestrator.gcdrCustomerId` | MAIN_VIEW onInit | UUID do customer no GCDR |
| `window.MyIOOrchestrator.gcdrTenantId` | MAIN_VIEW onInit | UUID do tenant no GCDR |
| `window.MyIOOrchestrator.alarmsApiBaseUrl` | MAIN_VIEW onInit | Ex.: `https://alarms-api.a.myio-bas.com` |

### RFCs Relevantes do Dashboard

| RFC | Título |
|-----|--------|
| RFC-0180 | NewAlarmsTab — aba de alarmes no SettingsModal |
| RFC-0181 | ReportsMenuItem — botões de relatório no menu |
| RFC-0182 | OrchestratorGroupClassification — classificação de grupos |
| RFC-0183 | AlarmServiceOrchestrator + AlarmBadge nos device cards |

---

## 8. Configuração do Ambiente

### Setup Completo (Todos os Serviços)

```bash
# 1. Clone todos os repositórios
git clone https://github.com/gh-myio/gcdr.git
git clone https://github.com/gh-myio/gcdr-frontend.git
git clone https://github.com/gh-myio/alarms-backend.git
git clone https://github.com/gh-myio/alarms-frontend.git

# 2. Setup GCDR Backend
cd gcdr
npm install
npm run offline  # Porta 3000

# 3. Setup GCDR Frontend (novo terminal)
cd gcdr-frontend
npm install
npm run dev      # Porta 5173

# 4. Setup Alarm Orchestrator Backend (novo terminal)
cd alarms-backend
pnpm install
docker-compose -f docker/docker-compose.yml up -d  # DynamoDB local
pnpm setup:local
pnpm dev         # Porta 3000 (cuidado: conflito com GCDR!)

# 5. Setup Alarm Console Frontend (novo terminal)
cd alarms-frontend
npm install
npm run dev      # Porta 3010
```

### Portas e URLs de Desenvolvimento

| Serviço | URL Local | Descrição |
|---------|-----------|-----------|
| GCDR Backend | `http://localhost:3000/dev` | API REST Serverless |
| GCDR Frontend | `http://localhost:5173` | Interface de gestão |
| Alarms Backend | `http://localhost:3001`* | API REST Fastify |
| Alarms Console | `http://localhost:3010` | Dashboard de alarmes |

*Configure porta diferente para evitar conflito com GCDR

### Variáveis de Ambiente Importantes

```bash
# GCDR Backend (.env)
NODE_ENV=development
AWS_REGION=us-east-1
DYNAMODB_ENDPOINT=http://localhost:8000

# Alarms Backend (.env)
NODE_ENV=development
PORT=3001
GCDR_API_URL=http://localhost:3000/dev  # Conecta ao GCDR!
ENABLE_TELEGRAM_DISPATCH=false
ENABLE_WORKORDER_DISPATCH=false

# Alarms Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GCDR_URL=http://localhost:3000/dev
```

---

## 9. Stack Tecnológica

### Comparativo das Tecnologias

| Aspecto | GCDR Backend | Alarms Backend | GCDR Frontend | Alarms Frontend |
|---------|--------------|----------------|---------------|-----------------|
| **Runtime** | Node.js 20 | Node.js 20 | - | - |
| **Framework** | Serverless + Lambda | Fastify 5 | React 18 + Vite | Next.js 14 |
| **Linguagem** | TypeScript 5 | TypeScript 5 | TypeScript 5 | TypeScript 5 |
| **Database** | DynamoDB | DynamoDB | - | - |
| **Messaging** | EventBridge | SQS | - | WebSocket |
| **Validação** | Zod | Zod | Zod | Zod |
| **Estilização** | - | - | Tailwind CSS | Tailwind + shadcn/ui |
| **Estado** | - | - | React hooks | Zustand + TanStack Query |
| **Testes** | Jest | Vitest | Vitest | Vitest/Playwright |
| **Pacotes** | npm | pnpm | npm | npm |

### Padrões Arquiteturais

| Sistema | Padrão | Descrição |
|---------|--------|-----------|
| GCDR Backend | Ports & Adapters | Domain isolado de infraestrutura |
| Alarms Backend | Ports & Adapters | Guards plugáveis, canais extensíveis |
| Frontends | Component-based | Componentes reutilizáveis |

---

## 10. Padrões e Convenções

### Convenções Comuns a Todos os Projetos

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Arquivos | kebab-case | `alarm-repository.ts` |
| Classes | PascalCase | `AlarmRepository` |
| Interfaces | PascalCase (com I no backend) | `IAlarmRepository`, `Alarm` |
| Funções | camelCase | `findByDedupKey()` |
| Constantes | SCREAMING_SNAKE | `DEFAULT_PAGE_SIZE` |
| Tipos | PascalCase | `AlarmState`, `CustomerType` |
| Hooks | camelCase com use | `useAlarms`, `useCustomers` |
| Componentes | PascalCase | `AlarmCard`, `CustomerList` |

### Commit Messages (Conventional Commits)

```bash
feat: add customer hierarchy endpoint
fix: resolve dedup guard false positives
docs: update onboarding guide
refactor: extract rule resolver to separate module
test: add unit tests for decision engine
chore: update dependencies
```

### Estrutura de Branches

```bash
main           # Produção
develop        # Desenvolvimento
feature/*      # Novas features
fix/*          # Correções
hotfix/*       # Correções urgentes em produção
```

---

## 11. Checklist de Onboarding

### Fase 1: Entendimento Conceitual

- [ ] Leu este documento completamente
- [ ] Entendeu a diferença entre GCDR (armazena) e Alarms (processa)
- [ ] Compreendeu o fluxo end-to-end de um alarme
- [ ] Sabe explicar o que são Guards e por que existem
- [ ] Entende a hierarquia de clientes no GCDR

### Fase 2: Setup do Ambiente

- [ ] Node.js 20 instalado (`node --version`)
- [ ] pnpm instalado (`pnpm --version`)
- [ ] Docker instalado (`docker --version`)
- [ ] AWS CLI configurado (`aws --version`)
- [ ] Todos os 4 repositórios clonados

### Fase 3: GCDR

- [ ] GCDR Backend rodando (`npm run offline`)
- [ ] Testou `curl http://localhost:3000/dev/health`
- [ ] GCDR Frontend rodando (`npm run dev`)
- [ ] Acessou http://localhost:5173
- [ ] Navegou pelas telas de Customers, Groups, Rules

### Fase 4: Alarm Orchestrator

- [ ] DynamoDB local rodando (`docker ps`)
- [ ] Alarms Backend rodando (`pnpm dev`)
- [ ] Testou `curl http://localhost:3001/health`
- [ ] Alarms Frontend rodando (`npm run dev`)
- [ ] Acessou http://localhost:3010
- [ ] Navegou pelo dashboard e lista de alarmes

### Fase 5: Integração

- [ ] Entendeu como Alarms busca dados do GCDR
- [ ] Executou os testes de cada projeto
- [ ] Fez uma alteração simples em cada projeto
- [ ] Criou pelo menos um PR (mesmo que pequeno)

### Fase 6: Aprofundamento

- [ ] Leu os RFCs de cada projeto
- [ ] Estudou o código do Decision Engine
- [ ] Estudou a estrutura de Customer no GCDR
- [ ] Entendeu os eventos do EventBridge
- [ ] Configurou debugging no VS Code

### Fase 7: Dashboard (myio-js-library)

- [ ] Entendeu o papel do `window.AlarmServiceOrchestrator` (RFC-0183)
- [ ] Sabe identificar um device card com alarm badge
- [ ] Verificou `window.AlarmServiceOrchestrator.deviceAlarmMap` no console do showcase
- [ ] Abriu a `AlarmsTab` de um device com `gcdrDeviceId` válido
- [ ] Testou o AllReportModal com `itemsList` filtrado (RFC-0182)
- [ ] Leu RFC-0180, RFC-0181, RFC-0182, RFC-0183

---

## Recursos Adicionais

### Documentação dos Projetos

| Projeto | Onboarding | RFC Principal |
|---------|------------|---------------|
| GCDR Backend | [ONBOARDING.md](../../gcdr/docs/ONBOARDING.md) | RFC-0001, RFC-0002 |
| GCDR Frontend | [ONBOARDING.md](../../gcdr-frontend/docs/ONBOARDING.md) | - |
| Alarms Backend | [ONBOARDING.md](../../alarms-backend/docs/ONBOARDING.md) | RFC.md |
| Alarms Frontend | [ONBOARDING.md](../../alarms-frontend/docs/ONBOARDING.md) | - |

### Contatos

- **Tech Lead**: Rodrigo Lago - rodrigo@myio.com.br
- **Dev Team**: #dev (Slack)
- **Suporte Infra**: #infra (Slack)

---

**Bem-vindo ao ecossistema GCDR x Alarmes!**

O GCDR é a **fundação** - ele sabe tudo sobre clientes, regras e quem notificar.
O Alarm Orchestrator é o **cérebro** - ele decide quando e como agir.

Juntos, eles garantem que as pessoas certas sejam notificadas da forma certa, no momento certo.
