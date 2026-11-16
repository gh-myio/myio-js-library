# Slaves Map — Central Fábrica MYIO (MYIO Pré-Setup)

> Central: **Central Fábrica MYIO (MYIO Pré-Setup)** · Gateway `9065a118-90be-49fc-8998-45f46c205381` · Central ID `69.24.63.252` · Frequência `34`
> IPv6: `200:2235:c16a:707a:e0be:c1d9:29a4:fd65`
> Total slaves: **43** · channels: **81** · ambients: **13** · `ambients_rfir_slaves_rel`: **45** · `ambients_rfir_devices_rel`: **0**
> RFIR: `rfir_devices`: **0** · `rfir_remotes`: **0** · `rfir_commands`: **0** · `rfir_buttons`: **0**
> Capturado em **2026-11-16 14:50 UTC** por `dump-cadastro.py` (somente leitura).
> Dados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · [`ambients_slaves_rel.json`](ambients_slaves_rel.json) · [`ambients_devices_rel.json`](ambients_devices_rel.json)
> Tipos de slave: `outlet` 23 · `three_phase_sensor` 10 · `infrared` 10

## Slaves

| id | addr_low | addr_high | type | name | ch | clamp | ambients | channels (nº · type · name) |
|---:|---:|---:|---|---|---:|---:|---|---|
| 1 | 9 | 249 | three_phase_sensor | 3F 1-1-6-15 | 3 | — | 2 Teste com o claude, 1 Teste Rodrigo | — |
| 2 | 53 | 249 | outlet | `Sw ` ⚠ espaço | 2 | — | 2 Teste com o claude, 1 Teste Rodrigo | 0 · lamp · S1<br>0 · presence_sensor · E1<br>1 · lamp · S2<br>1 · presence_sensor · E2<br>1 · flow_sensor · Hidr. Teste |
| 3 | 10 | 249 | outlet | MQTT Sync - 9065a118-90be-49fc-8998-45f46c205381 | 1 | — | 3 MQTT Sync - 9065a118-90be-49fc-8998-45f46c205381 | 0 · plug · MQTT Sync - 9065a118-90be-49fc-8998-45f46c205381 |
| 4 | 235 | 249 | outlet | sw testador disparador | 2 | — | 1 Teste Rodrigo | 0 · lamp · s1<br>1 · lamp · s2 |
| 5 | 5 | 248 | outlet | HIDR. CITTA_LAB_SALA_01 | 2 | — | 4 CITTA_LAB_SALA_01 | 0 · presence_sensor · Fonte<br>0 · lamp · s1<br>1 · flow_sensor · Vazão<br>1 · presence_sensor · e2<br>1 · lamp · s2 |
| 6 | 6 | 248 | infrared | RM CITTA_LAB_SALA_01 | 1 | — | 4 CITTA_LAB_SALA_01 | 0 · outlet · Canal 1 |
| 7 | 7 | 248 | outlet | SW CITTA_LAB_SALA_01 | 4 | — | 4 CITTA_LAB_SALA_01 | 0 · presence_sensor · Auto. 1<br>0 · lamp · Iluminacao 1<br>1 · presence_sensor · Auto. 2<br>1 · lamp · Iluminacao 2 |
| 8 | 8 | 248 | three_phase_sensor | 3F CITTA_LAB_SALA_02 | 1 | — | 5 CITTA_LAB_SALA_02 | — |
| 9 | 9 | 248 | outlet | HIDR. CITTA_LAB_SALA_02 | 2 | — | 5 CITTA_LAB_SALA_02 | 0 · presence_sensor · Fonte<br>1 · flow_sensor · Vazão |
| 10 | 10 | 248 | infrared | RM CITTA_LAB_SALA_02 | 1 | — | 5 CITTA_LAB_SALA_02 | 0 · outlet · Canal 1 |
| 11 | 11 | 248 | outlet | SW CITTA_LAB_SALA_02 | 4 | — | 5 CITTA_LAB_SALA_02 | 0 · presence_sensor · Auto. 1<br>0 · lamp · Iluminacao 1<br>1 · presence_sensor · Auto. 2<br>1 · lamp · Iluminacao 2 |
| 12 | 12 | 248 | three_phase_sensor | 3F CITTA_LAB_SALA_03 | 1 | — | 6 CITTA_LAB_SALA_03 | — |
| 13 | 13 | 248 | outlet | HIDR. CITTA_LAB_SALA_03 | 2 | — | 6 CITTA_LAB_SALA_03 | 0 · presence_sensor · Fonte<br>1 · flow_sensor · Vazão |
| 14 | 14 | 248 | infrared | RM CITTA_LAB_SALA_03 | 1 | — | 6 CITTA_LAB_SALA_03 | 0 · outlet · Canal 1 |
| 15 | 15 | 248 | outlet | SW CITTA_LAB_SALA_03 | 4 | — | 6 CITTA_LAB_SALA_03 | 0 · presence_sensor · Auto. 1<br>0 · lamp · Iluminacao 1<br>1 · presence_sensor · Auto. 2<br>1 · lamp · Iluminacao 2 |
| 16 | 16 | 248 | three_phase_sensor | 3F CITTA_LAB_SALA_04 | 1 | — | 7 CITTA_LAB_SALA_04 | — |
| 17 | 17 | 248 | outlet | HIDR. CITTA_LAB_SALA_04 | 2 | — | 7 CITTA_LAB_SALA_04 | 0 · presence_sensor · Fonte<br>1 · flow_sensor · Vazão |
| 18 | 18 | 248 | infrared | RM CITTA_LAB_SALA_04 | 1 | — | 7 CITTA_LAB_SALA_04 | 0 · outlet · Canal 1 |
| 19 | 19 | 248 | outlet | SW CITTA_LAB_SALA_04 | 4 | — | 7 CITTA_LAB_SALA_04 | 0 · presence_sensor · Auto. 1<br>0 · lamp · Iluminacao 1<br>1 · presence_sensor · Auto. 2<br>1 · lamp · Iluminacao 2 |
| 20 | 20 | 248 | three_phase_sensor | 3F CITTA_LAB_SALA_05 | 1 | — | 8 CITTA_LAB_SALA_05 | — |
| 21 | 21 | 248 | outlet | HIDR. CITTA_LAB_SALA_05 | 2 | — | 8 CITTA_LAB_SALA_05 | 0 · presence_sensor · Fonte<br>1 · flow_sensor · Vazão |
| 22 | 22 | 248 | infrared | RM CITTA_LAB_SALA_05 | 1 | — | 8 CITTA_LAB_SALA_05 | 0 · outlet · Canal 1 |
| 23 | 23 | 248 | outlet | SW CITTA_LAB_SALA_05 | 4 | — | 8 CITTA_LAB_SALA_05 | 0 · presence_sensor · Auto. 1<br>0 · lamp · Iluminacao 1<br>1 · presence_sensor · Auto. 2<br>1 · lamp · Iluminacao 2 |
| 24 | 24 | 248 | three_phase_sensor | 3F CITTA_LAB_SALA_06 | 1 | — | 9 CITTA_LAB_SALA_06 | — |
| 25 | 25 | 248 | outlet | HIDR. CITTA_LAB_SALA_06 | 2 | — | 9 CITTA_LAB_SALA_06 | 0 · presence_sensor · Fonte<br>1 · flow_sensor · Vazão |
| 26 | 26 | 248 | infrared | RM CITTA_LAB_SALA_06 | 1 | — | 9 CITTA_LAB_SALA_06 | 0 · outlet · Canal 1 |
| 27 | 27 | 248 | outlet | SW CITTA_LAB_SALA_06 | 4 | — | 9 CITTA_LAB_SALA_06 | 0 · presence_sensor · Auto. 1<br>0 · lamp · Iluminacao 1<br>1 · presence_sensor · Auto. 2<br>1 · lamp · Iluminacao 2 |
| 28 | 28 | 248 | three_phase_sensor | 3F CITTA_LAB_SALA_07 | 1 | — | 10 CITTA_LAB_SALA_07 | — |
| 29 | 29 | 248 | outlet | HIDR. CITTA_LAB_SALA_07 | 2 | — | 10 CITTA_LAB_SALA_07 | 0 · presence_sensor · Fonte<br>1 · flow_sensor · Vazão |
| 30 | 30 | 248 | infrared | RM CITTA_LAB_SALA_07 | 1 | — | 10 CITTA_LAB_SALA_07 | 0 · outlet · Canal 1 |
| 31 | 31 | 248 | outlet | SW CITTA_LAB_SALA_07 | 4 | — | 10 CITTA_LAB_SALA_07 | 0 · presence_sensor · Auto. 1<br>0 · lamp · Iluminacao 1<br>1 · presence_sensor · Auto. 2<br>1 · lamp · Iluminacao 2 |
| 32 | 32 | 248 | three_phase_sensor | 3F CITTA_LAB_SALA_08 | 1 | — | 11 CITTA_LAB_SALA_08 | — |
| 33 | 33 | 248 | outlet | HIDR. CITTA_LAB_SALA_08 | 2 | — | 11 CITTA_LAB_SALA_08 | 0 · presence_sensor · Fonte<br>1 · flow_sensor · Vazão |
| 34 | 34 | 248 | infrared | RM CITTA_LAB_SALA_08 | 1 | — | 11 CITTA_LAB_SALA_08 | 0 · outlet · Canal 1 |
| 35 | 35 | 248 | outlet | SW CITTA_LAB_SALA_08 | 4 | — | 11 CITTA_LAB_SALA_08 | 0 · presence_sensor · Auto. 1<br>0 · lamp · Iluminacao 1<br>1 · presence_sensor · Auto. 2<br>1 · lamp · Iluminacao 2 |
| 36 | 36 | 248 | three_phase_sensor | 3F CITTA_LAB_SALA_09 | 1 | — | 12 CITTA_LAB_SALA_09 | — |
| 37 | 37 | 248 | outlet | HIDR. CITTA_LAB_SALA_09 | 2 | — | 12 CITTA_LAB_SALA_09 | 0 · presence_sensor · Fonte<br>1 · flow_sensor · Vazão |
| 38 | 38 | 248 | infrared | RM CITTA_LAB_SALA_09 | 1 | — | 12 CITTA_LAB_SALA_09 | 0 · outlet · Canal 1 |
| 39 | 39 | 248 | outlet | SW CITTA_LAB_SALA_09 | 4 | — | 12 CITTA_LAB_SALA_09 | 0 · presence_sensor · Auto. 1<br>0 · lamp · Iluminacao 1<br>1 · presence_sensor · Auto. 2<br>1 · lamp · Iluminacao 2 |
| 40 | 40 | 248 | three_phase_sensor | 3F CITTA_LAB_SALA_10 | 1 | — | 13 CITTA_LAB_SALA_10 | — |
| 41 | 41 | 248 | outlet | HIDR. CITTA_LAB_SALA_10 | 2 | — | 13 CITTA_LAB_SALA_10 | 0 · presence_sensor · Fonte<br>1 · flow_sensor · Vazão |
| 42 | 42 | 248 | infrared | RM CITTA_LAB_SALA_10 | 1 | — | 13 CITTA_LAB_SALA_10 | 0 · outlet · Canal 1 |
| 43 | 43 | 248 | outlet | SW CITTA_LAB_SALA_10 | 4 | — | 13 CITTA_LAB_SALA_10 | 0 · presence_sensor · Auto. 1<br>0 · lamp · Iluminacao 1<br>1 · presence_sensor · Auto. 2<br>1 · lamp · Iluminacao 2 |

## Ambients

| id | name | slaves |
|---:|---|---|
| 1 | Teste Rodrigo | 1, 2, 4 |
| 2 | Teste com o claude | 1, 2 |
| 3 | MQTT Sync - 9065a118-90be-49fc-8998-45f46c205381 | 3 |
| 4 | CITTA_LAB_SALA_01 | 5, 6, 7 |
| 5 | CITTA_LAB_SALA_02 | 8, 9, 10, 11 |
| 6 | CITTA_LAB_SALA_03 | 12, 13, 14, 15 |
| 7 | CITTA_LAB_SALA_04 | 16, 17, 18, 19 |
| 8 | CITTA_LAB_SALA_05 | 20, 21, 22, 23 |
| 9 | CITTA_LAB_SALA_06 | 24, 25, 26, 27 |
| 10 | CITTA_LAB_SALA_07 | 28, 29, 30, 31 |
| 11 | CITTA_LAB_SALA_08 | 32, 33, 34, 35 |
| 12 | CITTA_LAB_SALA_09 | 36, 37, 38, 39 |
| 13 | CITTA_LAB_SALA_10 | 40, 41, 42, 43 |
