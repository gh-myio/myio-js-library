# TELEMETRY_INFO Widget - MyIO v-5.2.0

## 📋 Visão Geral

Widget de informações consolidadas que exibe totalizadores e distribuição de consumo de energia, classificando dispositivos em:
- **Entrada**: Medidores principais (subestações, relógios)
- **Área Comum**: Infraestrutura compartilhada (iluminação, elevadores, ar condicionado)
- **Equipamentos**: Bombas, chillers, administração
- **Lojas**: Consumidores individuais

## 🏗️ Estrutura de Arquivos

```
TELEMETRY_INFO/
├── controller.js      # Lógica principal (classificação, agregação, rendering)
├── template.html      # Estrutura HTML do widget
├── style.css         # Estilos baseados no design system v-5.2.0
├── settings.schema   # Configurações do widget (ThingsBoard)
└── README.md         # Esta documentação
```

## 🎯 Funcionalidades

### 1. Classificação Automática
- Classifica dispositivos baseado no label/identifier
- Suporta múltiplos padrões de nomenclatura
- Fallback para categoria "Lojas" em casos ambíguos

### 2. Agregação de Dados
- Calcula totais por categoria
- Calcula percentuais baseado na entrada (100%)
- Totalização geral de consumidores

### 3. Visualização
- Cards informativos com estatísticas
- Gráfico de pizza (Chart.js)
- Legenda customizada
- Responsivo (grid CSS)

### 4. Integração com Orquestrador
- Escuta eventos `myio:telemetry:provide-data`
- Filtra por domínio (energy/water/temperature)
- Suporte a warm start (dados cacheados)

## ⚙️ Configuração

### Settings (ThingsBoard)

```json
{
  "labelWidget": "Informações de Energia",
  "DOMAIN": "energy",
  "customerTB_ID": "xxx-xxx-xxx",
  "showDevicesList": false,
  "chartColors": {
    "areaComum": "#4CAF50",
    "equipamentos": "#2196F3",
    "lojas": "#FFC107"
  },
  "DEBUG_ACTIVE": false
}
```

#### Parâmetros

- **labelWidget** (string): Título do widget
- **DOMAIN** (enum): `energy` | `water` | `temperature`
- **customerTB_ID** (string, required): ID do customer no ThingsBoard
- **showDevicesList** (boolean): Mostrar lista de devices de entrada
- **chartColors** (object): Cores do gráfico de pizza
- **DEBUG_ACTIVE** (boolean): Ativar logs de debug

### Aliases ThingsBoard

O widget funciona com o **MyIO Orchestrator**, então não precisa de aliases/datasources tradicionais.

O orquestrador:
1. Recebe evento `myio:update-date` com período selecionado
2. Busca dados da API para todos os devices
3. Emite `myio:telemetry:provide-data` com dados agregados

## 🔄 Fluxo de Dados

```
USER selects date range (HEADER)
         ↓
myio:update-date event
         ↓
MyIOOrchestrator fetches API data
         ↓
myio:telemetry:provide-data event
         ↓
TELEMETRY_INFO receives data
         ↓
classifyDevice() → aggregateData()
         ↓
updateDisplay() → renderStats() + renderPieChart()
```

## 📊 Classificação de Dispositivos

### Regras de Classificação

```javascript
// ENTRADA
- "relógio"
- "subestação"
- "entrada"
- "medição"
- "medidor principal"

// EQUIPAMENTOS
- "bomba"
- "chiller"
- "administração"
- "casa de máquinas"

// ÁREA COMUM
- "área comum"
- "iluminação"
- "elevador"
- "escada"
- "ar condicionado"
- "climatização"
- "corredor"
- "hall"
- "estacionamento"

// LOJAS (default)
- Qualquer outro device
```

### Normalização

Labels são normalizados antes da classificação:
- Remoção de acentos
- Lowercase
- Trim

Exemplo: `"Relógio Principal"` → `"relogio principal"` → **ENTRADA**

## 🎨 Design System

### CSS Variables

```css
--myio-bg: #0f1419         /* Background principal */
--myio-panel: #1c2743      /* Background dos cards */
--myio-border: #2e3a52     /* Bordas */
--myio-text: #e8ebf0       /* Texto principal */
```

### Cores do Chart

- **Área Comum**: `#4CAF50` (Verde)
- **Equipamentos**: `#2196F3` (Azul)
- **Lojas**: `#FFC107` (Amarelo)

## 📦 Dependências

### Bibliotecas Externas

1. **Chart.js** (v3+)
   - Renderização do gráfico de pizza
   - Deve estar carregado globalmente
   - Verificação: `typeof Chart !== 'undefined'`

2. **jQuery**
   - Manipulação DOM
   - Fornecido pelo ThingsBoard

3. **MyIOLibrary** (opcional)
   - Formatação de energia: `MyIOLibrary.formatEnergy()`
   - Fallback: formatação manual se não disponível

## 🧪 Testing

### Test Case 1: Classificação
```javascript
// Entrada
classifyDevice("Relógio Principal") === "entrada"
classifyDevice("Subestação 1") === "entrada"

// Equipamentos
classifyDevice("Bomba Piscina") === "equipamentos"
classifyDevice("Chiller 1") === "equipamentos"

// Área Comum
classifyDevice("Iluminação Geral") === "area_comum"
classifyDevice("Elevador Social") === "area_comum"

// Lojas
classifyDevice("Loja 101") === "lojas"
classifyDevice("Nike Store") === "lojas"
```

### Test Case 2: Agregação
```javascript
const items = [
  { label: "Relógio 1", value: 10000 },
  { label: "Área Comum", value: 3000 },
  { label: "Bomba 1", value: 2000 },
  { label: "Loja 101", value: 5000 }
];

aggregateData(items);

// Expectations:
// STATE.entrada.total === 10000
// STATE.consumidores.areaComum.total === 3000
// STATE.consumidores.equipamentos.total === 2000
// STATE.consumidores.lojas.total === 5000
// STATE.consumidores.areaComum.perc === 30%
// STATE.consumidores.equipamentos.perc === 20%
// STATE.consumidores.lojas.perc === 50%
```

## 🐛 Troubleshooting

### Problema: Chart não renderiza

**Causa**: Chart.js não carregado

**Solução**:
1. Verificar se Chart.js está no HTML do dashboard
2. Adicionar `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`
3. Verificar console: `Chart is not defined`

### Problema: Dados não aparecem

**Causa**: Domain incorreto ou orquestrador não configurado

**Solução**:
1. Verificar `DOMAIN` nas settings
2. Ativar `DEBUG_ACTIVE = true`
3. Verificar logs: `[TELEMETRY_INFO] Received data`
4. Confirmar que orquestrador está emitindo eventos

### Problema: Classificação incorreta

**Causa**: Label não corresponde aos padrões

**Solução**:
1. Verificar label normalizado no console
2. Adicionar novo padrão em `classifyDevice()`
3. Considerar usar category manual via attributes

## 📚 Referências

- **RFC-0042**: MyIO Orchestrator Integration
- **Chart.js Docs**: https://www.chartjs.org/docs/latest/
- **v.3.6.0 ENERGY Widget**: Inspiração para classificação
- **v-5.2.0 TELEMETRY Widget**: Base de design e integração

## 📝 Changelog

### v1.0.0 (2025-10-17)
- ✨ Implementação inicial
- 📊 Suporte a gráfico de pizza
- 🔧 Integração com MyIO Orchestrator
- 🎨 Design system v-5.2.0
- 📱 Layout responsivo

---

**Autor**: MyIO Team
**Data**: 2025-10-17
**Versão**: 1.0.0
**Status**: ✅ **PRONTO PARA USO**
