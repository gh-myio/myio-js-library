# RFC-0053 — Apêndice: Revert temporário com iframe (histórico)

Data: 2025-10-22
Status: Histórico — revert temporário aplicado e obsoleto
Prioridade: N/A (não usar em produção)
Relacionados: RFC-0053 (master)

Resumo
- Após upload inicial da implementação sem iframes, a navegação que dependia de Estados do ThingsBoard falhou no ambiente onde `openDashboardState` não estava disponível e não havia containers declarados.
- Um revert temporário restaurou a navegação via iframe no MENU para desbloquear o uso.
- Esta abordagem está deprecada e não deve ser utilizada; mantida apenas para registro de causa e decisão.

Causa raiz
- Ambiente ThingsBoard sem Estados configurados e sem containers de conteúdo.
- Fallback inadequado resultou em quebra de navegação.

Decisão
- Reversão temporária realizada para restaurar a operação.
- Arquitetura alvo permanece “sem iframes”.
- Encaminhamento: aplicar Opção B (interina) ou concluir migração para Estados TB (Opção A).

Diretriz
- Não utilizar iframes como mecanismo de navegação.
- Priorizar Estados TB; usar containers DIV enquanto Estados não estiverem prontos.

Referência
- Master: `RFC-0053-ELIMINATE-IFRAMES.md`.

