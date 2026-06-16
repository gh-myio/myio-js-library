# Slaves Map — Guadalupe (OBRAMAX)

> Central: **OBRAMAX — Guadalupe** (`96a7ca86-c291-4d77-aa66-4706641eaa5a`)
> IPv6: `202:f573:1e70:22f1:1dae:95bd:eeb9:1157`
> Total slaves: 52 · Total channels: 113
> Captura do banco `hubot`: 2026-06-02

> Loja OBRAMAX (varejo de materiais de construção). Todos os slaves são `type = outlet`,
> `version 6.0.0`, `code 002-002-002-012`. A categorização abaixo é derivada do **nome** do
> slave e dos **canais** (`channels.slave_id`).

---

## 1. Climatização — Splits (controle de iluminação / automação)

5 slaves controlam os circuitos de iluminação dos splits (pares) + automação por presença
(`Splitão NN`, `Auto. Splitao NN`). `Sw Splitao Geral` é o disjuntor geral.

| Slave ID | Nome              | addr (low/high) | Canais                                   |
|----------|-------------------|-----------------|------------------------------------------|
| 14       | Splitão 01/02     | 228 / 249       | Splitão 01, Splitão 02 + Auto Splitao 1/2 |
| 15       | Splitão 03/04     | 81 / 248        | Splitão 03, Splitão 04 + Auto Splitao 3/4 |
| 16       | Splitão 05/06     | 31 / 249        | Splitão 05, Splitão 06 + Auto Splitao 5/6 |
| 17       | Splitão 07/08     | 94 / 248        | Splitão 07, Splitão 08 + Auto Splitao 7/8 |
| 18       | Splitão 09/10     | 84 / 248        | Splitão 09, Splitão 10 + Auto Splitao 9/10 |
| 9        | Sw Splitao Geral  | 53 / 248        | Splitao Geral (plug, ch0 REPLICATED)     |

---

## 2. Climatização — Compressores (monitoração SPT COMP1/COMP2)

10 slaves monitoram os compressores de cada split (`SPTn: COMP1`/`COMP2` + sensores de
presença `Split N Comp X ON/OFF`).

| Slave ID | Nome               | addr (low/high) | Canais                       |
|----------|--------------------|-----------------|------------------------------|
| 71       | SPT1: COMP1/COMP2  | 158 / 249       | SPT1: COMP1, SPT1: COMP2     |
| 72       | SPT2: COMP1/COMP2  | 72 / 248        | SPT2: COMP1, SPT2: COMP2     |
| 69       | SPT3: COMP1/COMP2  | 194 / 248       | SPT3: COMP1, SPT3: COMP2     |
| 70       | SPT4: COMP1/COMP2  | 165 / 249       | SPT4: COMP1, SPT4: COMP2     |
| 68       | SPT5: COMP1/COMP2  | 241 / 248       | SPT5: COMP1, SPT5: COMP2     |
| 67       | SPT6: COMP1/COMP2  | 121 / 248       | SPT6: COMP1, SPT6: COMP2     |
| 65       | SPT7: COMP1/COMP2  | 43 / 249        | SPT7: COMP1, SPT7: COMP2     |
| 66       | SPT8: COMP1/COMP2  | 124 / 248       | SPT8: COMP1, SPT8: COMP2     |
| 64       | SPT9: COMP1/COMP2  | 87 / 249        | SPT9: COMP1, SPT9: COMP2 + ON/OFF |
| 63       | SPT10: COMP1/COMP2 | 55 / 249        | SPT10: COMP1, SPT10: COMP2 + ON/OFF |

---

## 3. Temperatura

| Slave ID | Nome                    | addr (low/high) | Ambiente      |
|----------|-------------------------|-----------------|---------------|
| 54       | Temp.Frente Loja        | 225 / 248       | Frente Loja   |
| 53       | Temp.Meio Loja          | 29 / 248        | Meio Loja     |
| 52       | Temp. Fundo Loja        | 186 / 249       | Fundo Loja    |
| 83       | Temperatura Corredor 04 | 215 / 249       | Corredor 04   |
| 82       | Temp. Corredor 10       | 154 / 248       | Corredor 10   |
| 85       | Temperatura Corredor 14 | 243 / 249       | Corredor 14   |
| 84       | Temperatura Corredor 18 | 103 / 248       | Corredor 18   |

> ⚠️ **Prefixo inconsistente.** Os sensores de temperatura usam três grafias diferentes:
> `Temp.Meio Loja` (sem espaço), `Temp. Fundo Loja` (com espaço) e `Temperatura Corredor 04`
> (palavra completa). O prefixo canônico do tipo `TERMOSTATO` é **`TEMP.`** (ver
> `src/utils/device.ts` `DEVICE_TYPE_PREFIX_MAP`). O regex do transform Node-RED
> (`^(Temp\.\s*)…`) **só casa** as variantes com `Temp.` — `Temperatura Corredor NN`
> não é reconhecida como prefixada. Padronizar os nomes para `TEMP. <ambiente>` ao
> normalizar a central.

---

## 4. Iluminação / Tomadas (loja, quadros, áreas externas)

| Slave ID | Nome                         | addr (low/high) | Área / Canais                              |
|----------|------------------------------|-----------------|--------------------------------------------|
| 1        | LOJA CORR. FRENTE. MEIO.FUNDO | 74 / 249       | Frente/Corredor + Meio/Fundo Loja (+Auto)  |
| 2        | QT Loja Corredor Manutenção  | 200 / 248       | Corredor Manutenção (+Auto)               |
| 3        | Manut. Luz Externa Manut.    | 13 / 249        | Luz Externa Manut. (+Auto)                 |
| 4        | QT Depósito Luz Externa      | 104 / 249       | Luz Externa Depósito (+Auto)              |
| 5        | QT.Depósito                  | 193 / 249       | Luz Depósito Alta / Recebimento (+Auto)   |
| 6        | QT ADM. Estacionamento Coberto | 220 / 248     | Ilum. Estac. Coberto (+Auto)               |
| 7        | QT ADM.L                     | 63 / 249        | Estac. Descoberto, Totem Publicidade (+Auto) |
| 8        | DRIVE Drive                  | 71 / 248        | Luz Retira Externa, Drive Thru (+Auto)     |
| 81       | Corredor 34 (3mt)            | 198 / 249       | —                                          |
| 58       | Lj1                          | 142 / 249       | Geral (SPU/VMF/ADM), Selet. Geral Exaust   |
| 59       | Lj2                          | 176 / 248       | Status ADM Armários, Ligar/Desligar ADM   |
| 60       | Lj3                          | 124 / 249       | Status Exaust. Cozinha, Ligar/Desligar     |
| 61       | Lj4                          | 24 / 249        | Status Laje Técnica, Ligar/Desligar Exaust LT |

> `QT` = quadro/tomada de circuito. `Lj1–Lj4` agrupam cargas de exaustão/ADM (ver canais).

---

## 5. Repetidores (sinal)

| Slave ID | Nome                  | addr (low/high) | Obs                  |
|----------|-----------------------|-----------------|----------------------|
| 11       | Repetidor Frente Loja | 86 / 249        | sem `config` / canais |
| 12       | Repetidor Meio Loja   | 82 / 249        | —                    |
| 13       | Repetidor Fundo Loja  | 84 / 249        | ch: Check 2          |

---

## 6. Água — Hidrômetros / Caixas / Reuso

| Slave ID | Nome                       | addr (low/high) | Tipo / Canais                            |
|----------|----------------------------|-----------------|------------------------------------------|
| 77       | Hidr. Potável Entrada      | 63 / 248        | flow_sensor `Hidr. Potável Entrada x1` (ch1 PULSE_ON_POWER) |
| 80       | Hidr.Saída Potável         | 71 / 249        | flow_sensor `Hidr. Saída Potável x1`    |
| 79       | Hid.Saída Reuso            | 217 / 248       | flow_sensor `Hidr. Saída Reuso x1`      |
| 57       | SCD Potável 129 160 x0.95  | 60 / 248        | Caixa d'água — `Nivel Potável` (×0.95)  |
| 62       | SCD Reuso 129 160 x0.95    | 236 / 249       | Caixa d'água — `Nivel Reuso` (×0.95)     |
| 78       | Solenoide Reuso            | 248 / 248       | `Válvula Morotizada` (lamp)              |
| 86       | Eletroboia Reuso           | 180 / 248       | `Sinal Eletroboia`, Check               |

> Convenção de prefixos no nome (= `DEVICE_TYPE_PREFIX_MAP`): `Hidr.` → HIDROMETRO,
> `SCD` → CAIXA_D_AGUA. Formato `SCD <tag> <addr_modbus> <range> <fator>` (addr=129).

---

## 7. Geradores

| Slave ID | Nome      | addr (low/high) | Canais            |
|----------|-----------|-----------------|-------------------|
| 55       | Gerador 1 | 22 / 249        | Porta F, Porta E  |
| 56       | Gerador 2 | 11 / 248        | Porta G           |

---

## 8. Bombas de Incêndio

| Slave ID | Nome                    | addr (low/high) | Canais                                            |
|----------|-------------------------|-----------------|---------------------------------------------------|
| 73       | Bomba Elétrica Disp 1   | 47 / 248        | Alarme De Incêndio                                |
| 75       | Bomba Elétrica Disp 2   | 16 / 248        | Falha Do Motor Elétrico, Bomba Elétrica Ligada    |
| 76       | Bomba Diesel            | 182 / 248       | Bomba Diesel Ligada, Falha Geral Diesel           |

---

## 9. Sistema / Outros

| Slave ID | Nome           | addr (low/high) | Canais                                 |
|----------|----------------|-----------------|----------------------------------------|
| 88       | CD - Guadalupe | 208 / 249       | IL-1, IL-2 + Auto IL-1/IL-2 (channel_id 88) |

> Há canais `IL-1`/`IL-2`/`Auto IL-*` com `slave_id` **NULL** (ids 102–105) — provavelmente
> órfãos de uma configuração anterior; os equivalentes vinculados ao slave 88 são os ids 106–109.

---

## Resumo por categoria

| Categoria                         | Qtd    |
|-----------------------------------|--------|
| Climatização — Splits (ilum.)     | 6      |
| Climatização — Compressores SPT   | 10     |
| Temperatura                       | 7      |
| Iluminação / Tomadas              | 13     |
| Repetidores                       | 3      |
| Água (hidrômetro/caixa/reuso)     | 7      |
| Geradores                         | 2      |
| Bombas de Incêndio                | 3      |
| Sistema / Outros                  | 1      |
| **Total**                         | **52** |
