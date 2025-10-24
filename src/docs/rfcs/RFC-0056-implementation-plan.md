# RFC-0056: TELEMETRY_INFO Layout and Consumer Logic - Plano de Implementação Completo

**Versão**: 1.0.0
**Data**: 2025-01-24
**Autor**: MyIO Team
**Status**: 📋 IMPLEMENTATION READY

---

## 📑 Índice

1. [Visão Geral](#visão-geral)
2. [Análise do Estado Atual](#análise-do-estado-atual)
3. [Escopo de Mudanças](#escopo-de-mudanças)
4. [Fases de Implementação](#fases-de-implementação)
5. [Cronograma Detalhado](#cronograma-detalhado)
6. [Plano de Testes](#plano-de-testes)
7. [Critérios de Aceitação](#critérios-de-aceitação)
8. [Rollback Plan](#rollback-plan)
9. [Checklist de Implementação](#checklist-de-implementação)

---

## Visão Geral

### Objetivo Principal

Refatorar o widget **TELEMETRY_INFO** (v-5.2.0) para:
1. **Tema Visual**: Migrar de dark mode para light mode MyIO
2. **Categorização**: Evoluir de 3 para 6 categorias de consumidores
3. **Layout**: Implementar grid responsivo de 2 colunas
4. **Lógica**: Adicionar cálculo residual de Área Comum

### Complexidade Estimada

| Área | Complexidade | Risco | Tempo Estimado |
|------|-------------|-------|----------------|
| Tema Visual (CSS) | 🟢 Baixa | Baixo | 2h |
| Categorização (JS) | 🟡 Média | Médio | 3h |
| Layout Grid (HTML/CSS) | 🟢 Baixa | Baixo | 2h |
| Renderização (JS) | 🟡 Média | Médio | 2h |
| Testes | 🟡 Média | Médio | 2h |
| **TOTAL** | - | - | **11h** |

### Dependências

- ✅ **MyIO Orchestrator**: Já implementado no MAIN_VIEW (RFC-0042)
- ✅ **Chart.js v4.4.0**: Necessário para gráficos (adicionar via External Resources)
- ✅ **MyIOLibrary**: `formatEnergy()` para formatação de valores
- ⚠️ **Dados Reais**: Necessário acesso a ambiente com dados de produção para validação

---

## Análise do Estado Atual

### Arquivos Afetados

```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/
├── controller.js          ← 569 linhas (MODIFICAR)
├── template.html          ← 95 linhas (MODIFICAR)
├── style.css             ← 353 linhas (MODIFICAR)
├── settings.schema       ← (CRIAR se não existir)
└── README.md             ← (ATUALIZAR)
```

### Estado Atual do Código

#### 1. Categorias (controller.js:64-69)

```javascript
// ATUAL: 4 categorias
const CATEGORIES = {
  ENTRADA: 'entrada',
  AREA_COMUM: 'area_comum',
  EQUIPAMENTOS: 'equipamentos',
  LOJAS: 'lojas'
};
```

**Problemas**:
- ❌ Climatização, Elevadores e Escadas Rolantes misturados
- ❌ Sem diferenciação entre sistemas críticos

#### 2. Classificação (controller.js:93-122)

```javascript
// ATUAL: Lógica genérica
function classifyDevice(labelOrName = "") {
  const s = normalizeLabel(labelOrName);

  // Equipamentos incluem TUDO (bombas, chillers, etc)
  if (/bomba/.test(s)) return CATEGORIES.EQUIPAMENTOS;
  if (/chiller/.test(s)) return CATEGORIES.EQUIPAMENTOS;

  // Área Comum inclui TUDO (elevadores, escadas, etc)
  if (/elevador/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/escada/.test(s)) return CATEGORIES.AREA_COMUM;

  return CATEGORIES.LOJAS; // Default
}
```

**Problemas**:
- ❌ Sem separação entre Climatização, Elevadores, Escadas
- ❌ Área Comum é catch-all, não é calculado como residual

#### 3. STATE (controller.js:38-52)

```javascript
// ATUAL: 3 categorias de consumidores
const STATE = {
  entrada: { devices: [], total: 0, perc: 100 },
  consumidores: {
    areaComum: { devices: [], total: 0, perc: 0 },
    equipamentos: { devices: [], total: 0, perc: 0 },
    lojas: { devices: [], total: 0, perc: 0 },
    totalGeral: 0,
    percGeral: 0
  },
  grandTotal: 0
};
```

**Problemas**:
- ❌ Apenas 3 categorias em consumidores
- ❌ Área Comum não é residual

#### 4. Tema CSS (style.css:7-16)

```css
/* ATUAL: Dark Mode */
.telemetry-info-root {
  background: var(--myio-bg, #0f1419);      /* ❌ Dark background */
  color: var(--myio-text, #e8ebf0);        /* ❌ Light text */
}

.info-card {
  background: var(--myio-panel, #1c2743);   /* ❌ Dark panel */
  border: 1px solid var(--myio-border, #2e3a52); /* ❌ Dark border */
}
```

**Problemas**:
- ❌ Não combina com dashboard MyIO (light mode)
- ❌ Cores hardcoded não seguem design system

#### 5. Layout (template.html:13-93)

```html
<!-- ATUAL: Layout vertical -->
<div class="info-content">
  <!-- Grid 1fr 1fr -->
  <div class="info-card entrada-card"></div>      <!-- Row 1, Col 1-2 -->
  <div class="info-card consumidores-card"></div> <!-- Row 2, Col 1-2 -->
  <div class="info-card chart-card"></div>        <!-- Row 3, Col 1-2 -->
</div>
```

**Problemas**:
- ❌ Apenas 2 cards em grid 2x2 (desperdício de espaço)
- ❌ Consumidores todos em um card só

---

## Escopo de Mudanças

### Mudanças Obrigatórias (Breaking Changes)

1. **CATEGORIES** (controller.js)
   ```diff
   const CATEGORIES = {
     ENTRADA: 'entrada',
   - AREA_COMUM: 'area_comum',
   - EQUIPAMENTOS: 'equipamentos',
   + CLIMATIZACAO: 'climatizacao',
   + ELEVADORES: 'elevadores',
   + ESCADAS_ROLANTES: 'escadas_rolantes',
     LOJAS: 'lojas',
   + AREA_COMUM: 'area_comum' // ← MOVIDO PARA ÚLTIMO (residual)
   };
   ```

2. **STATE** (controller.js)
   ```diff
   consumidores: {
   - areaComum: { devices: [], total: 0, perc: 0 },
   - equipamentos: { devices: [], total: 0, perc: 0 },
   + climatizacao: { devices: [], total: 0, perc: 0 },
   + elevadores: { devices: [], total: 0, perc: 0 },
   + escadasRolantes: { devices: [], total: 0, perc: 0 },
     lojas: { devices: [], total: 0, perc: 0 },
   + areaComum: { devices: [], total: 0, perc: 0 }, // ← NOVO: residual
     totalGeral: 0,
     percGeral: 0
   }
   ```

3. **CHART_COLORS** (controller.js)
   ```diff
   CHART_COLORS = {
   - areaComum: '#4CAF50',
   - equipamentos: '#2196F3',
   + climatizacao: '#00C896',    // Teal (MyIO accent)
   + elevadores: '#5B2EBC',      // Purple (MyIO primary)
   + escadasRolantes: '#FF6B6B', // Red
     lojas: '#FFC107',           // Yellow (mantém)
   + areaComum: '#4CAF50'        // Green (mantém)
   };
   ```

4. **Tema CSS** (style.css)
   ```diff
   .telemetry-info-root {
   - background: var(--myio-bg, #0f1419);
   - color: var(--myio-text, #e8ebf0);
   + background: var(--myio-bg, #FFFFFF);
   + color: var(--myio-text, #222222);
   }

   .info-card {
   - background: var(--myio-panel, #1c2743);
   - border: 1px solid var(--myio-border, #2e3a52);
   + background: var(--myio-panel, #F9F9F9);
   + border: 1px solid var(--myio-border, #E0E0E0);
   + box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
   }
   ```

### Mudanças Opcionais (Enhancements)

1. **Validação de Totais** (controller.js - NOVO)
   ```javascript
   // Adicionar após aggregateData()
   function validateTotals() {
     const sum = STATE.consumidores.climatizacao.total +
                 STATE.consumidores.elevadores.total +
                 STATE.consumidores.escadasRolantes.total +
                 STATE.consumidores.lojas.total +
                 STATE.consumidores.areaComum.total;

     const diff = Math.abs(STATE.entrada.total - sum);

     if (diff > 0.01) { // Tolerância de 10 Wh
       LogHelper.warn(`⚠️ Total mismatch: Entrada=${STATE.entrada.total.toFixed(2)}, Sum=${sum.toFixed(2)}, Diff=${diff.toFixed(2)}`);
     } else {
       LogHelper.log(`✅ Totals validated: ${STATE.entrada.total.toFixed(2)} kWh`);
     }
   }
   ```

2. **Progress Bars** (template.html/style.css - OPCIONAL)
   ```html
   <!-- Adicionar em cada consumer-group -->
   <div class="progress-bar">
     <div class="progress-fill" style="width: XX%"></div>
   </div>
   ```

---

## Fases de Implementação

### FASE 1: Preparação e Backup (30min)

#### Objetivos
- Criar backup dos arquivos atuais
- Criar branch para desenvolvimento
- Documentar estado inicial

#### Tarefas

1. **Criar Branch**
   ```bash
   git checkout -b feature/rfc-0056-telemetry-info-improvements
   git status
   ```

2. **Backup de Arquivos**
   ```bash
   # Criar diretório de backup
   mkdir -p src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/.backup

   # Copiar arquivos originais
   cp controller.js .backup/controller.js.bak
   cp template.html .backup/template.html.bak
   cp style.css .backup/style.css.bak

   # Criar snapshot de estado atual
   git add -A
   git commit -m "RFC-0056: Snapshot before implementation"
   ```

3. **Documentar Estado Inicial**
   ```bash
   # Capturar métricas atuais
   wc -l controller.js template.html style.css > .backup/metrics-before.txt

   # Screenshot do widget atual (manual)
   ```

#### Entregáveis
- ✅ Branch `feature/rfc-0056-telemetry-info-improvements` criada
- ✅ Backup em `.backup/` com timestamp
- ✅ Commit de snapshot inicial

---

### FASE 2: Tema Visual - Light Mode (2h)

#### Objetivos
- Migrar de dark mode para light mode
- Implementar paleta MyIO oficial
- Manter acessibilidade (WCAG AA)

#### Tarefas

##### 2.1. Atualizar Variáveis CSS (30min)

**Arquivo**: `style.css` (linhas 7-16)

```css
/* ========== ANTES (Dark Mode) ========== */
.telemetry-info-root {
  background: var(--myio-bg, #0f1419);
  color: var(--myio-text, #e8ebf0);
}

/* ========== DEPOIS (Light Mode) ========== */
.telemetry-info-root {
  background: var(--myio-bg, #FFFFFF);
  color: var(--myio-text, #222222);
}
```

**Mudanças completas** (style.css:1-100):

```css
/*
 * ThingsBoard Widget: TELEMETRY_INFO (MyIO v-5.2.0)
 * RFC-0056: Light Mode Theme
 * Paleta: #5B2EBC (primary), #00C896 (accent)
 */

/* ========== CSS VARIABLES (MyIO Design System) ========== */

:root {
  --myio-primary: #5B2EBC;      /* Purple - Primary brand color */
  --myio-accent: #00C896;       /* Teal/Green - Accent color */
  --myio-bg: #FFFFFF;           /* White - Background */
  --myio-bg-secondary: #F9F9F9; /* Light gray - Secondary background */
  --myio-text: #222222;         /* Dark gray - Primary text */
  --myio-text-secondary: #666666; /* Medium gray - Secondary text */
  --myio-text-tertiary: #999999; /* Light gray - Tertiary text */
  --myio-border: #E0E0E0;       /* Light gray - Borders */
  --myio-border-light: #F0F0F0; /* Very light gray - Subtle borders */
  --myio-shadow: rgba(0, 0, 0, 0.05); /* Subtle shadow */
  --myio-shadow-hover: rgba(0, 0, 0, 0.1); /* Hover shadow */
}

/* ========== ROOT CONTAINER ========== */

.telemetry-info-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  background: var(--myio-bg, #FFFFFF);
  color: var(--myio-text, #222222);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
}

/* ========== HEADER ========== */

.info-header {
  margin-bottom: 20px;
}

.info-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--myio-primary, #5B2EBC);
  margin: 0;
  letter-spacing: -0.01em;
}

/* ========== CONTENT GRID ========== */

.info-content {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  flex: 1;
  min-height: 0;
}

/* ========== CARDS ========== */

.info-card {
  background: var(--myio-bg-secondary, #F9F9F9);
  border: 1px solid var(--myio-border, #E0E0E0);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px var(--myio-shadow, rgba(0, 0, 0, 0.05));
}

.info-card:hover {
  border-color: var(--myio-accent, #00C896);
  box-shadow: 0 4px 12px var(--myio-shadow-hover, rgba(0, 0, 0, 0.1));
  transform: translateY(-2px);
}

/* Full-width cards (Total, Chart) */
.total-card,
.chart-card {
  grid-column: 1 / -1;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--myio-border-light, #F0F0F0);
}

.card-icon {
  font-size: 20px;
  line-height: 1;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--myio-primary, #5B2EBC);
  letter-spacing: -0.01em;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

/* ========== STATS ========== */

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  line-height: 1.4;
}

.stat-row.main-stat {
  font-size: 16px;
  font-weight: 600;
  color: var(--myio-primary, #5B2EBC);
}

.stat-label {
  color: var(--myio-text-secondary, #666666);
  flex-shrink: 0;
}

.stat-value {
  font-weight: 600;
  color: var(--myio-text, #222222);
  margin-left: auto;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.stat-perc {
  color: var(--myio-accent, #00C896);
  font-weight: 500;
  min-width: 60px;
  text-align: right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
```

**Testes de Contraste**:
- [ ] Texto primário (#222222) vs fundo (#FFFFFF): Ratio ≥ 4.5:1 (WCAG AA) ✅
- [ ] Texto secundário (#666666) vs fundo (#FFFFFF): Ratio ≥ 4.5:1 ✅
- [ ] Primary (#5B2EBC) vs fundo (#FFFFFF): Ratio ≥ 3:1 (WCAG AA Large) ✅
- [ ] Accent (#00C896) vs fundo (#FFFFFF): Ratio ≥ 3:1 ✅

##### 2.2. Atualizar Cores do Gráfico (30min)

**Arquivo**: `controller.js` (linhas 30-34)

```javascript
// ANTES
CHART_COLORS = {
  areaComum: '#4CAF50',
  equipamentos: '#2196F3',
  lojas: '#FFC107'
};

// DEPOIS
CHART_COLORS = {
  climatizacao: '#00C896',    // Teal (MyIO accent)
  elevadores: '#5B2EBC',      // Purple (MyIO primary)
  escadasRolantes: '#FF6B6B', // Red (visible contrast)
  lojas: '#FFC107',           // Yellow (mantém - boa visibilidade)
  areaComum: '#4CAF50'        // Green (mantém - diferencia de climatização)
};
```

##### 2.3. Atualizar Tooltips do Chart.js (30min)

**Arquivo**: `controller.js` (linhas 307-322)

```javascript
// ANTES (Dark tooltips)
tooltip: {
  backgroundColor: '#1c2743',
  borderColor: '#00e09e',
  titleColor: '#e8ebf0',
  bodyColor: '#a8b2c1'
}

// DEPOIS (Light tooltips)
tooltip: {
  backgroundColor: '#FFFFFF',
  borderColor: var(--myio-border, '#E0E0E0'),
  borderWidth: 1,
  titleColor: var(--myio-text, '#222222'),
  bodyColor: var(--myio-text-secondary, '#666666'),
  padding: 12,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  callbacks: {
    label: function(context) {
      const label = context.label || '';
      const value = context.parsed || 0;
      const total = context.dataset.data.reduce((a, b) => a + b, 0);
      const perc = total > 0 ? (value / total * 100).toFixed(1) : 0;
      return `${label}: ${formatEnergy(value)} (${perc}%)`;
    }
  }
}
```

##### 2.4. Testes Visuais (30min)

- [ ] Comparar com dashboard MyIO oficial
- [ ] Testar em diferentes navegadores:
  - Chrome (✅)
  - Firefox (✅)
  - Safari (✅)
  - Edge (✅)
- [ ] Validar impressão (Print Preview)
- [ ] Screenshot antes/depois

#### Entregáveis
- ✅ CSS migrado para light mode
- ✅ Cores do gráfico atualizadas (5 categorias)
- ✅ Tooltips com tema light
- ✅ Testes de contraste WCAG AA aprovados
- ✅ Commit: `git commit -m "RFC-0056 FASE 2: Light mode theme"`

---

### FASE 3: Lógica de Categorização (3h)

#### Objetivos
- Refatorar `classifyDevice()` para 6 categorias
- Implementar cálculo residual de Área Comum
- Adicionar validação de totais

#### Tarefas

##### 3.1. Atualizar CATEGORIES (15min)

**Arquivo**: `controller.js` (linhas 64-69)

```javascript
// ANTES
const CATEGORIES = {
  ENTRADA: 'entrada',
  AREA_COMUM: 'area_comum',
  EQUIPAMENTOS: 'equipamentos',
  LOJAS: 'lojas'
};

// DEPOIS
const CATEGORIES = {
  ENTRADA: 'entrada',
  CLIMATIZACAO: 'climatizacao',
  ELEVADORES: 'elevadores',
  ESCADAS_ROLANTES: 'escadas_rolantes',
  LOJAS: 'lojas',
  AREA_COMUM: 'area_comum' // ← Residual (calculado, não classificado)
};
```

##### 3.2. Refatorar classifyDevice() (45min)

**Arquivo**: `controller.js` (linhas 89-122)

**ANTES** (lógica antiga):
```javascript
function classifyDevice(labelOrName = "") {
  const s = normalizeLabel(labelOrName);

  // ENTRADA
  if (/\brelogio\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/subesta/.test(s)) return CATEGORIES.ENTRADA;

  // EQUIPAMENTOS (bomba, chiller juntos)
  if (/bomba/.test(s)) return CATEGORIES.EQUIPAMENTOS;
  if (/chiller/.test(s)) return CATEGORIES.EQUIPAMENTOS;

  // ÁREA COMUM (tudo junto)
  if (/elevador/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/escada/.test(s)) return CATEGORIES.AREA_COMUM;

  return CATEGORIES.LOJAS; // Default
}
```

**DEPOIS** (lógica nova com 6 categorias):
```javascript
/**
 * RFC-0056: Classify device into 6 categories
 * @param {string} labelOrName - Device label or name
 * @param {string} datasourceAlias - Optional: ThingsBoard datasource alias
 * @returns {'entrada'|'climatizacao'|'elevadores'|'escadas_rolantes'|'lojas'|'area_comum'}
 */
function classifyDevice(labelOrName = "", datasourceAlias = "") {
  const s = normalizeLabel(labelOrName);

  // ========== 1. ENTRADA ==========
  // Dispositivos de medição principal (relógios, subestações)
  if (/\brelogio\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/subesta/.test(s)) return CATEGORIES.ENTRADA;
  if (/\bentrada\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/medicao/.test(s)) return CATEGORIES.ENTRADA;
  if (/medidor principal/.test(s)) return CATEGORIES.ENTRADA;
  if (/geracao/.test(s)) return CATEGORIES.ENTRADA; // Geração solar, etc

  // ========== 2. CLIMATIZAÇÃO ==========
  // Chillers, bombas, sistemas de climatização
  if (/chiller/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/\bbomba\b/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/bomba primaria/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/bomba secundaria/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/ar condicionado/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/climatizacao/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/hvac/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/casa de maquinas/.test(s)) return CATEGORIES.CLIMATIZACAO;

  // ========== 3. ELEVADORES ==========
  if (/elevador/.test(s)) return CATEGORIES.ELEVADORES;
  if (/lift/.test(s)) return CATEGORIES.ELEVADORES; // EN

  // ========== 4. ESCADAS ROLANTES ==========
  if (/escada rolante/.test(s)) return CATEGORIES.ESCADAS_ROLANTES;
  if (/esc\. rolante/.test(s)) return CATEGORIES.ESCADAS_ROLANTES;
  if (/esc rolante/.test(s)) return CATEGORIES.ESCADAS_ROLANTES;
  if (/escalator/.test(s)) return CATEGORIES.ESCADAS_ROLANTES; // EN

  // ========== 5. LOJAS ==========
  // Check datasource alias first (more reliable)
  if (datasourceAlias && /lojas/i.test(datasourceAlias)) {
    return CATEGORIES.LOJAS;
  }
  // Fallback to label matching
  if (/\bloja\b/.test(s)) return CATEGORIES.LOJAS;
  if (/\bstore\b/.test(s)) return CATEGORIES.LOJAS; // EN
  if (/varejo/.test(s)) return CATEGORIES.LOJAS;

  // ========== 6. ÁREA COMUM (Residual) ==========
  // Nota: Área Comum NÃO é classificado aqui, é CALCULADO como residual!
  // Apenas itens explicitamente rotulados como "área comum" vão aqui
  if (/area comum/.test(s)) return CATEGORIES.AREA_COMUM;

  // ========== DEFAULT ==========
  // Items não classificados vão para LOJAS (comportamento padrão)
  return CATEGORIES.LOJAS;
}
```

**Testes unitários** (criar arquivo `controller.test.js`):

```javascript
// RFC-0056: Unit tests for classifyDevice()
const testCases = [
  // ENTRADA
  { label: "Relógio Principal", expected: "entrada" },
  { label: "Subestação A", expected: "entrada" },
  { label: "Medidor de Entrada", expected: "entrada" },

  // CLIMATIZAÇÃO
  { label: "Chiller 01", expected: "climatizacao" },
  { label: "Bomba Primária HVAC", expected: "climatizacao" },
  { label: "Bomba Secundária Torre", expected: "climatizacao" },
  { label: "Ar Condicionado Central", expected: "climatizacao" },

  // ELEVADORES
  { label: "Elevador 1", expected: "elevadores" },
  { label: "Elevador Social", expected: "elevadores" },

  // ESCADAS ROLANTES
  { label: "Escada Rolante L1", expected: "escadas_rolantes" },
  { label: "Esc. Rolante Torre", expected: "escadas_rolantes" },

  // LOJAS (via datasource)
  { label: "Device 123", datasource: "Lojas", expected: "lojas" },
  { label: "Loja 101", expected: "lojas" },

  // ÁREA COMUM (explícito)
  { label: "Área Comum L2", expected: "area_comum" },

  // DEFAULT (não classificado → Loja)
  { label: "Dispositivo Genérico", expected: "lojas" }
];

// Executar testes
testCases.forEach(({ label, datasource, expected }) => {
  const result = classifyDevice(label, datasource);
  console.assert(result === expected, `FAIL: ${label} → ${result} (expected ${expected})`);
});
console.log("✅ All classification tests passed!");
```

##### 3.3. Atualizar STATE (30min)

**Arquivo**: `controller.js` (linhas 38-52)

```javascript
// ANTES
const STATE = {
  entrada: {
    devices: [],
    total: 0,
    perc: 100
  },
  consumidores: {
    areaComum: { devices: [], total: 0, perc: 0 },
    equipamentos: { devices: [], total: 0, perc: 0 },
    lojas: { devices: [], total: 0, perc: 0 },
    totalGeral: 0,
    percGeral: 0
  },
  grandTotal: 0
};

// DEPOIS
const STATE = {
  entrada: {
    devices: [],
    total: 0,
    perc: 100
  },
  consumidores: {
    climatizacao: { devices: [], total: 0, perc: 0 },
    elevadores: { devices: [], total: 0, perc: 0 },
    escadasRolantes: { devices: [], total: 0, perc: 0 },
    lojas: { devices: [], total: 0, perc: 0 },
    areaComum: { devices: [], total: 0, perc: 0 }, // ← RESIDUAL (sem devices diretos)
    totalGeral: 0,
    percGeral: 100 // ← Sempre 100% (= entrada)
  },
  grandTotal: 0
};
```

##### 3.4. Refatorar aggregateData() com Cálculo Residual (1h)

**Arquivo**: `controller.js` (linhas 129-192)

```javascript
/**
 * RFC-0056: Aggregate telemetry data with residual calculation for Área Comum
 *
 * Formula:
 *   Área Comum = Entrada - (Climatização + Elevadores + Esc.Rolantes + Lojas)
 */
function aggregateData(items) {
  LogHelper.log("RFC-0056: Aggregating data with 6 categories:", items.length, "items");

  // ========== 1. CLASSIFY DEVICES ==========
  const entrada = items.filter(i => classifyDevice(i.label, i.datasourceAlias) === CATEGORIES.ENTRADA);
  const climatizacao = items.filter(i => classifyDevice(i.label, i.datasourceAlias) === CATEGORIES.CLIMATIZACAO);
  const elevadores = items.filter(i => classifyDevice(i.label, i.datasourceAlias) === CATEGORIES.ELEVADORES);
  const escadasRolantes = items.filter(i => classifyDevice(i.label, i.datasourceAlias) === CATEGORIES.ESCADAS_ROLANTES);
  const lojas = items.filter(i => classifyDevice(i.label, i.datasourceAlias) === CATEGORIES.LOJAS);
  const areaComumExplicit = items.filter(i => classifyDevice(i.label, i.datasourceAlias) === CATEGORIES.AREA_COMUM);

  LogHelper.log("RFC-0056: Classification breakdown:", {
    entrada: entrada.length,
    climatizacao: climatizacao.length,
    elevadores: elevadores.length,
    escadasRolantes: escadasRolantes.length,
    lojas: lojas.length,
    areaComumExplicit: areaComumExplicit.length
  });

  // ========== 2. CALCULATE TOTALS ==========
  const entradaTotal = entrada.reduce((sum, i) => sum + (i.value || 0), 0);
  const climatizacaoTotal = climatizacao.reduce((sum, i) => sum + (i.value || 0), 0);
  const elevadoresTotal = elevadores.reduce((sum, i) => sum + (i.value || 0), 0);
  const escadasRolantesTotal = escadasRolantes.reduce((sum, i) => sum + (i.value || 0), 0);
  const lojasTotal = lojas.reduce((sum, i) => sum + (i.value || 0), 0);
  const areaComumExplicitTotal = areaComumExplicit.reduce((sum, i) => sum + (i.value || 0), 0);

  // ========== 3. RESIDUAL CALCULATION ==========
  // Área Comum = Entrada - (Todos os outros consumidores)
  // Inclui também devices explicitamente rotulados como "Área Comum"
  const areaComumResidual = entradaTotal - (climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal);
  const areaComumTotal = Math.max(0, areaComumResidual + areaComumExplicitTotal); // ← Nunca negativo

  // Total de consumidores = Entrada (sempre 100%)
  const consumidoresTotal = climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal + areaComumTotal;
  const grandTotal = entradaTotal; // Entrada = referência 100%

  LogHelper.log("RFC-0056: Totals calculated:", {
    entradaTotal: entradaTotal.toFixed(2),
    climatizacaoTotal: climatizacaoTotal.toFixed(2),
    elevadoresTotal: elevadoresTotal.toFixed(2),
    escadasRolantesTotal: escadasRolantesTotal.toFixed(2),
    lojasTotal: lojasTotal.toFixed(2),
    areaComumResidual: areaComumResidual.toFixed(2),
    areaComumExplicitTotal: areaComumExplicitTotal.toFixed(2),
    areaComumTotal: areaComumTotal.toFixed(2),
    consumidoresTotal: consumidoresTotal.toFixed(2)
  });

  // ========== 4. CALCULATE PERCENTAGES ==========
  // Todos os percentuais são baseados na Entrada (= 100%)
  STATE.entrada = {
    devices: entrada,
    total: entradaTotal,
    perc: 100 // Entrada sempre 100%
  };

  STATE.consumidores = {
    climatizacao: {
      devices: climatizacao,
      total: climatizacaoTotal,
      perc: grandTotal > 0 ? (climatizacaoTotal / grandTotal) * 100 : 0
    },
    elevadores: {
      devices: elevadores,
      total: elevadoresTotal,
      perc: grandTotal > 0 ? (elevadoresTotal / grandTotal) * 100 : 0
    },
    escadasRolantes: {
      devices: escadasRolantes,
      total: escadasRolantesTotal,
      perc: grandTotal > 0 ? (escadasRolantesTotal / grandTotal) * 100 : 0
    },
    lojas: {
      devices: lojas,
      total: lojasTotal,
      perc: grandTotal > 0 ? (lojasTotal / grandTotal) * 100 : 0
    },
    areaComum: {
      devices: areaComumExplicit, // ← Apenas devices explícitos (residual não tem devices)
      total: areaComumTotal,
      perc: grandTotal > 0 ? (areaComumTotal / grandTotal) * 100 : 0
    },
    totalGeral: consumidoresTotal,
    percGeral: 100 // ← Total sempre 100% (= entrada)
  };

  STATE.grandTotal = grandTotal;

  LogHelper.log("RFC-0056: Percentages calculated:", {
    climatizacao: STATE.consumidores.climatizacao.perc.toFixed(1) + '%',
    elevadores: STATE.consumidores.elevadores.perc.toFixed(1) + '%',
    escadasRolantes: STATE.consumidores.escadasRolantes.perc.toFixed(1) + '%',
    lojas: STATE.consumidores.lojas.perc.toFixed(1) + '%',
    areaComum: STATE.consumidores.areaComum.perc.toFixed(1) + '%'
  });

  // ========== 5. VALIDATE TOTALS ==========
  validateTotals(); // ← Nova função (ver seção 3.5)
}
```

##### 3.5. Adicionar Validação de Totais (30min)

**Arquivo**: `controller.js` (NOVO - após aggregateData())

```javascript
/**
 * RFC-0056: Validate that sum of consumers equals entrada total
 * Logs warning if mismatch > 10 Wh (0.01 kWh)
 */
function validateTotals() {
  const sum = STATE.consumidores.climatizacao.total +
              STATE.consumidores.elevadores.total +
              STATE.consumidores.escadasRolantes.total +
              STATE.consumidores.lojas.total +
              STATE.consumidores.areaComum.total;

  const entrada = STATE.entrada.total;
  const diff = Math.abs(entrada - sum);
  const tolerance = 0.01; // 10 Wh

  if (diff > tolerance) {
    LogHelper.warn("⚠️ RFC-0056: Total validation FAILED!");
    LogHelper.warn("  Entrada:  ", entrada.toFixed(2), "kWh");
    LogHelper.warn("  Sum:      ", sum.toFixed(2), "kWh");
    LogHelper.warn("  Diff:     ", diff.toFixed(2), "kWh");
    LogHelper.warn("  Breakdown:", {
      climatizacao: STATE.consumidores.climatizacao.total.toFixed(2),
      elevadores: STATE.consumidores.elevadores.total.toFixed(2),
      escadasRolantes: STATE.consumidores.escadasRolantes.total.toFixed(2),
      lojas: STATE.consumidores.lojas.total.toFixed(2),
      areaComum: STATE.consumidores.areaComum.total.toFixed(2)
    });
  } else {
    LogHelper.log("✅ RFC-0056: Totals validated successfully");
    LogHelper.log("  Entrada = Sum =", entrada.toFixed(2), "kWh (Diff:", diff.toFixed(4), "kWh)");
  }

  // Return validation result for testing
  return {
    valid: diff <= tolerance,
    entrada,
    sum,
    diff,
    tolerance
  };
}
```

#### Entregáveis
- ✅ `CATEGORIES` atualizado para 6 categorias
- ✅ `classifyDevice()` refatorado com nova lógica
- ✅ `STATE` atualizado com 5 consumidores + residual
- ✅ `aggregateData()` com cálculo residual de Área Comum
- ✅ `validateTotals()` implementado
- ✅ Testes unitários de classificação
- ✅ Commit: `git commit -m "RFC-0056 FASE 3: Refactor categorization logic"`

---

### FASE 4: Layout Grid 2 Colunas (2h)

#### Objetivos
- Reestruturar HTML para grid 2 colunas
- Adicionar cards individuais para cada categoria
- Implementar responsividade (mobile, tablet, desktop)

#### Tarefas

##### 4.1. Reestruturar HTML (1h)

**Arquivo**: `template.html` (SUBSTITUIR COMPLETO)

```html
<!--
  ThingsBoard Widget: TELEMETRY_INFO (MyIO v-5.2.0)
  RFC-0056: Grid 2 columns layout with 6 categories
-->

<section class="telemetry-info-root">
  <!-- HEADER -->
  <header class="info-header">
    <h2 class="info-title">ℹ️ Informações de Energia</h2>
  </header>

  <!-- GRID 2 COLUNAS -->
  <div class="info-grid">

    <!-- ========== ROW 1: ENTRADA + LOJAS ========== -->
    <div class="info-card entrada-card">
      <div class="card-header">
        <span class="card-icon">📥</span>
        <h3 class="card-title">Entrada</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="entradaTotal">0,00 kWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="entradaPerc">100%</span>
        </div>
        <div class="devices-list" id="entradaDevices">
          <!-- Dispositivos de entrada (opcional) -->
        </div>
      </div>
    </div>

    <div class="info-card lojas-card">
      <div class="card-header">
        <span class="card-icon">🏪</span>
        <h3 class="card-title">Lojas</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="lojasTotal">0,00 kWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="lojasPerc">(0%)</span>
        </div>
      </div>
    </div>

    <!-- ========== ROW 2: CLIMATIZAÇÃO + ELEVADORES ========== -->
    <div class="info-card climatizacao-card">
      <div class="card-header">
        <span class="card-icon">❄️</span>
        <h3 class="card-title">Climatização</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="climatizacaoTotal">0,00 kWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="climatizacaoPerc">(0%)</span>
        </div>
      </div>
    </div>

    <div class="info-card elevadores-card">
      <div class="card-header">
        <span class="card-icon">🛗</span>
        <h3 class="card-title">Elevadores</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="elevadoresTotal">0,00 kWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="elevadoresPerc">(0%)</span>
        </div>
      </div>
    </div>

    <!-- ========== ROW 3: ESC. ROLANTES + ÁREA COMUM ========== -->
    <div class="info-card escadas-card">
      <div class="card-header">
        <span class="card-icon">🎢</span>
        <h3 class="card-title">Esc. Rolantes</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="escadasRolantesTotal">0,00 kWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="escadasRolantesPerc">(0%)</span>
        </div>
      </div>
    </div>

    <div class="info-card area-comum-card">
      <div class="card-header">
        <span class="card-icon">🏢</span>
        <h3 class="card-title">Área Comum</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="areaComumTotal">0,00 kWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="areaComumPerc">(0%)</span>
        </div>
        <div class="residual-note">
          <small>* Calculado como residual</small>
        </div>
      </div>
    </div>

    <!-- ========== ROW 4: TOTAL (FULL WIDTH) ========== -->
    <div class="info-card total-card">
      <div class="card-header">
        <span class="card-icon">📊</span>
        <h3 class="card-title">Total Consumidores</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">TOTAL:</span>
          <span class="stat-value" id="consumidoresTotal">0,00 kWh</span>
          <span class="stat-perc" id="consumidoresPerc">(100%)</span>
        </div>
      </div>
    </div>

    <!-- ========== ROW 5: GRÁFICO (FULL WIDTH) ========== -->
    <div class="info-card chart-card">
      <div class="card-header">
        <h3 class="card-title">Distribuição de Consumo</h3>
      </div>
      <div class="card-body">
        <div class="chart-container">
          <canvas id="consumptionPieChart"></canvas>
        </div>
        <div class="chart-legend" id="chartLegend">
          <!-- Legenda gerada dinamicamente -->
        </div>
      </div>
    </div>

  </div>
</section>
```

##### 4.2. Atualizar CSS Grid (30min)

**Arquivo**: `style.css` (atualizar seção CONTENT GRID)

```css
/* ========== CONTENT GRID (RFC-0056) ========== */

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  flex: 1;
  min-height: 0;
}

/* Cards que ocupam 2 colunas (full width) */
.total-card,
.chart-card {
  grid-column: 1 / -1;
}

/* ========== RESPONSIVE GRID ========== */

/* Mobile: 1 coluna */
@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }

  .total-card,
  .chart-card {
    grid-column: 1; /* Reset to single column */
  }
}

/* Tablet: 2 colunas (mantém) */
@media (min-width: 769px) and (max-width: 1200px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop: 2 colunas (mantém) */
@media (min-width: 1201px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

##### 4.3. Adicionar Nota de Residual (15min)

**Arquivo**: `style.css` (NOVO)

```css
/* ========== RESIDUAL NOTE ========== */

.residual-note {
  margin-top: 8px;
  padding: 8px;
  background: var(--myio-bg, #FFFFFF);
  border: 1px dashed var(--myio-border, #E0E0E0);
  border-radius: 6px;
  text-align: center;
}

.residual-note small {
  font-size: 11px;
  color: var(--myio-text-tertiary, #999999);
  font-style: italic;
}
```

##### 4.4. Testes de Responsividade (15min)

- [ ] Desktop 1920x1080: 2 colunas ✅
- [ ] Laptop 1366x768: 2 colunas ✅
- [ ] Tablet 768x1024: 2 colunas (portrait) ✅
- [ ] Mobile 375x667: 1 coluna ✅
- [ ] Mobile landscape 667x375: 1 coluna ✅

#### Entregáveis
- ✅ HTML reestruturado com grid 2 colunas
- ✅ 7 cards individuais (Entrada, Lojas, Climatização, Elevadores, Esc.Rolantes, Área Comum, Total)
- ✅ CSS Grid responsivo
- ✅ Nota de residual em Área Comum
- ✅ Commit: `git commit -m "RFC-0056 FASE 4: Grid 2 columns layout"`

---

### FASE 5: Renderização (2h)

#### Objetivos
- Atualizar `renderStats()` para 6 categorias
- Atualizar `renderPieChart()` com 5 fatias
- Atualizar `renderChartLegend()` com novas cores

#### Tarefas

##### 5.1. Atualizar renderStats() (45min)

**Arquivo**: `controller.js` (linhas 217-248)

```javascript
/**
 * RFC-0056: Render statistics for 6 categories
 */
function renderStats() {
  LogHelper.log("RFC-0056: Rendering stats for 6 categories...");

  // ========== ENTRADA ==========
  $('#entradaTotal').text(formatEnergy(STATE.entrada.total));
  $('#entradaPerc').text('100%');

  // ========== CONSUMIDORES ==========

  // Climatização
  $('#climatizacaoTotal').text(formatEnergy(STATE.consumidores.climatizacao.total));
  $('#climatizacaoPerc').text(`(${STATE.consumidores.climatizacao.perc.toFixed(1)}%)`);

  // Elevadores
  $('#elevadoresTotal').text(formatEnergy(STATE.consumidores.elevadores.total));
  $('#elevadoresPerc').text(`(${STATE.consumidores.elevadores.perc.toFixed(1)}%)`);

  // Escadas Rolantes
  $('#escadasRolantesTotal').text(formatEnergy(STATE.consumidores.escadasRolantes.total));
  $('#escadasRolantesPerc').text(`(${STATE.consumidores.escadasRolantes.perc.toFixed(1)}%)`);

  // Lojas
  $('#lojasTotal').text(formatEnergy(STATE.consumidores.lojas.total));
  $('#lojasPerc').text(`(${STATE.consumidores.lojas.perc.toFixed(1)}%)`);

  // Área Comum (residual)
  $('#areaComumTotal').text(formatEnergy(STATE.consumidores.areaComum.total));
  $('#areaComumPerc').text(`(${STATE.consumidores.areaComum.perc.toFixed(1)}%)`);

  // ========== TOTAL ==========
  $('#consumidoresTotal').text(formatEnergy(STATE.consumidores.totalGeral));
  $('#consumidoresPerc').text('(100%)');

  // ========== DEVICES LIST (opcional) ==========
  if (SHOW_DEVICES_LIST) {
    const $list = $('#entradaDevices').empty();
    STATE.entrada.devices.forEach(device => {
      $list.append(`<div class="device-item">${device.label || device.identifier || device.id}</div>`);
    });
  } else {
    $('#entradaDevices').empty();
  }

  LogHelper.log("RFC-0056: Stats rendered successfully");
}
```

##### 5.2. Atualizar renderPieChart() (45min)

**Arquivo**: `controller.js` (linhas 253-331)

```javascript
/**
 * RFC-0056: Render pie chart with 5 slices (no Entrada)
 */
function renderPieChart() {
  LogHelper.log("RFC-0056: Rendering pie chart with 5 categories...");

  const canvas = document.getElementById('consumptionPieChart');
  if (!canvas) {
    LogHelper.warn("Canvas element not found");
    return;
  }

  // Destroy previous chart instance
  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }

  // Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    LogHelper.error("Chart.js library not loaded!");
    $(canvas).parent().html(`
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">Chart.js não carregado</div>
        <div class="empty-state-hint">
          <small>Adicione Chart.js v4.4.0 nos External Resources</small>
        </div>
      </div>
    `);
    return;
  }

  const ctx = canvas.getContext('2d');

  // ========== CHART DATA (5 slices) ==========
  const data = {
    labels: [
      '❄️ Climatização',
      '🛗 Elevadores',
      '🎢 Esc. Rolantes',
      '🏪 Lojas',
      '🏢 Área Comum'
    ],
    datasets: [{
      data: [
        STATE.consumidores.climatizacao.total,
        STATE.consumidores.elevadores.total,
        STATE.consumidores.escadasRolantes.total,
        STATE.consumidores.lojas.total,
        STATE.consumidores.areaComum.total
      ],
      backgroundColor: [
        CHART_COLORS.climatizacao,    // #00C896 (Teal)
        CHART_COLORS.elevadores,      // #5B2EBC (Purple)
        CHART_COLORS.escadasRolantes, // #FF6B6B (Red)
        CHART_COLORS.lojas,           // #FFC107 (Yellow)
        CHART_COLORS.areaComum        // #4CAF50 (Green)
      ],
      borderColor: '#FFFFFF',  // ← Light border
      borderWidth: 2,
      hoverBorderWidth: 3,
      hoverBorderColor: '#222222'
    }]
  };

  // ========== CHART CONFIG ==========
  pieChartInstance = new Chart(ctx, {
    type: 'pie',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false // Use custom legend below
        },
        tooltip: {
          backgroundColor: '#FFFFFF',
          borderColor: '#E0E0E0',
          borderWidth: 1,
          titleColor: '#222222',
          bodyColor: '#666666',
          padding: 12,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const perc = total > 0 ? (value / total * 100).toFixed(1) : 0;
              return `${label}: ${formatEnergy(value)} (${perc}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 800,
        easing: 'easeOutQuart'
      }
    }
  });

  // Render custom legend
  renderChartLegend();

  LogHelper.log("RFC-0056: Pie chart rendered successfully");
}
```

##### 5.3. Atualizar renderChartLegend() (30min)

**Arquivo**: `controller.js` (linhas 336-370)

```javascript
/**
 * RFC-0056: Render custom chart legend with 5 categories
 */
function renderChartLegend() {
  const $legend = $('#chartLegend').empty();

  const items = [
    {
      label: '❄️ Climatização',
      color: CHART_COLORS.climatizacao,
      value: STATE.consumidores.climatizacao.total,
      perc: STATE.consumidores.climatizacao.perc
    },
    {
      label: '🛗 Elevadores',
      color: CHART_COLORS.elevadores,
      value: STATE.consumidores.elevadores.total,
      perc: STATE.consumidores.elevadores.perc
    },
    {
      label: '🎢 Esc. Rolantes',
      color: CHART_COLORS.escadasRolantes,
      value: STATE.consumidores.escadasRolantes.total,
      perc: STATE.consumidores.escadasRolantes.perc
    },
    {
      label: '🏪 Lojas',
      color: CHART_COLORS.lojas,
      value: STATE.consumidores.lojas.total,
      perc: STATE.consumidores.lojas.perc
    },
    {
      label: '🏢 Área Comum',
      color: CHART_COLORS.areaComum,
      value: STATE.consumidores.areaComum.total,
      perc: STATE.consumidores.areaComum.perc
    }
  ];

  items.forEach(item => {
    const html = `
      <div class="legend-item">
        <div class="legend-color" style="background: ${item.color};"></div>
        <span class="legend-label">${item.label}:</span>
        <span class="legend-value">${formatEnergy(item.value)} (${item.perc.toFixed(1)}%)</span>
      </div>
    `;
    $legend.append(html);
  });

  LogHelper.log("RFC-0056: Chart legend rendered with 5 items");
}
```

#### Entregáveis
- ✅ `renderStats()` atualizado para 6 categorias
- ✅ `renderPieChart()` com 5 fatias (sem Entrada)
- ✅ `renderChartLegend()` com 5 itens
- ✅ Animações suaves no gráfico
- ✅ Commit: `git commit -m "RFC-0056 FASE 5: Update rendering logic"`

---

### FASE 6: Testes e Validação (2h)

#### Objetivos
- Validar com dados mock
- Testar com dados reais de produção
- Verificar todos os critérios de aceitação
- Documentar bugs encontrados

#### Tarefas

##### 6.1. Testes com Dados Mock (30min)

**Criar arquivo**: `test-data-mock.js`

```javascript
// RFC-0056: Mock data for testing
const mockData = {
  items: [
    // ENTRADA
    { id: '1', label: 'Relógio Principal', value: 100000, datasourceAlias: 'Entrada' },

    // CLIMATIZAÇÃO (30% = 30000 kWh)
    { id: '2', label: 'Chiller 01', value: 15000, datasourceAlias: 'Devices' },
    { id: '3', label: 'Bomba Primária HVAC', value: 10000, datasourceAlias: 'Devices' },
    { id: '4', label: 'Bomba Secundária Torre', value: 5000, datasourceAlias: 'Devices' },

    // ELEVADORES (10% = 10000 kWh)
    { id: '5', label: 'Elevador 1', value: 5000, datasourceAlias: 'Devices' },
    { id: '6', label: 'Elevador Social', value: 5000, datasourceAlias: 'Devices' },

    // ESCADAS ROLANTES (5% = 5000 kWh)
    { id: '7', label: 'Escada Rolante L1', value: 3000, datasourceAlias: 'Devices' },
    { id: '8', label: 'Esc. Rolante Torre', value: 2000, datasourceAlias: 'Devices' },

    // LOJAS (40% = 40000 kWh)
    { id: '9', label: 'Loja 101', value: 10000, datasourceAlias: 'Lojas' },
    { id: '10', label: 'Loja 102', value: 10000, datasourceAlias: 'Lojas' },
    { id: '11', label: 'Loja 103', value: 10000, datasourceAlias: 'Lojas' },
    { id: '12', label: 'Loja 104', value: 10000, datasourceAlias: 'Lojas' },

    // ÁREA COMUM: 15% = 15000 kWh (RESIDUAL)
    // Calculado: 100000 - (30000 + 10000 + 5000 + 40000) = 15000
  ]
};

// Expected results
const expected = {
  entrada: { total: 100000, perc: 100 },
  climatizacao: { total: 30000, perc: 30 },
  elevadores: { total: 10000, perc: 10 },
  escadasRolantes: { total: 5000, perc: 5 },
  lojas: { total: 40000, perc: 40 },
  areaComum: { total: 15000, perc: 15 }, // ← RESIDUAL
  totalGeral: { total: 100000, perc: 100 }
};

// Test
console.log("========== RFC-0056: MOCK DATA TEST ==========");
processOrchestratorData(mockData.items);

// Validate
const tests = [
  { name: 'Entrada Total', actual: STATE.entrada.total, expected: expected.entrada.total },
  { name: 'Climatização Total', actual: STATE.consumidores.climatizacao.total, expected: expected.climatizacao.total },
  { name: 'Elevadores Total', actual: STATE.consumidores.elevadores.total, expected: expected.elevadores.total },
  { name: 'Esc.Rolantes Total', actual: STATE.consumidores.escadasRolantes.total, expected: expected.escadasRolantes.total },
  { name: 'Lojas Total', actual: STATE.consumidores.lojas.total, expected: expected.lojas.total },
  { name: 'Área Comum Total (Residual)', actual: STATE.consumidores.areaComum.total, expected: expected.areaComum.total },
  { name: 'Total Geral', actual: STATE.consumidores.totalGeral, expected: expected.totalGeral.total }
];

let passed = 0;
tests.forEach(test => {
  const match = Math.abs(test.actual - test.expected) < 0.01;
  console.log(`${match ? '✅' : '❌'} ${test.name}: ${test.actual.toFixed(2)} ${match ? '===' : '!=='} ${test.expected.toFixed(2)}`);
  if (match) passed++;
});

console.log(`\n========== RESULT: ${passed}/${tests.length} PASSED ==========`);
```

**Executar**:
```bash
# No console do navegador (Developer Tools)
# 1. Abrir widget TELEMETRY_INFO
# 2. Colar código mock acima
# 3. Verificar output
```

##### 6.2. Testes com Dados Reais (1h)

**Checklist de validação**:

- [ ] **Entrada**: Total correto, 100%
- [ ] **Climatização**: Chillers + Bombas somados corretamente
- [ ] **Elevadores**: Dispositivos "Elevador" classificados
- [ ] **Escadas Rolantes**: Dispositivos "Escada Rolante" classificados
- [ ] **Lojas**: Devices do alias "Lojas" classificados
- [ ] **Área Comum**: Residual = Entrada - (outros), nunca negativo
- [ ] **Total Geral**: Soma = Entrada (100%)
- [ ] **Gráfico**: 5 fatias com cores corretas
- [ ] **Legenda**: 5 itens com valores e percentuais

**Ambientes de teste**:
1. ✅ **Staging**: Shopping Teste (dados controlados)
2. ✅ **Produção**: Shopping Real (validação final)

##### 6.3. Testes de Performance (15min)

**Métricas**:
- [ ] Tempo de renderização < 500ms (para 100 devices)
- [ ] Tempo de renderização < 1s (para 500 devices)
- [ ] Sem memory leaks após 10 mudanças de período
- [ ] Chart.js destroy() funciona corretamente

**Teste de stress**:
```javascript
// Simular 1000 devices
const stressTest = {
  items: Array.from({ length: 1000 }, (_, i) => ({
    id: `device-${i}`,
    label: `Loja ${i}`,
    value: Math.random() * 1000,
    datasourceAlias: 'Lojas'
  }))
};

console.time('RFC-0056: Stress Test (1000 devices)');
processOrchestratorData(stressTest.items);
console.timeEnd('RFC-0056: Stress Test (1000 devices)');
```

##### 6.4. Testes de Regressão (15min)

**Verificar que não quebrou**:
- [ ] Integração com MyIO Orchestrator (eventos)
- [ ] Formato de energia (MyIOLibrary.formatEnergy)
- [ ] Event handlers (myio:telemetry:provide-data)
- [ ] Widget lifecycle (onInit, onDestroy)
- [ ] Chart resize (onResize)

#### Entregáveis
- ✅ Testes com dados mock: 7/7 passed
- ✅ Testes com dados reais validados
- ✅ Performance < 1s para 500 devices
- ✅ Sem regressões
- ✅ Screenshots antes/depois
- ✅ Commit: `git commit -m "RFC-0056 FASE 6: Tests and validation"`

---

## Cronograma Detalhado

| Fase | Atividade | Duração | Dependências | Responsável |
|------|-----------|---------|--------------|-------------|
| **0** | **Preparação** | | | |
| 0.1 | Criar branch | 5min | - | Dev |
| 0.2 | Backup de arquivos | 10min | 0.1 | Dev |
| 0.3 | Documentar estado inicial | 15min | 0.2 | Dev |
| **1** | **Tema Visual** | | | |
| 1.1 | Atualizar variáveis CSS | 30min | 0.3 | Dev |
| 1.2 | Atualizar cores gráfico | 30min | 1.1 | Dev |
| 1.3 | Atualizar tooltips | 30min | 1.2 | Dev |
| 1.4 | Testes visuais | 30min | 1.3 | QA |
| **2** | **Categorização** | | | |
| 2.1 | Atualizar CATEGORIES | 15min | 1.4 | Dev |
| 2.2 | Refatorar classifyDevice() | 45min | 2.1 | Dev |
| 2.3 | Atualizar STATE | 30min | 2.2 | Dev |
| 2.4 | Refatorar aggregateData() | 1h | 2.3 | Dev |
| 2.5 | Adicionar validateTotals() | 30min | 2.4 | Dev |
| **3** | **Layout Grid** | | | |
| 3.1 | Reestruturar HTML | 1h | 2.5 | Dev |
| 3.2 | Atualizar CSS Grid | 30min | 3.1 | Dev |
| 3.3 | Adicionar nota residual | 15min | 3.2 | Dev |
| 3.4 | Testes responsividade | 15min | 3.3 | QA |
| **4** | **Renderização** | | | |
| 4.1 | Atualizar renderStats() | 45min | 3.4 | Dev |
| 4.2 | Atualizar renderPieChart() | 45min | 4.1 | Dev |
| 4.3 | Atualizar renderChartLegend() | 30min | 4.2 | Dev |
| **5** | **Testes** | | | |
| 5.1 | Testes mock | 30min | 4.3 | QA |
| 5.2 | Testes dados reais | 1h | 5.1 | QA |
| 5.3 | Testes performance | 15min | 5.2 | QA |
| 5.4 | Testes regressão | 15min | 5.3 | QA |
| **6** | **Finalização** | | | |
| 6.1 | Code review | 30min | 5.4 | Tech Lead |
| 6.2 | Documentação | 30min | 6.1 | Dev |
| 6.3 | Merge to main | 15min | 6.2 | Tech Lead |
| **TOTAL** | | **11h 45min** | | |

### Marcos (Milestones)

1. **M1 - Tema Completo**: Fim da Fase 1 (2h)
2. **M2 - Lógica Completa**: Fim da Fase 2 (5h)
3. **M3 - Layout Completo**: Fim da Fase 3 (7h)
4. **M4 - Renderização Completa**: Fim da Fase 4 (9h)
5. **M5 - Testes Aprovados**: Fim da Fase 5 (11h)
6. **M6 - Deploy Ready**: Fim da Fase 6 (11h 45min)

---

## Plano de Testes

### Testes Funcionais

#### TF-001: Classificação de Dispositivos
**Objetivo**: Validar que todos os devices são classificados corretamente

| Input Label | Categoria Esperada | Passou? |
|-------------|-------------------|---------|
| "Relógio Principal" | entrada | [ ] |
| "Chiller 01" | climatizacao | [ ] |
| "Bomba Primária HVAC" | climatizacao | [ ] |
| "Elevador 1" | elevadores | [ ] |
| "Escada Rolante L1" | escadas_rolantes | [ ] |
| "Loja 101" (alias "Lojas") | lojas | [ ] |
| "Dispositivo Genérico" | lojas (default) | [ ] |

#### TF-002: Cálculo Residual
**Objetivo**: Validar que Área Comum = Entrada - (outros)

| Entrada | Outros | Área Comum Esperada | Passou? |
|---------|--------|---------------------|---------|
| 100 kWh | 80 kWh | 20 kWh | [ ] |
| 100 kWh | 100 kWh | 0 kWh | [ ] |
| 100 kWh | 110 kWh | 0 kWh (nunca negativo) | [ ] |

#### TF-003: Validação de Totais
**Objetivo**: Validar que Soma = Entrada (100%)

| Entrada | Soma Categorias | Diff | Válido? (< 10 Wh) |
|---------|-----------------|------|-------------------|
| 100000 kWh | 100000 kWh | 0 Wh | [ ] ✅ |
| 100000 kWh | 100005 kWh | 5 Wh | [ ] ✅ |
| 100000 kWh | 100020 kWh | 20 Wh | [ ] ❌ |

### Testes de Interface

#### TI-001: Tema Light Mode
- [ ] Background branco (#FFFFFF)
- [ ] Texto escuro (#222222)
- [ ] Cards com shadow sutil
- [ ] Hover effect funciona
- [ ] Contraste WCAG AA

#### TI-002: Layout Grid
- [ ] Desktop: 2 colunas
- [ ] Tablet: 2 colunas
- [ ] Mobile: 1 coluna
- [ ] Total/Chart: full width
- [ ] Gap de 16px entre cards

#### TI-003: Gráfico
- [ ] 5 fatias (sem Entrada)
- [ ] Cores corretas:
  - Climatização: #00C896 (Teal)
  - Elevadores: #5B2EBC (Purple)
  - Esc.Rolantes: #FF6B6B (Red)
  - Lojas: #FFC107 (Yellow)
  - Área Comum: #4CAF50 (Green)
- [ ] Tooltip funciona
- [ ] Legenda abaixo do gráfico

### Testes de Integração

#### INT-001: Orquestrador
- [ ] Evento `myio:telemetry:provide-data` recebido
- [ ] Domain filtering funciona (energy, water, etc)
- [ ] Duplicate prevention (periodKey)

#### INT-002: MyIOLibrary
- [ ] `formatEnergy()` funciona
- [ ] Formato: "X.XXX,XX kWh"

#### INT-003: Widget Lifecycle
- [ ] `onInit()` executa sem erros
- [ ] `onResize()` redimensiona gráfico
- [ ] `onDestroy()` limpa listeners e chart

### Testes de Performance

#### PERF-001: Tempo de Renderização
| Nº Devices | Tempo Esperado | Tempo Real | Passou? |
|------------|---------------|------------|---------|
| 10 | < 100ms | ___ ms | [ ] |
| 100 | < 500ms | ___ ms | [ ] |
| 500 | < 1s | ___ ms | [ ] |
| 1000 | < 2s | ___ ms | [ ] |

#### PERF-002: Memory Leaks
- [ ] Trocar período 10x: Memory estável
- [ ] Trocar domínio 10x: Memory estável
- [ ] Chart destroy() libera memória

---

## Critérios de Aceitação

### Obrigatórios (Must Have)

- [ ] **AC-001**: Tema light mode implementado (background #FFFFFF, texto #222222)
- [ ] **AC-002**: 6 categorias funcionando (Entrada, Climatização, Elevadores, Esc.Rolantes, Lojas, Área Comum)
- [ ] **AC-003**: Área Comum calculado como residual (Entrada - outros)
- [ ] **AC-004**: Layout grid 2 colunas em desktop/tablet
- [ ] **AC-005**: Layout 1 coluna em mobile
- [ ] **AC-006**: Gráfico com 5 fatias (sem Entrada)
- [ ] **AC-007**: Cores MyIO aplicadas (#5B2EBC primary, #00C896 accent)
- [ ] **AC-008**: Validação de totais implementada (diff < 10 Wh)
- [ ] **AC-009**: Sem regressões (orquestrador, events, lifecycle)
- [ ] **AC-010**: Performance < 1s para 500 devices

### Desejáveis (Nice to Have)

- [ ] **AC-011**: Progress bars por categoria
- [ ] **AC-012**: Testes unitários automatizados
- [ ] **AC-013**: Documentação de API atualizada
- [ ] **AC-014**: Animações suaves (chart transitions)
- [ ] **AC-015**: Empty states com ícones

---

## Rollback Plan

### Cenário 1: Bug Crítico em Produção

**Gatilhos**:
- Widget não renderiza
- Dados incorretos exibidos
- Performance degradada (> 5s)

**Ação**:
1. **Rollback imediato** (5min)
   ```bash
   git revert <commit-hash>
   git push origin main --force
   ```

2. **Restaurar backup** (10min)
   ```bash
   cp .backup/controller.js.bak controller.js
   cp .backup/template.html.bak template.html
   cp .backup/style.css.bak style.css
   git commit -m "ROLLBACK RFC-0056: Critical bug"
   git push
   ```

3. **Notificar stakeholders** (imediato)
   - Email para: tech-lead@myio.com
   - Slack: #engineering-alerts

### Cenário 2: Bug Menor (Não-Bloqueante)

**Gatilhos**:
- Cores ligeiramente diferentes
- Tooltip com formato errado
- Responsividade com minor glitch

**Ação**:
1. **Hotfix em nova branch** (30min-1h)
   ```bash
   git checkout -b hotfix/rfc-0056-minor-fix
   # Fix bug
   git commit -m "RFC-0056 HOTFIX: Fix tooltip format"
   git push
   ```

2. **Deploy hotfix** após review (15min)

### Cenário 3: Rollback Parcial

**Gatilhos**:
- Tema light mode OK, mas lógica com bug
- Layout OK, mas gráfico com problema

**Ação**:
1. **Reverter commits específicos**
   ```bash
   # Reverter FASE 3 (lógica) mas manter FASE 2 (tema)
   git revert <commit-fase-3>
   git push
   ```

---

## Checklist de Implementação

### Pré-Implementação
- [ ] RFC-0056 aprovado pelo tech lead
- [ ] Branch criada: `feature/rfc-0056-telemetry-info-improvements`
- [ ] Backup de arquivos originais em `.backup/`
- [ ] Chart.js v4.4.0 adicionado nos External Resources
- [ ] Ambiente de staging disponível

### FASE 1: Tema Visual
- [ ] CSS variables atualizadas (light mode)
- [ ] Cores do gráfico alteradas (5 cores MyIO)
- [ ] Tooltips com tema light
- [ ] Testes de contraste WCAG AA (4/4 passed)
- [ ] Screenshots antes/depois
- [ ] Commit: "RFC-0056 FASE 1: Light mode theme"

### FASE 2: Categorização
- [ ] `CATEGORIES` com 6 categorias
- [ ] `classifyDevice()` refatorado
- [ ] `STATE` atualizado (5 consumidores)
- [ ] `aggregateData()` com cálculo residual
- [ ] `validateTotals()` implementado
- [ ] Testes unitários de classificação (100% passed)
- [ ] Commit: "RFC-0056 FASE 2: Refactor categorization logic"

### FASE 3: Layout Grid
- [ ] `template.html` reestruturado (7 cards)
- [ ] CSS Grid 2 colunas implementado
- [ ] Nota de residual adicionada
- [ ] Testes de responsividade (5/5 resoluções)
- [ ] Commit: "RFC-0056 FASE 3: Grid 2 columns layout"

### FASE 4: Renderização
- [ ] `renderStats()` para 6 categorias
- [ ] `renderPieChart()` com 5 fatias
- [ ] `renderChartLegend()` com 5 itens
- [ ] Animações Chart.js configuradas
- [ ] Commit: "RFC-0056 FASE 4: Update rendering logic"

### FASE 5: Testes
- [ ] Testes mock (7/7 passed)
- [ ] Testes dados reais (staging OK)
- [ ] Testes performance (< 1s para 500 devices)
- [ ] Testes regressão (sem bugs)
- [ ] Commit: "RFC-0056 FASE 5: Tests and validation"

### Pós-Implementação
- [ ] Code review aprovado
- [ ] Documentação atualizada (README.md)
- [ ] Changelog atualizado
- [ ] Merge para `main`
- [ ] Deploy em staging validado
- [ ] Deploy em produção (gradual: 10% → 50% → 100%)
- [ ] Monitoramento 24h pós-deploy
- [ ] Retrospectiva de implementação

---

## Referências

- **RFC-0056**: `src/docs/rfcs/RFC-0056-telemetry-info-layout-and-consumer-logic-improvements.md`
- **Widget Atual**: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/`
- **RFC-0042**: MyIO Orchestrator Integration
- **Chart.js Docs**: https://www.chartjs.org/docs/latest/
- **WCAG 2.1 Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/

---

**Última Atualização**: 2025-01-24
**Versão do Plano**: 1.0.0
**Status**: ✅ **READY FOR IMPLEMENTATION**
