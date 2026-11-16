# Slaves Map — Benfica (OBRAMAX)

> Central: **OBRAMAX — Benfica** (`1248905a-ed03-414d-bde6-c4410604ae8f`)
> IPv6: `200:47f1:8bf6:36da:65fa:4124:bcdb:dbb4`
> Total slaves: **51** · Total channels: **131** · Total ambients: **16**
> Captura do banco `hubot` (`logMaps.log`, capturado em **2026-06-17**).
> Dados estruturados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json).
> Não-conformidades e visão por tabela: [`DB-SNAPSHOT.md`](DB-SNAPSHOT.md).
>
> Este documento dá a visão **funcional** (por canais reais); o `DB-SNAPSHOT.md` dá a
> visão **de banco** (tipos, padrões, não-conformidades) — são complementares.

> Loja OBRAMAX. Slaves majoritariamente `type = outlet` (`version 6.0.0`,
> `code 002-002-002-012`), **exceto** 2 medidores trifásicos (`three_phase_sensor`,
> `code …-015`). A categorização abaixo é por **função real (canais)**, não pelo nome —
> nesta central vários nomes estão trocados (ver ⚠️ no fim).

---

## 1. Climatização — Splits (controle / automação)

5 slaves "SW Splitao" controlam os pares de splits (plug `Splitao N` + automação `Auto. Splitao N`).

| Slave ID | Nome              | addr (low/high) | Canais                                       |
|----------|-------------------|-----------------|----------------------------------------------|
| 1        | SW Splitao 1/2    | 168 / 248       | Splitao 1, Splitao 2 + Auto. Splitao 1/2     |
| 2        | SW Splitao 3/4    | 34 / 248        | Splitao 3, Splitao 4. + Auto. Splitao 3/4    |
| 5        | SW Splitao 5./6.  | 231 / 248       | Splitao 5., Splitao 6. + Auto. Splitao 5./6. |
| 3        | SW Splitao 7./8.  | 164 / 249       | Splitao 7, Splitao 8 + Auto. Splitao 7/8     |
| 4        | Sw Splitao 9./10. | 3 / 248         | Splitao 9., Splitao 10. + Auto. Splitao 9./10. |

---

## 2. Climatização — Compressores (monitor Spt N: Comp1/Comp2)

10 slaves monitoram os compressores de cada split (lamps `Spt N: Comp 1/2` + sensores
`Split N Comp X ON/OFF`). ⚠️ **Vários estão nomeados como "Temp."/"Termostato"** — o
nome não bate com a função; os canais confirmam que são compressores.

| Slave ID | Nome                 | addr (low/high) | Split | Canais                       |
|----------|----------------------|-----------------|-------|------------------------------|
| 35       | Spt 1: Comp 1/ Comp 2 | 194 / 248      | 1     | Spt 1: Comp 1/2 + Split 1 ON/OFF |
| 10       | **Temp. 1/2**        | 188 / 248       | 2     | Spt 2: Comp 1/2 + Split 2 ON/OFF |
| 34       | Spt 3: Comp 1/ Comp 2 | 97 / 248       | 3     | Spt 3: Comp 1/2 + Split 3 ON/OFF |
| 22       | **Temp. 3/4**        | 33 / 248        | 4     | Spt 4: Comp 1/2 + Split 4 ON/OFF |
| 33       | Spt 5: Comp1/ Comp2  | 156 / 248       | 5     | Spt 5: Comp 1/2              |
| 17       | **Termostato 5./6.** | 180 / 248       | 6     | Spt 6: Comp 1/2 + Split 6 ON/OFF |
| 58       | **Temp. 7/8**        | 121 / 248       | 7     | Split 7 Comp 1/2 + Split 7 ON/OFF |
| 32       | Spt 8: Comp1/Comp2   | 74 / 248        | 8     | Spt 8: Comp1/2 + Split 8 ON/OFF |
| 11       | **Temp. Spt 9/10**   | 177 / 249       | 9     | Spt 9: Comp 1/2 + Split 9 ON/OFF |
| 31       | SPT10: Comp1/Comp2   | 81 / 248        | 10    | Spt 10: Comp1/2 + Split 10 ON/OFF |

> Canais órfãos (`slave_id` NULL, a vincular/limpar): `Spt 7: Comp1` (119), `Spt 7: Comp 2` (120), `Teste` (121).

---

## 3. Iluminação / Tomadas (lojas + estacionamento)

| Slave ID | Nome                            | addr (low/high) | Canais                                        |
|----------|---------------------------------|-----------------|-----------------------------------------------|
| 20       | Qt Loja( C/D)                   | 143 / 248       | Loja 100% (C), Loja 50% (D) + Auto Barr C/D   |
| 21       | Qt Loja (E/F)                   | 166 / 248       | Loja 100% (E), Loja 50% (F) + Auto Barr E/F   |
| 19       | Qt. Loja (G)                    | 19 / 249        | Loja 50% (G) + Auto Barr G (50%)              |
| 15       | QT-depósito H                   | 165 / 249       | 100% Drive/Dep (G), 50% Drive/Dep (H) + Auto Barr G/H |
| 23       | QT DEPÓSITO                     | 4 / 249         | CIRC 4. L27/L28 (50%) Dep + Auto L27/L28      |
| 8        | Estacionamento Barra. H/ L24-L25 | 137 / 249      | Estac. Coberto (H), Estac. Coberto (L24 L25) + Auto |
| 7        | Sw Estacionamento T26/ Barr G.  | 24 / 248        | Estac. Coberto (G), Estac. Coberto (T26) + Auto |

---

## 4. Exaustão / Ventilação

⚠️ Slaves **45/47/48 nomeados "Lj 1/3/4"** são, na verdade, exaustão/ventilação (canais).

| Slave ID | Nome                          | addr (low/high) | Canais                                          |
|----------|-------------------------------|-----------------|-------------------------------------------------|
| 6        | Exasut San Arm/ SPU Lale tec  | 248 / 248       | Exaustores (San Arm), Exaustores (Spu2/laje tc) + Auto |
| 45       | **Lj 1**                      | 8 / 249         | Liga/Desliga Exaust. Cozinha, Exaust. Cozinha   |
| 47       | **Lj3**                       | 101 / 249       | Ventilador Cozinha + Auto Seletora Vent Cozinha |
| 48       | **Lj4**                       | 126 / 249       | Ventilação ADM 1/2 + Auto Seletora Vent ADM 1/2 |

---

## 5. Repetidores / Testadores (mesh)

| Slave ID | Nome                             | addr (low/high) | Canais                  |
|----------|----------------------------------|-----------------|-------------------------|
| 12       | Repetidor 01(Porta Emergencia)   | 48 / 248        | Teste Mesh 01-0/01-1    |
| 14       | Repetidor 02( Estrutura Corredor) | 193 / 249      | Teste Mesh 02-0/02-1    |
| 27       | Repetidor 3 Frente               | 142 / 248       | Frente 1, Frente 2      |
| 28       | Testador Fundo Loja              | 238 / 248       | Fundo 1, Fundo 2        |
| 29       | Testador Meio                    | 169 / 248       | Meio 1, Meio 2          |

---

## 6. Água — Hidrômetros / Caixas / Reuso

| Slave ID | Nome                       | addr (low/high) | Tipo / Canais                              |
|----------|----------------------------|-----------------|--------------------------------------------|
| 24       | Hidrmetro Potável          | 202 / 248       | flow `Hidrômetro Potável` + Energia Potável |
| 25       | Sw Hidrômetro Reuso        | 86 / 248        | flow `Hidrômetro Reuso` + Energia Reuso    |
| 53       | Hidrometro Potável( Verde) | 211 / 248       | flow `Hidr. Saída_Potável x10` + Energia   |
| 52       | Hidrometro Reuso( Lilas)   | 117 / 248       | flow `Hidr. Saída Reuso x10` + Energia      |
| 43       | SCD Potavel 129 160 x0.95  | 94 / 249        | Caixa d'água potável (sem canais; config no nome ×0.95) |
| 42       | SCD Reuso 129 160 x0.95    | 134 / 248       | Caixa d'água reuso (sem canais; ×0.95)     |
| 26       | Sw Nivel Potável/ Reuso    | 206 / 248       | Crítico Potável, Crítico Reuso + plug `Automação Obramax` |
| 51       | Alarme Tanque Reuso        | 182 / 248       | Reservatório Reuso Cheio, Caixa Reuso Vazia |
| 54       | Solenoide                  | 215 / 249       | `Válvula Aberta` (inverted_actionable)     |

> Convenção de prefixos (= `DEVICE_TYPE_PREFIX_MAP`): `Hidr.`/`Hidrometro` → HIDROMETRO,
> `SCD` → CAIXA_D_AGUA, `Solenoide` → SOLENOIDE.

---

## 7. Energia — Medição Trifásica (`three_phase_sensor`)

Único `type` diferente de `outlet` na central (`code …-015`, com `clamp_type`).

| Slave ID | Nome          | addr (low/high) | clamp_type | Obs                  |
|----------|---------------|-----------------|------------|----------------------|
| 9        | 3F QFAC 2 ADM | 32 / 249        | 2          | medidor 3F (sem canais on/off) |
| 30       | 3F ADM        | 212 / 248       | 6          | medidor 3F           |

---

## 8. Geradores

| Slave ID | Nome                 | addr (low/high) | Canais                                  |
|----------|----------------------|-----------------|-----------------------------------------|
| 36       | Gerador Alarme F / G | 125 / 248       | Alarme F - Falha Geral, Alarme G - Falta De Rede |
| 37       | Gerador i            | 80 / 249        | Alarme i - Mot. ON/OFF                  |

---

## 9. Bombas de Incêndio

| Slave ID | Nome                      | addr (low/high) | Canais                                          |
|----------|---------------------------|-----------------|-------------------------------------------------|
| 38       | Casa de Bombas Diesel     | 246 / 249       | Falha Geral, Alarme Motor Ligado                |
| 39       | Casa De Bombas 2 Diesel   | 184 / 249       | Manual/ Automático                              |
| 40       | Casa De Bombas 3 Eletrica | 108 / 249       | Alr. Manual/ Desligado                          |
| 41       | Cada De Bombas 4 Eletrica | 205 / 248       | Alarmes Bomba Ligada, Falha Geral               |

---

## 10. Temperatura

| Slave ID | Nome                         | addr (low/high) | Obs                                  |
|----------|------------------------------|-----------------|--------------------------------------|
| 50       | Temperatura Ambiente Central | 83 / 249        | **Único** sensor de temperatura real (sem canais) |

---

## 11. Sem nome / a identificar

| Slave ID | Nome   | addr (low/high) | Obs                          |
|----------|--------|-----------------|------------------------------|
| 46       | LJ2    | 92 / 248        | sem canais configurados      |
| 49       | LJ 5   | 225 / 248       | sem canais configurados      |

> O slave **59** (sem nome / sem canais) que constava em capturas anteriores **não existe
> mais** no dump atual (`logMaps.log` 2026-06-17) — foi removido. Por isso o total caiu de
> 52 → 51 slaves. Há lacunas de `id` na tabela (`13, 16, 18, 44, 55, 56, 57, 59` ausentes),
> resquício de slaves removidos/recriados — ver `DB-SNAPSHOT.md` §não-conformidades.

---

## ⚠️ Inconsistências de nomenclatura (importante)

Diferente da Guadalupe, nesta central **o nome do slave frequentemente não reflete a função**:

1. **Compressores nomeados como temperatura**: slaves `10` (Spt 2), `11` (Spt 9),
   `17` (Spt 6), `22` (Spt 4), `58` (Spt 7) têm nome `Temp.`/`Termostato` mas os canais
   são `Spt N: Comp`. → na classificação de device, **não** tratar como TERMOSTATO.
2. **Ventilação/exaustão nomeada como loja**: slaves `45` (Exaust. Cozinha),
   `47` (Ventilador Cozinha), `48` (Ventilação ADM) têm nome `Lj 1/3/4`.
3. **Único termostato real** é o slave `50` (`Temperatura Ambiente Central`).
4. **Sem canais** (7 slaves): `9` e `30` (3F — telemetria vem direto do slave, esperado),
   `42`, `43` (SCD — info no nome), `46`, `49` (Lj sem config), `50` (temperatura).
5. **Canais órfãos** (`slave_id` NULL): `119`, `120` (`Spt 7: Comp`), `121` (`Teste`).
6. **Referências fantasmas em `ambients`**: alguns `hide_devices_v1` apontam para slaves que
   não existem mais — slave `16` (em `QT-Depósito`), slave `18` (em `QT- Loja Incorporadora`),
   slave `13` (em `Termostatos`, `Compressores`, `Comandos`); e canais `39`/`63` (em
   `Termostatos`). Limpar esses JSONs. Há ainda uma entrada duplicada de `slave_id 45` no
   ambiente `Comandos`.
7. Grafias com erro de digitação preservadas como estão no banco: `Hidrmetro`,
   `Exasut`, `Cada De Bombas`, `Lale tec`.

---

## Resumo por categoria

| Categoria                         | Qtd    |
|-----------------------------------|--------|
| Climatização — Splits (controle)  | 5      |
| Climatização — Compressores SPT   | 10     |
| Iluminação / Tomadas              | 7      |
| Exaustão / Ventilação             | 4      |
| Repetidores / Testadores          | 5      |
| Água (hidrômetro/caixa/reuso)     | 9      |
| Energia 3F (medição trifásica)    | 2      |
| Geradores                         | 2      |
| Bombas de Incêndio                | 4      |
| Temperatura                       | 1      |
| Sem nome / a identificar          | 2      |
| **Total**                         | **51** |
