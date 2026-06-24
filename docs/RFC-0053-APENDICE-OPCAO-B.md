# RFC-0053 — Apêndice: Opção B (containers DIV)

Data: 2025-10-22
Status: Implementado (Interino, sem iframes)
Prioridade: P0 (restaurar navegação sem dependência de estados TB)
Relacionados: RFC-0053 (master)

Resumo
- Opção sem iframes baseada em containers de conteúdo (`<div data-content-state="...">`).
- Todos os estados são pré-declarados no `MAIN_VIEW/template.html` e alternados por show/hide no MENU.
- Funciona sem configuração de Estados no ThingsBoard.

Alterações necessárias
- MAIN_VIEW/template.html (exemplo mínimo):
```
<main class="myio-content">
  <div data-content-state="telemetry_content" style="display:none;">
    <tb-dashboard-state class="tb-child" [ctx]="ctx" stateId="telemetry_content"></tb-dashboard-state>
  </div>
  <div data-content-state="water_content" style="display:none;">
    <tb-dashboard-state class="tb-child" [ctx]="ctx" stateId="water_content"></tb-dashboard-state>
  </div>
  <div data-content-state="temperature_content" style="display:none;">
    <tb-dashboard-state class="tb-child" [ctx]="ctx" stateId="temperature_content"></tb-dashboard-state>
  </div>
  <div data-content-state="alarm_content" style="display:block;">
    <tb-dashboard-state class="tb-child" [ctx]="ctx" stateId="alarm_content"></tb-dashboard-state>
  </div>
  
</main>
```

- MENU/controller.js (lógica de alternância):
```
const main = document.getElementsByTagName('main')[0];
const all = main.querySelectorAll('[data-content-state]');
all.forEach(div => { div.style.display = 'none'; });
const target = main.querySelector(`[data-content-state="${stateId}"]`);
if (target) { target.style.display = 'block'; }
```

Critérios de aceite (Opção B)
- Quatro containers declarados e identificáveis por `data-content-state`.
- Apenas um container visível por vez; troca via MENU.
- Ausência total de iframes.
- Eventos no contexto único de janela.

Trade-offs
- Todos os widgets carregam na inicialização; avaliar impacto de memória.
- Alternância é instantânea; estado visual se mantém entre trocas.

Próximos passos
- Manter Opção B em produção enquanto os Estados TB são preparados.
- Migrar para Opção A (definitiva) quando `openDashboardState` estiver disponível.

Referência
- Master: `RFC-0053-ELIMINATE-IFRAMES.md`.

