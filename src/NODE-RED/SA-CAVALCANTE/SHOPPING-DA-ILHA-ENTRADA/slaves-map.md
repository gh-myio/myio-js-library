# Slaves Map — Central Shopping da Ilha - ENTRADA - 2026-10-06 (Sá Cavalcante)

> Central: **Central Shopping da Ilha - ENTRADA - 2026-10-06 (Sá Cavalcante)** · Gateway `e89e15f2-4dac-4fdb-b62f-a7e49a7a8127` · Central ID `54.17.161.225` · Frequência `83`
> IPv6: `200:f095:bb4:4e43:62ca:fbae:b36e:a2aa`
> Total slaves: **5** · channels: **3** · ambients: **5** · `ambients_rfir_slaves_rel`: **5** · `ambients_rfir_devices_rel`: **0**
> RFIR: `rfir_devices`: **0** · `rfir_remotes`: **0** · `rfir_commands`: **0** · `rfir_buttons`: **0**
> Capturado em **2026-11-16 14:40 UTC** por `dump-cadastro.py` (somente leitura).
> Dados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · [`ambients_slaves_rel.json`](ambients_slaves_rel.json) · [`ambients_devices_rel.json`](ambients_devices_rel.json)
> Tipos de slave: `three_phase_sensor` 3 · `outlet` 2

## Slaves

| id | addr_low | addr_high | type | name | ch | clamp | ambients | channels (nº · type · name) |
|---:|---:|---:|---|---|---:|---:|---|---|
| 1 | 167 | 248 | outlet | `SW Teste ` ⚠ espaço | 2 | — | 1 `SW Teste ` ⚠ espaço | 0 · presence_sensor · `Energia ` ⚠ espaço<br>1 · presence_sensor · Hidrometro |
| 2 | 121 | 248 | three_phase_sensor | 3F Teste | 3 | — | 2 3F Teste | — |
| 3 | 56 | 248 | three_phase_sensor | 3F SCSDIAC-TrafoEntrada x1877.2 x50A x36.31v | 3 | — | 3 3F SCSDIAC-TrafoEntrada x1877.2 x50A x36.31v | — |
| 4 | 69 | 248 | three_phase_sensor | 3F SCSDIAC-TrafoCAG x1518 x40A X36.31v | 3 | — | 4 3F SCSDIAC-TrafoCAG x1518 x40A X36.31v | — |
| 5 | 57 | 249 | outlet | MQTT Sync - e89e15f2-4dac-4fdb-b62f-a7e49a7a8127 | 1 | — | 5 MQTT Sync - e89e15f2-4dac-4fdb-b62f-a7e49a7a8127 | 0 · plug · MQTT Sync - e89e15f2-4dac-4fdb-b62f-a7e49a7a8127 |

## Ambients

| id | name | slaves |
|---:|---|---|
| 1 | `SW Teste ` ⚠ espaço | 1 |
| 2 | 3F Teste | 2 |
| 3 | 3F SCSDIAC-TrafoEntrada x1877.2 x50A x36.31v | 3 |
| 4 | 3F SCSDIAC-TrafoCAG x1518 x40A X36.31v | 4 |
| 5 | MQTT Sync - e89e15f2-4dac-4fdb-b62f-a7e49a7a8127 | 5 |
