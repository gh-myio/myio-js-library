# Slaves Map — Central T&D (Souza Aguiar)

> Central: **Souza Aguiar — T&D** (`df3f846e-b69c-45ce-9475-bd90570b24d0`)
> IPv6: `202:1d97:2112:f9b9:cfcb:e237:5dc:a3f7`
> Total slaves: 27

---

## 1. Sensores de Vazão — SCD (Sensor Contador D'água)

Formato do nome: `SCD <local> <addr_modbus> <range_max> <fator>`
Fator padrão: `×0.2705` (converte leitura bruta em m³/h ou similar).

| Slave ID | Nome                                         | Central             | Local                        | Addr  | Range | Fator   |
|----------|----------------------------------------------|---------------------|------------------------------|-------|-------|---------|
| 35       | SCD 8.1Caixad´agua 496 150 X0.2705           | Souza Aguiar — T&D  | Bloco 8 — Caixa d'água 1     | 496   | 150   | ×0.2705 |
| 48       | SCD 8.2Caixad´agua 496 150 X0.2705           | Souza Aguiar — T&D  | Bloco 8 — Caixa d'água 2     | 496   | 150   | ×0.2705 |
| 37       | SCD 5.1-SH 518 145 X0.2705                   | Souza Aguiar — T&D  | Bloco 5 — Piso 1 (SH)        | 518   | 145   | ×0.2705 |
| 61       | SCD 5.2-SH 1730 133 X0.2705                  | Souza Aguiar — T&D  | Bloco 5 — Piso 2 (SH)        | 1730  | 133   | ×0.2705 |
| 41       | SCD PrédioRegulador 1526 150 X0.275          | Souza Aguiar — T&D  | Prédio Regulador             | 1526  | 150   | ×0.275  |
| 53       | SCD Regulação 1162 210 x0.2705               | Souza Aguiar — T&D  | Regulação                    | 1162  | 210   | ×0.2705 |
| 42       | SCD MaternidadeCisterna 915 244 X0.2705      | Souza Aguiar — T&D  | Maternidade — Cisterna       | 915   | 244   | ×0.2705 |
| 43       | SCD MaternidadeCaixadagua 1264 210 X0.2705   | Souza Aguiar — T&D  | Maternidade — Caixa d'água   | 1264  | 210   | ×0.2705 |
| 57       | SCD Cisterna2_Maternidade 785 150 x0.2705    | Souza Aguiar — T&D  | Maternidade — Cisterna 2     | 785   | 150   | ×0.2705 |
| 49       | SCD Cisterna1_SouzaAguiar 1390 410 x0.2705   | Souza Aguiar — T&D  | Souza Aguiar — Cisterna 1    | 1390  | 410   | ×0.2705 |
| 47       | SCD Cisterna2_SouzaAguiar 1872 410 x0.2705   | Souza Aguiar — T&D  | Souza Aguiar — Cisterna 2    | 1872  | 410   | ×0.2705 |
| 44       | SCD CentrroMédico_Caixad´agua 1474 200 X0.2705 | Souza Aguiar — T&D | Centro Médico — Caixa d'água | 1474  | 200   | ×0.2705 |

---

## 2. Hidrômetros

| Slave ID | Nome                        | Central            | Local                  |
|----------|-----------------------------|--------------------|------------------------|
| 56       | Hidrometro (Cisternas 1/2)  | Souza Aguiar — T&D | Cisternas 1 e 2        |
| 60       | Hidrometro Upa              | Souza Aguiar — T&D | UPA                    |

---

## 3. Switches (Sw)

| Slave ID | Nome                      | Central            | Função                           |
|----------|---------------------------|--------------------|----------------------------------|
| 50       | Sw Hidrômetro Cisterna 1  | Souza Aguiar — T&D | Controle hidrômetro cisterna 1   |
| 51       | Sw Hidrômetro Cisterna 2  | Souza Aguiar — T&D | Controle hidrômetro cisterna 2   |
| 54       | Sw Hidrômetro Regulação   | Souza Aguiar — T&D | Controle hidrômetro regulação    |
| 62       | SW Chiller                | Souza Aguiar — T&D | Controle chiller                 |
| 52       | Sw Repetidor Regulação    | Souza Aguiar — T&D | Switch do repetidor de regulação |

---

## 4. Temperatura CO2

| Slave ID | Nome                        | Central            | Local    | Offset | Obs                        |
|----------|-----------------------------|--------------------|----------|--------|----------------------------|
| 63       | GAS Co2_Lactareo 132 5000 x9.47 | Souza Aguiar — T&D | Lactário | —      | Leitura bruta CO₂, addr=132, range=5000 |
| 64       | Temp. Co2_Lactareo -6       | Souza Aguiar — T&D | Lactário | -6°C   | Candidato a fix-temp-registry |

> `Temp. Co2_Lactareo -6` tem o offset no nome — candidato a renomear via fix-temp-registry (criar nova OS para Lactário).

---

## 5. Repetidores

| Slave ID | Nome                            | Central            | Local                    |
|----------|---------------------------------|--------------------|--------------------------|
| 39       | Repetidor Maternidade(Terraço)  | Souza Aguiar — T&D | Maternidade — Terraço    |
| 45       | Repetidor Maternidade(Térreo)   | Souza Aguiar — T&D | Maternidade — Térreo     |
| 40       | Repetidor Predio Regulador(Terraço) | Souza Aguiar — T&D | Prédio Regulador — Terraço |
| 38       | Repetidor Terraço(8°)           | Souza Aguiar — T&D | Terraço do 8° andar      |
| 58       | Repetido 03                     | Souza Aguiar — T&D | Repetidor 03 (a identificar) |

---

## 6. Outros / A identificar

| Slave ID | Nome       | Central            | Obs                                        |
|----------|------------|--------------------|--------------------------------------------|
| 65       | Vigarista  | Souza Aguiar — T&D | Nome informal — provavelmente slave de teste/diagnóstico |

---

## Resumo por categoria

| Categoria            | Qtd |
|----------------------|-----|
| SCD (vazão)          | 12  |
| Hidrômetros          | 2   |
| Switches             | 5   |
| Temperatura CO2      | 2   |
| Repetidores          | 5   |
| A identificar        | 1   |
| **Total**            | **27** |
