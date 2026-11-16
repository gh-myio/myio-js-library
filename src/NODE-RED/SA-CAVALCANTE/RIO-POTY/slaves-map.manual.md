# Slaves Map — Rio Poty (Sá Cavalcante)

> Central: **Rio Poty** (`c0af8288-7b13-4024-bc11-df5017fef656`)
> IPv6: `203:bdfb:8fda:634d:c846:1404:f319:718c`
> Total slaves: **404** · Total channels: 195
> Fonte: `logCentralDatabase.log`

> Central de **medição de shopping inteiro** (≠ lojas OBRAMAX): a grande maioria é
> **medidor de energia** (`three_phase_sensor`, 282) + **hidrômetro/água** (`outlet`, 122).
> Convenção de nome: prefixo **`SCRP`** = Shopping Center Rio Poty; **`AC`** = Área Comum.

---

## 🔑 Padrões de nomenclatura

| Prefixo | Tipo | Significado | Exemplo |
|---------|------|-------------|---------|
| `3F SCRP<piso><lojas>` | three_phase_sensor | **Medidor de loja** (RFC-0128 = Lojas) | `3F SCRP206FG` |
| `3F SCRPAC-<EQUIP>` | three_phase_sensor | **Área comum** (escada/elev/bomba/chiller/CAG/trafo) | `3F SCRPAC-ELEV1` |
| `HIDR. SCRP<...>` | outlet | **Hidrômetro** (água por loja) | `HIDR. SCRP107ABCD` |
| `TEMP. SCRPAC-TemperaturaNN` | outlet | **Temperatura** área comum (TERMOSTATO) | `TEMP. SCRPAC-Temperatura5` |
| ` xNNN xNNNA` (sufixo) | — | **Multiplicador de clamp** (tensão `xNNN` + corrente `xNNNA`) parseado no Node-RED | `3F SCRPAC-Chiller1 x200 x200A` |

> Os `3F` (medidores) **não têm channel materializado** — a leitura vem direto do slave.
> Os `outlet` (hidrômetro/temp) **têm channels** (`flow_sensor HIDR.…` + `presence Energia`).

---

## 1. Energia — Medidores de Loja (`3F SCRP<piso>…`)  ≈199 slaves

Medidores trifásicos por loja, agrupados por piso (`SCRP1xx`–`SCRP4xx`), ids **1–167** + `SCRPQ*`.

| Piso | Qtd | Faixa de exemplo |
|------|-----|------------------|
| `SCRP1xx` (107–109) | 8  | `3F SCRP107FGHI`, `3F SCRP108A`, `3F SCRP109A` |
| `SCRP2xx` (201–214) | 66 | `3F SCRP202ABCDEFG` … `3F SCRP214B` |
| `SCRP3xx` (301–313) | 67 | `3F SCRP301C` … `3F SCRP313EF` |
| `SCRP4xx` (401–415) | 39 | `3F SCRP401D` … `3F SCRP415E` |
| `SCRPQ*` (especiais) | ~19 | `3F SCRPQS119`, `3F SCRPQ309JKL`, `3F SCRPQ403` |

> A letra após o número = circuito/loja (ex. `206FG` = lojas F e G do circuito 206).
> ~21 medidores carregam o **multiplicador** no nome (ex. `x80 x80A`, `x100 x100A`).

---

## 2. Energia — Área Comum (`3F SCRPAC-…`)  (RFC-0128)

Equipamentos de área comum, ids **168–243** (+ trafos). Mapeiam às categorias do RFC-0128:

| Categoria (RFC-0128) | Slaves | IDs | Nomes |
|----------------------|--------|-----|-------|
| **Escadas Rolantes** | 16 | 168–183 | `SCRPAC-ER1` … `ER16` (ER8 = "Caso Indefinido") |
| **Elevadores** | 8 | 184–191 | `SCRPAC-ELEV1` … `ELEV8` |
| **Bombas Hidráulicas** | 9 | 192–195, 222–226 | `SCRPAC-BH1` … `BH9` |
| **Bombas de Incêndio** | 6 | 196–201 | `SCRPACBI1`…`BI4` + `BI2_2JOKEY`, `BI3_2BOMBAJOKEY` |
| **Climatização — Chiller** | 3 | 202–204 | `SCRPAC-Chiller1..3` (`x200/x190`) |
| **Climatização — Bombas CAG** | 15 | 205–219 | `SCRPAC-BCAG1` … `BCAG15` |
| **Climatização — Casa AR** | 17 | 227–243 | `SCRPAC-CasaAR1` … `CasaAR17` |
| **Entrada — Trafos** | 3 | 220, 221, 348 | `SCRPAC-TrafoEntrada x805`, `TrafoCAG x825`, `SCRP TRAFO 03 x200` |

> `BCAG` = Bomba da Central de Água Gelada · `CasaAR` = casa de máquinas de ar-condicionado.
> Trafos têm o maior multiplicador (`x805`/`x825`) — são as entradas de energia.

---

## 3. Água — Hidrômetros (`HIDR. SCRP…`)  96 slaves

`type=outlet`, ids **244–339** (+ alguns). Cada um com `flow_sensor` (vazão) + `presence Energia`.
Seguem o mesmo código de loja dos medidores 3F (`HIDR. SCRP107ABCD` ↔ `3F SCRP107…`).

| Piso | Exemplos |
|------|----------|
| 1xx | `HIDR. SCRP107ABCD`, `HIDR. SCRP108A`, `HIDR. SCRP109A` |
| 2xx | `HIDR. SCRP202ABCDEFG` … `HIDR. SCRP214B` |
| 3xx | `HIDR. SCRP301ABH` … `HIDR. SCRP312ABGHI` |
| 4xx | `HIDR. SCRP401ABB1` … `HIDR. SCRP409A` |

> ⚠️ `HIDE. SCRP300ABCDEFG` (slave 416) — **typo** de `HIDR.` (não casa o prefixo HIDROMETRO).
> Os 88 `flow_sensor` da tabela `channels` pertencem a esses hidrômetros.

---

## 4. Temperatura — Área Comum (`TEMP. SCRPAC-TemperaturaNN`)  17 slaves

`type=outlet`, ids **327–343** (`TEMP. SCRPAC-Temperatura1` … `Temperatura17`). Prefixo `TEMP.` = TERMOSTATO.

---

## 5. Diversos / a identificar

| Slave ID | Nome | Obs |
|----------|------|-----|
| 349 | `Repetidor Trafo 03` | repetidor de sinal |
| 350 | `Repetixor 02 (Trafo 03)` | **typo** de "Repetidor" |
| 388 | `Reboot Novo L3` | reboot remoto |
| 430 | `Sw Teste Hidrômetro` | switch de teste |
| 351, 352, 353, 385, 387 | *(sem nome)* | **5 slaves sem nome** — a identificar |

---

## Estrutura de `channels` (195)

| Tipo | Qtd | Pertence a |
|------|-----|-----------|
| `flow_sensor` | 88 | hidrômetros (`HIDR. …`) — a vazão |
| `presence_sensor` | 86 | "Energia" (estado dos hidrômetros/devices) |
| `lamp` | 21 | diversos (iluminação/auxiliar) |

> Os **medidores `3F` (282) não aparecem em `channels`** — leitura direto do slave (como em Benfica/Suzano).
> Só os `outlet` (hidrômetro/temp/diversos) têm linhas em `channels`.

---

## ⚠️ Inconsistências

1. `HIDE. SCRP300ABCDEFG` (416) — typo de `HIDR.`.
2. `Repetixor 02 (Trafo 03)` (350) — typo de `Repetidor`.
3. `SCRPAC-ER8( Caso Indefinido)` (175) — escada rolante não identificada.
4. **5 slaves sem nome** (351, 352, 353, 385, 387).
5. Multiplicador (` xNNN xNNNA`) **embutido no nome** em ~21 medidores — parseado pelo Node-RED
   (mesma lógica de `getMultiplier` dos transforms current/voltage/consumption). Padronizar caixa do `x`.

---

## Resumo por categoria

| Categoria | Slaves |
|-----------|--------|
| Energia — Medidores de Loja (3F) | 199 |
| Água — Hidrômetros | 96 |
| Temperatura (área comum) | 17 |
| Climatização — Casa AR | 17 |
| Escadas Rolantes | 16 |
| Climatização — Bombas CAG | 15 |
| Bombas Hidráulicas | 9 |
| Diversos / sem nome | 9 |
| Elevadores | 8 |
| Bombas de Incêndio | 6 |
| Entrada — Trafos | 6 |
| Climatização — Chillers | 3 |
| Outros 3F | 3 |
| **Total** | **404** |
