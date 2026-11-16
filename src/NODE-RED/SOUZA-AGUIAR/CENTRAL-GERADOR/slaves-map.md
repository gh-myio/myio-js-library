# Slaves Map — Souza Aguiar — Gerador (Souza Aguiar)

> Central: **Souza Aguiar — Gerador (Souza Aguiar)** · Gateway `bb8193d9-a132-44b5-8605-e50c0521ceb9` · Central ID `—` · Frequência `—`
> IPv6: `200:dd4c:53b0:28d5:33dc:fbef:2c98:b23`
> Total slaves: **4** · channels: **10** · ambients: **7** · `ambients_rfir_slaves_rel`: **12** · `ambients_rfir_devices_rel`: **0**
> RFIR: `rfir_devices`: **0** · `rfir_remotes`: **0** · `rfir_commands`: **0** · `rfir_buttons`: **0**
> Capturado em **2026-11-16 14:42 UTC** por `dump-cadastro.py` (somente leitura).
> Dados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · [`ambients_slaves_rel.json`](ambients_slaves_rel.json) · [`ambients_devices_rel.json`](ambients_devices_rel.json)
> Tipos de slave: `outlet` 4

## Slaves

| id | addr_low | addr_high | type | name | ch | clamp | ambients | channels (nº · type · name) |
|---:|---:|---:|---|---|---:|---:|---|---|
| 3 | 140 | 249 | outlet | QTA 1 | 2 | — | 2 QTA 1, 6 QTAs, 7 Todos | 0 · presence_sensor · Gerador 1<br>1 · presence_sensor · Rede 1 |
| 4 | 105 | 248 | outlet | QTA 2 | 2 | — | 3 QTA 2, 6 QTAs, 7 Todos | 0 · presence_sensor · Gerador 2<br>1 · presence_sensor · Rede 2 |
| 5 | 96 | 248 | outlet | QTA 3 | 2 | — | 4 QTA 3, 6 QTAs, 7 Todos | 0 · presence_sensor · Gerador 3<br>1 · presence_sensor · Rede 3 |
| 6 | 129 | 248 | outlet | QTA 4 | 2 | — | 5 QTA 4, 6 QTAs, 7 Todos | 0 · presence_sensor · Gerador 4<br>1 · presence_sensor · Rede 4 |

## Ambients

| id | name | slaves |
|---:|---|---|
| 1 | ignorar | ⚠ vazio |
| 2 | QTA 1 | 3 |
| 3 | QTA 2 | 4 |
| 4 | QTA 3 | 5 |
| 5 | QTA 4 | 6 |
| 6 | QTAs | 3, 4, 5, 6 |
| 7 | Todos | 3, 4, 5, 6 |

## Channels sem slave_id

| id | channel | type | name |
|---:|---:|---|---|
| 2 | 1 | presence_sensor | Rede |
| 3 | 0 | presence_sensor | Gerador |
