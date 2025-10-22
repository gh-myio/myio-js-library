# RFC-0053 — Status Atual do Ambiente

Data de Análise: 2025-10-22 22:15
Ambiente: Produção ThingsBoard (dashboard.myio-bas.com)
Versão: v5.2.0

Resumo Executivo
- Implementação atual: Opção B (containers DIV) implementada no código, sem iframes.
- Status de funcionamento: Parcialmente bloqueada.
- Causa: Falta de Estados ThingsBoard (telemetry_content, water_content, temperature_content, alarm_content) para o `<tb-dashboard-state>` renderizar widgets.
- Próxima ação recomendada: Configurar Estados TB e migrar para Opção A (definitiva) OU ajustar template para não depender de `<tb-dashboard-state>` (pesquisa).

Checklist de Itens Concluídos
- [x] Config Null Reference Fix — optional chaining em MAIN_VIEW/controller.js
- [x] Cache Bypass — verificado nos logs do RFC-0052 (enableCache: false, "Cache disabled - skipping write")
- [x] Análise do Ambiente RFC-0053 — este documento criado com caminhos de migração e estimativas

Análise do Código Atual
- MENU/controller.js: Alterna containers por `data-content-state` (show/hide), sem criação de iframes.
- MAIN_VIEW/template.html: Declara quatro containers e usa `<tb-dashboard-state stateId="...">` em cada um.
- HEADER/controller.js: Emissão de eventos simplificada (contexto único, sem window.parent/iframes).

Problema Identificado
- `<tb-dashboard-state>` exige Estados configurados no ThingsBoard. Sem eles, os containers ficam visíveis porém vazios (widgets não renderizam).

Verificações no Navegador (console)
- Teste 1 — API disponível: `typeof self.ctx.dashboard.openDashboardState` → esperado: "function".
- Teste 2 — Estados listados: `self.ctx.dashboard.configuration?.states || self.ctx.dashboardCtrl?.dashboardConfiguration?.states` → esperado: array com ids configurados.
- Teste 3 — Inspeção TB: verificar na UI do TB a existência dos estados acima e seus widgets.

Cenários
- Cenário A — Estados TB existem: implementar Opção A (preferida) usando `openDashboardState(nomeDoEstado)`; containers DIV tornam-se desnecessários.
- Cenário B — Estados TB não existem: ajustar Opção B verdadeira (sem `<tb-dashboard-state>`) OU configurar estados e migrar para A.

Caminhos Recomendados
- Caminho 1 (recomendado, 2–4h): Configurar Estados TB e migrar para Opção A (definitiva, sem iframes, API nativa).
- Caminho 2 (4–8h, incerto): Pesquisar Opção B “verdadeira” sem `<tb-dashboard-state>` (ex.: composição direta de widgets), mantendo containers DIV.
- Caminho 3 (rápido): Habilitar feature flag para alternar A/B em runtime, reduzindo risco de rollback.

Decisão Pendente
- Escolher entre Caminho 1, 2 ou 3 para destravar a navegação com zero iframes.

Referências
- Master: `src/docs/RFC-0053-ELIMINATE-IFRAMES.md`
- Apêndice (M1): `src/docs/RFC-0053-APENDICE-M1.md`
- Apêndice (Opção B): `src/docs/RFC-0053-APENDICE-OPCAO-B.md`
- Apêndice (Revert — histórico): `src/docs/RFC-0053-APENDICE-REVERT-IFRAME.md`

