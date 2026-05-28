# RFC-0203 — Header Annotations Button (Painel Cross-Domain de Anotações)

| Campo | Valor |
|-------|-------|
| **Status** | Approved — Ready for Implementation |
| **Autor** | Paige (Tech Writer) — autoria coletiva BMAD roundtable |
| **Mesa (roundtable)** | John (PM), Sally (UX), Winston (Architect), Amelia (Dev), Mary (Analyst), Paige (Doc) |
| **Data** | 2026-05-27 |
| **Versão alvo** | `0.1.414` |
| **Widget alvo** | `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/` |
| **RFCs relacionados** | RFC-0180 (AnnotationsTab), RFC-0181 (ReportsMenuItem), RFC-0183 (AlarmServiceOrchestrator), RFC-0199 (MyIOAuthContext — futuro), RFC-0201 (v-5.4.0 sync) |
| **Escopo de release** | v1 single-shot (sem faseamento — decisão explícita do PO) |
| **Estimativa** | ~2.760 LOC, 95% coverage target em services |

---

## 1. Resumo Executivo

Adicionar um terceiro botão de notificação ao `HEADER` do widget Shopping v-5.2.0 — **Anotações** (📋, ametista `#6c5ce7`) — que exibe todas as anotações operacionais (`log_annotations`) de **todos os devices do Customer**, atravessando os três domínios (energy, water, temperature) em um único painel.

O botão espelha estruturalmente os já existentes `AlarmNotificationTooltip` 🔔 (vermelho) e `TicketNotificationTooltip` 🎫 (azul). O painel oferece três visões organizacionais (Por Identificador / Por Device / Por Domínio), busca, filtros, ordenação, virtual-scroll, e export PDF/CSV — tudo na v1.

**Analogia:** se Alarmes é o "pronto-socorro" (vermelho, urgente, máquina-gerado) e Chamados é o "balcão de atendimento" (azul, formal, ticketing), Anotações é o **caderno de campo do operador** (ametista, contextual, humano-gerado) — onde o time de manutenção escreve, ao longo do tempo, o que precisa de atenção naquela loja, naquele medidor, naquele hidrômetro.

---

## 2. Motivação & Jobs-to-be-Done

### 2.1 Problema atual

Anotações já existem por device (RFC-0180 / `AnnotationsTab`), mas a **única forma de vê-las é abrir o SettingsModal device-por-device**. Não há visão consolidada. Operadores de mall passam por 200+ devices/dia — descobrir "onde tem coisa pendente?" exige cliques manuais em série.

### 2.2 Jobs-to-be-Done

| Persona | Job |
|---------|-----|
| **Operador de manutenção** | "Ao começar o turno, quero ver rapidamente todas as anotações abertas — agrupadas por loja — pra priorizar visitas." |
| **Gerente de mall** | "Quero exportar um PDF mensal com todas as observações registradas pela equipe pra revisar com o síndico." |
| **Analista regional** | "Quero filtrar anotações por tipo `issue` + importância ≥ 4 pra entender pontos de atrito recorrentes entre lojas." |
| **Técnico de campo** | "Ao chegar na loja L-203, quero ver num lugar só as anotações de energia + água + temperatura daquela unidade." |

### 2.3 Não-objetivos

- Não substitui a `AnnotationsTab` do SettingsModal (origem da escrita continua lá).
- Não cria endpoint backend novo — consome `log_annotations` já gravado em SERVER_SCOPE.
- Não implementa RBAC (até RFC-0199 chegar em v-5.2.0, todos veem tudo).
- Não faz polling nem websocket — refresh é manual + event-driven.

---

## 3. Arquitetura

### 3.1 Diagrama de fluxo

```
┌──────────────────────────────────────────────────────────────────────┐
│                      MAIN_VIEW/controller.js                         │
│                                                                      │
│  onInit() {                                                          │
│    ...                                                               │
│    await _prefetchCustomerAnnotations();        ← NOVO (paralelo a   │
│                                                   _prefetchCustomer  │
│                                                   Alarms)            │
│    window.AnnotationServiceOrchestrator =       ← NOVO global        │
│      createAnnotationServiceOrchestrator({...});                     │
│    MyIOOrchestrator.annotationsConfigured = true;                    │
│    window.dispatchEvent(new CustomEvent('myio:annotations-ready'));  │
│  }                                                                   │
└──────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐       ┌──────────────────┐      ┌──────────────────┐
│ HEADER button │       │ TELEMETRY badge  │      │ AnnotationsTab   │
│ (NEW)         │       │ (existing)       │      │ (RFC-0180)       │
│  📋 N         │       │                  │      │ (writes here)    │
└───────┬───────┘       └──────────────────┘      └────────┬─────────┘
        │ click                                            │ on save
        ▼                                                  │
┌─────────────────────────────────────┐                    │
│ HeaderAnnotationsPanel              │                    │
│  ├ Tab: Por Identificador           │                    │
│  ├ Tab: Por Device                  │                    │
│  ├ Tab: Por Domínio                 │                    │
│  ├ Search + Sort + Filters          │                    │
│  ├ Virtual scroll                   │                    │
│  └ Export PDF/CSV                   │                    │
└──────────┬──────────────────────────┘                    │
           │ click item                                    │
           ▼                                               │
window.dispatchEvent('myio:annotation-clicked')            │
           │                                               │
           ▼                                               │
   SettingsModal opens → AnnotationsTab ─────────────────► │
                                                           │
                                                           ▼
                                              dispatchEvent(
                                                'myio:annotation-changed'
                                              )
                                                           │
                                                           ▼
                                          AnnotationServiceOrchestrator
                                                .refresh()
```

### 3.2 Camadas

| Camada | Arquivo | Responsabilidade |
|--------|---------|------------------|
| **Service** | `src/services/annotations/AnnotationServiceOrchestrator.ts` | Fetch + cache + index; expõe `getAll()`, `getByDevice()`, `getByIdentifier()`, `getByDomain()`, `getTotalCount()`, `refresh()` |
| **Service auxiliar** | `src/services/devices/CustomerDeviceService.ts` | TB REST paginado: lista devices do customer + batch SERVER_SCOPE attrs |
| **Component** | `src/components/header-annotations-panel/HeaderAnnotationsPanel.ts` | Painel completo (tabs, search, filtros, virtual-scroll) |
| **Component** | `src/components/header-annotations-panel/AnnotationsExportModal.ts` | Modal pequeno de export (radio PDF/CSV + checkboxes níveis) |
| **Types** | `src/types/annotations.ts` | `Annotation`, `AnnotationGroup`, `AnnotationFilter`, `AnnotationExportOptions` |
| **Integração widget** | `HEADER/template.html`, `HEADER/controller.js` | Botão + tooltip class |
| **Bootstrap** | `MAIN_VIEW/controller.js` | `_prefetchCustomerAnnotations()` + construção do orchestrator |
| **Public API** | `src/index.ts` | Export de `createAnnotationServiceOrchestrator`, `HeaderAnnotationsPanel`, tipos |

### 3.3 Por que serviço dedicado e não reaproveitar `STATE.itemsBase`?

`STATE.itemsBase` contém **apenas os devices do domain corrente do widget** (energy OU water OU temperature). Para mostrar anotações cross-domain, precisamos do conjunto completo dos devices do customer — daí o `CustomerDeviceService` paginado.

**Decisão arquitetural (Winston):** Esse serviço fica útil também pra futuros features cross-domain (ex.: relatório consolidado de tickets, busca global) — vale o custo da abstração.

---

## 4. Especificação UX

### 4.1 Botão no HEADER

**Posição:** `HEADER/template.html`, imediatamente após `#tbx-btn-ticket-notif`.

**Markup base:**

```html
<button
  id="tbx-btn-annotation-notif"
  class="tbx-notif-btn tbx-notif-btn--annotation"
  aria-label="Anotações operacionais"
  aria-haspopup="dialog"
  aria-controls="myio-annotations-panel"
  style="display: none"
>
  <span class="tbx-notif-icon">📋</span>
  <span
    id="tbx-annotation-badge"
    class="tbx-notif-badge"
    aria-live="polite"
    style="display: none"
  >0</span>
</button>
```

**Estilo:**

| Estado | Estilo |
|--------|--------|
| Idle | Background ametista `#6c5ce7`, badge branco com texto ametista |
| Hover | Brightness 1.1, scale(1.05) |
| Badge `count = 0` | `display: none` no `.tbx-notif-badge` |
| Badge `count > 99` | Texto `"99+"` |
| Botão hidden | `display: none` enquanto `MyIOOrchestrator.annotationsConfigured !== true` E `getTotalCount() === 0` |

**aria-label dinâmico:** `"Anotações operacionais: ${pending} pendentes, ${overdue} vencidas"` — recalculado em cada refresh.

### 4.2 Painel (HeaderAnnotationsPanel)

```
┌─────────────────────────────────────────────────────┐
│ 📋 Anotações                              [⤢ 📌 ✕] │ ← header sticky
├─────────────────────────────────────────────────────┤
│ [Por Identificador] [Por Device] [Por Domínio]      │ ← tabs sticky
├─────────────────────────────────────────────────────┤
│ 🔍 [Buscar...]                       [⚙ Filtros ▾]  │
│ Ordenar: [Alfabética ▾]    547 anotações            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ▼ L-203 · Loja Riachuelo                     (3)   │
│     ⚡ Medidor 3F · 2 anotações                     │
│     💧 Hidrômetro · 1 anotação                      │
│                                                     │
│  ▼ L-204 · Loja Havaianas                     (1)   │
│     ⚡ Medidor 3F · 1 anotação                      │
│                                                     │
│  [virtual scroll abaixo de 100 itens]               │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [📥 Exportar ▾]                       [Atualizar ↻] │ ← footer sticky
└─────────────────────────────────────────────────────┘
```

**Dimensões:** width `min(720px, 90vw)`, height `min(80vh, 720px)`. Maximizado: `90vw × 90vh`.

### 4.3 Tabs

| Tab | Ordem default | Agrupamento | Bucket "sem grupo" |
|-----|---------------|-------------|---------------------|
| **Por Identificador** (default) | Alfabética por `identifier` | SERVER_SCOPE `identifier` (cross-domain) | "Sem Identificador" — visível, no topo |
| **Por Device** | Alfabética por device name | Device individual | N/A |
| **Por Domínio** | Energia → Água → Temperatura | `domain` classificado (RFC-0111) | "Indeterminado" — visível, no fim |

Última tab visitada em `sessionStorage["myio.annotations.activeTab"]`. Default: `"identifier"`.

### 4.4 Busca, Sort, Filtros, Export

(Especificação completa em ACs — seção 8. Resumo:)

- **Busca:** debounce 250ms, NFD-normalizada, highlight com `<mark>`
- **Sort:** 6 opções (alpha-asc/desc, count-asc/desc, importance-desc, recent-desc)
- **Filtros:** type, status, importance, "Acionáveis apenas" — AND entre seções, OR dentro
- **Export PDF (jsPDF):** níveis Sumário / Consolidado / Detalhado, combináveis
- **Export CSV:** colunas fixas, BOM UTF-8 pra Excel abrir certo

### 4.5 Click no item

```js
window.dispatchEvent(new CustomEvent('myio:annotation-clicked', {
  detail: { deviceId, annotationId, returnTo: 'header-panel' }
}));
```

Handler abre SettingsModal na aba Annotations. Ao fechar com `returnTo === 'header-panel'`, reabre o painel preservando estado.

### 4.6 Acessibilidade

`role="tablist"`/`tab` + navegação por setas, `aria-live="polite"` no badge, `role="dialog"` no painel, foco retorna ao botão ao fechar, contraste WCAG AA (ametista `#6c5ce7` sobre branco = 4.6:1).

---

## 5. Schema de Dados

> **Errata 2026-05-27 (M2 prep):** os tipos canônicos JÁ existem em
> `src/components/premium-modals/settings/annotations/types.ts` (RFC-0104) e
> estão em produção via TELEMETRY badge + AnnotationsTab. A spec original
> deste RFC listou valores incorretos. A definição CORRETA é:
>
> ```ts
> export type AnnotationType = 'observation' | 'pending' | 'maintenance' | 'activity';
> export type AnnotationStatus = 'created' | 'modified' | 'archived';
> export type ResponseType = 'approved' | 'rejected' | 'comment' | 'archived';
> ```
>
> `'approved' | 'rejected'` são **ResponseType** (campo `responses[]` da annotation),
> NÃO `AnnotationStatus`. AC-25 ajustado abaixo (§8.4) pra refletir isso.

```ts
// src/services/annotations/types.ts (re-exporta de premium-modals/settings/annotations/types.ts)

export interface Annotation {
  id: string;
  version: number;
  text: string;
  type: 'observation' | 'pending' | 'maintenance' | 'activity';
  importance: 1 | 2 | 3 | 4 | 5;
  status: 'created' | 'modified' | 'archived';
  createdAt: string;          // ISO-8601
  dueDate?: string;
  createdBy: { id: string; email: string; name: string };
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: { id: string; email: string; name: string };
  responses?: AnnotationResponse[];
  history: AnnotationHistoryEntry[];
}

export interface AnnotatedDevice {
  deviceId: string;
  name: string;
  label: string;
  identifier: string | null;
  domain: 'energy' | 'water' | 'temperature' | 'unknown';
  context: string;
  deviceType: string;
  annotations: Annotation[];
}

export interface AnnotationGroup {
  key: string;
  label: string;
  icon?: string;
  devices: AnnotatedDevice[];
  totalAnnotations: number;
  maxImportance: number;
  mostRecentAt: string | null;
}

export interface AnnotationFilter {
  types: Set<Annotation['type']>;
  statuses: Set<Annotation['status']>;
  importance: Set<1 | 2 | 3 | 4 | 5>;
  actionableOnly: boolean;
  searchTerm: string;
}

export type AnnotationSortKey =
  | 'alpha-asc' | 'alpha-desc'
  | 'count-desc' | 'count-asc'
  | 'importance-desc' | 'recent-desc';

export type AnnotationGroupBy = 'identifier' | 'device' | 'domain';

export interface AnnotationExportOptions {
  format: 'pdf' | 'csv';
  levels?: ('summary' | 'consolidated' | 'detailed')[];
  scope: 'current-tab' | 'all' | 'filtered';
}
```

**Parser tolerante:** JSON inválido em `log_annotations` → log warn + retorna `[]`, **nunca lança**.

---

## 6. API Contracts

### 6.1 `AnnotationServiceOrchestrator` (global)

```ts
window.AnnotationServiceOrchestrator = {
  devices: AnnotatedDevice[];
  byIdentifier: Map<string, AnnotatedDevice[]>;
  byDeviceId: Map<string, AnnotatedDevice>;
  byDomain: Map<string, AnnotatedDevice[]>;

  getAll(): AnnotatedDevice[];
  getByIdentifier(identifier: string | null): AnnotatedDevice[];
  getByDevice(deviceId: string): AnnotatedDevice | null;
  getByDomain(domain: 'energy' | 'water' | 'temperature'): AnnotatedDevice[];
  getGroups(groupBy: AnnotationGroupBy, filter?: AnnotationFilter): AnnotationGroup[];

  getTotalCount(): number;        // status !== 'archived'
  getPendingCount(): number;
  getOverdueCount(): number;

  refresh(): Promise<void>;
  invalidate(): void;
};
```

### 6.2 Factory exportada

```ts
// src/index.ts
export {
  createAnnotationServiceOrchestrator,
  type AnnotationServiceOrchestrator,
} from './services/annotations/AnnotationServiceOrchestrator';

export interface CreateAnnotationServiceOrchestratorParams {
  customerId: string;
  tbHost: string;
  jwt: string;
  cacheTtlMs?: number;   // default 60_000
}

export function createAnnotationServiceOrchestrator(
  params: CreateAnnotationServiceOrchestratorParams
): Promise<AnnotationServiceOrchestrator>;
```

### 6.3 TB REST endpoints

| Endpoint | Método | Uso |
|----------|--------|-----|
| `/api/customer/{customerId}/deviceInfos?pageSize=1000&page={K}` | GET | Lista paginada de devices do customer |
| `/api/plugins/telemetry/DEVICE/{deviceId}/values/attributes/SERVER_SCOPE?keys=log_annotations,identifier` | GET | Attrs em batch chunked (100 por vez, 50ms entre chunks) |

**Headers:** `X-Authorization: Bearer ${jwt}`
**Auth source:** `const jwt = localStorage.getItem('jwt_token');` + `const customerTB_ID = self.ctx.settings?.customerTB_ID;`

### 6.4 Events

| Event | Direção | Payload | Quando |
|-------|---------|---------|--------|
| `myio:annotations-ready` | Service → mundo | `{ totalCount, deviceCount }` | Após primeira carga |
| `myio:annotation-changed` | SettingsModal → Service | `{ deviceId, annotationId, action }` | Após save/archive/delete |
| `myio:annotation-clicked` | Panel → MAIN_VIEW | `{ deviceId, annotationId, returnTo }` | Click em item |
| `myio:annotations-refreshed` | Service → Panel | `{ totalCount, durationMs }` | Após `refresh()` |

---

## 7. Cache, Refresh, Performance

| Aspecto | Decisão |
|---------|---------|
| Storage | Memória apenas — **nunca** localStorage (LGPD) |
| TTL | 60s |
| Padrão | Stale-while-revalidate ao abrir o painel |
| Invalidação | TTL expira / `myio:annotation-changed` / `refresh()` |
| Polling/websocket | **Não.** Apenas refresh manual + event-driven |
| Virtual scroll | Só ativa quando `items > 100` |
| Bundle delta budget | ≤ 35KB minified (sem contar `jsPDF`, já no projeto) |
| First paint (cache hit) | ≤ 100ms |
| First paint (cold, 500 devices) | ≤ 1.5s |

---

## 8. Acceptance Criteria

### 8.1 Botão e badge

| ID | Critério |
|----|----------|
| **AC-1** | Existe `#tbx-btn-annotation-notif` em `HEADER/template.html`, após `#tbx-btn-ticket-notif`. |
| **AC-2** | Ícone 📋, bg ametista `#6c5ce7`, badge branco com texto ametista. |
| **AC-3** | Hidden enquanto `MyIOOrchestrator.annotationsConfigured !== true` E `getTotalCount() === 0`. |
| **AC-4** | Badge reflete `getTotalCount()` via listener `myio:annotations-refreshed`. |
| **AC-5** | Badge `0` → hidden; `> 99` → `"99+"`. |
| **AC-6** | `aria-label` dinâmico: `"Anotações operacionais: ${pending} pendentes, ${overdue} vencidas"`. |

### 8.2 Service / Orchestrator

| ID | Critério |
|----|----------|
| **AC-7** | `window.AnnotationServiceOrchestrator` construído em `MAIN_VIEW#onInit` após `_prefetchCustomerAnnotations()`. |
| **AC-8** | Factory `createAnnotationServiceOrchestrator` exportada de `src/index.ts`. |
| **AC-9** | Devices via `GET /api/customer/{customerId}/deviceInfos?pageSize=1000` (paginado). |
| **AC-10** | Attrs em batch chunks de 100, 50ms entre chunks. |
| **AC-11** | JSON inválido em `log_annotations` → warn + `[]`, **nunca lança**. |
| **AC-12** | Cache memória TTL 60s. **Zero** escrita em localStorage/sessionStorage. |
| **AC-13** | `refresh()` dispara `myio:annotations-refreshed` ao concluir. |
| **AC-14** | Listener `myio:annotation-changed` invalida cache + dispara `refresh()`. |

### 8.3 Painel — Tabs

| ID | Critério |
|----|----------|
| **AC-15** | 3 tabs nesta ordem: **Por Identificador** (default), **Por Device**, **Por Domínio**. |
| **AC-16** | Última tab em `sessionStorage["myio.annotations.activeTab"]`. |
| **AC-17** | Devices sem `identifier` → bucket "Sem Identificador" (visível). |
| **AC-18** | Tab Domínio: Energia ⚡ / Água 💧 / Temperatura 🌡️; sem classificação → "Indeterminado". |
| **AC-19** | Item exibe: icon domínio, identifier, device name, texto truncado 120ch, autor, data, badge tipo/importância. |

### 8.4 Painel — Busca / Sort / Filtros

| ID | Critério |
|----|----------|
| **AC-20** | Busca debounce **250ms**. |
| **AC-21** | Match em `identifier`, name, label, `annotation.text` — NFD-normalizada. |
| **AC-22** | Termo encontrado destacado com `<mark>`. |
| **AC-23** | Sort 6 opções; default `alpha-asc`. |
| **AC-24** | Filtros: `type`, `status`, `importance`, "Acionáveis apenas". AND entre seções, OR dentro. |
| **AC-25** | "Acionáveis apenas" = `type === 'pending' && status !== 'archived' && (!dueDate || dueDate <= now + 7d)`. (Errata: `pending` é `AnnotationType`, não `AnnotationStatus` — corrigido em 2026-05-27 conforme nota §5.) |
| **AC-26** | Contador "N anotações" reflete resultado filtrado/buscado. |
| **AC-27** | `status === 'archived'` excluído por default; toggle nos filtros. |

### 8.5 Performance & Virtual Scroll

| ID | Critério |
|----|----------|
| **AC-28** | Virtual scroll ativa só com `items > 100`. |
| **AC-29** | First paint cache hit ≤ 100ms. |
| **AC-30** | First paint cold ≤ 1.5s para 500 devices em 4G. |
| **AC-31** | Bundle delta ≤ 35KB minified. |

### 8.6 Tooltip behaviors

| ID | Critério |
|----|----------|
| **AC-32** | Pin (📌), maximize (⤢), close (✕), drag — espelha `AlarmNotificationTooltip`. |
| **AC-33** | Pinned não fecha em hover-out. |
| **AC-34** | Maximized: `90vw × 90vh`, foco trapped. |
| **AC-35** | Fecha em: click fora (se não pinned), Esc, ✕. |

### 8.7 Click & SettingsModal

| ID | Critério |
|----|----------|
| **AC-36** | Click dispara `myio:annotation-clicked` com `{deviceId, annotationId, returnTo: 'header-panel'}`. |
| **AC-37** | Handler abre SettingsModal na aba Annotations, pré-selecionando a anotação. |
| **AC-38** | Ao fechar SettingsModal com `returnTo === 'header-panel'`, painel reabre preservando tab/scroll/search/filtros. |

### 8.8 Export

| ID | Critério |
|----|----------|
| **AC-39** | Modal pequeno: radio formato (PDF/CSV), checkboxes níveis (PDF), radio escopo. |
| **AC-40** | PDF usa `jsPDF` (já em `package.json`). **Não adicionar XLSX.** |
| **AC-41** | CSV colunas: `identifier,device_name,device_label,domain,annotation_id,type,importance,status,text,created_at,created_by_email,due_date,acknowledged`. |
| **AC-42** | Filename: `anotacoes_${customerName}_${yyyymmdd_hhmm}.{pdf,csv}`. |
| **AC-43** | Níveis PDF combináveis em seções sequenciais no mesmo arquivo. |

### 8.9 Acessibilidade

| ID | Critério |
|----|----------|
| **AC-44** | Tabs `role="tablist"`/`tab` + nav `←/→/Home/End`. |
| **AC-45** | Badge `aria-live="polite"` + `role="status"`. |
| **AC-46** | Painel `role="dialog"`, `aria-labelledby`. |
| **AC-47** | Foco volta ao botão ao fechar. |
| **AC-48** | WCAG AA: ametista `#6c5ce7` sobre branco ≥ 4.5:1. |

### 8.10 Testes

| ID | Critério |
|----|----------|
| **AC-49** | `tests/services/AnnotationServiceOrchestrator.test.ts`: paginação, chunking, JSON tolerante, TTL, refresh, events — **coverage ≥ 95%**. |
| **AC-50** | `tests/components/HeaderAnnotationsPanel.test.ts`: 3 tabs, search debounce, filtros AND/OR, sort, virtual threshold, click → event. |
| **AC-51** | `npm run build` clean, `lint` clean, `smoke-test` clean, size check passa. |

---

## 9. Decisões e Trade-offs Registrados

| Decisão | Quem | Trade-off |
|---------|------|-----------|
| Sem faseamento; tudo v1 | PO override | (+) TTV (–) Risco scope — mitigado por ACs explícitos. |
| Cache memória, sem localStorage | Mary (LGPD) | (+) Compliance (–) Re-fetch ao recarregar — aceitável. |
| Sem polling/websocket | Winston | (+) Simplicidade (–) Janela stale — aceitável v1. |
| `CustomerDeviceService` dedicado | Winston | (+) Reuso futuro (–) +1 camada — justifica-se pelo cross-domain. |
| `jsPDF` ✓, XLSX ✗ (CSV) | Amelia | (+) Bundle ~430KB economizado (–) Sem formatação Excel — gap mínimo. |
| Virtual scroll só > 100 | Amelia | (+) Implementação simples no caso comum (–) Refactor se sempre virtual. |
| Bucket "Sem Identificador" visível | Sally + Mary | (+) Não esconde dados (–) Pode poluir — mitigado por sort. |
| Cor ametista `#6c5ce7` | Sally | (+) Distinta dos outros 2 botões; WCAG AA OK (–) +1 cor no DS. |
| Tooltip espelha sem base class | Winston | (+) Zero risco regressão (–) Duplicação ~200 LOC — refactor futuro. |
| Click → SettingsModal/AnnotationsTab | Amelia + Sally | (+) Única superfície de escrita (–) Acoplamento — pequeno PR. |
| Última tab em `sessionStorage` | Mary | (+) Sem PII; reset por aba é natural. |

---

## 10. Arquivos Novos / Alterados

### 10.1 Novos

```
src/
├── services/
│   ├── annotations/
│   │   ├── AnnotationServiceOrchestrator.ts
│   │   └── parseLogAnnotations.ts
│   └── devices/
│       └── CustomerDeviceService.ts
├── components/
│   └── header-annotations-panel/
│       ├── HeaderAnnotationsPanel.ts
│       ├── HeaderAnnotationsPanel.css
│       ├── AnnotationsExportModal.ts
│       ├── views/
│       │   ├── ByIdentifierView.ts
│       │   ├── ByDeviceView.ts
│       │   └── ByDomainView.ts
│       ├── filters/
│       │   ├── AnnotationFilterDropdown.ts
│       │   └── applyFilter.ts
│       ├── search/
│       │   └── searchAnnotations.ts
│       ├── sort/
│       │   └── sortGroups.ts
│       └── virtual-scroll/
│           └── VirtualList.ts
└── types/
    └── annotations.ts

tests/
├── services/
│   ├── AnnotationServiceOrchestrator.test.ts
│   ├── CustomerDeviceService.test.ts
│   └── parseLogAnnotations.test.ts
└── components/
    ├── HeaderAnnotationsPanel.test.ts
    └── AnnotationsExportModal.test.ts
```

### 10.2 Alterados

| Arquivo | Mudança |
|---------|---------|
| `src/index.ts` | Exports |
| `HEADER/template.html` | Botão após `#tbx-btn-ticket-notif` |
| `HEADER/controller.js` | Wire-up + tooltip class + listener |
| `MAIN_VIEW/controller.js` | `_prefetchCustomerAnnotations()`, criação do orchestrator, handler de `myio:annotation-clicked` |
| `settings/annotations/AnnotationsTab.ts` | Emitir `myio:annotation-changed` (se ainda não emite); aceitar `annotationId` pra pré-seleção |
| `settings/SettingsModal.ts` | Aceitar `returnTo: 'header-panel'`; emitir close pra reabrir painel |

---

## 11. Riscos e Mitigações

| ID | Risco | Sev | Prob | Mitigação |
|----|-------|-----|------|-----------|
| **R1** | 2000+ devices estoura budget 1.5s cold | Alta | Média | Skeleton + progress incremental + abortable via `AbortController`. |
| **R2** | JSON malformado derruba pipeline | Alta | Baixa | `parseLogAnnotations` defensivo + fallback `[]`. AC-11. |
| **R3** | `setInterval` acidental | Média | Baixa | Code review + lint rule custom futura. |
| **R4** | Memory leak de listeners | Média | Média | `AbortController` central; `destroy()` chama `abort()`. |
| **R5** | `myio:annotation-changed` não emitido pelo AnnotationsTab atual | Alta | Alta | Auditar antes; adicionar como parte do RFC. |
| **R6** | Race: painel aberto durante refresh inicial | Média | Média | Observa `annotationsConfigured`; skeleton antes. |
| **R7** | LGPD: PII em export PDF | Média | Alta | Footer "Documento confidencial" + audit trail futuro. |
| **R8** | Virtual scroll quebra com toggle de filtros | Média | Média | Recalcula heights em `rAF`; E2E cobre toggle ↔ scroll. |
| **R9** | TB rate-limit em batch | Alta | Baixa | Backoff exponencial em 429 (1s/2s/4s, max 3 retries). |
| **R10** | Bundle estoura 50KB ESM | Média | Média | Sem XLSX, sem jQuery, sem moment.js; virtual scroll caseiro; medir em CI. |

---

## 12. Out of Scope (Trabalho Futuro)

| Item | Por quê fora | Quando reconsiderar |
|------|--------------|---------------------|
| RBAC por anotação | RFC-0199 ainda não em v-5.2.0 | Após RFC-0199 |
| Polling/websocket | YAGNI v1 | Se telemetria mostrar refresh manual > 5×/sessão |
| Export XLSX | Bundle ~430KB; CSV cobre 99% | Se 3+ clientes pedirem |
| Comentários inline no painel | Única superfície de escrita = AnnotationsTab | Se >50% clicks forem "comentar rápido" |
| Notificações push browser | Fora do escopo do widget | Em product roadmap separado |
| Base class compartilhada tooltips | Risco regressão > DRY agora | RFC própria após v1 estabilizar |
| Sync com v-5.4.0 | RFC-0201 cobre | Após RFC-0201 Phase 2 |
| `deviceIcons` shared map (RFC-0200) | Independente | Em paralelo, RFC própria |

---

## 13. Questões Abertas

| ID | Pergunta | Quem decide | Bloqueia implementação? |
|----|----------|-------------|--------------------------|
| **Q1** | `AnnotationsTab` atual já emite `myio:annotation-changed`? | Amelia (auditar) | Não — se não emite, adicionamos como parte deste RFC |
| **Q2** | Customer name pro filename do export — fonte canônica? | Amelia + Winston | Não — fallback "customer" se ausente |
| **Q3** | Cor ametista `#6c5ce7` precisa entrar formalmente no design token file? | Sally + Paige | Não — usar inline + comentário "TODO: token RFC-XYZ" |

---

## 14. Apêndice — Mapeamento Espelho

| `AlarmNotificationTooltip` (HEADER/controller.js L1043–1437) | `HeaderAnnotationsPanel` |
|---|---|
| `containerId: 'myio-alarm-tooltip'` | `containerId: 'myio-annotations-panel'` |
| `_hideTimer`, `_isMouseOver` | (idem) |
| `_isPinned`, `_isMaximized`, `_isDragging`, `_dragOffset` | (idem) |
| `getContainer()` | (idem) |
| `renderHTML()` retorna alarmes | retorna tabs + lista atual |
| `show(targetButtonEl)` | (idem) |
| `hide()` respeita `_isPinned` | (idem) |
| `window.AlarmServiceOrchestrator` | `window.AnnotationServiceOrchestrator` |
| `myio:alarm-changed` | `myio:annotation-changed` |

**Regra:** copiar mutatis mutandis, **não** criar base class — risco de regressão > DRY (Winston).

---

## 15. Sign-off

| Agente | Papel | Status |
|--------|-------|--------|
| John | PM | ✓ Approved |
| Sally | UX | ✓ Approved (layout + ametista) |
| Winston | Architect | ✓ Approved (cache memória + sem polling) |
| Amelia | Dev | ✓ Approved (2.760 LOC, 95% coverage) |
| Mary | Analyst | ✓ Approved (LGPD + JtBD) |
| Paige | Tech Writer | ✓ Approved (este documento) |
| Rodrigo (PO) | Override authority | **Pendente** — leia, ajuste Q1/Q2/Q3 se quiser, e dê o go |

**Fim da RFC-0203.**
