# Slaves Map — Ilha Plaza AL3 (Soul Malls)

> Central: **Ilha Plaza AL3** (`91b719b7-f2d2-4d3f-9fb9-ab3d4edbac0d`)
> IPv6: `206:c160:eb69:3ddb:42c7:efce:511e:792a`
> Grupo: **Soul Malls** · Shopping: **Ilha Plaza Shopping**
> Total slaves: **67** · Total channels: **18**
> Fonte: `slave-and-channels.log` (dump `select * from slaves;` + `channels;`)
> `version`: **`6.0.0`** em todos, **exceto** os 2 `infrared` (`7.0.0`) · `aggregate`: `t` em todos

> Status: **🟢 mapeado** (AL3 de 3: AL1/AL2/AL3).
>
> Central **mais completa** do Ilha Plaza: além das lojas (ala L3/AL3), concentra a
> **infraestrutura predial** — **água** (recalque/poços/permeado, 8 hidrômetros),
> **climatização** (CAG, 3 Chillers), **cinema**, **antenas/telecom** e **repetidores IR**.
> Legenda `code`: **`002`** = `…-015` (3F) · **`003`** = `003-003-003-015` (3F) · `012` = outlet · `014` = infrared.

---

## 🔑 Padrões de nomenclatura

| Padrão | Tipo | Significado | Exemplo |
|--------|------|-------------|---------|
| `3F <Loja> N_<num>(AL3)` / `… L3` | three_phase_sensor | **Medidor de loja** (`3F_MEDIDOR`) — sufixo ora `(AL3)` ora `L3` | `3F Havaianas N_318(AL3)` |
| `3F CAG Bombas x160 x160A` | three_phase_sensor | **Bomba CAG** (`BOMBA_CAG`) — multiplicador no nome | `x160 x160A` |
| `3F Chiller(NN) x200 x200A` | three_phase_sensor | **Chiller** (`CHILLER`) | `3F Chiller(01)` |
| `3F Antena_… / Nextel/Tim` | three_phase_sensor | Carga de **telecom/antena** | `3F Antena_Vivo` |
| `Hidr. <Ponto> xNN` | outlet | **Hidrômetro** (`HIDROMETRO`) — channels `Energia` + `flow_sensor` | `Hidr. Poco11 x10` |
| `Sw Reboot / Reboot Lx / Sw Reborn` | outlet | **Switch de reboot remoto** | `Sw Reboot L3 Ilha Plaza` |
| `Reperidor NN` | infrared | **Repetidor IR** (typo de "Repetidor") · `version 7.0.0` | `Reperidor 01` |
| ` xNNN` / ` xNNNA` / ` x0.95` | — | **Multiplicador de clamp** embutido no nome | `x200 x200A` |

---

## 1. Energia — Medidores de Loja (`3F … N_<num>`)  · 42 slaves · `3F_MEDIDOR`

| ID | Nome | Loja | Ala | code | clamp |
|----|------|------|-----|------|------:|
| 1   | `3F Garage N_ 317( Al3)` | 317 | AL3 | 002 | 0 |
| 2   | `3F Havaianas N_318(AL3)` | 318 | AL3 | 002 | 0 |
| 3   | `3F Reserva N_321(Al3)` | 321 | AL3 | 002 | 0 |
| 4   | `3F SemLoja N_319/230(Al3)` | 319/230 | AL3 | 002 | 0 |
| 5   | `3F Melissa N_316(AL3)` | 316 | AL3 | 002 | 0 |
| 6   | `3F Josefina N_315(Al3)` | 315 | AL3 | 002 | 0 |
| 7   | `3F Sapattela N_314(AL3)` | 314 | AL3 | 002 | 0 |
| 8   | `3F Puket N_310A(Al3)` | 310A | AL3 | 002 | 0 |
| 41  | `3F alphabeto N_308(Al3j` | 308 | AL3 | 002 | 0 |
| 42  | `3F CacauShow N_310B/309(Al3)` | 310B/309 | AL3 | 002 | 1 |
| 43  | `3F Futebol* N_375Al(3)` | 375 | AL3 | 002 | 0 |
| 44  | `3F Semloja N_301/302(AL3)` | 301/302 | AL3 | 002 | 0 |
| 45  | `3F Vivo N_303/304(AL3)` | 303/304 | AL3 | 002 | 1 |
| 46  | `3F Peahi N_311/312(AL3)` | 311/312 | AL3 | 002 | 0 |
| 47  | `3F DI SANTINI N_343/344 L3` | 343/344 | L3 | 002 | 1 |
| 48  | `3F WERNER N_305/306 L3` | 305/306 | L3 | 002 | 1 |
| 49  | `3F RIHAPPY N_340/341/342 L3` | 340–342 | L3 | 002 | 0 |
| 50  | `3F BELCOSMÉTICOS N_373/374 L3` | 373/374 | L3 | 002 | 0 |
| 51  | `3F ALL MINI N_361/362/363/364 L3` | 361–364 | L3 | 002 | 0 |
| 52  | `3F PAVÃO N_323/324 L3` | 323/324 | L3 | 002 | 0 |
| 53  | `3F TIME ESTÉTICA N_322 L3` | 322 | L3 | 002 | 0 |
| 54  | `3F LIZIE N_355 L3` | 355 | L3 | 002 | 0 |
| 55  | `3F LÁPIS DE COR N_356 L3` | 356 | L3 | 002 | 0 |
| 56  | `3F BAGAGIO N_354/355 L3` | 354/355 | L3 | 002 | 0 |
| 57  | `3F CLOVER N_353 L3` | 353 | L3 | 002 | 0 |
| 58  | `3F ZINZANE N_352 L3` | 352 | L3 | 002 | 0 |
| 59  | `3F AVIATOR N_351 L3` | 351 | L3 | 002 | 0 |
| 60  | `3F FISICO E FORMA N_350 L3` | 350 | L3 | 002 | 0 |
| 93  | `3F HERING N_348/349 L3` | 348/349 | L3 | 002 | 0 |
| 94  | `3F OBSECIÓN N_347 L3` | 347 | L3 | 002 | 0 |
| 95  | `3F Sombrancelha N_346(AL3)` | 346 | AL3 | 002 | 0 |
| 96  | `3F Euro colchões N_345(AL3)` | 345 | AL3 | 002 | 0 |
| 97  | `3F Centauro N_LB3Parte1(AL3)` | LB3Parte1 | AL3 | 002 | **2** |
| 98  | `3F Bel Art N_333A/334/335` | 333A/334/335 | — | 002 | **2** |
| 99  | `3F Casas Bahia N_LB3Parte2(AL3)` | LB3Parte2 | AL3 | 002 | **2** |
| 100 | `3F Espacoilha N_364A(Al3)` | 364A | AL3 | 002 | 0 |
| 101 | `3F Pizzahut N_XXX(AL2) x0.95` | **XXX** | **AL2** | 003 | 1 |
| 102 | `3F PastaDiColina N_xxx(AL2)` | **xxx** | **AL2** | 003 | 0 |
| 103 | `3F Outback N_371(AL3)` | 371 | AL3 | 003 | **2** |
| 104 | `3F EspetoCarioca N_327/328/329/330/331(AL3)` | 327–331 | AL3 | 003 | 1 |
| 105 | `3F La mole N_xxx(AL2)` | **xxx** | **AL2** | 003 | **2** |
| 106 | `3F Havana N_XXX(AL3)` | **XXX** | AL3 | 003 | 1 |

> `clamp_type` da maioria é `0`. **`x0.95`** (101) é multiplicador no nome.
> ⚠️ Slaves **101, 102, 105** estão rotulados **`(AL2)`** dentro da central **AL3** (lojas com `N_xxx` a identificar).

---

## 2. Energia — Climatização / Infra / Área Comum (`3F …`)  · 12 slaves

| ID | Nome | Categoria sugerida | Multiplicador | clamp |
|----|------|--------------------|---------------|------:|
| 118 | `3F CAG Bombas x160 x160A` | `BOMBA_CAG` | x160 / x160A | 0 |
| 128 | `3F Chiller(01) x200 x200A` | `CHILLER` | x200 / x200A | 0 |
| 129 | `3F Chiller(02) x200 x200A` | `CHILLER` | x200 / x200A | 0 |
| 131 | `3F Chillers(3/4/5) x200 x200A` | `CHILLER` (3 unidades) | x200 / x200A | 0 |
| 119 | `3F Cinema` | Cinema (carga) | — | **2** |
| 120 | `3F Cinema_Bombas` | Bombas do cinema | — | **2** |
| 121 | `3F Antena_QMC` | Telecom/antena | — | 1 |
| 125 | `3F Antena_Vivo` | Telecom/antena | — | 0 |
| 126 | `3F Nextel/Tim( 2GXX3G)` | Telecom/antena | — | 0 |
| 127 | `3F Game_Point` | Loja/área (games) | — | 1 |
| 130 | _(nome vazio)_ | **SEM NOME — a identificar** | — | _(null)_ |
| 133 | `Teste` | **TESTE — slave de teste** (criado 2026-06-08) | — | _(null)_ |

---

## 3. Água — Hidrômetros (`Hidr. …`)  · 8 slaves · `outlet` · `HIDROMETRO`

Cada hidrômetro tem **2 channels**: `presence_sensor` **"Energia"** + `flow_sensor` (vazão).
Todos com `channelConfig` `REMOTE_INPUT` (ch0) + `PULSE_ON_POWER` (ch1).

| ID | Nome (slave) | Mult. | Channel `flow_sensor` | Obs |
|----|--------------|-------|------------------------|-----|
| 107 | `Hidr. Recalque _Torre x1` | x1 | `Hidr. Recalque_Torre x1` | espaço extra no slave |
| 108 | `Hidr. Prato_Rejeito x100` | x100 | `Hidr. Prado_Rejeito x100` | **typo** channel: `Prado`≠`Prato` |
| 109 | `Hidr. Prod_permeado x10` | x10 | `Hidr. Produ_penerado x10` | **typo** channel: `Produ_penerado`≠`Prod_permeado`; `{"confirm":false}` |
| 110 | `Hidr. Poco11 x10` | x10 | `Hidr. Poco11 x10` | — |
| 111 | `Hidr. Biogel_Brasil x10` | x10 | `Hidr. Biogel_Brasil x10` | — |
| 112 | `Hidr. Permeável_Torre x10` | x10 | `Hidr. Permeável_Torre x10` | `config_clamp` value null |
| 113 | `Hidr. Azulão_80 x10` | x10 | `Hidr. Azulão_80 x10` | — |
| 115 | `Hidr. Hidro_Descarte x1` | x1 | `Hidr. Hidro_Descarte x1` | flow `{"confirm":false}` |

---

## 4. Switch / BAS — Reboots remotos (`outlet`)  · 3 slaves

| ID | Nome | Obs |
|----|------|-----|
| 116 | `Sw Reboot L3 Ilha Plaza` | reboot L3 |
| 117 | `Reboot L2 Ilha Plaza` | reboot L2 |
| 132 | `Sw Reborn` | **"Reborn"** = provável typo de "Reboot" |

---

## 5. Infravermelho — Repetidores (`infrared`)  · 2 slaves · `version 7.0.0`

| ID | Nome | code | Obs |
|----|------|------|-----|
| 123 | `Reperidor 01` | 014 | **"Reperidor"** = typo de "Repetidor" |
| 124 | `Reperidor 02` | 014 | idem |

---

## 6. Temperatura / Seletor Auto/Manual

> **Nenhum** nesta central.

---

## Estrutura de `channels`  · 18 channels

| Tipo | Qtd | Pertence a |
|------|-----|-----------|
| `presence_sensor` ("Energia") | 8 | hidrômetros (slaves 107–115) |
| `flow_sensor` ("Hidr. …") | 8 | hidrômetros — a vazão |
| `lamp` ("ignorar") | 2 | slaves **43** (Futebol) e **104** (EspetoCarioca) — **descartar** |

> Os medidores `3F` **não têm channel materializado** (leitura direto do slave).
> Os 8 `outlet` de hidrômetro têm o par `Energia` + `flow_sensor`.

---

## ⚠️ Inconsistências

1. **Sufixo de ala** bagunçado: `(AL3)`, `(Al3)`, `L3`, `( Al3)` (espaço), `Al(3)` (43), **`(Al3j`** (41, bracket errado).
2. **Slaves rotulados `(AL2)` dentro da central AL3**: 101 (Pizzahut), 102 (PastaDiColina), 105 (La mole) — lojas `N_xxx`/`N_XXX` a identificar.
3. **Lojas não identificadas**: `N_XXX`/`N_xxx` em 101, 102, 105, 106; `N_LB3Parte1/2` em 97, 99.
4. **Slave 130 sem nome** — identificar. **Slave 133 `Teste`** (novo, 2026-06-08) — slave de teste, provável descartar/identificar.
5. **Typos de nome de channel vs slave**: 108 `Prado`≠`Prato`; 109 `Produ_penerado`≠`Prod_permeado`.
6. **Typos**: `Reperidor` (123/124 → Repetidor), `Sw Reborn` (132 → Reboot), `SemLoja`/`Semloja` (4, 44), `Futebol*` (43, asterisco), `N_319/230` (4, `230`≈typo `320`).
7. **2 channels `lamp` "ignorar"** (slaves 43, 104) — placeholders a descartar.
8. **`version 7.0.0`** só nos 2 `infrared` (resto `6.0.0`).
9. **Multiplicadores embutidos no nome** (`x1`/`x10`/`x100`/`x0.95`/`x160 x160A`/`x200 x200A`) — parseados no Node-RED (`getMultiplier`).

---

## Resumo por categoria

| Categoria | Slaves |
|-----------|--------|
| Energia — Medidores de Loja (3F) | 42 |
| Energia — Climatização/Infra/Antenas (3F) | 12 |
| Água — Hidrômetros (outlet) | 8 |
| Switch — Reboots remotos (outlet) | 3 |
| Infravermelho — Repetidores | 2 |
| **Total** | **67** |

| Métrica | Valor |
|---------|-------|
| `three_phase_sensor` | 54 |
| `outlet` | 11 (8 hidrômetros + 3 reboots) |
| `infrared` | 2 |
| `channels` (8 presence + 8 flow + 2 lamp) | 18 |
| `version` | `6.0.0` (65) · `7.0.0` (2 infrared) |
