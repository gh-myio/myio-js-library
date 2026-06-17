# Slaves Map — Ilha Plaza AL1 (Soul Malls)

> Central: **Ilha Plaza AL1** · Gateway `81a60176-222c-4bb9-88f5-bc2b47802d82`
> IPv6: `200:dc42:651b:5ae5:338d:2b26:670d:34e6`
> Grupo: **Soul Malls** · Shopping: **Ilha Plaza Shopping**
> Total slaves: **24** · Total channels: **1** · Total ambients: **6** · Junction (`ambients_rfir_slaves_rel`): **23**
> Fonte: `logsMaps.log` (`\d` + `SELECT *` de ambients/junction/channels/slaves), capturado em **2026-06-17**.
> Dados estruturados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · [`ambients_slaves_rel.json`](ambients_slaves_rel.json).
> `version` de todos os slaves: **`6.0.0`** · `aggregate`: `t` em todos

> Status: **🟢 mapeado** (AL1 de 3: AL1/AL2/AL3).
>
> ⚠️ Apesar do nome "AL1", esta central lê medidores rotulados **(AL1)** e **(AL2)**
> nos nomes — o sufixo `(ALx)` indica a **ala física da loja**, não a central.
> Central de **lojas de shopping**: quase tudo é medidor de energia (`three_phase_sensor`, 19)
> + alguns **switches de reboot** (`outlet`, 5). **Sem água, sem temperatura, sem seletor.**

---

## 🔑 Padrões de nomenclatura

| Padrão | Tipo | Significado | Exemplo |
|--------|------|-------------|---------|
| `3F <Loja> N_<num>(ALx)` | three_phase_sensor | **Medidor de loja** (RFC-0128 = Lojas → `3F_MEDIDOR`) | `3F Light N_135(AL1)` |
| `N_<num>` (sufixo) | — | **Número da loja**; pode ser faixa (`N_107/108/109`) ou letras (`N_133A/B/C/D/E`) | `N_102/103/104` |
| `(AL1)` / `(AL2)` | — | **Ala física** da loja (caixa do `(al1)`/`(Al2)` inconsistente) | `(al1)`, `(Al2)` |
| `Sw Reboot <Lx>` / `Reboot <Lx>` | outlet | **Switch de reboot remoto** por loja/linha | `Sw Reboot L1 Ilha Plaza` |

> `code` segue o formato `00X-00X-00X-015` (medidores) / `…-012` (outlets de reboot).
> `clamp_type`: `0` na maioria; `1` (Drogasmil), `2` (CasaeVideo). Outlets têm `clamp_type` nulo.

---

## 1. Energia — Medidores de Loja (`3F …`)  · 19 slaves · `three_phase_sensor` · `3F_MEDIDOR`

| Slave ID | Nome | Loja (N_) | Ala | code | clamp_type | config |
|----------|------|-----------|-----|------|-----------:|--------|
| 1  | `3F 4cantos N_138` | 138 | — | 003-003-003-015 | 0 | — |
| 2  | `3F Vialaser N_137` | 137 | — | 002-002-002-015 | 0 | — |
| 3  | `3F DomettEstudoEstetica N111(al1)` | 111 | AL1 | 003-003-003-015 | 0 | — |
| 4  | `3F Light N_135(AL1)` | 135 | AL1 | 003-003-003-015 | 0 | — |
| 5  | `3F Ortobom N_107/108/109(AL1)` | 107–109 | AL1 | 002-002-002-015 | 0 | — |
| 6  | `3F PetBoutique N_105/106(AL1)` | 105/106 | AL1 | 002-002-002-015 | 0 | `config_clamp` confirmed |
| 7  | `3F Don HelioN_104(al1)` | 104 | AL1 | 002-002-002-015 | 0 | `tolerance:0, min_variance:5` + `config_clamp` |
| 8  | `3F Portuguesa N_102/103/104(AL1)` | 102–104 | AL1 | 003-003-003-015 | 0 | — |
| 9  | `3F ViverParque N_134/135/155/156/157(AL1)` | 134/135/155–157 | AL1 | 002-002-002-015 | 0 | **tem channel `lamp` "ignorar"** |
| 10 | `3F  FastandFurious N_154(AL1)` | 154 | AL1 | 002-002-002-015 | 0 | `config_clamp` · **espaço duplo no nome** |
| 11 | `3F CasaeVideo N_133A/B/C/D/E(AL1)` | 133A–E | AL1 | 002-002-002-015 | **2** | — |
| 12 | `3F EstiloNatural N_151(AL2)` | 151 | AL2 | 003-003-003-015 | 0 | — |
| 13 | `3F Conserte N_152(Al2)` | 152 | AL2 | 002-002-002-015 | 0 | caixa `(Al2)` |
| 14 | `3F LizFestaa N_121/122/123/124/125/126/127(AL1)` | 121–127 | AL1 | 002-002-002-015 | 0 | `config_clamp` |
| 15 | `3F CaliforniaCoffee N_147(AL1)` | 147 | AL1 | 002-002-002-015 | 0 | `config_clamp` |
| 16 | `3F ÓticasCarol N_114(AL2)` | 114 | AL2 | 002-002-002-015 | 0 | — |
| 17 | `3F semLoja N_136(AL2)` | 136 | AL2 | 002-002-002-015 | 0 | **"semLoja"** (vago) |
| 18 | `3F Drogasmil N_115/116/117(AL2)` | 115–117 | AL2 | 003-003-003-015 | **1** | — |
| 19 | `3F SantaCor N_101(AL1)` | 101 | AL1 | 003-003-003-015 | 0 | `tolerance:0, min_variance:5` |

> Distribuição por ala: **AL1** = 12 (3,4,5,6,7,8,9,10,11,14,15,19) · **AL2** = 5 (12,13,16,17,18) · **sem ala** = 2 (1,2).

---

## 2. Switch / BAS — Reboots remotos (`outlet`)  · 5 slaves

| Slave ID | Nome | code | config | Obs |
|----------|------|------|--------|-----|
| 20 | `Sw Reboot L1 Ilha Plaza` | 002-002-002-012 | — | reboot Loja/Linha 1 |
| 22 | `Reboot L2 Ilha Plaza` | 002-002-002-012 | — | reboot L2 |
| 23 | `reboot L1 L2` | 002-002-002-012 | — | reboot L1+L2 (caixa minúscula) |
| 24 | `Reboot L3` | 002-002-002-012 | 2× `channelConfig` `REMOTE_INPUT`/`HOLDING` (ch0, ch1) | reboot L3 |
| 25 | `Sw Reborn AL1` | 002-002-002-012 | — | **"Reborn"** = provável typo de "Reboot" |

> Estes `outlet` são **switches de reboot remoto** (REMOTE_INPUT/HOLDING). Não há `slave id 21` (gap).

---

## 3. Água — Hidrômetros

> **Nenhum** nesta central.

## 4. Temperatura — Termostatos

> **Nenhum** nesta central.

## 5. Seletor Auto/Manual (`SELETOR_AUTO_MANUAL`)

> **Nenhum** nesta central.

---

## Estrutura de `channels`  · 1 channel

| ID | type | channel | name | slave_id | Pertence a |
|----|------|---------|------|----------|-----------|
| 1 | `lamp` | 0 | `ignorar` | 9 | `3F ViverParque N_134/135/155/156/157(AL1)` |

> Único channel da central: um `lamp` chamado **"ignorar"** no slave 9 → deve ser **descartado** no transform.
> Os 19 medidores `3F` **não têm channel materializado** (leitura direto do slave, como em Benfica/Suzano/Rio Poty).

---

## Ambients e associação (`ambients_rfir_slaves_rel`)

> Nesta central a associação **slave ↔ ambient** é feita **exclusivamente** pela junction
> `ambients_rfir_slaves_rel` (PK `(slave_id, ambient_id)`, `created_at`/`updated_at` NOT NULL
> **sem default**). Todos os 6 ambients têm `config = NULL` — `hide_devices_v1` **não é usado aqui**.

| Ambient ID | Nome | Slaves vinculados | Qtd |
|-----------:|------|-------------------|----:|
| 34 | `AL1` | 1,2,3,4,5,6,7,8,9,10,11,12,13,14,16,17,18,19 | 18 |
| 36 | `reboot` | 20, 22, 23 | 3 |
| 35 | `Al1 Restaurante` | 15 (`3F CaliforniaCoffee N_147`) | 1 |
| 37 | `Reboot L3` | 25 (`Sw Reborn AL1`) | 1 |
| 1  | `Myio 34` | — | 0 |
| 38 | `Reboot 14/04/2026` | — | 0 |

> `AL1` (id 34) agrupa **18 dos 19 medidores 3F** — falta só o slave 15, que está em `Al1 Restaurante`.

---

## ⚠️ Inconsistências

1. **Mistura AL1/AL2 nos nomes** — a central "AL1" lê medidores rotulados `(AL1)` e `(AL2)`; o sufixo é a **ala da loja**, não a central. Padronizar entendimento.
2. **Caixa do sufixo de ala** inconsistente: `(AL1)`, `(al1)`, `(AL2)`, `(Al2)`.
3. **Espaço duplo** em `3F  FastandFurious N_154(AL1)` (slave 10).
4. **`Sw Reborn AL1`** (slave 25) — provável typo de "Reboot".
5. **`3F semLoja N_136(AL2)`** (slave 17) — nome vago ("sem loja").
6. **2 medidores sem sufixo de ala**: `3F 4cantos N_138` (1) e `3F Vialaser N_137` (2).
7. **Channel `lamp` "ignorar"** no slave 9 — placeholder a ser ignorado.
8. `N_<num>` ora com underscore (`N_135`), ora sem (`N111`, slave 3) — padronizar.
9. **Naming mismatch ambient × slave** — o ambient `Reboot L3` (id 37) contém o slave **25 (`Sw Reborn AL1`)**, e **não** o slave 24 (`Reboot L3`). O slave 24, por sua vez, **não está em nenhum ambient**.
10. **Slave órfão (sem ambient)**: `24` (`Reboot L3`) — não tem linha na junction. Vincular ao ambient correto (provavelmente `Reboot L3`/`reboot`).
11. **Ambients vazios**: `Myio 34` (id 1) e `Reboot 14/04/2026` (id 38) — candidatos a limpeza ou a receber vínculos.

---

## Resumo por categoria

| Categoria | Slaves |
|-----------|--------|
| Energia — Medidores de Loja (3F) | 19 |
| Switch — Reboots remotos (outlet) | 5 |
| **Total** | **24** |

| Métrica | Valor |
|---------|-------|
| `three_phase_sensor` | 19 |
| `outlet` | 5 |
| `channels` (1 `lamp` "ignorar") | 1 |
| `version` (todos) | `6.0.0` |
