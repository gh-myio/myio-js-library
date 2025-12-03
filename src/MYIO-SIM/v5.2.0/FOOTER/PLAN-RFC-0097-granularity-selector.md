# RFC-0097: Seletor de Granularidade no Modal de Energia

## Resumo

Adicionar um botão seletor de granularidade (1h, 1d, 1w, 1M) no modal de comparação de energia (`EnergyModalView.ts`), permitindo que o usuário escolha a granularidade desejada, com sugestão automática baseada no período selecionado.

---

## Contexto Atual

### Arquivos Envolvidos

1. **EnergyModalView.ts** (`src/components/premium-modals/energy/`)
   - UI do modal de energia
   - Já tem botões de toggle para tema e modo de barras
   - Recebe `granularity` via config params

2. **EnergyModal.ts** (`src/components/premium-modals/energy/`)
   - Componente principal
   - Passa `granularity` para a view

3. **FOOTER/controller.js** (`src/MYIO-SIM/v5.2.0/FOOTER/`)
   - Calcula granularidade via `_calculateGranularity()`
   - Passa para `openDashboardPopupEnergy()`

### Lógica Atual de Cálculo (`_calculateGranularity`)

```javascript
_calculateGranularity(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) return '1h';   // 1 dia: granularidade horária
  if (diffDays <= 7) return '1d';   // 1 semana: diária
  if (diffDays <= 31) return '1d';  // 1 mês: diária
  if (diffDays <= 90) return '1w';  // 3 meses: semanal
  return '1M';                       // Mais de 3 meses: mensal
}
```

---

## Plano de Implementação

### Fase 1: Adicionar Seletor de Granularidade na UI (EnergyModalView.ts)

#### 1.1 Adicionar State para Granularidade

```typescript
// Adicionar após currentBarMode
private currentGranularity: '1h' | '1d' | '1w' | '1M' = '1d';
```

#### 1.2 Adicionar Método de Inicialização

```typescript
private initializeGranularity(): void {
  // Usa granularidade do config ou calcula baseado no período
  this.currentGranularity = this.config.params.granularity || '1d';
}
```

#### 1.3 Adicionar HTML do Seletor (no createModalContent)

Adicionar após o botão de toggle de tema/barMode:

```html
<!-- Granularity Selector -->
<div class="myio-granularity-selector" style="display: flex; align-items: center; gap: 4px;">
  <span style="font-size: 12px; color: #666; margin-right: 4px;">Granularidade:</span>
  <button id="granularity-1h" class="myio-btn myio-btn-granularity" data-granularity="1h" title="Hora">1h</button>
  <button id="granularity-1d" class="myio-btn myio-btn-granularity active" data-granularity="1d" title="Dia">1d</button>
  <button id="granularity-1w" class="myio-btn myio-btn-granularity" data-granularity="1w" title="Semana">1w</button>
  <button id="granularity-1M" class="myio-btn myio-btn-granularity" data-granularity="1M" title="Mês">1M</button>
</div>
```

#### 1.4 Adicionar CSS do Seletor

```css
.myio-btn-granularity {
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--myio-energy-border);
  background: var(--myio-energy-bg);
  color: var(--myio-energy-text);
  cursor: pointer;
  transition: all 0.2s;
  min-width: 32px;
}

.myio-btn-granularity:hover:not(.active) {
  background: #f3f4f6;
  border-color: var(--myio-energy-primary);
}

.myio-btn-granularity.active {
  background: var(--myio-energy-primary);
  color: white;
  border-color: var(--myio-energy-primary);
}
```

#### 1.5 Adicionar Event Listeners

```typescript
// Granularity selector buttons
const granularityButtons = document.querySelectorAll('.myio-btn-granularity');
granularityButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.currentTarget as HTMLElement;
    const newGranularity = target.dataset.granularity as '1h' | '1d' | '1w' | '1M';
    this.setGranularity(newGranularity);
  });
});
```

#### 1.6 Adicionar Método setGranularity

```typescript
private setGranularity(granularity: '1h' | '1d' | '1w' | '1M'): void {
  this.currentGranularity = granularity;

  // Atualiza UI
  const buttons = document.querySelectorAll('.myio-btn-granularity');
  buttons.forEach(btn => {
    const btnEl = btn as HTMLElement;
    if (btnEl.dataset.granularity === granularity) {
      btnEl.classList.add('active');
    } else {
      btnEl.classList.remove('active');
    }
  });

  // Salva preferência
  localStorage.setItem('myio-modal-granularity', granularity);

  // Re-renderiza o gráfico
  this.reRenderChart();

  console.log('[EnergyModalView] Granularity changed to:', granularity);
}
```

---

### Fase 2: Atualizar renderComparisonChart para usar currentGranularity

No método `renderComparisonChart()`, alterar:

```typescript
// ANTES:
granularity: this.config.params.granularity!,

// DEPOIS:
granularity: this.currentGranularity || this.config.params.granularity!,
```

---

### Fase 3: Sugestão Automática de Granularidade

#### 3.1 Adicionar Método de Cálculo (EnergyModalView.ts)

```typescript
/**
 * Calcula a granularidade sugerida baseado no período selecionado
 */
private calculateSuggestedGranularity(startDate: string, endDate: string): '1h' | '1d' | '1w' | '1M' {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) return '1h';   // 1 dia: granularidade horária
  if (diffDays <= 7) return '1d';   // 1 semana: diária
  if (diffDays <= 31) return '1d';  // 1 mês: diária
  if (diffDays <= 90) return '1w';  // 3 meses: semanal
  return '1M';                       // Mais de 3 meses: mensal
}
```

#### 3.2 Chamar ao Mudar Data Range

No método `loadData()` ou no callback `onApply` do DateRangePicker:

```typescript
// Após obter novas datas, sugere nova granularidade
const suggested = this.calculateSuggestedGranularity(startISO, endISO);

// Opcional: mostra tooltip ou hint para o usuário
console.log(`[EnergyModalView] Suggested granularity for period: ${suggested}`);

// Opcional: atualiza automaticamente (ou apenas destaca o botão sugerido)
// this.setGranularity(suggested);
```

---

### Fase 4: Validações e Edge Cases

1. **Granularidade incompatível com período**
   - Se período < 1 dia e granularidade = 1M → Mostrar warning
   - Se período > 90 dias e granularidade = 1h → Muitos dados, sugerir 1d ou 1w

2. **Persistência**
   - Salvar última granularidade usada no localStorage
   - Carregar ao inicializar o modal

3. **Modo Single vs Comparison**
   - Seletor só aparece em modo `comparison`
   - No modo `single`, granularidade é fixa (passada pelo caller)

---

## Checklist de Implementação

- [ ] **EnergyModalView.ts**
  - [ ] Adicionar `currentGranularity` state
  - [ ] Adicionar `initializeGranularity()` método
  - [ ] Adicionar HTML do seletor no `createModalContent()`
  - [ ] Adicionar CSS dos botões de granularidade
  - [ ] Adicionar event listeners para os botões
  - [ ] Adicionar `setGranularity()` método
  - [ ] Adicionar `calculateSuggestedGranularity()` método
  - [ ] Atualizar `renderComparisonChart()` para usar `currentGranularity`
  - [ ] Atualizar `loadData()` para sugerir granularidade

- [ ] **types.ts**
  - [ ] Garantir que `granularity` aceita '1h' | '1d' | '1w' | '1M'

- [ ] **Testes**
  - [ ] Testar seleção de granularidade
  - [ ] Testar persistência no localStorage
  - [ ] Testar re-render do gráfico ao mudar granularidade
  - [ ] Testar sugestão automática ao mudar período

---

## Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────┐
│                    EnergyModalView                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Controls Section                                     │   │
│  │ ┌──────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐  │   │
│  │ │ Período  │ │Carregar│ │Exportar│ │ Theme Toggle│  │   │
│  │ └──────────┘ └────────┘ └────────┘ └─────────────┘  │   │
│  │                                                      │   │
│  │ ┌────────────────────────────────────────────────┐  │   │
│  │ │ Granularidade: [1h] [1d*] [1w] [1M]            │  │   │
│  │ └────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Chart Container (iframe do SDK)                      │   │
│  │                                                      │   │
│  │   SDK recebe granularity via config e renderiza      │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Estimativa

- **Complexidade**: Média
- **Arquivos a modificar**: 2 (EnergyModalView.ts, types.ts)
- **Risco**: Baixo (mudança isolada na UI)

---

## Referências

- `FOOTER/controller.js:1278-1288` - Lógica atual de `_calculateGranularity`
- `EnergyModalView.ts:331-368` - Botões de toggle existentes (tema/barMode)
- `EnergyModalView.ts:594-685` - Método `renderComparisonChart()`
