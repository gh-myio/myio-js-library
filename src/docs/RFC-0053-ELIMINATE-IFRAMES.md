# RFC-0053: Eliminar iframes na arquitetura do dashboard

Data: 2025-10-22
Status: Aceito (sem iframes) — Implementação definitiva via estados do ThingsBoard; solução interina com DIVs disponível
Versão: v5.2.0 → v6.0.0 (mudança compatível planejada)
Prioridade: P0 (arquitetura e navegação)
Relacionados: RFC-0042 (Orchestrator), RFC-0044 (Busy Centralizado), RFC-0051 (Contexto)
Owner: Plataforma MyIO

Resumo executivo
- Objetivo: remover totalmente o uso de iframes e padronizar a navegação entre conteúdos no mesmo contexto de janela.
- Abordagem preferida (definitiva): navegação por Estados nativos do ThingsBoard (openDashboardState).
- Abordagem interina (sem iframes): containers DIV com atributo `data-content-state` e lógica de exibir/ocultar.
- Proibido em produção: iframes para navegação entre estados (apenas registro histórico em apêndice).

Motivação
- Comunicação simplificada (um único window; sem parent/child).
- Redução de complexidade e de condições de corrida.
- Melhor depuração (um console e DOM único).
- Performance previsível e menor consumo de memória.

Decisão de arquitetura
- Definitivo: Estados do ThingsBoard (Opção A) quando o ambiente estiver configurado.
- Interino: Containers de conteúdo (Opção B) quando Estados não estiverem disponíveis.
- Iframes: obsoleto/deprecado. Não utilizar.

Mecanismo de navegação (ordem canônica)
1) Estados nativos do ThingsBoard: `self.ctx.dashboard.openDashboardState(nomeDoEstado)`.
2) Fallback sem iframes: DIVs com `data-content-state` e show/hide.
3) Iframe: proibido. Manter apenas como histórico no apêndice de Revert.

Critérios de aceite
- Não há criação, injeção nem dependência de iframes nos widgets MENU/MAIN_VIEW/HEADER/TELEMETRY.
- Eventos entre widgets utilizam `window.dispatchEvent(...)` no mesmo contexto.
- Opção A: Estados TB configurados (nomes consistentes, widgets equivalentes entre estados) e MENU navega via `openDashboardState`.
- Opção B: `MAIN_VIEW/template.html` declara todos os containers necessários com `data-content-state` e o MENU alterna corretamente a visibilidade.

Plano de implementação
- Opção A — Estados do ThingsBoard (Preferida)
  - Configurar estados: `telemetry_content`, `water_content`, `temperature_content`, `alarm_content` (ou nomes acordados).
  - Em cada estado, manter widgets MENU, HEADER, MAIN_VIEW e um container de conteúdo alinhado ao domínio.
  - Validar disponibilidade de `self.ctx.dashboard.openDashboardState` no ambiente.
  - No MENU, chamar diretamente `openDashboardState(nomeDoEstado)`.
- Opção B — Containers de conteúdo (DIV) (Interina)
  - `MAIN_VIEW/template.html`: declarar um `<div data-content-state="...">` por estado, com `<tb-dashboard-state ... stateId="...">` dentro.
  - Padrão: um visível (display:block), demais ocultos (display:none).
  - MENU: ocultar todos e exibir somente o container alvo.

Plano de testes
- Navegação MENU: alternar entre todos os estados e verificar conteúdo correto.
- Logs: presença de mensagens padronizadas em MENU/HEADER/MAIN_VIEW (sem referências a iframes ou window.parent).
- Persistência: troca de estado não mantém conteúdo anterior visível.
- Ausência de iframes: inspeção de DOM não deve listar `<iframe>`.

Riscos e dependências
- Opção A depende da configuração dos Estados no ThingsBoard.
- Opção B carrega múltiplos widgets na inicialização; avaliar impacto de memória/tempo de carga.

Histórico e apêndices
- Apêndice M1 (prova de conceito): `RFC-0053-APENDICE-M1.md`.
- Apêndice Opção B (containers DIV): `RFC-0053-APENDICE-OPCAO-B.md`.
- Apêndice Revert (iframe — histórico): `RFC-0053-APENDICE-REVERT-IFRAME.md`.

