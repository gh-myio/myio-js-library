# Bug Report: `bar_mode` Parameter Not Working in `renderTelemetryStackedChart`

**Data:** 2025-11-27
**Reportado por:** Equipe MyIO Dashboard
**Componente:** Energy Chart SDK (`energy-chart-sdk.umd.js`)
**Severidade:** Alta
**Ambiente:** Produção e Staging

---

## Resumo Executivo

O parâmetro `bar_mode` passado para a função `renderTelemetryStackedChart` **não está sendo respeitado**. Independentemente do valor configurado (`'grouped'` ou `'stacked'`), o gráfico **sempre renderiza no modo stacked** (barras empilhadas).

---

## Contexto

Estamos utilizando o SDK de gráficos para renderizar comparações de múltiplos dispositivos (energy/water) no dashboard principal. A implementação segue exatamente a documentação oficial (`INGESTION-SDK-GRAPHS-COMPARISON_CHARTS.md`).

### Fluxo de Chamada

```
EnergyModalView.ts (mode: 'comparison')
    ↓
renderTelemetryStackedChart(container, config)
    ↓
SDK gera iframe com URL: /embed/telemetry-stacked?bar_mode=...
```

---

## Comportamento Esperado vs Atual

| Configuração | Esperado | Atual |
|--------------|----------|-------|
| `bar_mode: 'grouped'` | Barras lado a lado | Barras empilhadas |
| `bar_mode: 'stacked'` | Barras empilhadas | Barras empilhadas |

**Resultado:** O gráfico sempre exibe barras empilhadas, ignorando o parâmetro `bar_mode`.

---

## Código de Implementação

### 1. Inicialização do Bar Mode (EnergyModalView.ts:57-61)

```typescript
private initializeBarMode(): void {
  const savedBarMode = localStorage.getItem('myio-modal-bar-mode') as 'stacked' | 'grouped' | null;
  this.currentBarMode = savedBarMode || 'stacked';
}
```

### 2. Toggle do Bar Mode (EnergyModalView.ts:76-81)

```typescript
private toggleBarMode(): void {
  this.currentBarMode = this.currentBarMode === 'stacked' ? 'grouped' : 'stacked';
  localStorage.setItem('myio-modal-bar-mode', this.currentBarMode);
  this.applyBarMode();
  console.log('[EnergyModalView] Bar mode toggled to:', this.currentBarMode);
}
```

### 3. Chamada do SDK (EnergyModalView.ts:640-661)

```typescript
private renderComparisonChart(): boolean {
  // ...

  const chartConfig = {
    version: 'v2',
    clientId: this.config.params.clientId || 'ADMIN_DASHBOARD_CLIENT',
    clientSecret: this.config.params.clientSecret || 'admin_dashboard_secret_2025',
    dataSources: this.config.params.dataSources!,
    readingType: this.config.params.readingType || 'energy',
    startDate: startDateStr,      // Format: YYYY-MM-DD
    endDate: endDateStr,          // Format: YYYY-MM-DD
    granularity: this.config.params.granularity!,
    theme: this.currentTheme,
    bar_mode: this.currentBarMode,  // ← PARÂMETRO SENDO PASSADO CORRETAMENTE
    timezone: tzIdentifier,
    iframeBaseUrl: this.config.params.chartsBaseUrl || 'https://graphs.apps.myio-bas.com',
    apiBaseUrl: this.config.params.dataApiHost || 'https://api.data.apps.myio-bas.com',
    deep: this.config.params.deep || false
  };

  console.log('[EnergyModalView] Rendering comparison chart with SDK:', chartConfig);

  (this as any).chartInstance = renderTelemetryStackedChart(this.chartContainer, chartConfig);

  return true;
}
```

---

## Evidências de Log

### Console Output ao Trocar para `grouped`:

```
[EnergyModalView] Bar mode toggled to: grouped
[EnergyModalView] Rendering comparison chart with SDK: {
  version: "v2",
  clientId: "mestreal_mfh4e642_4flnuh",
  dataSources: [{type: "device", id: "abc123", label: "Medidor 1"}, ...],
  readingType: "energy",
  startDate: "2025-11-01",
  endDate: "2025-11-27",
  granularity: "1d",
  theme: "dark",
  bar_mode: "grouped",        // ← VALOR CORRETO NO LOG
  timezone: "America/Sao_Paulo",
  ...
}
```

### URL do iframe gerado (inspecionado via DevTools):

```
https://graphs.apps.myio-bas.com/embed/telemetry-stacked
  ?auth_token=eyJ...
  &reading_type=energy
  &bar_mode=grouped          // ← PARÂMETRO PRESENTE NA URL
  &data_sources=[...]
  &startDate=2025-11-01
  &endDate=2025-11-27
  &granularity=1d
  &theme=dark
  &timezone=America/Sao_Paulo
  &api_base_url=https://api.data.apps.myio-bas.com
```

**Mesmo com `bar_mode=grouped` na URL, o gráfico renderiza como stacked.**

---

## Passos para Reproduzir

1. Abrir o dashboard principal do MyIO
2. Selecionar 2+ dispositivos de energia no footer
3. Clicar no botão "Comparar"
4. Modal abre com gráfico de comparação (stacked por padrão)
5. Clicar no botão de toggle de bar mode (ícone de barras)
6. Observar no console: `Bar mode toggled to: grouped`
7. **Bug:** Gráfico continua mostrando barras empilhadas

---

## Verificações Já Realizadas

| Verificação | Status | Observação |
|-------------|--------|------------|
| Parâmetro está sendo passado na config | ✅ OK | Confirmado via console.log |
| Parâmetro está na URL do iframe | ✅ OK | Confirmado via DevTools Network |
| Re-render é chamado ao trocar modo | ✅ OK | Nova instância é criada |
| Cache do navegador | ✅ Limpo | Testado em aba anônima |
| Versão do SDK | ✅ Atualizada | `energy-chart-sdk.umd.js` mais recente |

---

## Hipóteses

### 1. SDK não está lendo o parâmetro `bar_mode`
O SDK pode estar ignorando o parâmetro na construção do gráfico Plotly/Chart.js.

### 2. Parâmetro com nome diferente internamente
A documentação menciona `bar_mode`, mas internamente o SDK pode esperar outro nome (ex: `barMode`, `mode`, `chartMode`).

### 3. Bug no build de produção
O parâmetro pode funcionar em desenvolvimento mas não no build minificado.

### 4. Falta de re-fetch dos dados
Ao trocar o `bar_mode`, o SDK pode precisar refazer a requisição de dados, mas está usando cache.

---

## Testes Sugeridos para a Equipe SDK

### Teste 1: Verificar parsing do parâmetro
```javascript
// No código do SDK, adicionar log:
console.log('[SDK] Received bar_mode:', config.bar_mode);
console.log('[SDK] Applied bar_mode:', actualBarModeUsed);
```

### Teste 2: Forçar modo via URL direta
```html
<!-- Testar iframe diretamente sem SDK -->
<iframe src="https://graphs.apps.myio-bas.com/embed/telemetry-stacked?bar_mode=grouped&..."></iframe>
```

### Teste 3: Verificar configuração do Plotly/Chart.js
```javascript
// Se usando Plotly:
Plotly.newPlot(container, data, {
  barmode: 'group'  // Plotly usa 'group', não 'grouped'
});
```

---

## Documentação de Referência

Conforme `INGESTION-SDK-GRAPHS-COMPARISON_CHARTS.md`:

```markdown
## Bar Mode Parameter

| Value     | Description                        | Visual              |
|-----------|------------------------------------|---------------------|
| `grouped` | Bars displayed **side-by-side**    | ![Grouped](grouped.png) |
| `stacked` | Bars displayed **on top of each other** | ![Stacked](stacked.png) |

### Usage via iframe URL
?bar_mode=grouped   // Side-by-side bars (default)
?bar_mode=stacked   // Stacked bars
```

**Nota:** A documentação indica que `grouped` deveria ser o DEFAULT, mas na prática o gráfico sempre mostra `stacked`.

---

## Impacto no Produto

- **UX degradada:** Usuários não conseguem visualizar comparações lado-a-lado
- **Funcionalidade quebrada:** Botão de toggle existe mas não funciona
- **Inconsistência:** Documentação promete feature que não funciona

---

## Solução Temporária (Workaround)

Atualmente não há workaround disponível. O botão de toggle foi mantido na UI aguardando correção do SDK.

---

## Anexos

- [x] Código fonte: `EnergyModalView.ts` (linhas 591-682)
- [x] Documentação: `INGESTION-SDK-GRAPHS-COMPARISON_CHARTS.md`
- [x] Screenshots: (solicitar se necessário)

---

## Contato

Para dúvidas ou informações adicionais sobre este report:
- **Repositório:** `myio-js-library`
- **Arquivo principal:** `src/components/premium-modals/energy/EnergyModalView.ts`
- **Branch:** `main`

---

**Aguardamos retorno com análise e previsão de correção.**
