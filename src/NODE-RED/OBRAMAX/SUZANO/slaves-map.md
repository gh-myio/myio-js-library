# Slaves Map — Suzano (OBRAMAX)

> Central: **OBRAMAX — Suzano** (`<uuid a preencher>`)
> IPv6: `<a preencher — não consta no manual>`
> Total slaves: 39 · Total channels: 124
> Fonte: `logDB-Central.log` (dump de `slaves` + `channels`)

> Loja OBRAMAX. Maioria `type = outlet` (`v6.0.0`, `code …-012`), **mais**: 3 blasters
> **`infrared`** (`v7.0.0`, `code …-014` — IR com termômetro embutido) e 1 medidor
> **`three_phase_sensor`** (`code …-015`). Classificação por **função real (canais)** —
> nesta central vários nomes não batem com a função (ver ⚠️).

---

## 1. Climatização — Splits (controle / automação)

4 slaves "Splitao" controlam os pares de splits (plug `Splitao N` + `Auto. Splitao N`).

| Slave ID | Nome          | addr (low/high) | Canais                                   |
|----------|---------------|-----------------|------------------------------------------|
| 17       | Splitao 1/2   | 211 / 249       | Splitao 1, Splitao 2 + Auto. Splitao 1/2 |
| 16       | Splitao S3/S4 | 166 / 249       | Splitao 3, Splitao 4 + Auto. Splitao S3/S4 |
| 15       | Splitao S5/S6 | 35 / 248        | Splitao 5, Splitao 6 + Auto. Splitao 5/6 |
| 18       | Splitao 7/8   | 75 / 248        | Splitao 7, Splitao 8 + Auto. Splitao 7/8 |

> Canais órfãos (`slave_id` NULL): `Splitao 3` (36), `Splitao 4` (37), `Auto. Splitao 3/4` (38/39).

---

## 2. Climatização — Compressores (monitor SPST N: COMP1/COMP2)

8 slaves monitoram os compressores dos splits 1–8 (lamps `SPSTn:COMP` + sensores `Comp1`/`Comp2`).
⚠️ **Todos estão nomeados "Termostato N"** — o nome não bate; os canais confirmam compressores.
O número casa: `Termostato N` → `SPST N`.

| Slave ID | Nome           | addr (low/high) | Split | Canais                       |
|----------|----------------|-----------------|-------|------------------------------|
| 31       | **Termostato 1** | 176 / 249     | SPST1 | SPST1:COMP1/COMP2 + Comp1/Comp2 |
| 30       | **Termostato 2** | 184 / 248     | SPST2 | SPST2:COMP1/COMP2 + Comp1/Comp2 |
| 28       | **Termostato 3** | 80 / 249      | SPST3 | SPST3:COMP1/COMP2 + Comp1/Comp2 |
| 29       | **Termostato 4** | 177 / 248     | SPST4 | SPST4:COMP1/COMP2 + Comp1/Comp2 |
| 32       | **Termostato 5** | 7 / 249       | SPST5 | SPST5:COMP1/COMP2 + Comp1/Comp2 |
| 33       | **Termostato 6** | 160 / 248     | SPST6 | SPST6:COMP1/COMP2 + Comp1/Comp2 |
| 35       | **Termostato 7** | 47 / 248      | SPST7 | SPST7:COMP1/COMP2 + Comp1/Comp2 |
| 37       | **Termostato 8** | 112 / 248     | SPST8 | SPST8:COMP1/COMP2 + Comp1/Comp2 |

---

## 3. Temperatura (blasters IR com termômetro — `infrared` v7.0.0)

Os **únicos** sensores de temperatura reais. São blasters IR (firmware 7.0.0) que expõem
um termômetro embutido (padrão RFIR — ver manual §8.2.4); `channels=1`, sem linha em `channels`.

| Slave ID | Nome              | addr (low/high) | Tipo     |
|----------|-------------------|-----------------|----------|
| 10       | Temp. Frente Loja | 233 / 249       | infrared |
| 9        | Temp. Meio Loja   | 2 / 248         | infrared |
| 8        | Temp. Fundo Loja  | 95 / 249        | infrared |

---

## 4. Iluminação / Tomadas (loja, depósito, drive, estacionamento)

| Slave ID | Nome                          | addr (low/high) | Canais                                       |
|----------|-------------------------------|-----------------|----------------------------------------------|
| 2        | Sw Loja Inc. S1/S2            | 49 / 249        | Loja 50% (S1), Loja 100% (S2) + Auto         |
| 3        | SW Loja Inc. S3/S4            | 90 / 249        | Loja 50% (S3), Loja 100% (S4) + Auto         |
| 4        | Qt-depósito M/N               | 33 / 248        | Ilum Externa (M), Ilum Deposito + Auto       |
| 5        | QT-deposito Luz Exter. /Bar.K | 92 / 249        | Ilum Externa (K), Ilum Externa (L) + Auto    |
| 6        | QT Deposito Barr.i/J          | 85 / 248        | Drive 50% (i), Drive 100% (J) + Auto         |
| 7        | Qt Deposito G/H               | 57 / 248        | Drive 50% (G), Drive 100% (H) + Auto         |
| 12       | **Sw S3/S4**                  | 175 / 249       | Estac Coberto (G), Letreiro Fachada, ADM MEZANINO |
| 13       | **SW S5/S6**                  | 82 / 249        | Ilum Externa (H), Ilum Externa (i) + Auto    |
| 24       | SW Treinamento Mezanino/ ADM  | 11 / 249        | Treinamento Mezanino, ADM Mezanino + Auto    |

> ⚠️ `Sw S3/S4` (12) e `SW S5/S6` (13) **não** são splits — são iluminação (estac/letreiro/externa).

---

## 5. Exaustão

| Slave ID | Nome                          | addr (low/high) | Canais                                         |
|----------|-------------------------------|-----------------|------------------------------------------------|
| 27       | Exaustor Cozinha/ Sanitário   | 245 / 249       | Exaustor Cozinha, Exaustor Sanitário 2 + Auto  |
| 26       | Exaustores Sanitário/ Armário | 209 / 249       | Exaustor Sanitário 1, Exaustor Armário + Auto  |

---

## 6. Água — Hidrômetros / Caixas / Reuso / Pluvial

| Slave ID | Nome                      | addr (low/high) | Tipo / Canais                                  |
|----------|---------------------------|-----------------|------------------------------------------------|
| 21       | Sw Potavel Sabesp         | 38 / 248        | flow `Hidr. PotSabesp x1` + Energia + `Automação Obramax.` |
| 44       | Sw Potável                | 154 / 249       | flow `Hidr. Potável` + Ligado                  |
| 47       | SW Saída Potável          | 152 / 248       | flow `Hidr. Saída_Potavel x10` + Energia       |
| 48       | Hidrometro Reuso          | 100 / 249       | flow `Hidr. Reuso x10` + Energia Reuso         |
| 40       | SCD Potável 132 160 x3.8  | 130 / 248       | Caixa d'água potável (sem canais; ×3.8)        |
| 23       | SCD Reuso 132 160 x1.95   | 78 / 248        | Caixa d'água reuso (Check; ×1.95)              |
| 22       | Sw Solenóide              | 103 / 248       | `Aberto` (inverted_actionable; XOR_OUTPUT)     |
| 49       | Nivel Caixa Pluvial       | 50 / 249        | `Quando Ligado Reservatorio`                   |

> Convenção de prefixos (= `DEVICE_TYPE_PREFIX_MAP`): `Hidr.`/`Hidrometro` → HIDROMETRO,
> `SCD` → CAIXA_D_AGUA, `Solenóide` → SOLENOIDE.
> Canais órfãos (`slave_id` NULL): `Hidrômetro Reuso Sabesp` (86), `Energia Reuso Sabesp` (85),
> `Hidrometro Potável` (137), `Potável` (142), `Fonte`/`Fonte Ligada`/`Reuso` (129–141).

---

## 7. Energia — Medição Trifásica (`three_phase_sensor`)

| Slave ID | Nome    | addr (low/high) | clamp_type | Obs                  |
|----------|---------|-----------------|------------|----------------------|
| 19       | 3F Café | 254 / 248       | 1          | medidor 3F (`code …-015`, sem canais on/off) |

---

## 8. Bombas de Incêndio (Diesel)

| Slave ID | Nome                    | addr (low/high) | Canais                          |
|----------|-------------------------|-----------------|---------------------------------|
| 36       | Bomba Diesel Principal  | 42 / 249        | Seletor Automático, Falha Geral |
| 34       | Bomba Diesel Principal. | 227 / 249       | Motor Ligado                    |
| 38       | Bomba Diesel Reserva    | 249 / 249       | Seletor Automático              |
| 39       | Bomba Diesel Reserva.   | 173 / 249       | Falha Geral, Motor Ligado       |

> Note os pares com nome quase idêntico diferindo só por `.` final (34 vs 36, 38 vs 39).

---

## ⚠️ Inconsistências de nomenclatura (importante)

1. **Compressores nomeados como termostato**: slaves `28`–`37` (`Termostato 1..8`) são
   monitores `SPST N: COMP` — **não** tratar como TERMOSTATO na classificação de device.
2. **Termostatos reais** = os 3 blasters `infrared` (`Temp. Frente/Meio/Fundo Loja`, slaves
   `8`/`9`/`10`) — IR com termômetro embutido (RFIR, firmware 7.0.0).
3. **"Sw S3/S4" (12)** e **"SW S5/S6" (13)** são iluminação (estac/letreiro/externa), não splits.
4. **Pares com `.` final** no nome (Bombas 34/36, 38/39) — fácil confundir; preservados como no banco.
5. **Sem canais**: `40` (SCD — info no nome).
6. **Canais órfãos** (`slave_id` NULL, a vincular/limpar): `Teste` (1), `Splitao 3/4` (36/37) +
   autos (38/39), `Energia/Hidrômetro Reuso Sabesp` (85/86), `Fonte*`/`Reuso`/`Potável`/
   `Hidrometro Potável` (129–142).
7. Grafias com erro/variação preservadas: `PotSabesp`, `Saída_Potavel`, `Solenóide`, `Reserva.`.

---

## Resumo por categoria

| Categoria                          | Qtd    |
|------------------------------------|--------|
| Climatização — Splits (controle)   | 4      |
| Climatização — Compressores SPST   | 8      |
| Temperatura (IR + termômetro)      | 3      |
| Iluminação / Tomadas               | 9      |
| Exaustão                           | 2      |
| Água (hidrômetro/caixa/reuso/pluvial) | 8   |
| Energia 3F (medição trifásica)     | 1      |
| Bombas de Incêndio (Diesel)        | 4      |
| **Total**                          | **39** |
