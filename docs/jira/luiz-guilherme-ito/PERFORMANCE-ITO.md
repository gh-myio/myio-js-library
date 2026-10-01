# Performance — Luiz Guilherme Martinho Sampaio Ito (Central / Mesh)

> Consolidado a partir de 2 relatórios de autoavaliação técnica que o próprio Ito produziu e
> exportou como PDF (`Acompanhamento_Ito-2026-08-25.pdf` e
> `acompanhamento-luiz-guilherme-ito-2026-09-08.pdf`, nesta pasta). **Fonte não é o Jira** — é
> levantamento direto no repositório (commits, branches, testes), então os números aqui não
> batem 1:1 com `../data.json`/`../metrics.json` (que só contam tickets ED). Onde um item tem
> ticket ED correspondente, o link é feito explicitamente abaixo.
>
> **Ressalva de honestidade:** este é um autorrelato, não uma auditoria independente. Os
> números de teste/commit são verificáveis (branch, hash, contagem de arquivo), mas o
> julgamento de "o que é relevante reportar" foi do próprio autor.

## Período coberto

**25/08/2026 → 08/09/2026** (2 semanas), branch `integration/opi-consolidated` (monorepo
`gh-myio/monorepo`), tema: par de centrais em alta disponibilidade (`myio-ha`) + API restart +
`/v3/health` (ED-1220) + malha NRF24 + Node-RED.

## Cadência de build

7 imagens assinadas em 8 dias corridos, terminando em release:

| Versão | Data | Conteúdo |
|---|---|---|
| rc13.5.3 | 28/ago | piso de relógio + 9 séries de saúde do par no exporter |
| rc13.6.0 | 02/set | eleição automática de papéis pelo cabo |
| rc13.6.1/.2 | 02/set | 6 defeitos de banco do par + endereço de malha + ordem de timers |
| rc13.6.3 | 03/set | ED-1220 (`/v3/health`) |
| rc13.6.4 | 04/set | tentativa de fix Node-RED — **revertida** (ver Node-RED abaixo) |
| rc14.0.0 | 05/set | consolidação do par + fix correto do Node-RED — **assinada, 181.518.848 bytes** |

## Entregas por frente

### 1. `myio-ha` — par de centrais em alta disponibilidade (o grosso do período)
- **Escopo:** pacote novo, 25 arquivos, 8 units systemd, eleição automática
  (`myio-ha-elect.py` + `myio-ha-arm.sh`) — duas placas decidem quem serve sem intervenção manual.
- **Testes:** 147 bats (relatório de 25/08) → **247 bats + 63 unittest** (relatório de 08/09) —
  crescimento de +100 bats no período. Mais 23 asserções de integração contra containers reais
  (PostgreSQL 11 + TimescaleDB 1.7.5).
- **6 defeitos de camada de banco** achados só com bancada de duas placas físicas (postgres da
  primária não bindava o cabo; standby falhando em silêncio; basebackup não atravessava `/data`;
  timer de identidade que nunca subia).
- **1 regressão crítica achada e corrigida:** `ConditionPathExists` avaliada antes do arquivo
  existir deixava os timers inativos após um OTA — **o par ficava sem failover automático
  nenhum**, medido nas duas placas em 02/09. Corrigido com uma linha.
- **Identidade de serviço corrigida na documentação:** são 9 valores que trafegam pela
  replicação, não 4 como a doc antiga dizia.
- **3 defeitos grandes fechados na rc14.0.0:** veredito "silent" da malha caindo pelo `case`
  errado na promoção; `conflict` nunca demitia (duas placas ficavam no mesmo endereço Yggdrasil);
  placa voltando com cabo solto subia `primary` sem provar nada; `CENTRAL_ID` duplicado
  corrompia o rádio uma da outra.
- `myio_board_id` ancorado no SID do Allwinner (driver já existia no kernel, ninguém o usava) +
  inventário Mender expandido de 1 para 9 campos.
- **Pendências que o próprio relatório assume:** validação em bancada com hardware físico ainda
  não feita; escutador de rádio segue desligado por padrão aguardando esse gate.

### 2. API restart (`POST /system/restart`)
- Endpoint com gate de API key (comparação em tempo constante), trigger via arquivo + unit
  systemd dedicada (não reinicia o processo diretamente). 7 casos de teste (`node:test`) cobrindo
  todos os caminhos de falha (503 sem chave configurada, 401×2, timing-safe compare, 202 nunca
  200, fallback de auditoria por IP).

### 3. API `/v3/health` — **ED-1220**
- Composição: exporter serve `/services`, `pg_upload` grava marker, rota Node agrega e decide o
  HTTP. PR #57 aberta — **nota de honestidade do próprio relatório:** o PR mostra 132 arquivos,
  mas o escopo real do ED-1220 é 14 arquivos/10 commits; o resto é linhagem de build arrastada
  junto.
- 2 bloqueadores achados na própria documentação ao verificar: o pin `fbf508d` citado não contém
  o código (units novas, binário velho); o marker não sobrevive a um OTA.
- No cockpit (`../data.json`), ED-1220 está registrado com assignee **Rodrigo Lago**, status
  **EM REVISÃO** — divergência a resolver: pelo relatório de Ito, quem implementou é ele. Vale
  confirmar/corrigir o assignee no Jira (Rodrigo pode ser o dono do ticket/revisor, com Ito como
  dev de fato — ou o campo está desatualizado).

### 4. Malha NRF24 (mesh) — em andamento, não pushado
- Diagnóstico registrado com citação de arquivo+linha para cada afirmação
  (`docs/design/mesh-throughput.md`, 260 linhas): a 250 kbit/s uma troca ocupa ~1,2 ms de ar, o
  produto responde 16,86 ms após o fim da TX, o escalonador reserva 4000 ms — variedura completa
  de 300 sensores leva ~1204 s.
- 4 dos 10 itens de melhoria mapeados (M1-M4) implementados numa branch local
  (`feat/mesh-throughput`, 5 commits, +455/−42) — **honestamente marcada como não compilada, não
  testada, não pushada, 0 testes novos**. M5-M10 seguem bloqueados por bancada com sensor
  trifásico.

### 5. Node-RED — bug de autenticação
- **Bug corrigido:** `Unauthorized` no navegador — causa raiz: o gate só aceitava header
  `Bearer`, e o navegador não manda esse header.
- **Achado colateral relevante:** `/auth/register` anônimo devolvia um token que abria os flows
  — falha de segurança lateral encontrada investigando o bug original.
- **Boa prática de revisão própria:** a primeira tentativa de fix (rc13.6.4, 04/set) foi
  **revertida pelo próprio autor** ao perceber que dava admin por qualquer túnel, inclusive o da
  nuvem — só a rc14.0.0 (05/set) trouxe o fix correto.

### 6. Mender no par
- Matriz de 39 cenários + runbook de OTA em duas ondas.
- Respondeu com precisão uma dúvida de arquitetura: a secundária não copia o Mender, copia o
  banco — o que colide é o inventário.
- Marcou um pedido como **impossível como formulado** (cliente não deixa o artifact em disco) em
  vez de forçar uma implementação capenga, e desenhou o caminho alternativo (depende de medição
  de bancada).

### 7. Documentação
- `redundancia-de-centrais.md` — 2.754 linhas, 22 diagramas.
- `ed-1220-health-v3.md` — 1.708 linhas, 14 diagramas.
- Em ambos, o levantamento próprio **derrubou 50 e 91 afirmações**, respectivamente, da
  documentação antiga e de comentários no próprio código — indicativo de revisão crítica de
  fontes, não cópia de doc desatualizada.

## Resumo quantitativo

| Métrica | Relatório 25/08 | Relatório 08/09 |
|---|---|---|
| Imagens buildadas no período | 1 (rc13.5.0) | 6 (rc13.5.3 → rc14.0.0) |
| Testes novos — unitário/bats | 147 bats (`myio-ha`) + 7 (`node:test`, API restart) | 247 bats + 63 unittest (`myio-ha` eleição) |
| Testes novos — integração | 23 (containers reais) | — (mantidos) |
| Defeitos de banco achados só em bancada | — | 6 |
| Regressões críticas achadas e corrigidas | — | 1 (perda total de failover pós-OTA) |
| Bugs de segurança achados (colateral) | — | 1 (`/auth/register` anônimo) |
| Fix revertido por autocrítica antes de reincidir | — | 1 (rc13.6.4) |
| Linhas de documentação nova | ~260 (design doc mesh) | 4.462 (2 docs) |
| Afirmações incorretas de doc/código corrigidas | — | 141 (50 + 91) |

## Vínculo com o Jira (`../data.json` / `../wip.json`)

- **ED-1220** — `/v3/health`: implementação é dele por este relatório; ticket no Jira está com
  Rodrigo Lago, status EM REVISÃO, Sprint 19. **Ação sugerida:** confirmar assignee real com os
  dois antes do próximo snapshot.
- **Grupo "Central / Firmware / HW"** no cockpit (26 itens na Sprint 19 após o snapshot de
  08/09) é consistente com o volume de trabalho aqui descrito (ED-1199..1204, ED-1206..1213 e
  correlatos).
- **ED-1208** ("Definir o critério de setor") segue como o único item `Em Andamento` dele no
  `../wip.json` atual — não coberto por nenhum dos dois relatórios acima (frente de trabalho
  distinta, malha/setores).

## Como manter isto atualizado

Quando novos relatórios do Ito chegarem nesta pasta, adicionar uma seção acima seguindo o mesmo
formato (período, cadência de build, entregas por frente, resumo quantitativo) e atualizar a
tabela comparativa. Não misturar estes números com `../metrics.json`/`../data.json` — aqueles
são estritamente Jira-sourced (`resolutiondate`/JQL) e este arquivo é repositório-sourced; a
mistura quebraria a garantia de proveniência que o README do cockpit documenta.
