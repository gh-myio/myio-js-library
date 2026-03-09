# RFC-0183 — AlarmServiceOrchestrator + Alarm Badge nos Device Cards

**Status**: Implementado
**Data**: 2026-02-26
**Branch**: `fix/rfc-0152-real-data`

---

## Problema

Os alarmes pré-fetchados em `window.MyIOOrchestrator.customerAlarms` (array bruto) não tinham
mapeamento por device, impossibilitando:

1. Saber quantos alarmes ativos cada device possui
2. Mostrar badge visual nos device cards do TelemetryGrid
3. Reutilizar dados pré-fetchados na `AlarmsTab` sem nova chamada à API

---

## Solução

### `window.AlarmServiceOrchestrator` (novo global)

Criado ao final de `_prefetchCustomerAlarms()` no `MAIN_VIEW/controller.js`:

```javascript
window.AlarmServiceOrchestrator = {
  alarms,                  // array bruto de todos os alarmes do customer
  deviceAlarmMap,          // Map<gcdrDeviceId, GCDRAlarm[]>
  deviceAlarmTypes,        // Map<gcdrDeviceId, Set<alarmType>>

  getAlarmCountForDevice(gcdrDeviceId) { … },
  getAlarmsForDevice(gcdrDeviceId)     { … },
  getAlarmTypesForDevice(gcdrDeviceId) { … },
  async refresh()                      { … }, // re-fetcha + reconstrói os mapas
};
```

### Alarm Badge nos Device Cards

Badge vermelho (sino + contador) injetado sobre os cards com alarmes ativos:

- `TelemetryGridShoppingView.ts` (`v-5.4.0`) — método `_createAlarmBadge(count)`
- `TELEMETRY/controller.js` (`v-5.2.0`) — função `addAlarmBadge(cardElement, gcdrDeviceId)`

```
card
└── .myio-alarm-badge   ← position: absolute; top:6px; left:6px; background:#dc2626
    ├── <svg> sino
    └── <span> 3 (ou "99+")
```

### AlarmsTab migrada para `AlarmService.batchX()`

`AlarmsTab.ts` passa a usar (com fallback):

| Ação | Com AlarmService | Sem AlarmService (fallback) |
|------|------------------|-----------------------------|
| Acknowledge | `batchAcknowledge(ids, email)` | individual `postAlarmAction(id, 'acknowledge')` |
| Snooze | `batchSilence(ids, email, '4h')` | individual `postAlarmAction(id, 'snooze')` |
| Escalate | `batchEscalate(ids, email)` | individual `postAlarmAction(id, 'escalate')` |

Ao abrir a `AlarmsTab`, a ordem de prioridade para buscar alarmes é:

1. `AlarmServiceOrchestrator.getAlarmsForDevice(gcdrDeviceId)` ← prefetchados e mapeados
2. `config.prefetchedAlarms` filtrados por `deviceId`
3. `fetchActiveAlarms(alarmsBaseUrl)` ← chamada à API (último recurso)

Ao fechar/refresh: `AlarmServiceOrchestrator.refresh()` reconstrói os mapas.

---

## Propagação de `gcdrDeviceId` na cadeia MAIN_VIEW → TELEMETRY

**Bug encontrado e corrigido**: `it.gcdrDeviceId` chegava sempre `undefined` em `addAlarmBadge()`.

Cadeia de propagação (3 pontos corrigidos):

```
ctx.data row { dataKey: 'gcdrDeviceId', value: 'gcdr-uuid-xxx' }
    ↓  [Fix 1] buildMetadataMapFromCtxData():
           else if (keyName === 'gcdrdeviceid') meta.gcdrDeviceId = val;
    ↓  [Fix 2] createOrchestratorItem() baseItem:
           gcdrDeviceId: meta.gcdrDeviceId || null,
    ↓          → window.STATE.energy.*.items[n].gcdrDeviceId = 'gcdr-uuid-xxx'
    ↓  [Fix 3] TELEMETRY STATE.itemsBase.map() (ambos os caminhos):
           gcdrDeviceId: item.gcdrDeviceId || null,
    ↓
addAlarmBadge($card[0], 'gcdr-uuid-xxx')  ✓  badge renderizado
```

---

## AllReportModal — Filtro API-driven por grupo (RFC-0182 fix)

**Problema**: A API de totais retorna TODOS os devices do customer (ex.: 271 energy, 99 mistos
para temperatura). O relatório de "Ambientes Climatizáveis" mostrava 99 devices ao invés de 13.

**Causa**: `mapCustomerTotalsResponse()` era list-driven — iterava o `itemsList` do orquestrador
e incluía items com `consumption = 0` quando não havia match na API.

**Fix**: Abordagem API-driven — itera a resposta da API e descarta items cujo `api.item.id`
não esteja no `orchIdSet` (ingestionIds do grupo selecionado):

```typescript
const orchIdSet = new Set(itemsList.map(item => String(item.id)));
const orchMeta  = new Map(itemsList.map(item => [String(item.id), item]));

for (const apiItem of apiArray) {
  const apiId = String(apiItem?.id || '');
  if (!apiId || !orchIdSet.has(apiId)) continue; // descarta: não pertence ao grupo
  // ... inclui com total_value
}
```

Funciona para todos os domínios/grupos:
- `energy > lojas` → apenas lojas 3F_MEDIDOR
- `energy > area_comum` → apenas subset da área comum
- `temperature > climatizavel` → 13 sensores TERMOSTATO (não 99 mistos)
- `water > hidrometros_entrada` → apenas hidrômetros de entrada

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` | `_buildAlarmServiceOrchestrator()` + propagação `gcdrDeviceId` (Fix 1 & 2) |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js` | `addAlarmBadge()` + `gcdrDeviceId` em `STATE.itemsBase` (Fix 3) |
| `src/components/telemetry-grid-shopping/TelemetryGridShoppingView.ts` | Badge + `_createAlarmBadge()` + `_injectAlarmBadgeStyles()` |
| `src/components/telemetry-grid-shopping/types.ts` | `alarmCount?: number` em `TelemetryDevice` |
| `src/components/telemetry-grid-shopping/styles.ts` | `position: relative` em `.card-wrapper` |
| `src/components/premium-modals/settings/alarms/AlarmsTab.ts` | AlarmService.batchX() + refresh() |
| `src/components/premium-modals/report-all/AllReportModal.ts` | Filtro API-driven por orchIdSet |
| `showcase/main-view-shopping/index.html` | Painéis RFC-0183 Alarm Badge + RFC-0182 AllReportModal |

---

## Validação no Showcase

```
showcase/main-view-shopping/index.html
```

**Alarm Badge**:
1. Clique `onInit` → `AlarmServiceOrchestrator` é construído automaticamente pelo controller
2. Ou clique `💉 Inject ASO` para mock imediato (gcdr-uuid-dev01..05)
3. Cards com `gcdrDeviceId` 01–05 exibem badge vermelho (sino + contador)

**AllReportModal (API-driven filter)**:
1. `Load Real Devices` → selecionar `temperature > climatizavel` → `From STATE`
2. `Open Report` → relatório mostra apenas os 13 sensores do orquestrador (não os 99 da API)

---

## Campos ThingsBoard Necessários

Para que o badge funcione em produção, os devices precisam ter o atributo `gcdrDeviceId`
configurado como dataKey no widget TELEMETRY:

| DataKey | Tipo | Exemplo de valor |
|---------|------|-----------------|
| `gcdrDeviceId` | SERVER_SCOPE attribute | `gcdr-uuid-dev01-0000-000000000001` |

O MAIN_VIEW lê esse campo via `ctx.data` e o propaga para `window.STATE` → TELEMETRY → badge.
