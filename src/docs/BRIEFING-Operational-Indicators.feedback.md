# FEEDBACK: BRIEFING - Operational Indicators (Frontend x Backend)

**Data:** 2026-01-29  
**Versao:** 1.0  
**Base:** `src/docs/BRIEFING-Operational-Indicators.md`  
**Objetivo:** alinhar contratos de dados reais vs UI implementada (Operational Dashboard + Operational General List + Alarmes) e garantir cobertura de backend/alarms.

---

## 1) Escopo real do Frontend hoje

### 1.1 Operational General List (Lista Geral)
Componente: `src/components/operational-general-list`

**Pontos implementados no UI:**
- Header premium (busca, filtro modal premium, filtro por cliente, stats, maximize) via `OperationalHeaderDevicesGrid`.
- Cards com gauge de disponibilidade, MTBF/MTTR, reversao, alertas recentes.
- Seleção e drag-and-drop para o Footer via `SelectionStore` (mesma infra de comparacao).

**Campos efetivamente usados no card:**
- `id`, `name`, `type`, `status`, `availability`, `mtbf`, `mttr`, `hasReversal`, `recentAlerts`, `customerName`, `customerId`, `location`.

**Observacoes relevantes:**
- Status aceitos pelo tipo: `online | offline | maintenance`.
- No mock atual, “warning” foi normalizado para “maintenance”.
- O filtro premium usa `selectedIds` e `sortMode` (ver **GAP #1**).

### 1.2 Operational Dashboard (Dashboard Gerencial)
Componente: `src/components/operational-dashboard`

**Pontos implementados no UI:**
- KPIs principais e secundarios.
- Graficos: Disponibilidade por periodo, Timeline MTBF (operacao vs paradas), Status donut, Top downtime.

**Campos efetivamente usados:**
- `DashboardKPIs` (ver types.ts).
- `TrendDataPoint[]` para grafico de disponibilidade.
- `DowntimeEntry[]`.
- `MTBFTimelineData` (atual render usa **horas numericas**, nao timestamps).

### 1.3 Alarmes e Notificacoes
Componentes relacionados:
- `src/components/device-operational-card` (lista de alarmes)  
- `src/components/alarms/AlarmComparisonModal.ts` (comparacao premium)

**Pontos implementados no UI:**
- Lista de alarmes filtravel, selecao e drag para Footer.
- Comparacao de alarmes usando `Alarm[]` (stats e mini-charts).

---

## 2) Gaps e inconsistencias encontradas

### GAP #1 — Filter Modal vs Filter State
No UI premium do **Operational General List**, o filtro modal retorna:
```
selectedIds: Set<string> | null
sortMode: cons_desc | cons_asc | alpha_asc | alpha_desc | status_asc | status_desc | shopping_asc | shopping_desc
```
Isso **nao estava** previsto no `EquipmentFilterState` original. Foi adicionado no tipo, mas precisa alinhamento com backend se a intencao for aplicar filtro server-side.

**Pergunta:** backend vai filtrar/ordenar ou o frontend faz local? Hoje o frontend faz local (mock), mas precisamos confirmar se dados serao grandes.

---

### GAP #2 — Timeline MTBF: contrato divergente ✅ **RESOLVIDO**
~~No briefing, `MTBFTimelineData` usa `periodStart/periodEnd` com ISO e `segments` com `startTime/endTime`.~~
~~Na implementacao (`ChartComponents.ts`), o renderer atual espera `startHour/endHour`.~~

**Correcao (revisao 2026-01-29):** O briefing e a implementacao **JA ESTAO ALINHADOS**.
A implementacao em `ChartComponents.ts` usa:
```typescript
interface MTBFTimelineSegment {
  startTime: string;   // ISO timestamp (ex: "2026-01-01T00:00:00")
  endTime: string;     // ISO timestamp
  durationHours: number;
  state: 'operating' | 'stopped' | 'maintenance';
  failureNumber?: number;
  affectedEquipments?: number;
  activeEquipments?: number;
}
```

**Status:** Nenhuma acao necessaria. O contrato esta consistente.

---

### GAP #3 — Alarmes comparacao vs Alarmes lista
Comparacao de alarmes usa `Alarm` completo (severidade, estado, timestamps, count).  
Lista de alarmes usa `AlarmCardData`.  

**Pergunta:** backend vai retornar sempre `Alarm` completo (recomendado) ou precisamos de dois endpoints?

---

## 3) Contratos de dados recomendados (final)

### 3.1 EquipmentCardData (Lista Geral)
Status e metricas obrigatorias para render:
```
id, name, type, status, availability, mtbf, mttr, hasReversal, recentAlerts, customerName, location
```
Se backend puder, incluir:
```
customerId, entityId
```

### 3.2 EquipmentStats (Header premium)
Necessario para o header:
```
total, online, offline, maintenance, fleetAvailability, avgMtbf, avgMttr
```

### 3.3 DashboardKPIs
Necessario:
```
fleetAvailability, availabilityTrend, avgAvailability, activeAlerts,
fleetMTBF, fleetMTTR, totalEquipment, onlineCount, offlineCount, maintenanceCount
```
Opcional (RFC-0155):
```
onlineTrend, offlineTrend, maintenanceTrend, offlineCriticalCount,
recurrentFailuresCount, avgTimeInStatus
```
Opcional (RFC-0155 Feedback - implementado 2026-01-29):
```typescript
maintenanceBreakdown?: {
  scheduled: number;   // Manutencao programada
  corrective: number;  // Manutencao corretiva
  avgDuration: number; // Duracao media (horas)
};
availabilitySlaTarget?: number;      // Meta SLA (default 95%)
availabilityTrendValue?: number;     // Tendencia vs periodo anterior (ex: -2.3)
offlineEssentialCount?: number;      // Equipamentos essenciais offline
```

### 3.4 TrendDataPoint (Disponibilidade por periodo)
Necessario:
```
label, timestamp, value (disponibilidade)
```
Opcional (RFC-0156):
```
failureCount, downtimeHours, affectedEquipment, hasEvent, eventDescription
```

**Nota (RFC-0156 Feedback - implementado 2026-01-29):**
O grafico de disponibilidade agora suporta:
- Escala adaptativa (zoom 80-100% ou completa 0-100%)
- Linha de tendencia (linear regression)
- Marcadores de evento proporcionais ao numero de falhas
- CTA "Ver causas" no badge "Abaixo do SLA"

### 3.5 DowntimeEntry
Necessario:
```
name, location, downtime, percentage
```

### 3.6 MTBFTimelineData (proposta final)
**Proposta de contrato consistente:**
```
periodStart: ISO
periodEnd: ISO
totalHours: number
segments: [
  { startTime: ISO, endTime: ISO, durationHours: number, state: 'operating'|'stopped', failureNumber?: number }
]
operatingHours: number
failureCount: number
mtbfValue: number
mttrValue?: number
```

Frontend converte `startTime/endTime` em `startHour/endHour` para o grafico.

---

## 4) Pontos especificos para Backend de Alarmes

**Necessario para Alarmes & Notifications:**
- Lista paginada/filtrada de `Alarm[]` por periodo, severidade, estado.
- Estatisticas agregadas (`AlarmStats`).
- Trend (ultimos 7/30 dias).

**Comparacao premium de alarmes** (Footer):
- Requer `Alarm` completo para pelo menos 2 itens selecionados.
- Usa `lastOccurrence`, `severity`, `state`, `occurrenceCount`.

---

## 5) Recomendacoes de API (alinhadas ao briefing)

```
GET /api/operational/equipment
GET /api/operational/equipment/stats
GET /api/operational/dashboard/kpis
GET /api/operational/dashboard/trend
GET /api/operational/dashboard/downtime
GET /api/operational/dashboard/mtbf-timeline
GET /api/operational/alarms
GET /api/operational/alarms/stats
POST /api/operational/alarms/:id/acknowledge
POST /api/operational/alarms/:id/close
POST /api/operational/alarms/:id/escalate
```

**Observacao:** se o backend preferir um unico endpoint agregador, o frontend aceita, mas precisa de payloads com as tipagens acima.

---

## 6) Acoes sugeridas para fechar gaps

1) ~~**Alinhar contrato MTBFTimelineData** (timestamps vs horas).~~ ✅ Ja alinhado (revisao 2026-01-29).
2) **Definir se filtros e ordenacao sao server-side** (GAP #1).
3) **Confirmar disponibilidade de historico de falhas** (para MTBF/MTTR).
4) **Definir SLA para alarmes ativos** e o que entra em `recentAlerts`.
5) **Confirmar estrutura de Alarm unificada** (GAP #3) - backend retorna `Alarm` completo.

---

## 7) Observacoes finais

- O frontend ja suporta selecao/drag para o Footer; backend nao precisa mudar isso.
- O header premium usa lista de clientes; se nao vier do backend, ele gera a partir de `equipment`.
- O painel de alarmes precisa do backend para sair do mock.

---

**Status:** Feedback pronto para revisao com Backend/Alarmes.
**Proxima acao:** confirmar contratos finais e converter mock -> API real.

---

## Historico de Revisoes

| Data | Revisor | Alteracoes |
|------|---------|------------|
| 2026-01-29 | Equipe Frontend | Documento original |
| 2026-01-29 | Claude | Corrigido GAP #2 (MTBFTimeline ja esta alinhado); adicionado item 5 nas acoes |
