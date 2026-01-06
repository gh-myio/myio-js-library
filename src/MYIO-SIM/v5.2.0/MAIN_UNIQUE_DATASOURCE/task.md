# Plano de Correções - MAIN_UNIQUE_DATASOURCE (8 Issues)

## Resumo dos Problemas

| #   | Problema                                          | Componente           | Prioridade |
| --- | ------------------------------------------------- | -------------------- | ---------- |
| 1   | Metas não abre                                    | Menu                 | Alta       |
| 2   | Filtro shopping não atualiza header               | Header/TelemetryGrid | Alta       |
| 3   | Labels incorretos no header bar                   | TelemetryGrid        | Média      |
| 4   | Seleção não mostra consumo no footer              | Footer               | Alta       |
| 5   | Comparativo não abre                              | Footer               | Alta       |
| 6   | Actions (dashboard/report/settings) não funcionam | TelemetryGrid        | Alta       |
| 7   | Filtro de data "consultar" não funciona           | Menu                 | Média      |
| 8   | Água e temperatura não funcionam no menu          | Menu                 | Alta       |

---

## Issue 1: Metas não está abrindo

### Problema

O botão "Metas" no MenuComponent emite evento `myio:open-goals-panel`, mas o MAIN_UNIQUE_DATASOURCE não está ouvindo/implementando a chamada para `MyIOLibrary.openGoalsPanel()`.

### Arquivos a Modificar

- `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`

### Solução

Adicionar listener para `myio:open-goals-panel` e implementar chamada para `MyIOLibrary.openGoalsPanel()` com:

- `customerId` de `window.myioHoldingCustomerId`
- `token` de `localStorage.getItem('jwt_token')`
- `shoppingList` da lista de customers
- `onSave` callback que dispara `myio:goals-updated`

### Referência

Ver implementação antiga em `src/MYIO-SIM/v5.2.0/MENU/controller.js` linhas 1120-1241.

---

## Issue 2: Filtro de shoppings não atualiza header

### Problema

Quando filtro é aplicado, `myio:filter-applied` é disparado mas o HeaderComponent (RFC-0113) não está conectado ao event chain.

### Arquivos a Modificar

- `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`

### Solução

No listener de `myio:filter-applied`, além de chamar `telemetryGridInstance.applyFilter()`, também chamar `headerInstance.updateKPIs()` com valores recalculados baseados nos devices filtrados.

### Limpeza Adicional

Verificar e remover `src/components/premium-modals/header/` se não estiver sendo usado em `src/index.ts`.

---

## Issue 3: Labels incorretos no header bar

### Problema

- "Consumo Total Total de Equipamentos" (duplicado)
- "Consumo Zero" deveria ser "Sem Consumo"

### Arquivos a Modificar

- `src/components/telemetry-grid/TelemetryGridView.ts` linha 167
- `src/components/header-devices-grid/HeaderDevicesGridView.ts` linhas 20, 26

### Solução

1. Em TelemetryGridView.ts:167, mudar de:

   ```typescript
   consumption: `${domainConfig.headerLabel} ${contextConfig.headerLabel}`;
   ```

   Para:

   ```typescript
   consumption: domainConfig.headerLabel;
   ```

2. Em HeaderDevicesGridView.ts, mudar `zeroLabel: 'Consumo Zero'` para `zeroLabel: 'Sem Consumo'`

---

## Issue 4: Seleção não mostra consumo no footer

### Problema

Ao selecionar cards no telemetry-grid, o footer mostra label mas não o consumo em kWh.

### Arquivos a Verificar

- `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`
- `src/components/footer/ChipRenderer.ts`

### Solução

Verificar se o device passado para seleção contém `lastValue` e `unit`. Se não, garantir que `TelemetryDevice` tenha esses campos populados corretamente ao criar os cards.

---

## Issue 5: Comparativo não abre

### Problema

O botão de comparação no footer não abre o modal.

### Arquivos a Verificar

- `src/components/footer/ComparisonHandler.ts`
- `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`

### Solução

1. Verificar se `params.getIngestionToken()` está implementado no footer
2. Verificar se `MyIOLibrary.openDashboardPopupEnergy` está disponível
3. Implementar/passar callbacks necessários para o FooterComponent

---

## Issue 6: Actions (dashboard/report/settings) não funcionam

### Problema

Os botões de ação nos cards do telemetry-grid não abrem os modais correspondentes.

### Arquivos a Modificar

- `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`

### Solução

Implementar callback `onCardAction` ao criar `telemetryGridInstance`:

```javascript
telemetryGridInstance = MyIOLibrary.createTelemetryGridComponent({
  // ... outras configs
  onCardAction: async (action, device) => {
    const tbToken = localStorage.getItem('jwt_token');
    const ingestionToken = await getIngestionToken();

    switch (action) {
      case 'dashboard':
        MyIOLibrary.openDashboardPopupEnergy({...});
        break;
      case 'report':
        MyIOLibrary.openDashboardPopupReport({...});
        break;
      case 'settings':
        // Navegar para settings do device
        break;
    }
  }
});
```

### Referência

Ver implementação antiga em `src/MYIO-SIM/v5.2.0/TELEMETRY/controller.js` linhas 428-500.

---

## Issue 7: Filtro de data "consultar" não funciona

### Problema

Ao mudar período e clicar em "Consultar", não chama a API do ingestion.

### Arquivos a Modificar

- `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`

### Solução

Adicionar listener para evento de consulta do menu (ex: `myio:date-query` ou similar) que:

1. Obtém novas datas selecionadas
2. Chama API do ingestion com novo range
3. Atualiza dados no telemetry-grid e header

---

## Issue 8: Água e temperatura não funcionam no menu

### Problema

Ao navegar para Água ou Temperatura no menu, nada acontece.

### Arquivos a Verificar

- `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`

### Solução

Verificar se o listener de `myio:dashboard-state` está:

1. Recebendo eventos de troca de domínio (energy → water → temperature)
2. Atualizando o telemetry-grid com devices do domínio correto
3. Atualizando header com dados do domínio correto

---

## Limpeza de Código

### Remover Header Duplicado

- **CONFIRMADO**: `src/components/premium-modals/header/` NÃO está exportado em `src/index.ts`
- **AÇÃO**: Remover diretório inteiro `src/components/premium-modals/header/` (5 arquivos)
- **MANTER**: `src/components/header/` (está exportado nas linhas 314-343 do index.ts)

---

## Ordem de Implementação Sugerida

1. **Issue 3** - Labels (rápido, baixo risco)
2. **Issue 8** - Água/temperatura no menu (fundamental para outros fixes)
3. **Issue 2** - Filtro shopping → header
4. **Issue 6** - Card actions (dashboard/report/settings)
5. **Issue 4** - Consumo no footer
6. **Issue 5** - Comparativo
7. **Issue 1** - Metas
8. **Issue 7** - Filtro de data
9. **Limpeza** - Remover header duplicado

---

## Arquivos Críticos

| Arquivo                                                       | Modificações       |
| ------------------------------------------------------------- | ------------------ |
| `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`    | Issues 1,2,5,6,7,8 |
| `src/components/telemetry-grid/TelemetryGridView.ts`          | Issue 3            |
| `src/components/header-devices-grid/HeaderDevicesGridView.ts` | Issue 3            |
| `src/components/footer/`                                      | Issues 4,5         |
| `src/components/premium-modals/header/`                       | Remover (limpeza)  |
