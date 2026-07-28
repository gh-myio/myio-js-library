# Acordos de Processo — Time ED (Jira Board 166)

> Regras combinadas de trabalho e medição. Refletidas nos dashboards `index.html` (cockpit) e `performance.html`.
> Última revisão: **28/07/2026**.

## 1. WIP = 1 (um ticket em andamento por pessoa)
Cada pessoa mantém **sempre um, e apenas um**, ticket com status **`Em Andamento`** — inclusive quando estiver ociosa: nesse caso, o ticket em andamento é o de **`Aguardando Demanda`**. Nunca zero, nunca dois.

- **Objetivo:** tornar o trabalho (e a ociosidade) visível e rastreável no board a qualquer momento.
- **Como medimos:** cartão *"WIP atual"* no cockpit (`status = "Em Andamento"` agrupado por responsável). Acima de 1 = sinalizado.

## 2. Vazão diária: mínimo 1, meta 4
- **Mínimo aceitável:** **1 ticket concluído por dia útil**.
- **Meta desejada:** **4 tickets concluídos por dia útil**.

- **Objetivo:** garantir fluxo contínuo de entregas; 4/dia é o ritmo saudável esperado.
- **Como medimos:** dashboard de Performance — coluna *Aderência* (dias úteis com ≥1 entrega) e linha tracejada de **meta (4/dia)** no gráfico de conclusões diárias.

## 3. Granularidade mínima de tarefa: 0,5 h
Nenhuma tarefa é menor que **meia hora** (0,5 h) de estimativa/apontamento. Trabalhos menores são agrupados num único ticket.

- **Objetivo:** evitar fragmentação artificial e inflar a contagem de tickets.

## 4. Teto diário: 16 tickets concluídos/dia
Fechar **mais de 16 tickets num único dia** (por pessoa) é sinalizado como **suspeito** (provável fechamento em lote).

- **Coerência interna:** 16 tickets × 0,5 h = 8 h = uma jornada. Acima disso, ou houve lote, ou a granularidade mínima (item 3) foi furada.
- **Como medimos:** dashboard de Performance — coluna *Picos > 16* e barras vermelhas no gráfico diário.

## 5. Branch = ID do Ticket
Toda branch nos repositórios é **alinhada ao ID do ticket** no Jira, com prefixo por tipo (mesmo vocabulário dos commits) e **slug opcional** para leitura.

| Tipo | Prefixo | Exemplo |
|---|---|---|
| Feature | `feat/` | `feat/ED-953-tela-login` |
| Correção | `fix/` | `fix/ED-999` |
| Refactor | `refactor/` | `refactor/ED-1012` |
| Chore/infra | `chore/` | `chore/ED-1020` |
| Docs | `docs/` | `docs/ED-981` |

- **Formato:** `<tipo>/ED-<id>[-slug-curto]`.
- **Ganho:** o Jira faz a **linkagem automática** do desenvolvimento no ticket; permite *Smart Commits* (transicionar status pelo commit).

## 6. Semântica de status (máquina de estados da TASK-pai)
A **TASK-pai** carrega o *estágio do fluxo*; o **WIP=1 é medido apenas no que está `Em Andamento`** (a pai em `Em Revisão`/`Pendente` **não** conta como WIP de ninguém).

| Status | Significado |
|---|---|
| **Em Andamento** | Alguém está **trabalhando ativamente** (é o item de WIP daquela pessoa). |
| **Em Revisão** | Alguém está **revisando/validando ativamente** — existe uma **subtask `Em Andamento`** de revisão. |
| **Pendente** | **Parado esperando** — na fila (ninguém pegou ainda) ou **devolvido** aguardando o DEV retomar. |
| **Concluído** | Entregue e validado. |

```
Em Andamento ──(DEV termina)──▶ Em Revisão ──(aprovado)──▶ Concluído
     ▲                              │
     │                              │ (bug: evidencia e devolve)
     └────── Em Andamento ◀── Pendente ◀┘
            (DEV retoma: Pendente → Em Andamento = seu WIP)
```

## 7. Fluxo DEV → QA (Validação funcional)
1. DEV finaliza o desenvolvimento e **passa para revisão**: **reatribui a TASK ao QA** e muda o status para **`Em Revisão`**.
2. O QA cria uma **subtask "Validação QA"** dentro da TASK, com **estimativa em horas**. Essa subtask é o **`Em Andamento` do QA**.
3. **Aprovado:** o QA **evidencia** na subtask, **conclui a "Validação QA"** e **conclui a TASK-pai**.
4. **Pendência / novo bug:** o QA **evidencia o cenário**, **devolve a TASK ao DEV** e move **ambas** (pai + validação) `Em Revisão → Pendente`. Quando o DEV retoma, move a dele `Pendente → Em Andamento` (vira seu WIP).
5. **A cada rodada de bug, o QA reabre a MESMA subtask "Validação QA"** (mantém histórico; rodadas registradas em comentários).

## 8. Fluxo de PR (Revisão de código)
1. DEV **abre o PR**, move a TASK `Em Andamento → Pendente`, **reatribui** ao líder técnico (ou revisor) e **comenta o link do PR** na TASK. *(Isso libera o WIP do DEV para pegar o próximo.)*
2. O revisor move a pai `Pendente → Em Revisão` e cria uma **subtask "Revisão de código"** (que vira o `Em Andamento` dele).
3. Aprovação/pendência seguem a mesma mecânica do item 7 (evidência, conclui ou devolve para `Pendente`).

> **Dois tipos de revisão, mesmo status na pai (`Em Revisão`), subtasks distintas:** **"Revisão de código"** (PR / líder técnico) e **"Validação QA"** (teste funcional).

---

## Parâmetros aplicados nos dashboards
| Regra | Parâmetro (`metrics.json` → `rules`) | Valor |
|---|---|---|
| Mínimo diário | `minPerDay` | 1 |
| Meta diária | `targetPerDay` | 4 |
| Teto suspeito | `suspectPerDay` | 16 |
| Tarefa mínima | `minTaskHours` | 0,5 |
| Limite de WIP | `wipLimit` | 1 |

## Ressalvas de medição (honestas)
- **Base de conclusão = `resolutiondate`** — mede *quando o ticket foi marcado concluído no Jira*, não necessariamente quando o trabalho terminou. Fechamento em lote distorce a aderência para baixo.
- **1 ticket = 1**, sem peso por esforço/tamanho. Item 3 (0,5 h mínimo) mitiga parcialmente.
- **Subtarefas contam** no throughput (podem inflar volume de quem tem muitos itens de spec/documentação).
- **WIP** é um *snapshot* do momento da geração (não histórico).
