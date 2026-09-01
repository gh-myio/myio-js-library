# Cockpit Jira — ED (Sprint 19 + Backlog)

Dashboards estáticos gerados a partir do Jira Cloud (`myio.atlassian.net`, projeto **ED / Engineer Dashboard**, board **166**), via MCP Atlassian. **Snapshot: 01/09/2026** (atualização incremental sobre o de 26/08).

## Arquivos

| Arquivo | Descrição |
|---|---|
| `index.html` | **Cockpit do backlog** — KPIs, charts, cartão de WIP e grid filtrável (597 backlog + 68 da Sprint 19). Escopo: Tarefa + Subtarefa + Bug (sem Épico, sem História/Story). |
| `performance.html` | **Performance & Burndown** — burndown por sprint, conclusões/dia, heatmap e ranking de aderência, seletor de período, export PDF. |
| `processo.html` | **Modelo de Trabalho** — acordos de processo + fluxo de revisão (DEV→QA, PR) + nomenclatura de branches. |
| `data.json` | Dados estruturados do cockpit (sprint + backlog + agregados). Consumido por `index.html`. |
| `metrics.json` | Métricas temporais (sprints 15–19, burndown, 152 conclusões p/ throughput por período). Consumido por `performance.html` e `processo.html`. |
| `wip.json` | Snapshot de WIP (tickets `Em Andamento` por pessoa). Consumido pelo cartão WIP do cockpit. |
| `ED-sprint19-backlog-2026-08-25.md` | Relatório textual (tabelas agrupadas por unidade/tema) — **desatualizado**: ainda reflete o escopo antigo (Tarefa+História+Bug+Freshdesk). Snapshots anteriores (`2026-07-28`, `2026-08-20`, `2026-08-24`) mantidos como histórico. |
| `PROCESSO.md` | Acordos de processo do time (WIP=1, vazão 1/4/dia, teto 16, tarefa mín. 0,5h) + fluxos e branches. |
| `start-server.*` / `stop-server.*` | Sobem/derrubam um servidor estático local na porta **3340**. |

## Como rodar

```bash
# Windows
start-server.bat        # abre http://localhost:3340/docs/jira/

# Git Bash / Linux / macOS
./start-server.sh
./stop-server.sh
```

- Cockpit backlog: <http://localhost:3340/docs/jira/index.html>
- Performance & Burndown: <http://localhost:3340/docs/jira/performance.html>

> Servem os JSONs via `fetch` — precisa do servidor (abrir o HTML direto com `file://` bloqueia o fetch).

## Regras de leitura (performance) — ver `PROCESSO.md`

- **Base de conclusão:** `resolutiondate` do Jira.
- **Mínimo:** ≥ 1 ticket/dia útil · **Meta:** 4/dia · **Teto suspeito:** > 16/dia (lote) · **Tarefa mínima:** 0,5 h · **WIP:** 1 por pessoa.
- **Aderência:** % de dias úteis do período selecionado com ≥ 1 entrega (regularidade, não volume).
- **Período configurável:** presets das 5 sprints (14–18), "Últimas 5 sprints" ou intervalo de datas custom. Throughput recomputa client-side.
- **Burndown:** por contagem de tickets, por sprint (linha ideal na janela da sprint). Intervalos multi-sprint mostram burn-up acumulado.
- **Export:** botão "Exportar relatório premium (PDF)" → `window.print()` com layout `@media print` A4.

## Escopo dos dados

- **Tipos contados:** Tarefa/Task, Subtarefa/Subtask e Bug. **Excluídos:** Épico e História/Story (decisão de 26/08/2026 — antes o escopo incluía História e excluía Subtarefa; ver histórico do repo).
- **26/08/2026:** 25 tickets concluídos no Jira (transição real, não só snapshot) e removidos daqui — 4 de Bruno Kubudi Cardeman, 9 de Bruno Dantas Costa, e todos os 12 restantes do grupo Obramax (Rodrigo Lago + Leandro Gadioli Rodrigues), com 2 tickets contados nos dois critérios (ED-143, ED-144). Totais caíram de 567/57/624 para 545/54/599.
- **01/09/2026 (delta desde 26/08):** totais subiram para 597/68/665. Entradas: **+50** da migração RFC-0229 Customer Server Scope → GCDR customer-config (ED-1149 + 49 subtarefas, Victor, backlog); **+14** subtarefas de Central na Sprint 19 (ED-1199..1204 Erlradio/deploy sob ED-800, ED-1206..1213 MESH/setores sob ED-1205, Ito); **+3** avulsos (ED-1214 exploração OS antigo p/ Letícia; ED-1217/ED-1218 follow-ups BAS do review do PR #121). Saídas: 4 concluídos (ED-50, ED-1066, ED-1068, ED-1115). ED-1145 (bug Melicidade, PR #121 aprovado) reatribuído a Victor. Sprint 19 segue **active** no Jira; escopo dela cresceu 82→96 com as subtarefas novas.
- **Backlog (cockpit):** `project = ED`, fora de sprint aberta, `statusCategory != Done`, tipos acima.
- **Sprint 19:** `sprint = 596` (ainda **active** no Jira em 26/08/2026, apesar da janela planejada 28/07 → 04/08/2026 já ter passado — o time não fechou formalmente a sprint). Sprints anteriores 15–18 fechadas; ao fechar, itens incompletos migram para a próxima sprint, então o escopo visível de sprint fechada ≈ o que foi concluído.
- **Subtarefas:** herdam o `group`/tema do ticket pai quando o conteúdo da subtarefa não indica algo mais específico (ex.: subtarefa citando um shopping/cliente pelo nome vai para o grupo daquele cliente, mesmo que o pai seja um container genérico).

## Regenerar

Os JSONs foram gerados a partir de consultas JQL via MCP Atlassian (paginadas em `searchJiraIssuesUsingJql`). Para atualizar, refaça as consultas e reprocesse — os scripts de geração ficaram no scratchpad da sessão. Snapshot atual: **01/09/2026**.

> ⚠️ **Armadilha de JQL (aprendida em 01/09):** `issuetype in (Tarefa, Subtarefa, Bug)` NÃO retorna issues criadas via API com o nome de tipo em inglês ("Task"), mesmo que o Jira as exiba como "Tarefa" (mesmo id 10267). Para não perder tickets, filtre por **id**: `issuetype in (10267, 10271, 10268)` (Tarefa, Subtarefa, Bug).

**Atualização incremental** (mais barata que o full pull): 1 query de resolvidos (`resolved >= <última data>`), 1 de abertos alterados (`statusCategory != Done AND updated >= <última data>`), 1 de WIP (`status = "Em Andamento"`); remover resolvidos das listas, fazer upsert dos alterados (sprint se membro da sprint ativa, senão backlog), recomputar agregados/summary e estender o burndown da sprint ativa.
