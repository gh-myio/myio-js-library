# Slaves Map — Campinas Shopping — Subestação Principal (Argo Plan)

> Central: **Campinas Shopping — Subestação Principal (Argo Plan)** · Gateway `c248c77f-da23-4247-a06b-cf371a82f4d9` · Central ID `—` · Frequência `—`
> IPv6: `202:7cde:b52f:7210:12a5:91d6:1fe5:4d6e`
> Total slaves: **9** · channels: **4** · ambients: **9** · `ambients_rfir_slaves_rel`: **25** · `ambients_rfir_devices_rel`: **0**
> RFIR: `rfir_devices`: **0** · `rfir_remotes`: **0** · `rfir_commands`: **0** · `rfir_buttons`: **0**
> Capturado em **2026-11-16 15:01 UTC** por `dump-cadastro.py` (somente leitura).
> Dados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · [`ambients_slaves_rel.json`](ambients_slaves_rel.json) · [`ambients_devices_rel.json`](ambients_devices_rel.json)
> Tipos de slave: `three_phase_sensor` 8 · `outlet` 1

## Slaves

| id | addr_low | addr_high | type | name | ch | clamp | ambients | channels (nº · type · name) |
|---:|---:|---:|---|---|---:|---:|---|---|
| 22 | 25 | 248 | three_phase_sensor | 3F Bombas Secundária  x80 x80A | 3 | 0 | 12 Todos, 15 Todos, 8 Chiller | — |
| 23 | 14 | 249 | three_phase_sensor | 3F SCP0LXXX Outback | 3 | 2 | 12 Todos, 15 Todos, 7 `Outback ` ⚠ espaço | — |
| 24 | 142 | 249 | three_phase_sensor | 3F Chiller x700 x700A | 3 | 0 | 12 Todos, 15 Todos, 8 Chiller | — |
| 25 | 113 | 249 | three_phase_sensor | 3F ADM 1 x120 x120A | 3 | 0 | 12 Todos, 15 Todos, 9 `ADM ` ⚠ espaço | — |
| 26 | 53 | 249 | three_phase_sensor | 3F ADM 2 x120 x120A | 3 | 0 | 12 Todos, 15 Todos, 9 `ADM ` ⚠ espaço | — |
| 27 | 175 | 249 | three_phase_sensor | 3F Trafo Outback | 3 | — | 12 Todos, 15 Todos, 7 `Outback ` ⚠ espaço | — |
| 28 | 250 | 248 | three_phase_sensor | Entrada_Subestação_01 x2072.8 x40A x51.82V | 3 | 0 | 12 Todos, 15 Todos, 10 `Trafo ` ⚠ espaço | — |
| 36 | 194 | 249 | outlet | Hidr. Torre Resfriamento | 2 | — | 13 `Torre Resfriamento ` ⚠ espaço, 15 Todos | 0 · presence_sensor · `Energia ` ⚠ espaço<br>1 · flow_sensor · Hidr. Torre Resfriamento x100 |
| 37 | 67 | 249 | three_phase_sensor | 3F Coco Bambu | 3 | 2 | 14 Coco Bambu, 15 Todos | — |

## Ambients

| id | name | slaves |
|---:|---|---|
| 7 | `Outback ` ⚠ espaço | 23, 27 |
| 8 | Chiller | 22, 24 |
| 9 | `ADM ` ⚠ espaço | 25, 26 |
| 10 | `Trafo ` ⚠ espaço | 28 |
| 11 | Bk | ⚠ vazio |
| 12 | Todos | 22, 23, 24, 25, 26, 27, 28 |
| 13 | `Torre Resfriamento ` ⚠ espaço | 36 |
| 14 | Coco Bambu | 37 |
| 15 | Todos | 22, 23, 24, 25, 26, 27, 28, 36, 37 |

## Channels sem slave_id

| id | channel | type | name |
|---:|---:|---|---|
| 1 | 0 | presence_sensor | `Energia ` ⚠ espaço |
| 2 | 1 | presence_sensor | `Hidr Bk Quiosque ` ⚠ espaço |
