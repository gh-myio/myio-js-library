# Slaves Map — Souza Aguiar — Ar Comprimido (Souza Aguiar)

> Central: **Souza Aguiar — Ar Comprimido (Souza Aguiar)** · Gateway `—` · Central ID `—` · Frequência `—`
> IPv6: `200:4dbc:14be:a704:6904:81cd:b62a:ab22`
> Total slaves: **14** · channels: **14** · ambients: **9** · `ambients_rfir_slaves_rel`: **15** · `ambients_rfir_devices_rel`: **0**
> RFIR: `rfir_devices`: **0** · `rfir_remotes`: **0** · `rfir_commands`: **0** · `rfir_buttons`: **0**
> Capturado em **2026-11-16 14:42 UTC** por `dump-cadastro.py` (somente leitura).
> Dados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · [`ambients_slaves_rel.json`](ambients_slaves_rel.json) · [`ambients_devices_rel.json`](ambients_devices_rel.json)
> Tipos de slave: `outlet` 13 · `infrared` 1

## Slaves

| id | addr_low | addr_high | type | name | ch | clamp | ambients | channels (nº · type · name) |
|---:|---:|---:|---|---|---:|---:|---|---|
| 1 | 15 | 249 | outlet | GAS Ar_comprimido_SH_Matern 132 700 x1.97 | 2 | — | 1 Ar comprimido/ Vácuo / O2 | 0 · lamp · check Ar compr. |
| 2 | 219 | 248 | outlet | `Sw QTA 1 Maternidade ` ⚠ espaço | 2 | — | 2 `Subestação maternidade ` ⚠ espaço | 0 · presence_sensor · Gerador QTA 1 Matern.<br>1 · presence_sensor · Rede QTA 1 Matern. |
| 3 | 139 | 248 | outlet | Sw QTA 2 Matern. | 2 | — | 2 `Subestação maternidade ` ⚠ espaço | 0 · presence_sensor · Gerador QTA 2 Matern.<br>1 · presence_sensor · Rede QTA 2 Matern. |
| 4 | 233 | 248 | outlet | GAS Oxigênio_SH 132 700 x1.97 | 2 | — | 3 Oxigênio Souza | 0 · lamp · `Check ` ⚠ espaço |
| 5 | 178 | 249 | outlet | GAS Nitroso_SH 132 700 x1.97 | 2 | — | 4 Nitroso Souza | 0 · lamp · Check |
| 6 | 46 | 249 | outlet | GAS Ar_comprimido_CER 132 700 x1.97 | 2 | — | 6 UPA (CER) | 0 · lamp · Check |
| 7 | 232 | 249 | outlet | GAS Vacuo_CER 132 200 x0.378 | 2 | — | 6 UPA (CER), 7 `Vácuo Souza Aguiar ` ⚠ espaço | 0 · lamp · Check |
| 8 | 153 | 249 | outlet | GAS Vacuo_SouzaAguiar 132 200 x0.378 | 2 | — | 7 `Vácuo Souza Aguiar ` ⚠ espaço | 0 · lamp · Check Vácuo Sh |
| 9 | 7 | 248 | outlet | GAS Oxigênio_CER 132 700 x1.97 | 2 | — | 8 Oxigênio Cer | 0 · lamp · Check Oxigênio Cer |
| 10 | 207 | 248 | infrared | OLD-T.e.m.p. Co2_Medicacao_CER -6 | 1 | — | 9 Co2_Medicacao_Cer | — |
| 11 | 121 | 248 | outlet | Temp. Co2_Medicacao_CER | 2 | — | 9 Co2_Medicacao_Cer | 0 · lamp · Check |
| 12 | 137 | 248 | outlet | Hdr. Cisterna2_Maternidade x1 | 2 | — | 10 `Cisterna Maternidade ` ⚠ espaço | 0 · presence_sensor · `Energia ` ⚠ espaço<br>1 · flow_sensor · Hdr. Cisterna2_Maternidade x1 |
| 13 | 120 | 248 | outlet | SCD MaternidadeCisterna2 1064 244 x0.2705 | 2 | — | 10 `Cisterna Maternidade ` ⚠ espaço | — |
| 14 | 175 | 248 | outlet | SCD MaternidadeCisterna1 1350 244 x0.2705 | 2 | — | 10 `Cisterna Maternidade ` ⚠ espaço | — |

## Ambients

| id | name | slaves |
|---:|---|---|
| 1 | Ar comprimido/ Vácuo / O2 | 1 |
| 2 | `Subestação maternidade ` ⚠ espaço | 2, 3 |
| 3 | Oxigênio Souza | 4 |
| 4 | Nitroso Souza | 5 |
| 6 | UPA (CER) | 6, 7 |
| 7 | `Vácuo Souza Aguiar ` ⚠ espaço | 7, 8 |
| 8 | Oxigênio Cer | 9 |
| 9 | Co2_Medicacao_Cer | 10, 11 |
| 10 | `Cisterna Maternidade ` ⚠ espaço | 12, 13, 14 |
