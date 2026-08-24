# Cockpit Jira — ED (Sprint 19 + Backlog)

Dashboards estáticos gerados a partir do Jira Cloud (`myio.atlassian.net`, projeto **ED / Engineer Dashboard**, board **166**), via MCP Atlassian. **Snapshot: 20/08/2026.**

## Arquivos

| Arquivo | Descrição |
|---|---|
| `index.html` | **Cockpit do backlog** — KPIs, charts, cartão de WIP e grid filtrável (541 backlog + 67 da Sprint 19). |
| `performance.html` | **Performance & Burndown** — burndown por sprint, conclusões/dia, heatmap e ranking de aderência, seletor de período, export PDF. |
| `processo.html` | **Modelo de Trabalho** — acordos de processo + fluxo de revisão (DEV→QA, PR) + nomenclatura de branches. |
| `data.json` | Dados estruturados do cockpit (sprint + backlog + agregados). Consumido por `index.html`. |
| `metrics.json` | Métricas temporais (sprints 15–19, burndown, 99 conclusões p/ throughput por período). Consumido por `performance.html` e `processo.html`. |
| `wip.json` | Snapshot de WIP (tickets `Em Andamento` por pessoa). Consumido pelo cartão WIP do cockpit. |
| `ED-sprint19-backlog-2026-08-20.md` | Relatório textual atual (tabelas agrupadas por unidade/tema). Snapshot anterior (`2026-07-28`) mantido como histórico. |
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

- **Backlog (cockpit):** `project = ED`, fora de sprint aberta, `statusCategory != Done`, **excluindo épicos e subtarefas** (containers) — reflete a lista de trabalho do board.
- **Sprint 19:** `sprint = 596` (ainda **active** no Jira em 20/08/2026, apesar da janela planejada 28/07 → 04/08/2026 já ter passado — o time não fechou formalmente a sprint). Sprints anteriores 15–18 fechadas; ao fechar, itens incompletos migram para a próxima sprint, então o escopo visível de sprint fechada ≈ o que foi concluído.

## Regenerar

Os JSONs foram gerados a partir de consultas JQL via MCP Atlassian (paginadas em `searchJiraIssuesUsingJql`). Para atualizar, refaça as consultas e reprocesse — os scripts de geração ficaram no scratchpad da sessão. Snapshot atual: **20/08/2026**.
