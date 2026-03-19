# RFC-0182: Orchestrator Group Classification API

- **RFC Number:** 0182
- **Status:** Implemented
- **Start Date:** 2026-02-25
- **Related RFCs:** RFC-0106 (Device Classification), RFC-0142 (Ocultos Group), RFC-0181 (Reports Menu Item)
- **Files Affected:**
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` *(exposição das funções)*

---

## Summary

Expõe as funções de categorização de dispositivos (`categorizeItemsByGroup` e `categorizeItemsByGroupWater`) via `window.MyIOUtils` e adiciona dois métodos helpers no `window.MyIOOrchestrator` (`getEnergyGroups`, `getWaterGroups`) que retornam os dispositivos já classificados por grupo a partir dos dados em cache.

Antes desta RFC, as funções de categorização existiam como closures privadas dentro do MAIN_VIEW e não podiam ser usadas por outros widgets (MENU, TELEMETRY).

---

## Motivação

O MENU widget (RFC-0181) precisa obter a lista de lojas, entrada e área comum para popular o `itemsList` do `AllReportModal`. O TELEMETRY pode precisar inspecionar os grupos para lógica de exibição condicional.

Expor a API de grupos elimina duplicação de lógica de classificação nos widgets filhos.

---

## API Exposta

### `window.MyIOOrchestrator.getEnergyGroups()`

Retorna os dispositivos do domínio **energia** classificados em grupos, a partir de `window.MyIOOrchestratorData.energy.items`.

```javascript
const { lojas, entrada, areacomum, ocultos } = window.MyIOOrchestrator.getEnergyGroups();
```

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `lojas` | `Device[]` | `deviceProfile === '3F_MEDIDOR'` |
| `entrada` | `Device[]` | deviceType/Profile contém TRAFO, ENTRADA, RELOGIO, SUBESTACAO |
| `areacomum` | `Device[]` | Todo o restante (climatização, elevadores, escadas, outros) |
| `ocultos` | `Device[]` | deviceProfile contém ARQUIVADO, SEM_DADOS, DESATIVADO, REMOVIDO, INATIVO |

Retorna `{ lojas: [], entrada: [], areacomum: [], ocultos: [] }` se ainda não há dados em cache.

---

### `window.MyIOOrchestrator.getWaterGroups()`

Retorna os dispositivos do domínio **água** classificados em grupos, a partir de `window.MyIOOrchestratorData.water.items`.

```javascript
const { lojas, entrada, areacomum, banheiros, ocultos } = window.MyIOOrchestrator.getWaterGroups();
```

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `lojas` | `Device[]` | Hidrômetros de loja (`deviceProfile === 'HIDROMETRO_LOJA'` ou equivalente) |
| `entrada` | `Device[]` | Hidrômetro geral do shopping (HIDROMETRO_SHOPPING) |
| `areacomum` | `Device[]` | Hidrômetros de área comum (HIDROMETRO_AREA_COMUM) |
| `banheiros` | `Device[]` | Hidrômetros de banheiro (identificador contém BANHEIRO, WC, etc.) |
| `ocultos` | `Device[]` | Dispositivos arquivados/inativos |

---

### `window.MyIOUtils.categorizeItemsByGroup(items)`

Versão baixo-nível da classificação de energia. Útil quando o chamador já tem o array de items e quer classificar sem passar pelo cache.

```javascript
// Exemplo: TELEMETRY classifica items recebidos via evento
const items = window.MyIOOrchestratorData?.energy?.items || [];
const { lojas, entrada, areacomum, ocultos } = window.MyIOUtils.categorizeItemsByGroup(items);
```

**Parâmetros:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `items` | `Device[]` | Array de dispositivos com `deviceType`, `deviceProfile`, `identifier` |

**Retorno:** `{ lojas: Device[], entrada: Device[], areacomum: Device[], ocultos: Device[] }`

---

### `window.MyIOUtils.categorizeItemsByGroupWater(items)`

Versão baixo-nível da classificação de água.

```javascript
const items = window.MyIOOrchestratorData?.water?.items || [];
const { lojas, entrada, areacomum, banheiros, ocultos } = window.MyIOUtils.categorizeItemsByGroupWater(items);
```

**Retorno:** `{ lojas: Device[], entrada: Device[], areacomum: Device[], banheiros: Device[], ocultos: Device[] }`

---

## Regras de Classificação — Energia

Aplicadas em ordem de prioridade por `categorizeItemsByGroup`:

| Prioridade | Grupo | Regra |
|-----------|-------|-------|
| 0 | `ocultos` | `deviceProfile` contém ARQUIVADO \| SEM_DADOS \| DESATIVADO \| REMOVIDO \| INATIVO |
| 1 | `lojas` | `isStoreDevice(item)` → `deviceType === '3F_MEDIDOR' && deviceProfile === '3F_MEDIDOR'` |
| 2 | `entrada` | `(deviceType === '3F_MEDIDOR' && deviceProfile ∈ {TRAFO, ENTRADA, RELOGIO, SUBESTACAO})` OR `deviceType ∈ {TRAFO, ENTRADA, RELOGIO, SUBESTACAO}` |
| 3 | `areacomum` | Tudo o que não se encaixou nas regras acima |

> **Nota:** `areacomum` inclui climatização, elevadores, escadas rolantes e outros equipamentos. Para subcategorização granular desses itens use `window.MyIOUtils.classifyDeviceByDeviceType(item)` ou `window.MyIOUtils.classifyDevice(item)`.

---

## Regras de Classificação — Água

Aplicadas em ordem de prioridade por `categorizeItemsByGroupWater`:

| Prioridade | Grupo | Regra |
|-----------|-------|-------|
| 0 | `ocultos` | `deviceProfile` contém ARQUIVADO \| SEM_DADOS \| DESATIVADO \| REMOVIDO \| INATIVO |
| 1 | `entrada` | `deviceType === HIDROMETRO_SHOPPING` OR `(deviceType === HIDROMETRO && deviceProfile === HIDROMETRO_SHOPPING)` |
| 2 | `areacomum` | `deviceType === HIDROMETRO_AREA_COMUM` OR `(deviceType === HIDROMETRO && deviceProfile === HIDROMETRO_AREA_COMUM)` |
| 3 | `banheiros` | `identifier/label` contém BANHEIRO, WC, SANITARIO, TOALETE, LAVABO |
| 4 | `lojas` | Restante dos HIDROMETRO com perfil de loja |
| 5 | (sem grupo) | Dispositivos não mapeados |

---

## Uso para Debug no Console

```javascript
// Verificar quantos dispositivos há em cada grupo
const eg = window.MyIOOrchestrator.getEnergyGroups();
console.table({
  lojas:     eg.lojas.length,
  entrada:   eg.entrada.length,
  areacomum: eg.areacomum.length,
  ocultos:   eg.ocultos.length,
});

// Inspecionar identificadores das lojas
window.MyIOOrchestrator.getEnergyGroups().lojas
  .map(d => ({ id: d.id, identifier: d.identifier, label: d.label }));

// Verificar grupos de água
const wg = window.MyIOOrchestrator.getWaterGroups();
console.log('Hidrômetros entrada:', wg.entrada.length);
console.log('Hidrômetros lojas:', wg.lojas.length);

// Usar a função baixo-nível diretamente
const items = window.MyIOOrchestratorData?.energy?.items || [];
const { lojas } = window.MyIOUtils.categorizeItemsByGroup(items);
console.log('Lojas (baixo-nível):', lojas.length);
```

---

## Uso no MENU para o AllReportModal

```javascript
// Em openReportsPickerModal / _openLojasReport:
function _openLojasReport(domain, baseParams) {
  const groups = domain === 'water'
    ? window.MyIOOrchestrator.getWaterGroups()
    : window.MyIOOrchestrator.getEnergyGroups();

  const itemsList = groups.lojas.map(d => ({
    id:         d.id || d.ingestionId || '',
    identifier: d.identifier || d.label || '',
    label:      d.label || d.name || d.identifier || '',
  }));

  window.MyIOLibrary.openDashboardPopupAllReport({
    ...baseParams,
    domain,
    itemsList,  // fornece cross-reference para o AllReportModal
  });
}
```

---

## Notas de Implementação

- `getEnergyGroups()` e `getWaterGroups()` lêem de `window.MyIOOrchestratorData` que é populado após a primeira hidratação bem-sucedida. Chamar antes do carregamento retorna arrays vazios (sem erro).
- A função `categorizeItemsByGroup` é a mesma usada internamente para construir os summaries de energia (eventos `myio:energy-summary-ready`). Os grupos são consistentes com os totais exibidos no HEADER.
- Widgets que usam `window.MyIOUtils` (ex: TELEMETRY) têm acesso automático sem dependência do orchestrator.
