# Mapeamento: Tooltip para Climatização no Widget TELEMETRY

## Objetivo
Implementar um tooltip informativo no card de **Climatização** do widget TELEMETRY (similar ao tooltip existente em "Área Comum" no widget TELEMETRY_INFO).

---

## 1. Referência: Tooltip em TELEMETRY_INFO (Área Comum)

### Localização
**Arquivo:** `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/template.html`

**Linha 115:**
```html
<h3 class="card-title">
  Área Comum
  <span class="info-tooltip" title="Entrada - (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros)">ℹ️</span>
</h3>
```

### Características
- **Elemento:** `<span class="info-tooltip">`
- **Ícone:** `ℹ️` (emoji info)
- **Atributo:** `title` com a fórmula de cálculo
- **Fórmula:** `Entrada - (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros)`

---

## 2. Widget TELEMETRY: Estrutura de Classificação de Climatização

### Arquivos Principais
```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/
├── controller.js       # Lógica de classificação e cálculo
├── template.html       # Template HTML (onde adicionar tooltip)
└── styles.css          # Estilos (se necessário ajustar tooltip)
```

---

## 3. Lógica de Classificação de Climatização

### 3.1 Métodos de Classificação

**Arquivo:** `controller.js`

#### 3.1.1 Classificação por Identifier (RFC-0063)
**Localização:** Linhas 1796-1846

```javascript
function classifyDeviceByIdentifier(identifier = "") {
  const id = String(identifier).trim().toUpperCase();

  // Climatização: CAG, Fancoil
  if (
    id === "CAG" ||
    id === "FANCOIL" ||
    id.startsWith("CAG-") ||
    id.startsWith("FANCOIL-")
  ) {
    return "climatizacao";
  }
  // ... outros
}
```

**Identificadores reconhecidos:**
- `CAG` (Central de Água Gelada)
- `FANCOIL`
- `CAG-*` (qualquer variante com prefixo CAG-)
- `FANCOIL-*` (qualquer variante com prefixo FANCOIL-)

#### 3.1.2 Classificação por Label (Legacy)
**Localização:** Linhas 1853-1893

```javascript
function classifyDeviceByLabel(label = "") {
  const normalized = normalizeLabel(label);

  // Climatização patterns
  if (
    normalized.includes("climatizacao") ||
    normalized.includes("hvac") ||
    normalized.includes("ar condicionado") ||
    normalized.includes("chiller") ||
    normalized.includes("bomba cag") ||
    normalized.includes("fancoil") ||
    normalized.includes("casa de máquina ar") ||
    normalized.includes("bomba primaria") ||
    normalized.includes("bomba secundaria") ||
    normalized.includes("bombas condensadoras") ||
    normalized.includes("bomba condensadora") ||
    normalized.includes("bombas primarias") ||
    normalized.includes("bombas secundarias")
  ) {
    return "climatizacao";
  }
  // ... outros
}
```

**Padrões de label reconhecidos:**
- `climatizacao`
- `hvac`
- `ar condicionado`
- `chiller`
- `bomba cag`
- `fancoil`
- `casa de máquina ar` / `casa de maquina ar`
- `bomba primaria` / `bombas primarias`
- `bomba secundaria` / `bombas secundarias`
- `bomba condensadora` / `bombas condensadoras` / `bombas condensadora`

#### 3.1.3 Método Unificado
**Localização:** Linhas 1900-1942

```javascript
function classifyDevice(item) {
  // Mode 1: Identifier only (prioridade ao identifier)
  if (USE_IDENTIFIER_CLASSIFICATION) {
    const category = classifyDeviceByIdentifier(item.identifier);
    return category || classifyDeviceByLabel(item.label);
  }

  // Mode 2: Hybrid (identifier + label fallback)
  if (USE_HYBRID_CLASSIFICATION) {
    const categoryById = classifyDeviceByIdentifier(item.identifier);
    if (categoryById) return categoryById;
    return classifyDeviceByLabel(item.label);
  }

  // Mode 3: Label only (legacy)
  return classifyDeviceByLabel(item.label);
}
```

**Flags de configuração:**
- `USE_IDENTIFIER_CLASSIFICATION`: Usar apenas identifier
- `USE_HYBRID_CLASSIFICATION`: Usar identifier + label fallback (recomendado)
- Default: Label only (legacy)

---

## 4. Cálculo de Climatização

### 4.1 Agregação de Dispositivos
**Localização:** Linhas 1964-1986

```javascript
// Estrutura de breakdown por categoria
const breakdown = {
  climatizacao: 0,
  elevadores: 0,
  escadas_rolantes: 0,
  outros: 0,
};

// Agregação
STATE.itemsEnriched.forEach((item) => {
  const energia = item.value || 0;  // Valor em kWh
  const category = classifyDevice(item);

  breakdown[category] += energia;
});
```

### 4.2 Emissão de Dados
**Localização:** Linhas 1988-2036

```javascript
const payload = {
  type: "areacomum_breakdown",
  domain: "energy",
  periodKey: periodKey,
  timestamp: Date.now(),
  source: "TELEMETRY_AreaComum",
  data: {
    climatizacao_kWh: breakdown.climatizacao,        // ← Valor em kWh
    climatizacao_MWh: normalizeToMWh(breakdown.climatizacao), // ← Valor em MWh
    elevadores_kWh: breakdown.elevadores,
    elevadores_MWh: normalizeToMWh(breakdown.elevadores),
    escadas_rolantes_kWh: breakdown.escadas_rolantes,
    escadas_rolantes_MWh: normalizeToMWh(breakdown.escadas_rolantes),
    outros_kWh: breakdown.outros,
    outros_MWh: normalizeToMWh(breakdown.outros),
    device_count: STATE.itemsEnriched.length,
  },
};

// Evento emitido para TELEMETRY_INFO consumir
window.dispatchEvent(new CustomEvent("myio:telemetry:update", {
  detail: payload,
  bubbles: true,
  cancelable: false,
}));
```

---

## 5. Fórmula do Tooltip para Climatização

### 5.1 Composição
A climatização é composta pela **soma** de todos os dispositivos classificados como `climatizacao`.

### 5.2 Componentes (baseado nos padrões de classificação)

**Por Identifier (RFC-0063):**
- Todos os devices com `identifier` = `CAG`, `FANCOIL`, `CAG-*`, `FANCOIL-*`

**Por Label (Legacy):**
- Devices cujo label contém:
  - `climatizacao`
  - `hvac`
  - `ar condicionado`
  - `chiller`
  - `bomba cag`
  - `fancoil`
  - `casa de máquina ar`
  - `bomba primaria` / `bomba secundaria`
  - `bomba condensadora`

### 5.3 Texto do Tooltip (Proposta)

**Opção 1 - Simples:**
```
Climatização = Soma de CAG + Fancoils + Chillers + Bombas
```

**Opção 2 - Detalhada:**
```
Climatização = CAG + Fancoils + Chillers + Bombas (Primárias + Secundárias + Condensadoras)
```

**Opção 3 - Técnica (RFC-0063):**
```
Climatização = Dispositivos identificados como CAG, FANCOIL, Chillers e Bombas CAG
```

**Opção 4 - Lista Completa:**
```
Climatização = CAG + Fancoils + Chillers + Bombas Primárias + Bombas Secundárias + Bombas Condensadoras + HVAC
```

---

## 6. Implementação (NÃO FAZER AINDA - APENAS MAPEAMENTO)

### 6.1 Local de Implementação
**Arquivo:** `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/template.html`

**Buscar pelo card de Climatização:**
```html
<!-- Procurar estrutura similar a esta -->
<div class="info-card climatizacao-card">
  <div class="card-header">
    <span class="card-icon">❄️</span>
    <h3 class="card-title">Climatização</h3>  <!-- ← Adicionar tooltip aqui -->
  </div>
  <div class="card-body">
    <!-- ... valores ... -->
  </div>
</div>
```

### 6.2 Modificação Proposta
```html
<h3 class="card-title">
  Climatização
  <span class="info-tooltip"
        title="Climatização = CAG + Fancoils + Chillers + Bombas (Primárias + Secundárias + Condensadoras)">
    ℹ️
  </span>
</h3>
```

### 6.3 CSS (se necessário)
**Arquivo:** `styles.css` (se ainda não existir estilo para `.info-tooltip`)

```css
.info-tooltip {
  cursor: help;
  font-size: 0.85em;
  margin-left: 4px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.info-tooltip:hover {
  opacity: 1;
}
```

---

## 7. Evitar Busca por Label/Name (Melhoria Futura - RFC-0063)

### 7.1 Problema Atual
O código ainda usa classificação por **label** (texto livre), o que é:
- ❌ Frágil (depende de convenções de nomenclatura)
- ❌ Propenso a erros (typos quebram classificação)
- ❌ Ambíguo ("Bomba Lojas" poderia ser classificada errado)

### 7.2 Solução Recomendada (RFC-0063)
**Usar atributo `identifier` estruturado:**

```javascript
// ✅ BOM: Usar identifier (enum controlado)
if (item.identifier === "CAG") {
  return "climatizacao";
}

// ❌ EVITAR: Buscar por label (texto livre)
if (item.label.includes("bomba cag")) {
  return "climatizacao";
}
```

### 7.3 Flags de Configuração
**Arquivo:** `controller.js` (início do arquivo)

```javascript
// RFC-0063: Classification mode flags
let USE_IDENTIFIER_CLASSIFICATION = true;   // ← Priorizar identifier
let USE_HYBRID_CLASSIFICATION = true;        // ← Fallback para label
```

**Recomendação:**
- ✅ Manter `USE_HYBRID_CLASSIFICATION = true` (identifier + label fallback)
- ✅ Migrar todos os devices para terem `identifier` correto
- ⚠️ Depreciar `USE_IDENTIFIER_CLASSIFICATION = false` (label-only mode)

---

## 8. Dispositivos Mapeados para Climatização

### 8.1 Estrutura de Dados (STATE)
**Arquivo:** `controller.js`

```javascript
STATE.itemsEnriched = [
  {
    id: "device123",
    label: "Chiller 01 - Piso Térreo",
    identifier: "CAG",              // ← Usado para classificação
    value: 150.5,                   // ← Energia em kWh
    // ... outros atributos
  },
  {
    id: "device456",
    label: "Bomba Primária CAG",
    identifier: "CAG-BOMBA-PRIMARIA",
    value: 45.2,
    // ...
  }
  // ... mais devices
];
```

### 8.2 Exemplo de Classificação
```javascript
// Exemplo 1: Classificado por identifier
{
  identifier: "CAG",
  label: "Chiller Principal"
}
// → Resultado: "climatizacao"

// Exemplo 2: Classificado por identifier com prefixo
{
  identifier: "CAG-BOMBA-SEC",
  label: "Bomba Secundária"
}
// → Resultado: "climatizacao"

// Exemplo 3: Fallback para label (sem identifier)
{
  identifier: null,
  label: "Bomba Primária CAG"
}
// → Resultado: "climatizacao" (via classifyDeviceByLabel)

// Exemplo 4: Não classificado
{
  identifier: null,
  label: "Iluminação Corredor"
}
// → Resultado: "outros"
```

---

## 9. Resumo: O que contabiliza para Climatização

### 9.1 Critérios de Inclusão

**1. Por Identifier (Prioridade 1 - RFC-0063):**
- `identifier === "CAG"`
- `identifier === "FANCOIL"`
- `identifier.startsWith("CAG-")`
- `identifier.startsWith("FANCOIL-")`

**2. Por Label (Fallback - Legacy):**
- Label contém qualquer um dos termos:
  - `climatizacao`
  - `hvac`
  - `ar condicionado`
  - `chiller`
  - `bomba cag`
  - `fancoil`
  - `casa de máquina ar`
  - `bomba primaria` / `bombas primarias`
  - `bomba secundaria` / `bombas secundarias`
  - `bomba condensadora` / `bombas condensadoras`

**3. Normalização de Label:**
```javascript
// Função normalizeLabel() remove acentos e converte para lowercase
function normalizeLabel(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // Remove acentos
    .toLowerCase()
    .trim();
}

// Exemplos:
// "Bomba Primária CAG" → "bomba primaria cag" ✅ Match
// "Climatização HVAC"  → "climatizacao hvac"  ✅ Match
// "Chíller 01"         → "chiller 01"         ✅ Match
```

### 9.2 Cálculo Final
```javascript
// Pseudo-código
let climatizacao_total = 0;

for (device of devices_area_comum) {
  if (classifyDevice(device) === "climatizacao") {
    climatizacao_total += device.value;  // Soma em kWh
  }
}

// climatizacao_total = soma de TODOS os devices classificados como "climatizacao"
```

---

## 10. Checklist de Implementação (FUTURO)

### ✅ Mapeamento (ESTE DOCUMENTO)
- [x] Identificar tooltip de referência (TELEMETRY_INFO)
- [x] Mapear lógica de classificação (controller.js)
- [x] Documentar padrões de identifier
- [x] Documentar padrões de label
- [x] Propor texto do tooltip
- [x] Identificar local de implementação

### ⏳ Implementação (NÃO FAZER AGORA)
- [ ] Localizar template.html do widget TELEMETRY
- [ ] Encontrar card de Climatização no HTML
- [ ] Adicionar `<span class="info-tooltip">` com texto apropriado
- [ ] Testar tooltip no browser
- [ ] Verificar se CSS já existe ou precisa ser adicionado
- [ ] Validar com usuário

### 🔮 Melhorias Futuras (RFC-0063)
- [ ] Migrar todos devices para usar `identifier` estruturado
- [ ] Depreciar classificação por label
- [ ] Adicionar validação de consistência (devices sem identifier)
- [ ] Criar dashboard de monitoramento de classificação

---

## 11. Referências

### Arquivos Relacionados
```
src/thingsboard/main-dashboard-shopping/v-5.2.0/
├── WIDGET/
│   ├── TELEMETRY_INFO/
│   │   ├── controller.js           # Receptor de dados, calcula Área Comum
│   │   └── template.html           # ← TOOLTIP DE REFERÊNCIA (linha 115)
│   └── TELEMETRY/
│       ├── controller.js           # ← CLASSIFICAÇÃO E CÁLCULO (linhas 1796-2036)
│       ├── template.html           # ← ADICIONAR TOOLTIP AQUI
│       └── styles.css              # Estilos (se necessário)
```

### RFCs Relacionados
- **RFC-0056:** Grid 2 columns layout with 6 categories
- **RFC-0063:** Identifier-Based Classification (evitar busca por label)
- **RFC-0002:** Multi-domain support (energy, water, gas)

### Eventos e Comunicação
```javascript
// Evento emitido por TELEMETRY (Área Comum)
window.dispatchEvent(new CustomEvent("myio:telemetry:update", {
  detail: {
    type: "areacomum_breakdown",
    data: {
      climatizacao_kWh: 1234.56,
      climatizacao_MWh: 1.23,
      // ...
    }
  }
}));

// Consumido por TELEMETRY_INFO
window.addEventListener('myio:telemetry:update', (ev) => {
  const { type, data } = ev.detail;
  if (type === 'areacomum_breakdown') {
    STATE.consumidores.climatizacao.total = data.climatizacao_kWh;
    // ...
  }
});
```

---

## 12. Notas Finais

### ⚠️ IMPORTANTE
**ESTE É APENAS UM MAPEAMENTO - NÃO IMPLEMENTAR AINDA**

O objetivo deste documento é:
1. ✅ Documentar a lógica existente de classificação
2. ✅ Mapear todos os padrões que incluem devices em "Climatização"
3. ✅ Propor texto para o tooltip
4. ✅ Identificar onde será implementado
5. ⏳ **Aguardar aprovação antes de implementar**

### 🎯 Próximos Passos
1. Revisar este mapeamento
2. Aprovar texto do tooltip
3. Confirmar se há necessidade de tooltip em outras categorias (Elevadores, Esc. Rolantes, etc.)
4. Implementar após aprovação

### 📞 Dúvidas ou Alterações
- Se precisar alterar a fórmula do tooltip, editar seção **5.3**
- Se precisar adicionar/remover padrões de classificação, consultar seções **3.1** e **9.1**
- Se precisar entender o fluxo de dados completo, consultar seção **11 (Eventos e Comunicação)**

---

**Documento criado em:** 2025-01-24
**Versão:** 1.0
**Widget:** TELEMETRY v-5.2.0
**Status:** Mapeamento Completo ✅ | Implementação Pendente ⏳
