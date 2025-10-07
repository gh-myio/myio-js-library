# RFC-0044: Fix intermitência do estado "busy" nos widgets TELEMETRY

## Sumário

Este documento propõe um plano de correção para o problema de exibição intermitente do modal de carregamento ("busy") nos widgets TELEMETRY da dashboard de compras principal (v‑4.0.0). Em determinadas cargas de trabalho ou condições de rede, o modal de carregamento permanece preso indefinidamente ou dispara falsos positivos antes de concluir a operação.

## Motivation

Widgets TELEMETRY exibem um overlay de carregamento para indicar que dados estão sendo buscados. Porém, em ambientes com múltiplos widgets e orquestração via evento, o modal pode:
- Nunca ser ocultado (stuck busy)
- Aparecer erroneamente em operações válidas
- Disparar timeouts prematuros sem necessidade

Isso degrada a experiência do usuário e dificulta o diagnóstico de problemas de desempenho.

## Comportamento Atual

1. Cada widget TELEMETRY invoca `showBusy()` na inicialização e no tratamento de eventos de data.
2. Um _fallback_ de timeout de 10 segundos (setTimeout) limpa cache e tenta uma nova requisição.
3. Se os botões HEADER de "Limpar" e "Carregar" não existirem, o handler faz fallback manual de cache e dispara alertas.
4. Quando a resposta chega, os widgets chamam `hideBusy()`, mas podem não cancelar timeouts concorrentes.

**Evidência no log** (exemplo simplificado):

```log
[TELEMETRY] ⏰ Created busyTimeout with ID: 31
[TELEMETRY] ⏸️ hideBusy() called
[TELEMETRY] ✅ Clearing busyTimeout (ID: 31)
[TELEMETRY] ⚠️ BUSY TIMEOUT (10s) - Modal still visível, limpando cache e retry...
```
【F:src/thingsboard/main-dashboard-shopping/v-4.0.0/WIDGET/TELEMETRY/controller.js†L40-L48】【F:src/thingsboard/main-dashboard-shopping/v-4.0.0/WIDGET/TELEMETRY/controller.js†L82-L102】

## Root Cause Analysis

1. **Timeout Agressivo**  
   Fallback de 10s é insuficiente em cenários de latência ou carga alta, levando a timeouts falsos.

2. **Instâncias Conflitantes**  
   Cada widget mantém seu próprio timer, causando múltiplos timeouts desconectados do ciclo de vida real.

3. **Gestão de Estado Fragmentada**  
   `busyTimeoutId` é local ao controller e não considera interdependências entre widgets ou orquestrador.

4. **Eventos Duplicados**  
   Orquestrador reemite `provide-data` várias vezes sem debounce, gerando race conditions na lógica de hide/show.

5. **Race Conditions no Período**  
   Condições de corrida em `lastProcessedPeriodKey` e reset de estado geram datas não batendo entre os handlers.

6. **Retry Fallback Inadequado**  
   Dependência de botões HEADER (`tbx-btn-force-refresh`, `tbx-btn-load`) nem sempre disponíveis e alertas intrusivos.

## Proposed Solution

Sugere-se um fix iterativo em quatro fases:

### Fase 1: Timeout e Estado Busy
- Elevar o timeout primário para 25 s.
- Implementar alertas intermediários após 10 s sem interromper o fluxo.
- Centralizar a gestão de busy no orquestrador em vez do controller.

### Fase 2: Coordenação Entre Widgets
- Utilizar estado compartilhado (`window.MyIOOrchestratorData`) para lock/unlock global de busy.
- Sincronizar `lastProcessedPeriodKey` no orquestrador para evitar race conditions.
- Remover instâncias independentes de timeout nos controllers.

### Fase 3: Melhoria do Orquestrador
- Adicionar debounce de emissão de eventos `provide-data`.
- Implementar circuit breaker para retries de fetch.
- Expor métricas de estado de busy e cachê para debugging.

### Fase 4: Robustez e Telemetria
- Registrar métricas de latência e falhas diretamente no orquestrador.
- Testes de carga para validar timeouts e handler de retry.
- Documentar fallback UI sem alertas intrusivos (ex.: notificações unificadas).

## Plano de Ação Detalhado
1. Análise Inicial
   - Revisão dos pontos problemáticos identificados, tais como timeout agressivo, timers isolados e gestão fragmentada do estado busy.
2. Fase 1 – Timeout e Estado Busy
   - Elevar o timeout primário para 25 segundos, acomodando cenários de maior latência.
   - Implementar alertas intermediários após 10 segundos sem interromper o fluxo do usuário.
   - Centralizar a gestão do estado busy no orquestrador, removendo a lógica individual dos widgets.
3. Fase 2 – Coordenação Entre Widgets
   - Criar um estado compartilhado (ex.: window.MyIOOrchestratorData) para gerenciar lock/unlock global do busy.
   - Sincronizar a variável lastProcessedPeriodKey para evitar condições de corrida entre widgets.
   - Eliminar timers individuais, centralizando o controle no orquestrador.
4. Fase 3 – Melhoria do Orquestrador
   - Adicionar debounce na emissão dos eventos provide-data para evitar redundâncias.
   - Implementar um mecanismo de circuit breaker para retries de requisições.
   - Expor métricas de estado (busy e cache) para facilitar o debugging.
5. Fase 4 – Robustez e Telemetria
   - Registrar métricas de latência e falhas diretamente no orquestrador.
   - Realizar testes de carga simulando latências de 5s, 15s e 30s.
   - Documentar uma fallback UI com notificações unificadas, eliminando alertas intrusivos.
6. Cronograma de Rollout
   - Após a aprovação do RFC, proceder com o merge.
   - Aplicar as mudanças da Fase 1 via hotfix e validar em ambiente de staging.
   - Liberar implementações das Fases 2 a 4 em releases sequenciais, com monitoramento contínuo.
7. Plano de Testes
   - Desenvolver testes automatizados e manuais para simular condições de latência e validar a coordenação dos widgets.
   
## Implementation Details

Esta RFC não inclui mudanças de código; mudanças concretas serão detalhadas ao adotar cada fase. Abaixo um pseudocódigo resumido para a centralização do busy no orquestrador:

```js
// Orchestrator: centraliza show/hide busy
function showGlobalBusy(msg) { /* ... */ }
function hideGlobalBusy() { /* ... */ }

// Widget controller:
window.addEventListener('myio:update-date', ev => {
  showGlobalBusy('Carregando dados...');
  MyIOOrchestrator.hydrateDomain(domain, ev.detail.period)
    .finally(() => hideGlobalBusy());
});
```

## Testing Strategy

- Simular latências de 5s, 15s e 30s em ambiente de testes.
- Verificar exibição/ocultação de busy em cada fase.
- Garantir que múltiplos widgets não conflitem.
- Cobertura de testes automatizados com mocks de rede.

## Rollout Plan

1. Merge RFC aprovado.
2. Aplicar mudanças da Fase 1 em hotfix.
3. Validar em staging.
4. Implementar Fases 2–4 em releases subsequentes.
5. Monitorar métricas pós‐deploy.

## Alternatives Considered

- Remover fallback de timeout e confiar apenas em `finally()` do fetch.
- Usar Spinner embutido no card em vez de overlay global.
- Desacoplar UI de carregamento do controller, deixando somente o orquestrador cuidar do estado.

## Open Questions

- Qual o impacto em dashboards com > 10 widgets simultâneos?
- É aceitável exibir notificações consolidadas em vez de alertas JS?
- Necessitamos de configuração de timeout por widget (override via settings)?

**End of RFC-0044**
