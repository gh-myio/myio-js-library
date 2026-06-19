# Mapa de Classificação de Devices — Dashboard Shopping v-5.2.0

> Como o `MAIN_VIEW` (orquestrador) classifica devices e alimenta os widgets
> `TELEMETRY` (colunas Entrada / Lojas / Área Comum) e `TELEMETRY_INFO`
> (cards de breakdown: Climatização, Elevadores, Escadas Rolantes, Outros).
>
> Base: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/`. Linhas citadas
> conferidas em 2026-06-18 (podem sofrer pequeno drift em edições futuras).

## ⚡ A chave do entendimento — dois critérios diferentes

O dashboard faz **duas** classificações independentes, com campos de decisão distintos:

| Situação | Onde | Campo de decisão | Tipo de match |
| --- | --- | --- | --- |
| **Coluna** (Entrada/Lojas/Área Comum) | `categorizeItemsByGroup` | **`deviceProfile`** | **exato** |
| **Breakdown** (Climatização/Elevadores/…) | `classifyDeviceByDeviceType` | `deviceProfile` + `identifier` (+ `deviceType`/label combinados) | exato (Set) **+** prefixo/substring |

> É por isso que um device pode aparecer na **coluna** "Área Comum" mas ser somado em
> "Outros" no **breakdown** — os dois caminhos não usam a mesma regra. Ver §3 (bugs).

---

## SITUAÇÃO 1 — Colunas Entrada / Lojas / Área Comum (widgets TELEMETRY)

### 1A. Função que separa por grupo (MAIN_VIEW)
`categorizeItemsByGroup(items)` — **`MAIN_VIEW/controller.js:3161`**. Decide pelo
**`deviceProfile`** (exato). Regras, em ordem:

1. **ocultos** — `isOcultosDevice(item)` (`:643`): `deviceProfile` casa algum de
   `OCULTOS_PATTERNS = ['ARQUIVADO','SEM_DADOS','DESATIVADO','REMOVIDO','INATIVO']` (`:629`).
2. **lojas** — `deviceProfile === '3F_MEDIDOR'` (`:3181`).
3. **entrada** — `deviceProfile ∈ ENTRADA_PROFILES = {TRAFO, ENTRADA, RELOGIO, SUBESTACAO}` (`:3162`, teste em `:3187`).
4. **areacomum** — **tudo o que sobrar** (residual) (`:3193`).

Retorno: `{ lojas, entrada, areacomum, ocultos }` (`:3203`).

Variantes por domínio:
- Água: `categorizeItemsByGroupWater` (`:3221`) → `entrada/lojas/banheiros/areacomum/caixadagua/ocultos`.
- Temperatura: `categorizeItemsByGroupTemperature` (`:3286`).

Montagem do STATE de energia: por volta de **`MAIN_VIEW/controller.js:3981-3997`**
(`const { lojas, entrada, areacomum } = categorizeItemsByGroup(items)` → `window.STATE.energy.{lojas,entrada,areacomum}` via `buildGroupData`).

> ⚠️ Existe uma 2ª função paralela: **`inferLabelWidget(row)`** (`:866`), que grava um
> rótulo textual por device (`labelWidget`: `'Lojas'`/`'Entrada'`/`'Climatização'`/
> `'Elevadores'`/`'Escadas Rolantes'`/`'Área Comum'`/`'Ocultos'`) usando `deviceType`
> **E** `deviceProfile` por **substring**. O bucket de coluna vem do `deviceProfile`
> exato; o `labelWidget` do device vem do `inferLabelWidget` por substring — lógicas
> distintas que podem divergir.

### 1B. Como cada widget TELEMETRY sabe qual grupo renderizar
- Setting de instância: **`self.ctx.settings.labelWidget`** (lido em `TELEMETRY/controller.js:4994`, `:5758`, `:6229`).
- Mapeamento label → grupo de STATE: **`mapLabelWidgetToStateGroup(labelWidget)`** — `TELEMETRY/controller.js:1628`:
  - `'lojas' → 'lojas'`, `'entrada' → 'entrada'`, `'ocultos' → 'ocultos'`
  - **qualquer outro → `'areacomum'`** (`:1638`) — inclui Climatização, Elevadores, Escadas, Área Comum.
- Leitura dos itens: **`getItemsFromState(domain, labelWidget)`** — `TELEMETRY/controller.js:1642`:
  - `lojas`/`entrada`/`caixadagua` → lê direto `window.STATE.get(domain, grupo)`.
  - `areacomum`: pega `STATE.get(domain,'areacomum')`; se label = "Área Comum"/"areacomum"/"area comum" → retorna **tudo**; senão **filtra por `item.labelWidget`** (`:1714-1716`) para isolar Climatização/Elevadores/etc.
- Filtro de cards interno (RFC-0196): `_getEnergyGroupKey(it)` (`TELEMETRY/controller.js:1126`).

### 1C. Como "Área Comum" é obtida
- **Como bucket de devices**: residual — "tudo que não é lojas/entrada/ocultos" (`categorizeItemsByGroup:3193`).
- **Como valor de consumo**: em `buildSummary` (`MAIN_VIEW/controller.js:3325`), o card de Área Comum
  usa **residual** `Math.max(0, areacomumTotal − (climatizacao+elevadores+escadas+outros))`
  (~`:3542-3547`). No util, é puro residual `entrada − (lojas+climatizacao+elevadores+escadas+outros)`
  (`src/utils/equipmentCategory.js` `buildEquipmentCategorySummary`).

---

## SITUAÇÃO 2 — Breakdown em TELEMETRY_INFO (Climatização, Elevadores, Escadas, Outros)

### 2A. A fonte real dos números
**Não** vem do `classifyDevice` do próprio TELEMETRY_INFO — esse é por label e está
**DEPRECATED** (`TELEMETRY_INFO/controller.js:605`, `:616`, `CATEGORIES` em `:563`).
Os números reais vêm do evento `areacomum_breakdown` emitido pelo **TELEMETRY**:

- Emissor: **`emitAreaComumBreakdown(periodKey)`** — `TELEMETRY/controller.js:5325`:
  - Itera `STATE.itemsEnriched`, chama `classifyDevice(item)` (que delega para
    `window.MyIOUtils.classifyDevice` do MAIN_VIEW, `:5310-5313`).
  - Acumula `breakdown[category].{total,count}` em `climatizacao/elevadores/escadas_rolantes/outros`.
  - Subcategorias de climatização por `identifier`; de "outros" por `deviceType`/`deviceProfile`.
  - Emite `type:'areacomum_breakdown'` (~`:5457-5470`) com `*_kWh`, `*_MWh`, `*_count`.

- Regra categoria→device (efetiva): **`classifyDeviceByDeviceType(item)`** — `MAIN_VIEW/controller.js:700`
  (envolvida por `classifyDevice`, `:805`):
  - **lojas**: `deviceProfile === '3F_MEDIDOR'`.
  - **climatizacao**: `deviceProfile ∈ {CHILLER, AR_CONDICIONADO, HVAC, FANCOIL}` (Set);
    ou condicional `BOMBA/MOTOR` com `identifier` de climatização.
  - **elevadores**: `deviceProfile ∈ {ELEVADOR}`.
  - **escadas_rolantes**: `deviceProfile ∈ {ESCADA_ROLANTE}`.
  - **outros**: default.
  - Fallback por identifier: `classifyDeviceByIdentifier` (`:758`) — prefixos `CAG-`/`FANCOIL-`,
    `ELV-`/`ELEVADOR-`, `ESC-`/`ESCADA-`/`ESCADA_`.
  - Config: `DEVICE_CLASSIFICATION_CONFIG` (`MAIN_VIEW/controller.js:571`), espelhado em
    `src/utils/equipmentCategory.js`.

- Consumidor: **TELEMETRY_INFO**:
  - `setupTelemetryListener` ouve `myio:telemetry:update`; case `'areacomum_breakdown'` (`:1892`).
  - `handleAreaComumBreakdown(data, ts, periodKey)` (`:1944`) grava
    `RECEIVED_DATA.{climatizacao,elevadores,escadas_rolantes,outros}` (`count` + `subcategories`).
  - Render dos totais/percentuais por volta de `:899-921`; cores `:258-262`.

### 2B. Fluxo de eventos
```
MAIN_VIEW (orquestra, classifica)
   │  window.STATE.energy.{lojas,entrada,areacomum,ocultos}   (categorizeItemsByGroup)
   │  window.MyIOUtils.classifyDevice                          (classifyDeviceByDeviceType)
   ▼
TELEMETRY (por instância: settings.labelWidget → grupo)
   │  getItemsFromState() renderiza cards do grupo
   │  emite myio:telemetry:update:
   │     • entrada_total          (TELEMETRY/controller.js:5213)
   │     • lojas_total            (:5263)
   │     • areacomum_breakdown    (:5457)  ← climatizacao/elevadores/escadas/outros
   ▼
TELEMETRY_INFO (setupTelemetryListener :1862 → handleAreaComumBreakdown :1944)
   └─ renderiza cards de breakdown + subcards
```
- `MAIN_VIEW` também emite **`myio:energy-summary-ready`** (~`:7419`) com
  `customerTotal/equipmentsTotal/lojasTotal` (separando lojas vs equipamentos por
  `deviceProfile===deviceType==='3F_MEDIDOR'`) — **mas NÃO** traz o breakdown por categoria.
- O `byCategory` estruturado existe no retorno de `buildSummary`
  (`MAIN_VIEW/controller.js:~3681-3688`: `entrada/lojas/climatizacao/elevadores/escadasRolantes/outros`).

---

## 3. Bugs / inconsistências conhecidas

1. **CAG por `Set.has` exato (não substring)** — em `classifyDeviceByDeviceType`
   (`MAIN_VIEW/controller.js:~727`): `CLIMATIZACAO_IDENTIFIERS_SET.has(identifier)`, com
   `identifiers: ['CAG','FANCOIL']` (`:~580`). Match **exato**: `"CAG"` casa, mas `"CAG 01"`,
   `"CAG-PRIMARIA"`, `"BOMBA CAG 2"` **não** casam pelo Set — só salvam via prefixo `CAG-`/`FANCOIL-`.
   → devices CAG com identifier "solto" caem em **Outros**. Mesma lógica em
   `_getEnergyGroupKey` (`TELEMETRY:~1135`) e `classifyDeviceByIdentifier` (`:~773`).
   **Divergência**: `src/utils/equipmentCategory.js` usa `identifier.includes(id)` (substring) —
   comportamento DIFERENTE do widget de produção.

2. **Coluna (exata) vs breakdown (substring)** — a coluna usa `deviceProfile` exato
   (`categorizeItemsByGroup:3178`); a subcategorização do `buildSummary` (`:~3443-3486`) usa
   um `combined = labelWidget+deviceType+deviceProfile+label` por substring + checagens de
   `identifier.startsWith(...)`. Um device pode cair em "areacomum" na coluna e em "outros"
   no breakdown.

3. **`config.climatizacao.deviceProfiles` ausente no MAIN_VIEW** — `_getEnergyGroupKey`
   (`TELEMETRY:~1138`) lê `(DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceProfiles || []).includes(dp)`,
   mas o `DEVICE_CLASSIFICATION_CONFIG` do MAIN_VIEW (`:574-582`) **não define** `deviceProfiles`
   (só o util `equipmentCategory.js` tem). Como o TELEMETRY lê o config do MAIN_VIEW via
   `window.MyIOUtils.DEVICE_CLASSIFICATION_CONFIG`, esse ramo cai sempre em `[]` → match
   silenciosamente ignorado.

---

## 4. Índice de arquivos/linhas

**Situação 1 (colunas):**
- `MAIN_VIEW/controller.js`: `categorizeItemsByGroup` **:3161**; `ENTRADA_PROFILES` **:3162**;
  `inferLabelWidget` **:866**; `isOcultosDevice` **:643**; `OCULTOS_PATTERNS` **:629**;
  montagem STATE energia **:~3981-3997**; residual área comum em `buildSummary` **:3325, :~3542**.
- `TELEMETRY/controller.js`: `mapLabelWidgetToStateGroup` **:1628**; `getItemsFromState` **:1642**;
  `_getEnergyGroupKey` **:1126**; `settings.labelWidget` **:4994, :5758, :6229**.
- `src/utils/deviceInfo.js`: detecção de contexto de energia (stores/equipments/entrada) — RFC-0111.

**Situação 2 (breakdown):**
- `TELEMETRY/controller.js`: `emitAreaComumBreakdown` **:5325**; `entrada_total` **:5213**;
  `lojas_total` **:5263**; `areacomum_breakdown` **:5457**; delega `classifyDevice` **:5310-5313**.
- `MAIN_VIEW/controller.js`: `classifyDeviceByDeviceType` **:700**; `classifyDevice` **:805**;
  `classifyDeviceByIdentifier` **:758**; `DEVICE_CLASSIFICATION_CONFIG` **:571**;
  subcategorização do breakdown **:~3405-3486**; `byCategory` **:~3681**; `myio:energy-summary-ready` **:~7390-7423**.
- `TELEMETRY_INFO/controller.js`: `CATEGORIES` **:563**; `classifyDevice` (DEPRECATED) **:600**;
  `setupTelemetryListener` **:1862**; `areacomum_breakdown` case **:1892**; `handleAreaComumBreakdown` **:1944**;
  render cards **:~899-921**; cores **:258-262**.
- `src/utils/equipmentCategory.js`: `classifyEquipment`/`EQUIPMENT_CLASSIFICATION_CONFIG`;
  `buildEquipmentCategorySummary` (área comum residual).

---

_Gerado por mapeamento de código (read-only). Última atualização: 2026-06-18._
