# RFC-0053 — Checklist de Configuração de Estados ThingsBoard (Opção A Definitiva)

Data: 2025-10-22
Escopo: Configurar Estados no ThingsBoard para navegação nativa sem iframes e habilitar `openDashboardState`.
Resultado esperado: Navegação entre conteúdos via Estados TB, eventos em contexto único, zero iframes.

Pré-requisitos
- Acesso de edição ao dashboard no ThingsBoard (permissões de administrador).
- Identificação do dashboard alvo (ID/slug) atualmente usado em produção.
- Conhecimento dos domínios/conteúdos: energia, água, temperatura, alarmes.

Padrões de nomes e IDs de Estado
- IDs dos estados (minúsculo, com underscore):
  - `telemetry_content` (energia)
  - `water_content`
  - `temperature_content`
  - `alarm_content`
- Um estado raiz (root/default) para carregar por padrão (sugestão: `telemetry_content` ou `alarm_content`).

Passo a passo — Configurar Estados no ThingsBoard
1) Abrir o dashboard alvo no ThingsBoard em modo de edição.
2) Abrir a seção de configuração de Estados (States ou Dashboard States):
   - Criar os estados com os IDs definidos acima.
   - Marcar um como root/default.
3) Em cada estado, manter os mesmos widgets estruturais:
   - `MENU` (widget custom)
   - `HEADER` (widget custom)
   - `MAIN_VIEW` (widget custom — orquestrador)
   - Container de conteúdo específico do estado (widgets/telemetry relacionados ao domínio daquele estado).
4) Ajustar datasources e settings por estado:
   - Energia: dispositivos de energia, filtros e parâmetros pertinentes.
   - Água: dispositivos de água, etc.
   - Temperatura: sensores de temperatura, etc.
   - Alarmes: lista de alarmes/configuração correspondente.
5) Salvar as alterações do dashboard.

Associação de Widgets por Estado
- MENU, HEADER e MAIN_VIEW devem existir em todos os estados, compartilhando a mesma função e layout.
- O conteúdo principal varia entre estados (telemetry/widgets diferentes conforme domínio).

Ajustes no Código (MENU/controller.js) — Navegação por Estado com Fallback sem iframes
- Comportamento desejado:
  1. Se `openDashboardState` existir, navegar via API nativa do TB.
  2. Caso contrário, usar fallback de containers DIV (`data-content-state`) no mesmo dashboard (sem iframes).

Exemplo de lógica (trecho sugerido):
```
// Navegação por Estados do ThingsBoard (preferido) com fallback para DIVs
try {
  const targetStateName = stateId; // ex.: "telemetry_content"

  if (self.ctx?.dashboard && typeof self.ctx.dashboard.openDashboardState === 'function') {
    LogHelper.log(`[MENU] RFC-0053: Navegando para estado TB: ${targetStateName}`);
    self.ctx.dashboard.openDashboardState(targetStateName);
  } else {
    // Fallback: show/hide containers de conteúdo no mesmo dashboard
    const main = document.getElementsByTagName('main')[0];
    if (!main) return;

    const all = main.querySelectorAll('[data-content-state]');
    all.forEach(div => { div.style.display = 'none'; });

    const target = main.querySelector(`[data-content-state="${stateId}"]`);
    if (target) {
      target.style.display = 'block';
      LogHelper.log(`[MENU] RFC-0053: Exibindo container para ${stateId}`);
    } else {
      LogHelper.warn(`[MENU] RFC-0053: Container não encontrado para ${stateId}`);
    }
  }
} catch (err) {
  LogHelper.error('[MENU] RFC-0053: Falha na navegação', err);
}
```

Validação no Navegador (console)
- API disponível: `typeof self.ctx.dashboard.openDashboardState` → deve retornar `"function"`.
- Estados listados: `self.ctx.dashboard.configuration?.states || self.ctx.dashboardCtrl?.dashboardConfiguration?.states` → array contendo os 4 estados.
- Teste manual: clicar nos itens do MENU e verificar troca de estado no TB (sem iframes) ou exibição do container fallback.

Critérios de aceite (Opção A definitiva)
- MENU usa `openDashboardState` quando disponível.
- Todos os conteúdos alternam corretamente entre estados do TB (ou fallback com containers quando no mesmo dashboard, sem criar iframes).
- Eventos entre widgets ocorrem no mesmo contexto de janela (sem `window.parent` e sem loops de iframes).
- Inspeção do DOM não mostra `<iframe>` para navegação de conteúdo.

Pós-configuração
- Se Estados TB estiverem operando, pode-se remover a dependência dos containers DIV em `MAIN_VIEW/template.html` (opcional), mantendo apenas a estrutura baseada em estados.
- Atualizar documentação de operação para a equipe.

Solução interina (se Estados não estiverem prontos)
- Manter os containers DIV com `data-content-state` e a lógica de show/hide do MENU.
- Não utilizar iframes como fallback.

Problemas comuns e solução
- `openDashboardState` não existe: conferir permissões do usuário e versão/configuração do TB; usar fallback de containers até corrigir.
- Estado não renderiza widgets: checar se o ID do estado no TB coincide exatamente com `stateId` usado no código.
- Conteúdo vazio no container: se usar `<tb-dashboard-state>`, confirme que o estado existe no TB; alternativamente componha widgets diretamente sem essa tag.

