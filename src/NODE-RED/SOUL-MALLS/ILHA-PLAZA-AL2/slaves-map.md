# Slaves Map — Ilha Plaza AL2 (Soul Malls)

> Central: **Ilha Plaza AL2** (`53052549-cc8c-4ca2-a597-58e0577548a2`)
> IPv6: `200:24a5:8297:cce7:59d2:8126:6d67:7e4d`
> Grupo: **Soul Malls** · Shopping: **Ilha Plaza Shopping**
> Total slaves: **52** · Total channels: **2**
> Fonte: `slave-and-channels.log` (dump `select * from slaves;` + `channels;`)
> `version` de todos os slaves: **`6.0.0`** · `aggregate`: `t` em todos

> Status: **🟢 mapeado** (AL2 de 3: AL1/AL2/AL3).
>
> Central de **lojas de shopping** — quase tudo é medidor de energia (`three_phase_sensor`, 48)
> + **switches de reboot** (`outlet`, 4). **Sem água, sem temperatura, sem seletor.**
> Quase todos os medidores são da ala **(AL2)** (consistente com o nome da central).
> Legenda `code`: **`002`** = `002-002-002-015` · **`003`** = `003-003-003-015` · outlets = `…-012`.

---

## 🔑 Padrões de nomenclatura

| Padrão | Tipo | Significado | Exemplo |
|--------|------|-------------|---------|
| `3F <Loja> N_<num>(AL2)` | three_phase_sensor | **Medidor de loja** (RFC-0128 = Lojas → `3F_MEDIDOR`) | `3F Natura N_204(AL2)` |
| `N_<num>` | — | Número da loja; faixa (`N_209/210`), letras (`N_226A/B/C/D`) ou `N_xxx`/`N_E.C.A` (a identificar) | `N_264/265` |
| `(AL2)` / `(Al2)` / `(al2)` / `(aL2)` / `( AL2)` | — | **Ala física** (caixa/espaço inconsistente) | `(al2)` |
| `Sw Reboot` / `Reboot Ilha Plaza NN` / `Sw Reborn` | outlet | **Switch de reboot remoto** | `Reboot Ilha Plaza 01` |

---

## 1. Energia — Medidores de Loja (`3F …`)  · 48 slaves · `three_phase_sensor` · `3F_MEDIDOR`

| ID | Nome | Loja (N_) | code | clamp | config / obs |
|----|------|-----------|------|------:|--------------|
| 1  | `3F MR.Cat N_211(AL2)` | 211 | 002 | 0 | — |
| 2  | `3F Wolrd Free N_209/210(Al2)` | 209/210 | 002 | 0 | typo "Wolrd" |
| 3  | `3F Fluminense N_208(AL2)` | 208 | 002 | 0 | — |
| 4  | `3F Tim N_207(AL2)` | 207 | 002 | 0 | config_clamp 0 |
| 5  | `3F Valisere N_240(AL2)` | 240 | 002 | 0 | config_clamp 0 |
| 6  | `3F Bredcapas N_238(al2)` | 238 | 002 | 0 | caixa `(al2)` |
| 7  | `3F Solvang N_239(AL2)` | 239 | 002 | 0 | — |
| 8  | `3F Santa Lolla N_205` | 205 | 002 | 0 | **sem ala** |
| 9  | `3F WQS N_203(AL2)` | 203 | 002 | 0 | config_clamp 0 |
| 10 | `3F Natura N_204(AL2)` | 204 | 002 | 0 | — |
| 11 | `3F EspaçoRubroNegro N_202` | 202 | 002 | 0 | **sem ala** |
| 12 | `3F Kopenhagen N_206(AL2)` | 206 | 002 | 0 | — |
| 13 | `3F SoutechN_241(AL2)` | 241 | 002 | 0 | **sem espaço** "SoutechN_241" |
| 14 | `3F CLJoias N_242(AL2)` | 242 | 002 | 0 | — |
| 15 | `3F PrataePrata N_243/244` | 243/244 | 002 | 0 | **sem ala** |
| 16 | `3F Boticário N_245/246(Al2)` | 245/246 | 002 | 0 | — |
| 17 | `3F ViaMia N_247/248(Al2)` | 247/248 | 003 | 0 | — |
| 18 | `3F QualiOtica N_212(AL2)` | 212 | 002 | 0 | — |
| 19 | `3F Taco N_214/215(AL2)` | 214/215 | 002 | 0 | config_clamp 0 |
| 20 | `3F AD N_216(AL2)` | 216 | 003 | 0 | config_clamp 0 |
| 21 | `3F SonhosDosPes N_220(Al2)` | 220 | 003 | 0 | — |
| 22 | `3F Arezzo N_221(AL2)` | 221 | 002 | 0 | config_clamp 0 |
| 23 | `3F GiganteColina N_224(AL2)` | 224 | 002 | 0 | — |
| 24 | `3F LUPO N_223(AL2)` | 223 | 002 | 0 | config_clamp 0 |
| 25 | `3F Brulane N_222(AL2)` | 222 | 002 | 0 | — |
| 26 | `3F EnfoquePapelaria N_226A/B/C/D` | 226A–D | 002 | **1** | **sem ala** |
| 27 | `3F Demorcrata N_225/226AL2` | 225/226 | 003 | 0 | typo "Demorcrata"; **`226AL2` sem parênteses**; config_clamp 0 |
| 28 | `3F PontoFrio N_E.C.A(AL2)` | **E.C.A** | 002 | **1** | loja **não-numérica** |
| 29 | `3F Toulon N_226E` | 226E | 002 | 0 | **sem ala** |
| 30 | `3F BondSession N_256(AL2)` | 256 | 003 | 0 | — |
| 31 | `3F South N_217/218` | 217/218 | 002 | 0 | **sem ala**; config_clamp 0 |
| 32 | `3F FirstClass N_257(AL2)` | 257 | 003 | 0 | — |
| 33 | `3F Lulean N_213(AL2)` | 213 | 003 | 0 | — |
| 34 | `3F VIVARA N_249/250(al2)` | 249/250 | 002 | 0 | caixa `(al2)` |
| 35 | `3F Patroni N_235/236(aL2)` | 235/236 | 003 | **1** | caixa `(aL2)` |
| 36 | `3F Claro N_237A/B( AL2)` | 237A/B | 002 | 0 | **espaço** `( AL2)` |
| 37 | `3F Burguerking N_252(AL2)` | 252 | 003 | **2** | typo "Burguerking" |
| 38 | `3F Spoleto N_263(AL2)` | 263 | 003 | 0 | — |
| 39 | `3F McDonald's N_264/265(AL2)` | 264/265 | 002 | **2** | config_clamp value 2 |
| 40 | `3F Bobs N_258(AL2)` | 258 | 003 | **1** | — |
| 41 | `3F Camarão&Cia N_262(AL2)` | 262 | 002 | **1** | — |
| 42 | `3F Kawari N_266A(AL2)` | 266A | 003 | 0 | — |
| 43 | `3F Maneco N_268(AL2)` | 268 | 002 | **1** | — |
| 44 | `3F Izla N_260(AL2)` | 260 | 003 | **1** | — |
| 45 | `3F CheirinBao N_255(AL2)` | 255 | 002 | 0 | config_clamp 0 |
| 46 | `3F Espaçolaser N_250A(AL2)` | 250A | 002 | 0 | — |
| 47 | `3F ReiMatte N_xxx(AL2)` | **xxx** | 003 | **1** | loja **desconhecida** |
| 48 | `3F Milky Moore N_xxx(AL2)` | **xxx** | 002 | 0 | loja **desconhecida** |

> `clamp_type`: `1` em 8 medidores (26, 28, 35, 40, 41, 43, 44, 47) · `2` em 2 (37, 39) · `0` no restante.

---

## 2. Switch / BAS — Reboots remotos (`outlet`)  · 4 slaves

| ID | Nome | config | Obs |
|----|------|--------|-----|
| 49 | `Sw Reboot L2 Ilha Plaza` | — | reboot L2 |
| 50 | `Sw Reborn Al2` | `channelConfig` ch0/ch1 `NORMAL`/`HOLDING` + `config_temperature` | **"Reborn"** = provável typo de "Reboot" |
| 51 | `Reboot Ilha Plaza 01` | — | reboot |
| 52 | `Reboot Ilha Plaza 02` | — | reboot — **possui os 2 channels `lamp`** abaixo |

---

## 3. Água — Hidrômetros

> **Nenhum** nesta central.

## 4. Temperatura — Termostatos

> **Nenhum** nesta central.

## 5. Seletor Auto/Manual (`SELETOR_AUTO_MANUAL`)

> **Nenhum** nesta central.

---

## Estrutura de `channels`  · 2 channels

| ID | type | channel | name | slave_id | Pertence a |
|----|------|---------|------|----------|-----------|
| 1 | `lamp` | 0 | `Reboot 1` | 52 | `Reboot Ilha Plaza 02` |
| 2 | `lamp` | 1 | `Reboot2` | 52 | `Reboot Ilha Plaza 02` |

> Os 2 channels `lamp` do slave 52 são as **saídas de reboot** (não iluminação).
> Os 48 medidores `3F` **não têm channel materializado** (leitura direto do slave).

---

## ⚠️ Inconsistências

1. **Caixa/espaço do sufixo de ala** muito inconsistente: `(AL2)`, `(Al2)`, `(al2)`, `(aL2)`, `( AL2)` (espaço), e `226AL2` (slave 27, **sem parênteses**).
2. **Lojas não identificadas**: `N_xxx` em ReiMatte (47) e Milky Moore (48); `N_E.C.A` em PontoFrio (28, não-numérico).
3. **Sem sufixo de ala**: 8 (Santa Lolla), 11 (EspaçoRubroNegro), 15 (PrataePrata), 26 (Enfoque), 29 (Toulon), 31 (South).
4. **Typos**: `Wolrd Free` (2 → World), `Burguerking` (37), `Demorcrata` (27 → Democrata), `SoutechN_241` (13, sem espaço), `Sw Reborn Al2` (50 → Reboot).
5. **Channels `lamp` "Reboot 1"/"Reboot2"** (slave 52) são reboots, não luminárias — nome do tipo é enganoso.

---

## Resumo por categoria

| Categoria | Slaves |
|-----------|--------|
| Energia — Medidores de Loja (3F) | 48 |
| Switch — Reboots remotos (outlet) | 4 |
| **Total** | **52** |

| Métrica | Valor |
|---------|-------|
| `three_phase_sensor` | 48 |
| `outlet` | 4 |
| `channels` (2× `lamp` de reboot) | 2 |
| `version` (todos) | `6.0.0` |
