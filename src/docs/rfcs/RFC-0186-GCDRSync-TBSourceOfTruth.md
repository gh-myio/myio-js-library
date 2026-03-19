# RFC-0186 — GCDR Sync: TB como Fonte da Verdade

**Status:** Aguardando aprovação
**Widget:** `src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/controller.js`
**Função afetada:** `openGCDRSyncInlineModal()`
**Data:** 2026-03-05

---

## 1. Motivação

O fluxo atual de "Sincronizar GCDR" é baseado num bundle GCDR como fonte e tenta fazer match de devices de forma global (todos os devices do customer). O novo fluxo define o **ThingsBoard como fonte da verdade**: a hierarquia TB (assets + devices + relações) é o que guia todo o sync. O GCDR deve espelhar fielmente o que está no TB.

---

## 2. Pré-condição obrigatória

Antes de qualquer passo, verificar nos atributos `SERVER_SCOPE` do customer TB:

| Atributo | Obrigatório | Descrição |
|---|---|---|
| `gcdrTenantId` | ✅ | Tenant GCDR do customer |
| `gcdrCustomerId` | ✅ | UUID do customer no GCDR |
| `gcdrApiKey` | ✅ | Chave de API para chamadas GCDR |

Se qualquer um estiver ausente → **abortar com mensagem de erro clara**. Não executar nenhum passo seguinte.

---

## 3. Fluxo completo

### FASE 0 — Carregar árvore TB em memória

Usando `GET /api/relations/info?fromId={id}&fromType={type}` recursivamente a partir do customer, montar:

```
Customer
  └── Asset A (+ SERVER_SCOPE attrs)
        ├── Asset A1 (+ SERVER_SCOPE attrs)
        │     └── Device X (+ SERVER_SCOPE attrs)
        └── Device Y (+ SERVER_SCOPE attrs)
  └── Asset B (+ SERVER_SCOPE attrs)
        └── Device Z (+ SERVER_SCOPE attrs)
```

Para cada **asset** e **device** encontrado nas relações, buscar também seus `SERVER_SCOPE` attributes via:
- `GET /api/plugins/telemetry/ASSET/{id}/values/attributes/SERVER_SCOPE`
- `GET /api/plugins/telemetry/DEVICE/{id}/values/attributes/SERVER_SCOPE`

Campos necessários por entidade:

**Asset TB:** `id`, `name`, `label`, `type`, `SERVER_SCOPE: { gcdrAssetId, gcdrParentAssetId, gcdrSyncAt, gcdrCustomerId }`

**Device TB:** `id`, `name`, `label`, `type`, `SERVER_SCOPE: { slaveId, centralId, deviceType, deviceProfile, identifier, ingestionId, ingestionGatewayId, gcdrDeviceId, gcdrAssetId, gcdrSyncAt, gcdrCustomerId }`

#### Fallback: devices sem asset (orphans)

Se durante a varredura de relações do customer existirem devices diretamente ligados ao customer (sem asset intermediário):
1. Verificar se já existe no TB um asset com nome `DevicesSemAsset<CustomerName>`
2. Se não existir: criar esse asset no TB via `POST /api/v1/entities` e criar a relação `customer → asset` via `POST /api/v1/relations`
3. Criar relação `asset → device` para cada device orphan
4. Incluir esse asset (e seus devices) no processamento normal das fases seguintes

---

### FASE 1 — Carregar árvore GCDR em memória

```
GET /api/v1/customers/external/{tbCustomerId}?deep=1
```

Retorna `{ customer, assets: [...flat...], devices: [...flat...] }`.

Indexar em memória:
```js
// assets indexados por id
const gcdrAssetMap = new Map(bundle.assets.map(a => [a.id, { ...a, devices: [] }]));

// devices agrupados por assetId
for (const d of bundle.devices) {
  gcdrAssetMap.get(d.assetId)?.devices.push(d);
}
```

Também indexar devices por lookup rápido:
```js
// para match por slaveId+centralId
const gcdrDeviceBySlaveKey = new Map();   // `${centralId}:${slaveId}` → device
// para match por name (normalizado)
const gcdrDeviceByName = new Map();        // norm(name) → device
const gcdrDeviceByDisplayName = new Map(); // norm(displayName) → device
```
*(Esses índices globais são usados apenas como fallback — o match principal é scoped ao asset)*

---

### FASE 2 — Sincronizar Assets (um a um, ordem topológica)

Processar assets em ordem topológica: **raízes primeiro, depois filhos**. Isso garante que ao sincronizar um asset filho, o `gcdrAssetId` do pai já está disponível no TB.

#### Para cada asset TB (um a um):

**Match no GCDR** — testar todas as combinações entre campos TB e campos GCDR:

| Campo TB | vs Campo GCDR |
|---|---|
| `name` | `name` |
| `name` | `displayName` |
| `name` | `code` |
| `label` | `name` |
| `label` | `displayName` |
| `label` | `code` |

Comparação case-insensitive, trim, colapso de espaços múltiplos.

**Se match encontrado:**
1. `PUT /api/v1/assets/{gcdrAssetId}` com payload completo atualizado com dados do TB:
   ```json
   {
     "name": "<tb.name>",
     "displayName": "<tb.label || tb.name>",
     "code": "<tb.name>",
     "description": "",
     "type": "<mapeado>",
     "metadata": {
       "tbId": "<tb.id>",
       "tbAssetName": "<tb.name>",
       "tbAssetType": "<tb.type>",
       "syncedAt": "<now ISO>"
     },
     "status": "ACTIVE"
   }
   ```
2. Verificar se `parentAssetId` no GCDR difere do esperado (pai já sincronizado):
   - Se diferir → `POST /api/v1/assets/{gcdrAssetId}/move` com `{ "newParentAssetId": "<gcdrParentAssetId>" }`
3. Salvar no TB SERVER_SCOPE do asset:
   ```
   gcdrAssetId      = gcdrAsset.id
   gcdrParentAssetId = gcdrAsset.parentAssetId (se aplicável)
   gcdrSyncAt       = <now ISO>
   gcdrCustomerId   = <gcdrCustomerId do customer>
   ```

**Se não encontrado (CREATE):**
1. Resolver `gcdrParentAssetId`: ler `gcdrAssetId` do SERVER_SCOPE do asset pai TB (já sincronizado na iteração anterior)
2. `POST /api/v1/assets` com payload:
   ```json
   {
     "customerId": "<gcdrCustomerId>",
     "parentAssetId": "<gcdrParentAssetId ou null>",
     "name": "<tb.name>",
     "displayName": "<tb.label || tb.name>",
     "code": "<tb.name>",
     "type": "OTHER",
     "metadata": {
       "tbId": "<tb.id>",
       "tbAssetName": "<tb.name>",
       "tbAssetType": "<tb.type>",
       "syncedAt": "<now ISO>"
     }
   }
   ```
3. Salvar no TB SERVER_SCOPE com dados da resposta criada (mesmo campos acima)

---

### FASE 3 — Sincronizar Devices (por asset, um a um)

Para cada asset TB **já sincronizado** (com `gcdrAssetId` disponível):

Obter os GCDR devices desse asset específico **filtrando o bundle**:
```js
const gcdrDevicesForAsset = bundle.devices.filter(d => d.assetId === gcdrAssetId);
```

#### Para cada device TB do asset (um a um):

**Pré-verificação:** se o device não tiver `slaveId` **E** não tiver `centralId` nos SERVER_SCOPE attrs → **skip** (adicionar ao log final como ignorado).

**Match no GCDR** — executar em ordem de prioridade:

| Prioridade | Estratégia | Condição |
|---|---|---|
| 1 | `slaveId + centralId` | ambos presentes no TB attrs e em `gcdrDevicesForAsset` |
| 2 | `name` TB vs GCDR `name` | normalizado |
| 3 | `name` TB vs GCDR `displayName` | normalizado |
| 4 | `label` TB vs GCDR `name` | normalizado |
| 5 | `label` TB vs GCDR `displayName` | normalizado |

Se qualquer estratégia resultar em match → **UPDATE** (mesmo que só o name bater, a fonte da verdade é TB, então forçamos o update completo).

**Se match encontrado (UPDATE):**
1. `PUT /api/v1/devices/{gcdrDeviceId}` com payload completo:
   ```json
   {
     "name": "<tb.name>",
     "displayName": "<tb.label || tb.name>",
     "label": "<tb.label>",
     "type": "<mapToGCDRType(deviceType)>",
     "externalId": "<tb.id>",
     "slaveId": <tb.slaveId>,
     "centralId": "<tb.centralId>",
     "identifier": "<tb.identifier || tb.name>",
     "deviceProfile": "<tb.deviceProfile>",
     "deviceType": "<tb.deviceType>",
     "ingestionId": "<tb.ingestionId>",
     "ingestionGatewayId": "<tb.ingestionGatewayId>",
     "status": "ACTIVE",
     "metadata": {
       "tbId": "<tb.id>",
       "tbDeviceName": "<tb.name>",
       "tbProfile": "<tb.deviceProfile>",
       "syncedAt": "<now ISO>"
     }
   }
   ```
2. Verificar se `gcdrDevice.assetId !== gcdrAssetId` → se diferir: `POST /api/v1/devices/{gcdrDeviceId}/move` com `{ "newAssetId": "<gcdrAssetId>" }`
3. Salvar no TB SERVER_SCOPE do device:
   ```
   gcdrDeviceId  = gcdrDevice.id
   gcdrAssetId   = gcdrAssetId (do asset pai já sincronizado)
   gcdrSyncAt    = <now ISO>
   gcdrCustomerId = <gcdrCustomerId do customer>
   ```

**Se não encontrado (CREATE):**
1. `POST /api/v1/devices` com mesmo payload do UPDATE + `{ "assetId": "<gcdrAssetId>", "customerId": "<gcdrCustomerId>" }`
2. Salvar no TB SERVER_SCOPE com dados da resposta

---

## 4. Log final da execução

Ao término do sync, exibir resumo:

```
✅ Assets sincronizados: N  (M criados, K atualizados)
✅ Devices sincronizados: N (M criados, K atualizados)
⚠️  Devices ignorados (sem slaveId/centralId): N
   - Device "Nome A" (tb-id)
   - Device "Nome B" (tb-id)
❌ Erros: N
   - Asset "X": <motivo>
   - Device "Y": <motivo>
```

---

## 5. Mapeamento TB type → GCDR type

Reutilizar `mapToGCDRType()` já existente:

| Contém no deviceType/Profile | GCDR type |
|---|---|
| HIDROMETRO, HYDROMETER, MEDIDOR, RELOGIO, METER, ENTRADA, TRAFO, SUBESTACAO | `METER` |
| TERMOSTATO, SENSOR, TEMP | `SENSOR` |
| CHILLER, FANCOIL, HVAC, AR_CONDICIONADO, BOMBA | `ACTUATOR` |
| ELEVADOR, ESCADA, CONTROLLER | `CONTROLLER` |
| GATEWAY, CENTRAL | `GATEWAY` |
| (default) | `OTHER` |

---

## 6. Campos protegidos no GCDR (não enviados via PUT)

| Campo | Asset | Device |
|---|---|---|
| `parentAssetId` | ❌ PUT — usar `POST /assets/:id/move` | — |
| `assetId` | — | ❌ PUT — usar `POST /devices/:id/move` |
| `customerId` | ❌ sem endpoint direto | ❌ implícito via move |
| `serialNumber` | — | ❌ não está no UpdateDeviceSchema |

---

## 7. Arquivo afetado

- `src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/controller.js`
  - Reescrever `openGCDRSyncInlineModal()` completo
  - Adicionar helpers: `guBuildTbTree()`, `guBuildGcdrTree()`, `guSyncAsset()`, `guSyncDevice()`, `guMatchAsset()`, `guMatchDevice()`
  - Manter todas as outras funções e modais intocados

---

## 8. O que NÃO muda

- `openSyncForceIdModal()` — não alterado
- `openForceUpdateModal()` — não alterado
- `openForceClearModal()` — não alterado
- Upsell Setup card — não alterado
- CSS / HTML shell do widget — não alterado
