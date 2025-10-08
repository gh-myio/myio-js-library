# Plano de Melhorias - Modal de Demanda

## 📋 Visão Geral
Documento de planejamento para implementação de melhorias no componente `DemandModal` e integração com o widget Energy.

---

## 🎯 Objetivos

### 1. Correção da Configuração de Agregação da API ThingsBoard
**Arquivo:** `src/components/DemandModal.ts`

#### Problema Atual
- Parâmetro `limit` está sendo enviado mas é ignorado quando `agg` != 'NONE'
- `interval` está fixo em `54000000` ms (~15h) - não representa 1 dia completo
- Agregação está usando `SUM` por padrão, mas deveria ser `MAX` para demanda

#### Solução
- Remover o parâmetro `limit` quando `agg` != 'NONE'
- Calcular `interval` para 1 dia completo: `86400000` ms (24 horas)
- Alterar agregação padrão de `SUM` para `MAX`
- Atualizar documentação inline da interface `TelemetryQueryParams`

#### Conhecimento Base
- **API ThingsBoard:** Segundo a documentação, `limit` só funciona quando `agg=NONE`
- **Intervalo 24h:** 24h × 60min × 60s × 1000ms = 86.400.000 ms
- **Agregação MAX:** Para demanda de pico, precisamos do valor máximo em cada intervalo

---

### 2. Alteração do Tipo de Gráfico
**Arquivo:** `src/components/DemandModal.ts`

#### Problema Atual
- Gráfico usa tipo `line` (linhas)
- Não representa adequadamente demanda diária

#### Solução
- Alterar tipo de gráfico de `line` para `bar`
- Cada barra representa um dia do período
- Manter cores e estilização consistentes

#### Conhecimento Base
- **Chart.js:** Suporta tipo `bar` nativamente
- **Dados:** Estrutura `MultiSeriesDataPoint` já é compatível com gráfico de barras
- **Visualização:** Barras facilitam comparação dia a dia

---

### 3. Correção do Pan/Zoom no Gráfico
**Arquivo:** `src/components/DemandModal.ts`

#### Problema Atual
- Zoom funciona (scroll)
- Pan não funciona após zoom (não consegue mover para esquerda/direita)

#### Solução
- Habilitar `pan.enabled: true` sem necessidade de `modifierKey`
- Ajustar configuração do plugin `chartjs-plugin-zoom`:
  ```javascript
  pan: {
    enabled: true,
    mode: 'x',
    // Remover modifierKey para pan livre
  }
  ```

#### Conhecimento Base
- **chartjs-plugin-zoom:** Plugin já está carregado
- **Interação:** Pan deve ser independente de tecla modificadora
- **UX:** Usuário espera arrastar livremente após dar zoom

---

### 4. Esconder Exportar PDF / Habilitar Exportar CSV
**Arquivo:** `src/components/DemandModal.ts`

#### Problema Atual
- Botão "Exportar PDF" está visível
- Não existe opção de exportar CSV

#### Solução

**4.1. Esconder Botão PDF**
- Adicionar `style="display: none;"` no botão PDF (linha ~940)
- Ou adicionar parâmetro `pdf.enabled: false` para controlar via config

**4.2. Criar Botão CSV**
- Adicionar novo botão "Exportar CSV" no header
- Implementar função `exportCsv()`
- Gerar CSV com colunas: `Data/Hora`, `Valor (kW)`, `Série`
- Usar `Blob` + `URL.createObjectURL` para download

#### Conhecimento Base
- **CSV Format:**
  ```csv
  Data/Hora,Série,Valor (kW)
  01/01/2025 10:00,a,120.50
  01/01/2025 11:00,b,115.30
  ```
- **Download:** Browser API permite criar link temporário para blob
- **Encoding:** UTF-8 com BOM para compatibilidade Excel

---

### 5. Seletor de Período na Modal
**Arquivo:** `src/components/DemandModal.ts`

#### Problema Atual
- Período é fixo (vem do widget)
- Para mudar período, usuário precisa:
  1. Fechar modal
  2. Mudar intervalo do widget
  3. Reabrir modal

#### Solução

**5.1. Adicionar Seletor de Data**
- Criar seção no header da modal com 2 inputs tipo `date`
- Input 1: Data Inicial
- Input 2: Data Final
- Botão "Atualizar" para recarregar dados

**5.2. Validação**
- Máximo 30 dias (já existe validação)
- Data final >= Data inicial
- Mostrar mensagem de erro se inválido

**5.3. Recarregar Dados**
- Criar função `updateDateRange(newStartDate, newEndDate)`
- Chamar `fetchTelemetryData` com novos parâmetros
- Redesenhar gráfico com novos dados
- Atualizar displays de período e pico

#### Conhecimento Base
- **HTML5 Date Input:** Suportado em todos navegadores modernos
- **Formato:** ISO 8601 (`YYYY-MM-DD`)
- **Conversão:** `new Date(inputValue).toISOString()` para API
- **Estado:** Armazenar `currentStartDate` e `currentEndDate` no escopo da modal

---

## 📐 Arquitetura de Implementação

### Estrutura de Arquivos
```
src/
├── components/
│   └── DemandModal.ts           ← Componente principal (modificar)
└── thingsboard/
    └── main-dashboard-shopping/
        └── v.3.6.0/
            └── WIDGET/
                └── ENERGY/
                    └── controller.js  ← Chamada openDemandModal (modificar)
```

### Fluxo de Dados
```
Widget Energy (controller.js)
    ↓
    openDemandModal({
        telemetryQuery: {
            agg: 'MAX',           ← Correção #1
            interval: 86400000,   ← Correção #1
            // limit removido
        }
    })
    ↓
DemandModal.ts
    ↓
    fetchTelemetryData() → API ThingsBoard
    ↓
    processMultiSeriesChartData()
    ↓
    Chart.js (tipo: 'bar')        ← Correção #2
```

---

## ✅ Critérios de Aceite

### CA-01: Agregação API Corrigida
- [ ] Parâmetro `limit` não é enviado quando `agg != 'NONE'`
- [ ] Intervalo padrão é `86400000` ms (24 horas)
- [ ] Agregação padrão é `MAX`
- [ ] Documentação inline atualizada

### CA-02: Gráfico de Barras
- [ ] Gráfico renderiza com tipo `bar`
- [ ] Cada barra representa um dia
- [ ] Cores mantidas consistentes
- [ ] Tooltips funcionando corretamente

### CA-03: Pan Funcional
- [ ] Após zoom, é possível arrastar gráfico para esquerda/direita
- [ ] Pan funciona sem necessidade de Ctrl
- [ ] Botão "Reset Zoom" retorna ao estado inicial

### CA-04: Exportar CSV
- [ ] Botão PDF está oculto
- [ ] Botão CSV visível no header
- [ ] CSV gerado contém colunas: Data/Hora, Série, Valor (kW)
- [ ] Download funciona em Chrome, Firefox, Edge
- [ ] Encoding UTF-8 com BOM (compatível Excel)
- [ ] Nome do arquivo: `demanda_LABEL_YYYY-MM-DD.csv`

### CA-05: Seletor de Período
- [ ] Inputs de data inicial e final visíveis na modal
- [ ] Valores iniciais preenchidos com período do widget
- [ ] Validação: máximo 30 dias
- [ ] Validação: data final >= data inicial
- [ ] Botão "Atualizar" recarrega dados sem fechar modal
- [ ] Loading state durante atualização
- [ ] Mensagens de erro claras para validações
- [ ] Display de período e pico atualizam após mudança

---

## 🔧 Detalhes Técnicos

### Interface `TelemetryQueryParams` (Atualizada)
```typescript
export interface TelemetryQueryParams {
  keys?: string;                       // Telemetry keys (default: "consumption")
  limit?: number;                      // APENAS quando agg=NONE
  intervalType?: string;               // Interval type (default: "MILLISECONDS")
  interval?: number;                   // Interval value (default: 86400000 - 24h)
  agg?: string;                        // Aggregation function (default: "MAX")
  orderBy?: string;                    // Sort order (default: "ASC")
}
```

### Exemplo de Chamada Corrigida (controller.js)
```javascript
MyIOLibrary.openDemandModal({
    token: jwtTbToken,
    deviceId: entityId,
    startDate: startDate,
    endDate: endDate,
    label: entityLabel,
    telemetryQuery: {
        keys: 'a,b,c',
        intervalType: 'MILLISECONDS',
        interval: 86400000,  // 24 horas
        agg: 'MAX',          // Demanda de pico
        orderBy: 'ASC'
        // limit removido
    },
    yAxisLabel: 'Potência (kW)',
    correctionFactor: 1
});
```

### Estrutura CSV
```csv
Data/Hora,Série,Valor (kW)
01/01/2025 00:00,a,120.50
01/01/2025 00:00,b,115.30
01/01/2025 00:00,c,118.90
02/01/2025 00:00,a,125.20
...
```

### Nova Seção HTML - Seletor de Período
```html
<div class="myio-demand-modal-period-selector">
  <label>
    Data Inicial:
    <input type="date" class="myio-demand-modal-date-start" />
  </label>
  <label>
    Data Final:
    <input type="date" class="myio-demand-modal-date-end" />
  </label>
  <button class="myio-demand-modal-btn-update" type="button">
    Atualizar
  </button>
</div>
```

---

## 📊 Estimativa de Esforço

| Item | Complexidade | Tempo Est. |
|------|--------------|------------|
| CA-01: Agregação API | Baixa | 30min |
| CA-02: Gráfico Barras | Baixa | 20min |
| CA-03: Pan | Baixa | 15min |
| CA-04: CSV Export | Média | 1h |
| CA-05: Seletor Período | Média | 1h30 |
| **TOTAL** | - | **~3h45min** |

---

## 🚀 Ordem de Implementação Sugerida

1. **CA-01** → Correção agregação API (base para demais funcionalidades)
2. **CA-02** → Gráfico de barras (visualização correta)
3. **CA-03** → Pan funcional (UX básica)
4. **CA-05** → Seletor de período (feature crítica)
5. **CA-04** → Exportar CSV (funcionalidade adicional)

---

## 📝 Notas Importantes

- Manter compatibilidade com código existente
- Não quebrar chamadas existentes de `openDemandModal`
- Testar em diferentes tamanhos de tela (responsive)
- Validar performance com 30 dias de dados
- Adicionar logs de debug para troubleshooting
- Considerar i18n para mensagens de erro

---

## 🔗 Referências

- [Chart.js Bar Chart Documentation](https://www.chartjs.org/docs/latest/charts/bar.html)
- [chartjs-plugin-zoom](https://www.chartjs.org/chartjs-plugin-zoom/)
- [ThingsBoard Telemetry API](https://thingsboard.io/docs/user-guide/telemetry/)
- [RFC-0015: Demand Modal Component](./src/components/DemandModal.ts)

---

**Documento criado em:** 2025-10-08
**Versão:** 1.0
**Status:** 📝 Planejamento
