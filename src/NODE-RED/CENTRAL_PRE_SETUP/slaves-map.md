# Slaves Map — CENTRAL_PRE_SETUP (referência / pós Pre-Setup Constructor)

> Central de **pré-setup** (saída do Pre-Setup Constructor — ver `src/thingsboard/WIDGET/Pre-Setup-Constructor`).
> Total slaves: 45 · Total channels: 161
> Fonte: `logDatabase.log` (re-provisionada — ver nota abaixo)

> **Não é uma loja em produção** — é o resultado "limpo" de uma central recém-provisionada:
> todos `type=outlet`, **`version 1.0.0`**, `code` **vazio**, **mesmo `created_at`**
> (`2026-06-03 03:39:33`, criação em lote). Serve de **referência canônica** de nomenclatura
> (contraste com Benfica/Suzano, que têm nomes trocados).

> 🔄 **Mudança vs dump anterior (03:10:56 → 03:39:33):** os 3 canais `lamp CHECK …_Loja_*`
> dos `TEMP._Loja` (slaves 43/44/45) **foram removidos** → 164 → 161 channels. Os slaves
> de temperatura de loja agora ficam **sem canal**. O restante é idêntico.

---

## 🔑 Padrão de nomenclatura (canônico — RFC-0202)

Todo device segue: **`<PREFIXO_TIPO> <PLACA>_<Local>_<NN[_MM]>`**

- **PLACA** = identificador no formato **Mercosul** (`LLLDLDD`, ex. `LEN2C37`, `UBS5B38`) — gerado por
  `generateMercosulPlate()` (sem glifos ambíguos I/O/0/1). Ver `src/utils/device.ts`.
- **PREFIXO_TIPO** = `DEVICE_TYPE_PREFIX_MAP` (`src/utils/device.ts`):
  `TEMP.` → TERMOSTATO · `SCD` → CAIXA_D_AGUA · `SW` → switch/controle · `Hidro`/`PULSE_ON_POWER` → hidrômetro.
- **Local + NN_MM** = ambiente + pares de canais (ex. `QGBT_01_02`, `Splitao_15_16`).

> Aqui os nomes **batem** com a função (≠ Benfica/Suzano). É como uma central "deve" sair de fábrica.

Schema novo de `config` (v1.0.0):
- slave: `{"channelConfig":{"channelN":{"output":"HOLDING","pulses":1,"channel":N,"slaveId":id,"channel_type":"…"}}}`
- channel: `{"pulses":1,"remoteInput":true}` (entrada) · `{"pulses":1,"countingPulseOnPower":true}` (hidrômetro) · `{}` (saída lamp)

---

## 1. QGBT — Iluminação (Quadro Geral de Baixa Tensão)

6 slaves, cada um com 4 canais: 2× `lamp Iluminacao` + 2× `presence_sensor Auto.`

| Slave ID | Placa | addr (low/high) | Nome |
|----------|--------|-----------------|------|
| 1 | LEN2C37 | 1/248 | SW LEN2C37_QGBT_01_02 |
| 2 | UBS5B38 | 2/248 | SW UBS5B38_QGBT_03_04 |
| 3 | PCH3T82 | 3/248 | SW PCH3T82_QGBT_05_06 |
| 4 | UDH2U82 | 4/248 | SW UDH2U82_QGBT_07_08 |
| 5 | HBT4K84 | 5/248 | SW HBT4K84_QGBT_09_10 |
| 6 | TDU6T43 | 6/248 | SW TDU6T43_QGBT_11_12 |

---

## 2. Climatização — Splits (controle / iluminação)

11 slaves (Splitão 01–22), cada um 2× `lamp Iluminacao` + 2× `presence Auto.`

| Slave ID | Placa | addr | Nome |
|----------|--------|------|------|
| 7  | UUW5M33 | 7/248  | SW UUW5M33_Splitao_01_02 |
| 8  | UBV5R87 | 8/248  | SW UBV5R87_Splitao_03_04 |
| 9  | QUQ7K54 | 9/248  | SW QUQ7K54_Splitao_05_06 |
| 10 | YHC6S97 | 10/248 | SW YHC6S97_Splitao_07_08 |
| 11 | ZQK3D84 | 11/248 | SW ZQK3D84_Splitao_09_10 |
| 12 | LER8B37 | 12/248 | SW LER8B37_Splitao_11_12 |
| 13 | LYM9U93 | 13/248 | SW LYM9U93_Splitao_13_14 |
| 14 | CJR3B69 | 14/248 | SW CJR3B69_Splitao_15_16 |
| 15 | KYN7A97 | 15/248 | SW KYN7A97_Splitao_17_18 |
| 16 | FVD9B56 | 16/248 | SW FVD9B56_Splitao_19_20 |
| 17 | EZH8N93 | 17/248 | SW EZH8N93_Splitao_21_22 |

---

## 3. Climatização — Compressores (Status + Temperatura)

11 slaves (compressores dos splits 01–22), cada um 2× `plug SW …Status_Compressor` + 2× `outlet Temp.`.
⚠️ Aqui `Temp. <PLACA>_NN` é canal **`outlet`** de temperatura **por compressor** (não é device separado).

| Slave ID | Placa | addr | Nome |
|----------|--------|------|------|
| 18 | FQN6E86 | 18/248 | SW FQN6E86_Status_Compressor_Splitao_01_02 |
| 19 | YPM8H43 | 19/248 | SW YPM8H43_Status_Compressor_Splitao_03_04 |
| 20 | FEH5A94 | 20/248 | SW FEH5A94_Status_Compressor_Splitao_05_06 |
| 21 | JKA4P77 | 21/248 | SW JKA4P77_Status_Compressor_Splitao_07_08 |
| 22 | EYS2Q88 | 22/248 | SW EYS2Q88_Status_Compressor_Splitao_09_10 |
| 23 | NND9W82 | 23/248 | SW NND9W82_Status_Compressor_Splitao_11_12 |
| 24 | GCG9F37 | 24/248 | SW GCG9F37_Status_Compressor_Splitao_13_14 |
| 25 | VBD2U43 | 25/248 | SW VBD2U43_Status_Compressor_Splitao_15_16 |
| 26 | MVA3G84 | 26/248 | SW MVA3G84_Status_Compressor_Splitao_17_18 |
| 27 | WJM7R33 | 27/248 | SW WJM7R33_Status_Compressor_Splitao_19_20 |
| 28 | RQR9K34 | 28/248 | SW RQR9K34_Status_Compressor_Splitao_21_22 |

---

## 4. QuadroLoja — Iluminação

4 slaves, 2× lamp + 2× presence cada.

| Slave ID | Placa | addr | Nome |
|----------|--------|------|------|
| 34 | ZAA6R65 | 34/248 | SW ZAA6R65_QuadroLoja_01_02 |
| 35 | YVM9Z77 | 35/248 | SW YVM9Z77_QuadroLoja_03_04 |
| 36 | CHD5R57 | 36/248 | SW CHD5R57_QuadroLoja_05_06 |
| 37 | GRV2R73 | 37/248 | SW GRV2R73_QuadroLoja_07_08 |

---

## 5. Depósitos / Logística / Exaustores (iluminação/automação)

2× lamp + 2× presence cada.

| Slave ID | Placa | addr | Nome | Área |
|----------|--------|------|------|------|
| 38 | XDN5R48 | 38/248 | SW XDN5R48_DepSubsolo_01_02 | Depósito Subsolo |
| 39 | WLC8Q83 | 39/248 | SW WLC8Q83_DepSubsolo_03_04 | Depósito Subsolo |
| 33 | HNZ5G97 | 33/248 | SW HNZ5G97_DepTerreo_01_02   | Depósito Térreo |
| 31 | WCY6S74 | 31/248 | SW WCY6S74_Logistica_01_02   | Logística |
| 32 | MHT7W55 | 32/248 | SW MHT7W55_Logistica_03_04   | Logística |
| 29 | DZL6R42 | 29/248 | SW DZL6R42_Exaustor_01_02    | Exaustor |
| 30 | GSM4Y26 | 30/248 | SW GSM4Y26_Exaustor_03_04    | Exaustor |

---

## 6. Água — Hidrômetro / SCD

| Slave ID | Placa | addr | Nome | Canais |
|----------|--------|------|------|--------|
| 40 | ZFF4A49 | 40/248 | `SW ZFF4A49_Hidro` | `flow_sensor Hidro. …_Potavel` (ch1 **PULSE_ON_POWER**) + `presence Fonte` |
| 42 | TTE2A34 | 42/248 | `SCD TTE2A34_Reservatorio_01 132 160 x1.95` | `presence SCD …_Nivel` (só channel0) |

> **SCD** confirma o padrão `SCD <local> <offset> <height> x<fator>`: local=`TTE2A34_Reservatorio_01`
> (token único, sem espaço — exigência do parser), offset=`132`, height=`160`, fator=`1.95`.
> **Hidro** confirma o padrão hidrômetro: `channel1: PULSE_ON_POWER` + `flow_sensor` com `countingPulseOnPower`.

---

## 7. Gerador

| Slave ID | Placa | addr | Nome | Canais |
|----------|--------|------|------|--------|
| 41 | WEV9X74 | 41/248 | `SW WEV9X74_Gerador` | `presence …_Falha_Geral`, `presence …_Ligado_Desligado` |

---

## 8. Temperatura — Loja (`TEMP.` = TERMOSTATO)

`channels=2` declarado, mas **0 canais materializados** (nesta versão os `CHECK` foram removidos —
era a única diferença vs o dump de 03:10).

| Slave ID | Placa | addr | Nome | Canais |
|----------|--------|------|------|--------|
| 43 | PGG2J56 | 43/248 | `TEMP. PGG2J56_Loja_Frente` | — |
| 44 | SHU7J84 | 44/248 | `TEMP. SHU7J84_Loja_Meio`   | — |
| 45 | BZM9X84 | 45/248 | `TEMP. BZM9X84_Loja_Fundos` | — |

---

## Observações (vs centrais em produção)

1. **Tudo padronizado** — placas Mercosul (`generateMercosulPlate`) + prefixos (`DEVICE_TYPE_PREFIX_MAP`).
   Os nomes **batem** com a função; nada de "Termostato" que é compressor, nem "Lj" que é ventilação.
2. **`version 1.0.0`, `code` vazio, mesmo `created_at`** → central nova, ainda não "envelhecida" por edições manuais.
3. **`addr_low` = `id`** em todos (1→1, 2→2, …) e `addr_high=248` fixo — alocação sequencial do constructor.
4. Schema de `config` é o **novo** (`remoteInput`/`countingPulseOnPower`), não o legado `{"confirm":false}`.
5. `Temp.` aparece em **dois papéis**: device de temperatura de loja (slaves 43–45, prefixo `TEMP.`) e
   canal `outlet` de temperatura por compressor (seção 3) — não confundir.

---

## Resumo por categoria

| Categoria                              | Slaves |
|----------------------------------------|--------|
| QGBT — Iluminação                      | 6      |
| Climatização — Splits (controle)       | 11     |
| Climatização — Compressores (+Temp)    | 11     |
| QuadroLoja — Iluminação                | 4      |
| Depósitos / Logística / Exaustores     | 7      |
| Água (Hidrômetro + SCD)                | 2      |
| Gerador                                | 1      |
| Temperatura — Loja (TEMP.)             | 3      |
| **Total**                              | **45** |
