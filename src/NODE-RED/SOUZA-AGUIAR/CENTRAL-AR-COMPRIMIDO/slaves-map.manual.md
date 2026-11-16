# Slaves Map — Central Ar Comprimido (Souza Aguiar)

> Central: **Souza Aguiar — Ar Comprimido** (`200:4dbc:14be:a704:6904:81cd:b62a:ab22`)
> IPv6: `200:4dbc:14be:a704:6904:81cd:b62a:ab22`
> Total slaves: 14

---

## 1. Gases Medicinais

Formato: `GAS <tag> <addr_modbus> <range_max> <fator>` — addr=132 = registrador Modbus de leitura bruta.

| Slave ID | Nome                                    | Central                      | Gás           | Local          | Range | Fator  |
|----------|-----------------------------------------|------------------------------|---------------|----------------|-------|--------|
| 1        | GAS Ar_comprimido_SH_Matern 132 700 x1.97 | Souza Aguiar — Ar Comprimido | Ar Comprimido | SH / Maternidade | 0–700 | ×1.97  |
| 5        | GAS Nitroso_SH 132 700 x1.97            | Souza Aguiar — Ar Comprimido | Óxido Nitroso | SH             | 0–700 | ×1.97  |
| 4        | GAS Oxigênio_SH 132 700 x1.97           | Souza Aguiar — Ar Comprimido | Oxigênio      | SH             | 0–700 | ×1.97  |
| 6        | GAS Ar_comprimido_CER 132 700 x1.97     | Souza Aguiar — Ar Comprimido | Ar Comprimido | CER            | 0–700 | ×1.97  |
| 9        | GAS Oxigênio_CER 132 700 x1.97          | Souza Aguiar — Ar Comprimido | Oxigênio      | CER            | 0–700 | ×1.97  |
| 7        | GAS Vacuo_CER 132 200 x0.378            | Souza Aguiar — Ar Comprimido | Vácuo         | CER            | 0–200 | ×0.378 |
| 8        | GAS Vacuo_SouzaAguiar 132 200 x0.378    | Souza Aguiar — Ar Comprimido | Vácuo         | Souza Aguiar   | 0–200 | ×0.378 |

> **SH** = Complexo Hospitalar Souza Aguiar (prédio principal)
> **CER** = Centro de Especialidades e Reabilitação

---

## 2. Sensores de Vazão — SCD (Sensor Contador D'água)

| Slave ID | Nome                                    | Central                      | Local                    | Addr | Range | Fator   |
|----------|-----------------------------------------|------------------------------|--------------------------|------|-------|---------|
| 14       | SCD MaternidadeCisterna1 1350 244 x0.2705 | Souza Aguiar — Ar Comprimido | Maternidade — Cisterna 1 | 1350 | 244   | ×0.2705 |
| 13       | SCD MaternidadeCisterna2 1064 244 x0.2705 | Souza Aguiar — Ar Comprimido | Maternidade — Cisterna 2 | 1064 | 244   | ×0.2705 |

---

## 3. Hidrômetro

| Slave ID | Nome                           | Central                      | Local                    | Obs         |
|----------|--------------------------------|------------------------------|--------------------------|-------------|
| 12       | Hdr. Cisterna2_Maternidade x1  | Souza Aguiar — Ar Comprimido | Maternidade — Cisterna 2 | Fator ×1    |

---

## 4. Switches (QTA — Quadro de Tomadas de Ar?)

| Slave ID | Nome                  | Central                      | Função                          |
|----------|-----------------------|------------------------------|---------------------------------|
| 2        | Sw QTA 1 Maternidade  | Souza Aguiar — Ar Comprimido | Controle QTA 1 — Maternidade    |
| 3        | Sw QTA 2 Matern.      | Souza Aguiar — Ar Comprimido | Controle QTA 2 — Maternidade    |

---

## 5. Temperatura CO2

| Slave ID | Nome                       | Central                      | Local | Offset | Obs                              |
|----------|----------------------------|------------------------------|-------|--------|----------------------------------|
| 10       | OLD-T.e.m.p. Co2_Medicacao_CER -6 | Souza Aguiar — Ar Comprimido | CER — Sala Medicação | -6°C | Legado pré-fix — migrado para id=11 |
| 11       | Temp. Co2_Medicacao_CER    | Souza Aguiar — Ar Comprimido | CER — Sala Medicação | —    | Ativo pós-fix (row_014 no fix-temp-registry) |

> `OLD-T.e.m.p. Co2_Medicacao_CER -6` (id=10) → renomeado após migração para id=11.
> SQL de renomeação: ver fix-temp-registry **row_014**.

---

## Resumo por categoria

| Categoria         | Qtd    |
|-------------------|--------|
| Gases medicinais  | 7      |
| SCD (vazão)       | 2      |
| Hidrômetro        | 1      |
| Switches (QTA)    | 2      |
| Temperatura CO2   | 2      |
| **Total**         | **14** |
