# Slaves Map — Central Maternidade (Souza Aguiar)

> Central: **Souza Aguiar — Maternidade Nova** (`cea3473b-6e46-4a2f-85b8-f228d2a8347a`)
> IPv6: `201:ce30:f047:7f02:a27c:cbac:ffb7:2b67`
> Total slaves: 40

---

## 1. Climatização — IR + Switch (ar-condicionado / fan-coil)

Pares IR (sensor infravermelho) + Swt (switch de controle) por ambiente.

| Slave ID | Nome         | Central                       | Slave ID | Nome      | Central                       | Ambiente   |
|----------|--------------|-------------------------------|----------|-----------|-------------------------------|------------|
| 25       | Ir 01        | Souza Aguiar — Maternidade    | 26       | Swt 01    | Souza Aguiar — Maternidade    | Quarto 01  |
| 17       | Ir 02        | Souza Aguiar — Maternidade    | 18       | Swt 02    | Souza Aguiar — Maternidade    | Quarto 02  |
| 4        | ir 05        | Souza Aguiar — Maternidade    | 5        | swt 05    | Souza Aguiar — Maternidade    | Quarto 05  |
| 6        | ir 06        | Souza Aguiar — Maternidade    | 7        | swt 06    | Souza Aguiar — Maternidade    | Quarto 06  |
| 23       | Ir 07        | Souza Aguiar — Maternidade    | 24       | Swt 07    | Souza Aguiar — Maternidade    | Quarto 07  |
| 12       | ir 08        | Souza Aguiar — Maternidade    | 13       | swt 08    | Souza Aguiar — Maternidade    | Quarto 08  |
| 14       | ir 09        | Souza Aguiar — Maternidade    | 16       | Swt 09    | Souza Aguiar — Maternidade    | Quarto 09  |
| 9        | ir 10        | Souza Aguiar — Maternidade    | —        | —         | —                             | Quarto 10  |
| 29       | Ir 12        | Souza Aguiar — Maternidade    | 30       | Swt 12    | Souza Aguiar — Maternidade    | Quarto 12  |
| 35       | Ir 13        | Souza Aguiar — Maternidade    | 36       | Swt 13    | Souza Aguiar — Maternidade    | Quarto 13  |
| 31       | Caixa 14     | Souza Aguiar — Maternidade    | 32       | Swt 14    | Souza Aguiar — Maternidade    | Quarto 14  |
| 33       | Ir 15        | Souza Aguiar — Maternidade    | 34       | Swt 15    | Souza Aguiar — Maternidade    | Quarto 15  |
| 1        | ir 16        | Souza Aguiar — Maternidade    | 2        | swt 16    | Souza Aguiar — Maternidade    | Quarto 16  |
| 3        | ir 17        | Souza Aguiar — Maternidade    | 37       | Swt 17    | Souza Aguiar — Maternidade    | Quarto 17  |

> Nota: Quarto 10 não tem Swt mapeado. Quarto 14 usa `Caixa 14` em vez de `Ir 14`.

---

## 2. Temperatura CO2 — Ativos (pós-fix)

| Slave ID | Nome                           | Central                    | Ambiente             | Obs                     |
|----------|--------------------------------|----------------------------|----------------------|-------------------------|
| 20       | Temp. Co2_Centro_Obstetrico_01 | Souza Aguiar — Maternidade | Centro Obstétrico 01 | Migrado de id=19        |
| 10       | Temp. Co2_Centro_Obstetrico_02 | Souza Aguiar — Maternidade | Centro Obstétrico 02 | Migrado de id=8         |
| 28       | Temp. Co2_Centro_Obstetrico_03 | Souza Aguiar — Maternidade | Centro Obstétrico 03 | Migrado de id=27        |
| 22       | Temp. Co2_UTI_Neonatal -4      | Souza Aguiar — Maternidade | UTI Neonatal         | Offset -4°C no nome — candidato a renomear |

---

## 3. Temperatura CO2 — Legados (pré-fix, renomeados com OLD-)

| Slave ID | Nome                                      | Central                    | Offset | Migrado para |
|----------|-------------------------------------------|----------------------------|--------|--------------|
| 19       | OLD-T.e.m.p. Co2_Centro_Obstetrico_01 -4 | Souza Aguiar — Maternidade | -4°C   | id=20        |
| 8        | OLD-T.e.m.p. Co2_Centro_Obstetrico_02 -3 | Souza Aguiar — Maternidade | -3°C   | id=10        |
| 27       | OLD-T.e.m.p. Co2_Centro_Obstetrico_03 -4 | Souza Aguiar — Maternidade | -4°C   | id=28        |

> SQL de renomeação: ver fix-temp-registry (rows 015, 016, 017).

---

## 4. Gases Medicinais

| Slave ID | Nome                                  | Central                    | Gás           | Range  | Fator  |
|----------|---------------------------------------|----------------------------|---------------|--------|--------|
| 38       | GAS Nitroso_Matern 132 700 x3.9       | Souza Aguiar — Maternidade | Óxido Nitroso | 0–700  | ×3.9   |
| 39       | GAS Vacuo_Maternidade 132 200 x0.378  | Souza Aguiar — Maternidade | Vácuo         | 0–200  | ×0.378 |
| 21       | GAS Co2_UTI_Neonatal 132 5000 x9.47   | Souza Aguiar — Maternidade | CO₂           | 0–5000 | ×9.47  |

> Formato: `GAS <tag> <addr_modbus> <range_max> <fator>` — addr=132 é o registrador Modbus de leitura bruta.

---

## 5. Controle / Sistema

| Slave ID | Nome      | Central                    | Função                            |
|----------|-----------|----------------------------|-----------------------------------|
| 40       | SWReboot  | Souza Aguiar — Maternidade | Reinicialização remota da central |

---

## 6. Sem nome (a identificar)

| Slave ID | Nome | Central                    | Obs             |
|----------|------|----------------------------|-----------------|
| 11       | —    | Souza Aguiar — Maternidade | Não identificado |
| 15       | —    | Souza Aguiar — Maternidade | Não identificado |

---

## Resumo por categoria

| Categoria              | Qtd    |
|------------------------|--------|
| IR (climatização)      | 14     |
| Switch (climatização)  | 13     |
| Caixa (climatização)   | 1      |
| Temp CO2 (ativos)      | 4      |
| Temp CO2 (legados OLD) | 3      |
| Gases medicinais       | 3      |
| Controle/Sistema       | 1      |
| Sem nome               | 2      |
| **Total**              | **40** |
