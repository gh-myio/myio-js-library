# Backlog — Frentes Pendentes e Futures

> Levantamento de itens **não implementados** e **planejados** extraídos dos RFCs.
> Atualizado em: 2026-04-13
> Foco: RFC-0100 em diante + itens explicitamente pendentes em RFCs anteriores.

---

## Legenda de Status

| Símbolo | Significado |
|---------|-------------|
| ⏳ | Pendente — especificado, pronto para implementar |
| 📝 | Draft — especificado parcialmente, precisa refinamento |
| 🔴 | Depende de backend externo (alarms-backend, Data Apps API) |
| ✅ | Implementado (citado apenas para contextualizar fase pendente) |

---

## 1. Indicadores Operacionais (RFC-0152)

RFC-0152 tem 5 fases. Fases 1, 2, 3 já implementadas. **Fases 4 e 5 pendentes.**

### ⏳ Phase 4 — Painel de Alarmes e Notificações Operacionais

**Componente:** `src/components/operational-alarms/`

O painel exibe alarmes com duas abas: lista filtrável e dashboard com KPIs de alarmes.

- `OperationalAlarmsView.ts` — renderização
- `OperationalAlarmsController.ts` — lógica
- `AlarmCard.ts` — card reutilizável por alarme
- `AlarmDashboard.ts` — sub-componente de KPIs

Integra com o `AlarmServiceOrchestrator` (RFC-0183) para dados de alarmes em tempo real.

---

### ⏳ Phase 5 — Dashboard Gerencial Operacional

**Componente:** `src/components/operational-dashboard/`

Visão gerencial com tiles de KPI: MTBF, MTTR, disponibilidade e métricas operacionais de toda a frota de equipamentos.

- `KPICard.ts` — tile de KPI
- `ChartComponents.ts` — gráficos de séries temporais
- Depende de RFC-0175 (endpoint de disponibilidade no backend de alarmes)

---

## 2. Detecção de Offline Confiável (RFC-0188 + RFC-0189)

### ⏳ RFC-0188 — `lastTelemetryTs` como timestamp autoritativo de offline

**Arquivo:** `MAIN_VIEW/controller.js` — `createOrchestratorItem()`

Problema atual: ThingsBoard atualiza o timestamp de um dataKey mesmo sem nova medição real (heartbeats do broker). Isso faz devices aparecerem **online** no dashboard mesmo sem dados reais.

Solução: usar o campo `lastTelemetryTs` retornado pela Data Apps API (`/api/v1/telemetry/customers/:id/:domain/devices/totals`) — este reflete o último ponto **realmente ingerido** pelo backend.

Impacto: devices de energia e água passam a mostrar offline corretamente.

---

### ⏳ RFC-0189 — Detecção de offline para temperatura via Data Apps API

**Arquivo:** `MAIN_VIEW/controller.js` + `settingsSchema.json`

Complemento do RFC-0188 para o domínio temperatura (que não usa o endpoint `/totals`).

- Nova setting booleana `enableTemperatureApiDataFetch` (default `false`)
- Quando ativo: dispara uma chamada por device de temperatura sobre janela de 72h
- `GET /api/v1/telemetry/devices/:deviceId/temperature?startTime=...&endTime=...&granularity=1h`
- Último item de `consumption[]` → `lastTelemetryTs` → detecta offline real
- **Valor exibido no card não muda** (continua sendo `meta.temperature` do ThingsBoard)

---

## 3. GCDR Sync — TB como Fonte da Verdade (RFC-0186)

### ⏳ RFC-0186 — Novo fluxo de sync GCDR orientado pelo ThingsBoard

**Arquivo:** `GCDR-Upsell-Setup/v.1.0.0/controller.js` — `openGCDRSyncInlineModal()`

Reescrita do fluxo de sincronização GCDR. Hoje o sync usa o bundle GCDR como fonte. O novo fluxo inverte: **ThingsBoard é a fonte da verdade**, e o GCDR deve espelhá-la.

Fases do novo fluxo:
- **FASE 0** — Carrega árvore TB em memória recursivamente (assets + devices + SERVER_SCOPE attrs)
- **FASE 1** — Carrega árvore GCDR em memória
- **FASE 2** — Diff TB vs GCDR (creates, updates, deletes)
- **FASE 3** — Aplica mutations no GCDR via API
- **FASE 4** — Grava `gcdrSyncAt` e `gcdrAssetId/DeviceId` de volta nos attrs SERVER_SCOPE do TB

Pré-condição: customer TB deve ter `gcdrTenantId`, `gcdrCustomerId`, `gcdrApiKey` no SERVER_SCOPE.

---

## 4. Check & Fix Routine (RFC-0184)

### ⏳ RFC-0184 — Fase FIX (write-back para ThingsBoard)

**Arquivo:** `GCDR-Upsell-Setup/v.1.0.0/controller.js`

A fase CHECK (raio-X de `deviceType`/`deviceProfile`) está implementada. A **fase FIX** está especificada mas intencionalmente deferida.

O FIX executaria:
- Para devices com status `mismatch`: POST `SERVER_SCOPE` attributes com valores corrigidos
- Para devices com status `missing`: idem, criando os atributos do zero
- Confirmação row-a-row ou bulk com preview antes de aplicar
- Log de auditoria das correções aplicadas

---

## 5. PresetupGateway — Componente de Biblioteca (RFC-0185)

### 📝 RFC-0185 — `createPresetupGateway` como componente reutilizável

**Destino:** `myio-js-library` como export público

Encapsula o workflow completo de pré-setup de um gateway (já existente no Ingestion API) sem depender do `presetup-nextjs`:

- Autenticação OAuth2 client credentials contra Ingestion API
- Lista devices do gateway, adiciona via form inline
- Sync two-phase: Ingestion API → Provisioning Central API com live log
- Export PDF de etiquetas com QR codes (jsPDF, grades 4×7 / 2×4 / one-per-page)

```typescript
import { createPresetupGateway } from 'myio-js-library';

const instance = createPresetupGateway({
  mount: document.getElementById('presetup-root')!,
  gatewayId: 'uuid',
  clientId: '...',
  clientSecret: '...',
});
```

---

## 6. Disponibilidade e MTBF via Backend de Alarmes (RFC-0175)

### 🔴 RFC-0175 — Endpoint de disponibilidade no alarms-backend

**Depende de:** `alarms-backend.git` (equipe backend)

Novo endpoint solicitado: `GET /api/v1/alarms/stats/availability`

Retornaria por device: MTBF, MTTR, uptime %, contagem de paradas — calculados pelo backend a partir do histórico de alarmes.

Questões abertas para o backend:
- A tabela `alarms` tem coluna `customerId`?
- Como tratar alarmes sobrepostos no mesmo device?
- Filtro server-side por customerId/deviceId ou client-side?
- Range máximo de tempo permitido?

Sem este endpoint, o Dashboard Gerencial (RFC-0152 Phase 5) não pode exibir MTBF/MTTR reais.

---

## 7. Annotations com Upload de Imagens (RFC-0151)

### ⏳ RFC-0151 — Upload de até 6 mídias por anotação

**Arquivo:** `src/components/premium-modals/settings/annotations/AnnotationsTab.ts`

Na modal de criação/edição de anotação, abaixo de "Data Limite":
- Campo de upload (arrastar ou ícone) — aceita JPEG, JPG, PNG até 10MB cada, máx. 6
- Grid de preview com opção de excluir cada imagem
- Ao salvar: campo `img_list` (opcional, nullable) no schema de anotações

API de upload: `POST /api/image`
- `file: binary`
- `title`: padrão `{deviceLabel} - Anotação {TIPO} - {n}/{total}` (ex: `AC-SALA-TI - Anotação Manutenção - 1/6`)
- `imageSubType`: nome original do arquivo

---

## 8. Sidebar Menu Premium — BAS Dashboard (RFC-0173)

### 📝 RFC-0173 — `createSidebarMenuComponent` para o dashboard BAS

**Destino:** `src/components/sidebar-menu/`

Menu lateral retrátil para o MAIN_BAS dashboard:
- Seções: Ambientes, Devices, Charts, Settings
- Busca e filtro cross-dashboard
- Collapse/expand para maximizar área de trabalho
- Design responsivo desktop/tablet
- Dark theme consistente com MYIO

---

## 9. Telegram — Fila de Notificações com Prioridade (RFC-0135)

### 📝 RFC-0135 — Pipeline de notificações Telegram com fila e rate control

**Contexto:** ThingsBoard Rule Chains

Substitui o envio direto via `External - REST API Call` por uma camada de fila gerenciada:

- Priorização por customer e device profile (alarmes críticos passam na frente)
- Rate limiting (batch size + delay entre batches) — evita throttle da API Telegram
- Ordering garantido por prioridade
- Panel premium de configuração e monitoramento (logs de entrega, replay de falhas)

Arquitetura: Function Node no Rule Chain enfileira a mensagem → processor JS consome a fila periodicamente → REST API Call para Telegram com controle de taxa.

---

## 10. Exportação de Dados (RFC-0101)

### 📝 RFC-0101 — Export Data Smart Component

**Destino:** componente de biblioteca reutilizável

Exportação inteligente de dados do dashboard:

- Formatos: CSV, XLSX, PDF
- ZIP agrupando múltiplos arquivos (já implementado parcialmente no `Tabela_Temp_V5`)
- **Futures não implementados:**
  - Exportação agendada (cron → email automático)
  - Templates customizados de PDF (branding por cliente)
  - Exportação em batch (múltiplos devices/períodos em uma operação)
  - Preview antes de exportar
  - Suporte a múltiplos idiomas/localização

---

## 11. Modal de Setup de Limites de Potência (RFC-0103)

### 📝 RFC-0103 — `ModalSetupPowerLimits`

**Contexto:** configuração de thresholds de consumo por device type

Futures não implementados:
- **Bulk Edit Mode** — editar múltiplos device types simultaneamente
- **Import/Export JSON** — backup/restore de configurações
- **Audit Log** — quem mudou o quê e quando
- **Live Preview** — mostrar como valores atuais de telemetria seriam classificados
- **Recomendações automáticas** — sugerir limites baseados em histórico
- **Device Override Modal** — UI similar para overrides por device (vs. por customer)

---

## 12. Tooltip de Resumo de Energia (RFC-0105)

### 📝 RFC-0105 — Tooltip interativo com breakdown de categorias

**Contexto:** header KPI do dashboard de energia

Futures não implementados:
- **Filtragem interativa** — clicar em uma categoria filtra a view principal
- **Comparação histórica** — delta vs. período anterior inline no tooltip
- **Alarmes inline** — exibir alarmes ativos dentro do tooltip
- **Acesso rápido** — clicar para navegar direto ao device
- **Compartilhamento** — gerar snapshot compartilhável do resumo atual

---

## Resumo por Prioridade Sugerida

### Alta — impacto direto em produção

| RFC | Título | Dependência |
|-----|--------|-------------|
| RFC-0188 | `lastTelemetryTs` offline confiável (energia/água) | Nenhuma |
| RFC-0189 | Offline confiável para temperatura | RFC-0188 |
| RFC-0186 | GCDR Sync TB como fonte da verdade | Nenhuma |
| RFC-0151 | Annotations com upload de imagens | API `/api/image` |

### Média — features premium planejadas

| RFC | Título | Dependência |
|-----|--------|-------------|
| RFC-0184 | Check & Fix — fase FIX | RFC-0184 CHECK (✅) |
| RFC-0152 Ph4 | Painel Alarmes Operacionais | RFC-0183 (✅) |
| RFC-0152 Ph5 | Dashboard Gerencial (MTBF/MTTR) | RFC-0175 (backend) |
| RFC-0185 | PresetupGateway componente de lib | Ingestion API |

### Baixa / Exploratória

| RFC | Título | Obs |
|-----|--------|-----|
| RFC-0135 | Telegram com fila + prioridade | Rule Chain TB |
| RFC-0173 | Sidebar Menu Premium — BAS | Dashboard BAS |
| RFC-0101 | Export agendado / email / templates | Infra externa |
| RFC-0103 | Power Limits — bulk edit + audit log | Futuro distante |
| RFC-0105 | Tooltip energia — filtro + comparação | UX incremental |
| RFC-0175 | Endpoint MTBF/MTTR no alarms-backend | Depende de BE |

---

_Gerado a partir dos RFCs em `src/docs/rfcs/`. Para detalhes de implementação, consultar o RFC correspondente._
