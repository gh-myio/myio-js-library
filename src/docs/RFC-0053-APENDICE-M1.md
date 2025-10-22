# RFC-0053 — Apêndice M1: Prova de Conceito (histórico)

Data: 2025-10-22
Status: Histórico — Prova de Conceito implementada
Versão: v5.2.0 → v6.0.0 (PoC)
Relacionados: RFC-0053 (master), RFC-0042, RFC-0044, RFC-0051

Resumo
- Objetivo do M1: validar arquitetura sem iframes simplificando a comunicação de eventos.
- Escopo: remover criação de iframes no MENU, simplificar emissão de eventos em MAIN_VIEW/HEADER, eliminar `window.parent` no TELEMETRY e validar build.

Principais mudanças (PoC)
- MENU: remoção do bloco que construía `<iframe>` dinamicamente.
- MAIN_VIEW/HEADER: `emitToAllContexts` reduzido para `window.dispatchEvent(...)` (contexto único).
- TELEMETRY: remoção de fallback baseado em `window.parent`.

Lições aprendidas
- A simplificação de eventos reduz código, erros e condições de corrida.
- A ausência de estados configurados no ThingsBoard pode bloquear a navegação se não houver fallback com containers.

Estado atual
- A PoC demonstrou viabilidade técnica sem iframes.
- A implementação definitiva deve seguir o master RFC (Estados TB — Opção A) ou, interinamente, o apêndice da Opção B.

Referências
- Master: `RFC-0053-ELIMINATE-IFRAMES.md`.
- Interino: `RFC-0053-APENDICE-OPCAO-B.md`.
