# Slaves Map — Contagem (Soul Malls)

> Central: **Shopping Contagem** · Gateway `70b6d878-090f-4326-af18-2695396cbc67`
> IPv6: `200:12b0:b768:7ba0:32b5:1c15:bec7:33aa`
> Grupo: **Soul Malls** · Shopping: **Shopping Contagem**
> Total slaves: **79** · Total channels: **8** (todos teste) · Total ambients: **7** · Junction (`ambients_rfir_slaves_rel`): **78** · `ambients_rfir_devices_rel`: **0**
> Fonte: `logMaps-v2-CONTAGEM.log` (gerado por `/tmp/dump-cadastro.sh`), capturado em **2026-07-07 12:33 UTC** — **estado final pós-revert + pós-restauração de nomes**.
> Dados estruturados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · [`ambients_slaves_rel.json`](ambients_slaves_rel.json) · [`ambients_devices_rel.json`](ambients_devices_rel.json)
> `version` de todos: **`6.0.0`** · `aggregate`: `t` · `type`: **`three_phase_sensor`** (100%) · `code`: **`002-002-002-015`** (100%) · 3 canais (100%)

> Status: **🟢 mapeado e SANEADO**.
>
> Central de **lojas de shopping 100% energia** — sem água, sem temperatura, sem outlets, sem seletor, sem RFIR.

---

## 📜 Histórico do incidente (2026-07-06 → 07-07)

1. **Import em lote** (`2026-07-06 16:59:39`, provável `provision_central(jsonb)`): criou 218 ambients `SCO*`, 148 slaves 1-canal, 148 channels e 227 vínculos, **e renomeou os 79 medidores manuais** por pareamento posicional (destruindo o mapeamento de campo `3F SMCONTAGEM_*`). Devices `3F SCO*` haviam sido pré-criados no TB (03/07 e 06/07 16:49 UTC).
2. **Revert** (`revert-import-2026-07-06.sql`, 07/07 ~14:20 UTC): deletou tudo que o import criou (pré-check 227/148/148/218, pós-check 79/8/7/78, COMMIT). Backups pré-revert: `/tmp/backup-cadastro-20260707-111232.sql` e tarball `...-2026-07-07-check.tar.gz`.
3. **Restauração de nomes** (`restore-names-from-bkp-2026-07-04.sql` + `restore-names-from-thingsboard.sql`, 07/07): 77/77 nomes de campo recuperados (26 via backup diário de 04/07 + 51 via devices do ThingsBoard, que o sync capturou 16:53–16:56, minutos antes do import). Slaves 106/116 mantêm código SCO (nasceram assim). Dossiê: [`confronto-backup-2026-07-04.md`](confronto-backup-2026-07-04.md).

---

## 🔑 Padrões de nomenclatura

| Padrão | Significado | Exemplo |
|--------|-------------|---------|
| `3F SMCONTAGEM_<luc>` | **Medidor de loja** (SM = Soul Malls; RFC-0128 = Lojas → `3F_MEDIDOR`) | `3F SMCONTAGEM_01006` |
| `<luc>` numérico `1xxx`/`2xxx`/`3xxx` (às vezes `0xxxx`/`02xxx`) | Loja por **piso L1/L2/L3**; zeros à esquerda inconsistentes | `1041`, `01006`, `02024` |
| `Q<num>` / `Q<num><A/B>` | **Quiosque** | `Q0104B`, `Q200B` |
| `M0001` / `ETG402`/`ETG403` | Áreas técnicas (a confirmar: mall / entrada técnica geral) | `3F SMCONTAGEM_ETG402` |
| sufixo ` X<nn> X<nn>A` | **Relação de TC** anotada no nome pela equipe de campo | `3F SMCONTAGEM_Q300 X10 X10A` |
| `3F SCO<luc>` | Código do catálogo SCO (novo padrão do import) — só slaves 106 e 116 | `3F SCO02083` |
| `Quiosque Quadro QPBT-G3` | Medidor **não identificado** (nomeado pelo quadro elétrico) | slave 89 |

---

## 1. Energia — Medidores de Loja · 79 slaves · 3 canais · `002-002-002-015`

| Slave ID | Nome | Grupo | clamp_type | config | Obs |
|----------|------|-------|-----------:|--------|-----|
| 5 | `3F SMCONTAGEM_01006` | L1 | 0 | — | — |
| 6 | `3F SMCONTAGEM_01011` | L1 | 0 | — | — |
| 7 | `3F SMCONTAGEM_01012` | L1 | 0 | — | — |
| 8 | `3F SMCONTAGEM_01015` | L1 | 0 | — | — |
| 9 | `3F SMCONTAGEM_01059` | L1 | 0 | — | — |
| 10 | `3F SMCONTAGEM_01060` | L1 | 0 | — | — |
| 11 | `3F SMCONTAGEM_01064` | L1 | 0 | — | — |
| 12 | `3F SMCONTAGEM_01065` | L1 | 0 | — | — |
| 13 | `3F SMCONTAGEM_01066` | L1 | 0 | — | — |
| 14 | `3F SMCONTAGEM_Q0102` | L1 | 0 | — | — |
| 15 | `3F SMCONTAGEM_02024` | L2 | 0 | — | — |
| 16 | `3F SMCONTAGEM_1013B` | L1 | 0 | — | — |
| 17 | `3F SMCONTAGEM_1019B` | L1 | 0 | — | — |
| 18 | `3F SMCINTAGEM_Q0115` | L1 | 0 | — | ⚠️ typo "SMCINTAGEM" |
| 19 | `3F SMCONTAGEM_Q0204` | L2 | 0 | — | — |
| 20 | `3F SMCONTAGEM_Q200B` | L2 | 0 | `config_clamp` confirmed | — |
| 21 | `3F SMCONTAGEM_Q0103` | L1 | 0 | — | — |
| 22 | `3F SMCONTAGEM_Q0116` | L1 | 0 | — | — |
| 23 | `3F SMCONTAGEM_Q1015` | L1 | 0 | — | — |
| 24 | `3F SMCONTAGEM_Q202B` | L2 | 0 | — | — |
| 25 | `3F SMCONTAGEM_Q0104` | L1 | 0 | — | — |
| 26 | `3F SMCONTAGEM_Q0201` | L2 | 0 | — | — |
| 27 | `3F SMCONTAGEM_Q0104B` | L1 | 0 | — | — |
| 28 | `3F SMCONTAGEM_Q0202` | L2 | 0 | — | — |
| 29 | `3F SMCONTAGEM_Q102A` | L2 | 0 | — | — |
| 30 | `3F SMCONTAGEM_Q114A` | L1 | 0 | — | — |
| 31 | `3F SMCONTAGEM_M0001` | L1 | NULL | `config_clamp` confirmed | — |
| 32 | `3F SMCONTAGEM_2047` | L2 | NULL | `config_clamp` confirmed | — |
| 33 | `3F SMCONTAGEM_2062` | L2 | NULL | `config_clamp` confirmed | — |
| 34 | `3F SMCONTAGEM_1041` | L1 | NULL | `config_clamp` confirmed | — |
| 35 | `3F SMCONTAGEM_Q300 X10 X10A` | L3 | NULL | — | sufixo de TC no nome |
| 36 | `3F SMCONTAGEM_1048 X30 X30A` | L1 | 0 | — | sufixo de TC no nome |
| 37 | `3F SMCONTAGEM_2021 X16 X16A` | L2 | NULL | `config_clamp` confirmed | sufixo de TC no nome |
| 38 | `3F SMCONTAGEM_2018` | L2 | NULL | `config_clamp` confirmed | — |
| 39 | `3F SMCONTAGEM_2020` | L2 | NULL | `config_clamp` confirmed | — |
| 40 | `3F SMCONTAGEM_2017 X30 X30A` | L2 | NULL | — | sufixo de TC no nome |
| 41 | `3F SMCONTAGEM_2022` | L2 | NULL | `config_clamp` confirmed | — |
| 42 | `3F SMCONTAGEM_2019` | L2 | NULL | `config_clamp` confirmed | — |
| 43 | `3F SMCONTAGEM_2015 X40 X40A` | L2 | NULL | `config_clamp` confirmed | sufixo de TC no nome |
| 44 | `3F SMCONTAGEM_2001` | L2 | NULL | `config_clamp` confirmed | — |
| 45 | `3F SMCONTAGEM_2011 X80 X80A` | L2 | NULL | `config_clamp` confirmed | sufixo de TC no nome |
| 46 | `3F SMCONTAGEM_2013 X40 X40A` | L2 | NULL | `config_clamp` confirmed | sufixo de TC no nome |
| 47 | `3F SMCONTAGEM_3002` | L3 | NULL | `config_clamp` confirmed | — |
| 48 | `3F SMCONTAGEM_3004` | L3 | NULL | `config_clamp` confirmed | — |
| 49 | `3F SMCONTAGEM_3005 X15 X15A` | L3 | NULL | `config_clamp` confirmed | sufixo de TC no nome |
| 50 | `3F SMCONTAGEM_3006A` | L3 | 0 | `config_clamp` confirmed | — |
| 51 | `3F SMCONTAGEM_3007` | L3 | 0 | `config_clamp` confirmed | — |
| 52 | `3F SMCONTAGEM_312B` | L3 | NULL | `config_clamp` confirmed | — |
| 53 | `3F SMCONTAGEM_Q312` | L3 | NULL | `config_clamp` confirmed | — |
| 54 | `3F SMCONTAGEM_ETG402` | Piso G4 | NULL | `config_clamp` confirmed | — |
| 55 | `3F SMCONTAGEM_ETG403` | Piso G4 | NULL | `config_clamp` confirmed | — |
| 88 | `3F SMCONTAGEM_Q109` | L1 | NULL | `config_clamp` confirmed | — |
| 89 | `Quiosque Quadro QPBT-G3` | Identificar | NULL | `config_clamp` confirmed | loja não identificada (quadro) |
| 91 | `3F SMCONTAGEM_Q309` | L3 | NULL | `config_clamp` confirmed | — |
| 92 | `3F SMCONTAGEM_Q305` | L3 | NULL | `config_clamp` confirmed | — |
| 93 | `3F SMCONTAGEM_Q308` | L3 | NULL | `config_clamp` confirmed | — |
| 94 | `3F SMCONTAGEM_3009` | L3 | NULL | `config_clamp` confirmed | — |
| 95 | `3F SMCONTAGEM_1002` | L1 | 0 | — | — |
| 96 | `3F SMCONTAGEM_1071` | L1 | 0 | — | — |
| 97 | `3F SMCONTAGEM_1054` | L1 | NULL | `config_clamp` confirmed | — |
| 98 | `3F SMCONTAGEM_1072` | L1 | NULL | `config_clamp` confirmed | — |
| 99 | `3F SMCONTAGEM_1053` | L1 | NULL | `config_clamp` confirmed | — |
| 100 | `3F SMCONTAGEM_1070` | L1 | 0 | — | — |
| 101 | `3F SMCONTAGEM_1047` | L1 | 0 | — | — |
| 102 | `3F SMCONTAGEM_1073` | L1 | 0 | — | — |
| 103 | `3F SMCONTAGEM_1078A` | L1 | 0 | — | — |
| 104 | `3F SMCONTAGEM_1057A` | L1 | 0 | — | — |
| 105 | `3F SMCONTAGEM_1057C` | L1 | 0 | — | — |
| 106 | `3F SCO02083` | **—** | NULL | — | código SCO de nascença · 🚨 SEM GRUPO |
| 107 | `3F SMCONTAGEM_1052` | L1 | NULL | `config_clamp` confirmed | — |
| 108 | `3F SMCONTAGEM_1074` | L1 | NULL | `config_clamp` confirmed | — |
| 109 | `3F SMCONTAGEM_1082` | L1 | NULL | `config_clamp` confirmed | — |
| 110 | `3F SMCONTAGEM_1076` | L1 | NULL | `config_clamp` confirmed | — |
| 111 | `3F SMCONTAGEM_Q203A` | L2 | 0 | — | — |
| 112 | `3F CONTAGEM_Q200A` | L2 | 0 | — | ⚠️ prefixo sem "SM" |
| 113 | `3F SMCONTAGEM_Q211` | L2 | 0 | — | — |
| 114 | `3F SMCONTAGEM_1068` | L1 | 0 | — | — |
| 115 | `3F SMCONTAGEM_1069A` | L1 | 0 | — | — |
| 116 | `3F SCO02094` | L2 | 0 | — | código SCO de nascença |

> Distribuição: **L1** = 40 · **L2** = 23 · **L3** = 12 · **Piso G4** = 2 · **Identificar** = 1 · **SEM GRUPO** = 1.
> IDs não contíguos: 5–55, 88–89, 91–116 (gaps 1–4, 56–87, 90 = itens do import deletados no revert; sequence segue em 230+).

---

## 2. Água — Hidrômetros

> **Nenhum** (só o channel de teste "Hidrometro ", órfão — descartar).

## 3. Temperatura — Termostatos

> **Nenhum**.

## 4. Switch/Reboot (`outlet`) · Seletor Auto/Manual · RFIR

> **Nenhum** (`ambients_rfir_devices_rel` vazia).

---

## Estrutura de `channels` · 8 channels — todos TESTE, descartar no transform

| ID | type | channel | name | config |
|----|------|---------|------|--------|
| 1 | `lamp` | 1 | `Teste 02` | `{"confirm":false}` |
| 2 | `presence_sensor` | 1 | `Teste Presença 02` | — |
| 3 | `presence_sensor` | 0 | `Energia 01 ` | — |
| 4 | `presence_sensor` | 1 | `Energia 02` | — |
| 5 | `presence_sensor` | 0 | `Energia ` | — |
| 6 | `presence_sensor` | 1 | `Hidrometro ` | `{"confirm":false}` |
| 7 | `lamp` | 0 | `01` | — |
| 8 | `lamp` | 1 | `02` | — |

> Sobras de bancada de 2026-06-17, nenhum aponta para slave. Os **79 medidores não têm channel materializado** (leitura direto do slave, como Ilha Plaza/Benfica/Suzano).

---

## Ambients e associação (`ambients_rfir_slaves_rel`)

| Ambient ID | Nome | Slaves | Qtd |
|-----------:|------|--------|----:|
| 5 | `L1 Medidores 3F ` | 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 21, 22, 23, 25, 27, 30, 31, 34, 36, 88, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 107, 108, 109, 110, 114, 115 | 40 |
| 6 | `L2 Medidores 3F ` | 15, 19, 20, 24, 26, 28, 29, 32, 33, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 111, 112, 113, 116 | 23 |
| 7 | ` Serviço Medidores 3F ` | — | 0 |
| 8 | `L3 Medidores 3F` | 35, 47, 48, 49, 50, 51, 52, 53, 91, 92, 93, 94 | 12 |
| 9 | `Piso G4` | 54, 55 | 2 |
| 10 | `Identificar` | 89 | 1 |
| 229 | `Piso G3` | — | 0 |

> **Slave 106 (`3F SCO02083`) está SEM ambient** — provável L1 (vizinhos de cadastro 105 e 107→110 são L1).

---

## ⚠️ Pendências / Inconsistências

1. **Slave 106 sem grupo** — único fora da junction; vincular (provável `L1 Medidores 3F`, ambient 5).
2. **Slaves 106 e 116 com código SCO** (`3F SCO02083`/`3F SCO02094`) — padrão divergente dos demais 77; nasceram assim (ver dossiê). Padronizar quando definirem a convenção final.
3. **Typo no slave 18**: `3F SMCINTAGEM_Q0115` ("CINTAGEM") — typo original de campo, preservado na restauração.
4. **Slave 112 sem "SM"**: `3F CONTAGEM_Q200A` — idem, original de campo.
5. **Slave 89 não identificado**: `Quiosque Quadro QPBT-G3`, no ambient `Identificar` — pendência de campo.
6. **8 slaves com relação de TC no nome** (` X10 X10A`…` X80 X80A`): 35, 36, 37, 40, 43, 45, 46, 49 — mover para `config` quando possível.
7. **Ambient 7 `" Serviço Medidores 3F "`** — espaço à esquerda E à direita no nome, e **vazio**. Ambients 5/6 também têm espaço à direita real.
8. **Ambients vazios**: 7 (Serviço) e 229 (`Piso G3`, criado 07/07 03:14 aguardando vínculos).
9. **Zeros à esquerda inconsistentes** no `<luc>`: `01006`/`02024` vs `1002`/`2047`.
10. **Channels de teste 1–8** órfãos — descartar no transform.
11. **Lado ThingsBoard**: devices `3F SCO*` pré-criados (03 e 06/07) e duplicatas com sufixo hardcoded `"(Ilha Plaza)"`/`"(Contagem)"` continuam lá; o flow do Node-RED desta central usa sufixo **"(Ilha Plaza)"** (copiado) — corrigir antes do próximo sync.

---

## Resumo por categoria

| Categoria | Slaves |
|-----------|--------|
| Energia — Medidores de Loja (3F, 3 canais) | 79 |
| **Total** | **79** |

| Métrica | Valor |
|---------|-------|
| `three_phase_sensor` | 79 (100%) |
| `channels` | 8 (todos teste, órfãos) |
| `ambients` | 7 (5 grupos com slaves + 2 vazios) |
| Junction | 78 (slave 106 órfão) |
| `clamp_type` | 0 = 43 · NULL = 36 (destes, 33 com `config_clamp`) |
| `version` (todos) | `6.0.0` |
