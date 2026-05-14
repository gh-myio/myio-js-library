# Slaves Map — Central CO2 (Souza Aguiar)

> Central: **Souza Aguiar — CO2** (`295628b1-75c6-4854-8031-107cd9a2ab91`)
> IPv6: `201:3941:4753:9232:901b:19fa:4978:51aa`
> Total slaves: 69

---

## 1. Temperatura CO2 — Ativos, já renomeados (sem offset no nome)

Slaves cujo fix-temp-registry já foi concluído: histórico migrado, OLD renomeado, slave novo sem offset.

| Slave ID | Nome                    | Central               | Ambiente             | fix-temp row | Migrado de |
|----------|-------------------------|-----------------------|----------------------|--------------|------------|
| 76       | Temp. Co2_Cirurgia1     | Souza Aguiar — CO2    | Centro Cirúrgico 01  | row_001      | id=75      |
| 110      | Temp. CO2_CC02          | Souza Aguiar — CO2    | Centro Cirúrgico 02  | row_002      | id=111     |
| 52       | Temp. Co2_CC_03         | Souza Aguiar — CO2    | Centro Cirúrgico 03  | row_003      | id=53      |
| 114      | Temp. Co2_CC05          | Souza Aguiar — CO2    | Centro Cirúrgico 05  | row_004      | id=115     |
| 107      | Temp. Co2_Cirurgia06    | Souza Aguiar — CO2    | Centro Cirúrgico 06  | row_005      | id=106     |
| 64       | Temp. Co2_Cirurgia7     | Souza Aguiar — CO2    | Centro Cirúrgico 07  | row_006 / row_007 | id=63 / id=158 |
| 50       | Temp. Co2_Cirurgia8     | Souza Aguiar — CO2    | Centro Cirúrgico 08  | row_008      | id=143     |
| 54       | Temp. Co2_Cirurgia9     | Souza Aguiar — CO2    | Centro Cirúrgico 09  | row_009      | id=155     |
| 108      | Temp. CO2_RPA           | Souza Aguiar — CO2    | RPA                  | row_010      | id=109     |
| 112      | Temp. CO2_CC10          | Souza Aguiar — CO2    | Centro Cirúrgico 10  | row_011      | id=113     |
| 79       | Temp. Co2_Laboratorio   | Souza Aguiar — CO2    | Laboratório          | row_012      | id=80      |
| 127      | Temp. Co2_CTI_03        | Souza Aguiar — CO2    | CTI 03               | row_013      | id=128     |
| 122      | Temp. Co2_CME_SL01      | Souza Aguiar — CO2    | CME — SL01           | batch3_001   | id=121     |
| 123      | Temp. Co2_CME_SL02      | Souza Aguiar — CO2    | CME — SL02           | batch3_002 (0 rows) | id=124 |
| 151      | Temp. Co2_Queimados     | Souza Aguiar — CO2    | Queimados            | batch3_003   | id=150     |

---

## 2. Temperatura CO2 — Ativos, com offset no nome (candidatos a fix-temp-registry)

Slaves ativos que ainda carregam o offset na nomenclatura — cada um é candidato a nova OS no fix-temp-registry.

| Slave ID | Nome                               | Central            | Ambiente                  | Offset |
|----------|------------------------------------|--------------------|---------------------------|--------|
| 44       | Temp. Co2_Cirurgia4 -7             | Souza Aguiar — CO2 | Centro Cirúrgico 04       | -7°C   |
| 88       | Temp. Co2_CTI_01 -2                | Souza Aguiar — CO2 | CTI 01                    | -2°C   |
| 144      | Temp. Co2_CTI_02 -4                | Souza Aguiar — CO2 | CTI 02                    | -4°C   |
| 84       | Temp. Co2_CTI_04 -5                | Souza Aguiar — CO2 | CTI 04                    | -5°C   |
| 126      | Temp. Co2_CTI_Pediatrico -6        | Souza Aguiar — CO2 | CTI Pediátrico            | -6°C   |
| 74       | Temp. Co2_Sala_Vermelha_Adulto -8  | Souza Aguiar — CO2 | Sala Vermelha Adulto      | -8°C   |
| 135      | Temp. Co2_Sala_Vermelha_Infantil -8| Souza Aguiar — CO2 | Sala Vermelha Infantil    | -8°C   |
| 130      | Temp. Co2_Hemodialise -6           | Souza Aguiar — CO2 | Hemodiálise               | -6°C   |
| 137      | Temp. Co2_Agencia_Transfusional -5 | Souza Aguiar — CO2 | Agência Transfusional     | -5°C   |
| 149      | Temp. Co2_CAF -7                   | Souza Aguiar — CO2 | CAF                       | -7°C   |
| 140      | Temp. Co2_Farmácia_Satelite -7     | Souza Aguiar — CO2 | Farmácia Satélite         | -7°C   |
| 132      | Temp. Co2_Tomografia -6            | Souza Aguiar — CO2 | Tomografia                | -6°C   |
| 103      | Temp. Co2_Raiox1 -5                | Souza Aguiar — CO2 | Raio-X 01                 | -5°C   |
| 101      | Temp. Co2_Raio-X2 -3               | Souza Aguiar — CO2 | Raio-X 02                 | -3°C   |
| 105      | Temp. Co2_Raiox3 -4                | Souza Aguiar — CO2 | Raio-X 03                 | -4°C   |
| 99       | Temp. Co2_RaioX4 -5                | Souza Aguiar — CO2 | Raio-X 04                 | -5°C   |

---

## 3. GAS CO2 — Sensores Brutos

Formato: `GAS Co2_<local> <addr_modbus> <range_max> <fator>`
addr=132 = registrador Modbus; range=5000 (padrão), exceto CME SL02 (range=500).

| Slave ID | Nome                                       | Central            | Ambiente               | Range | Fator  |
|----------|--------------------------------------------|--------------------|------------------------|-------|--------|
| 45       | GAS Co2_Cirurgia4 132 5000 x9.47           | Souza Aguiar — CO2 | Centro Cirúrgico 04    | 5000  | ×9.47  |
| 87       | GAS Co2_CTI_01 132 5000 x9.47              | Souza Aguiar — CO2 | CTI 01                 | 5000  | ×9.47  |
| 152      | GAS Co2_CTI_02 132 5000 x9.47              | Souza Aguiar — CO2 | CTI 02                 | 5000  | ×9.47  |
| 91       | GAS Co2_CTI_04 132 5000 x9.47              | Souza Aguiar — CO2 | CTI 04                 | 5000  | ×9.47  |
| 125      | GAS Co2_CTI_Pediatrico 132 5000 x9.47      | Souza Aguiar — CO2 | CTI Pediátrico         | 5000  | ×9.47  |
| 145      | GAS Co2_Sala_Vermelha_Adulto 132 5000 x9.47 | Souza Aguiar — CO2 | Sala Vermelha Adulto  | 5000  | ×9.47  |
| 134      | GAS Co2_Sala_Vermelha_Infantil 132 5000 x9.47 | Souza Aguiar — CO2 | Sala Vermelha Infantil | 5000 | ×9.47 |
| 131      | GAS Co2_Hemodialise 132 5000 x9.47         | Souza Aguiar — CO2 | Hemodiálise            | 5000  | ×9.47  |
| 138      | GAS Co2_Agencia_Transfusional 132 5000 x9.47 | Souza Aguiar — CO2 | Agência Transfusional | 5000  | ×9.47  |
| 148      | GAS Co2_CAF 132 5000 x9.47                 | Souza Aguiar — CO2 | CAF                    | 5000  | ×9.47  |
| 141      | Gas Co2_Farmácia_Satelite 132 5000 x9.47   | Souza Aguiar — CO2 | Farmácia Satélite      | 5000  | ×9.47  |
| 133      | GAS Co2_Tomografia 132 5000 x9.47          | Souza Aguiar — CO2 | Tomografia             | 5000  | ×9.47  |
| 102      | Gas Co2_Raiox1 132 5000 x9.47              | Souza Aguiar — CO2 | Raio-X 01              | 5000  | ×9.47  |
| 98       | GAS Co2_Raio-X2 132 5000 x9.47             | Souza Aguiar — CO2 | Raio-X 02              | 5000  | ×9.47  |
| 104      | Gas Co2_Raiox3 132 5000 x9.47              | Souza Aguiar — CO2 | Raio-X 03              | 5000  | ×9.47  |
| 100      | Gas Co2_RaioX4 132 5000 x9.47              | Souza Aguiar — CO2 | Raio-X 04              | 5000  | ×9.47  |

---

## 4. Temperatura CO2 — Legados (pré-fix, renomeados com OLD-)

| Slave ID | Nome                                          | Central            | Offset | Migrado para | fix-temp row    |
|----------|-----------------------------------------------|--------------------|--------|--------------|-----------------|
| 75       | OLD-T.e.m.p. Co2_Cirurgia1 -3                 | Souza Aguiar — CO2 | -3°C   | id=76        | row_001         |
| 111      | OLD-T.e.m.p. CO2_CC02 -5                      | Souza Aguiar — CO2 | -5°C   | id=110       | row_002         |
| 53       | OLD-T.e.m.p. Co2_CC_03 -8                     | Souza Aguiar — CO2 | -8°C   | id=52        | row_003         |
| 115      | OLD-T.e.m.p. Co2_CC05 -6                      | Souza Aguiar — CO2 | -6°C   | id=114       | row_004         |
| 106      | OLD-T.e.m.p. Co2_Cirurgia06 -4                | Souza Aguiar — CO2 | -4°C   | id=107       | row_005         |
| 63       | OLD-T.e.m.p. Co2_Cirurgia7 -2                 | Souza Aguiar — CO2 | -2°C   | id=64        | row_006         |
| 158      | OLD-T.e.m.p. Co2_Cirurgia7_Apos_04_Fev_2026 -4 | Souza Aguiar — CO2 | -4°C | id=64        | row_007         |
| 143      | OLD-T.e.m.p. Co2_Cirurgia8 -3                 | Souza Aguiar — CO2 | -3°C   | id=50        | row_008         |
| 155      | OLD-T.e.m.p. Co2_Cirurgia9 -3                 | Souza Aguiar — CO2 | -3°C   | id=54        | row_009         |
| 109      | OLD-T.e.m.p. CO2_RPA -8                       | Souza Aguiar — CO2 | -8°C   | id=108       | row_010         |
| 113      | OLD-T.e.m.p. CO2_CC10 -5                      | Souza Aguiar — CO2 | -5°C   | id=112       | row_011         |
| 80       | OLD-T.e.m.p. Co2_Laboratorio -6               | Souza Aguiar — CO2 | -6°C   | id=79        | row_012         |
| 128      | OLD-T.e.m.p. Co2_CTI_03 -9                    | Souza Aguiar — CO2 | -9°C   | id=127       | row_013         |
| 121      | OLD-T.e.m.p. Co2_CME_SL01 -6                  | Souza Aguiar — CO2 | -6°C   | id=122       | batch3_001      |
| 124      | OLD-T.e.m.p. Co2_CME_SL02 -7                  | Souza Aguiar — CO2 | -7°C   | id=123       | batch3_002 (0 rows) |
| 150      | OLD-T.e.m.p. Co2_Queimados -4                 | Souza Aguiar — CO2 | -4°C   | id=151       | batch3_003      |

---

## 5. Repetidores / Mesh

| Slave ID | Nome                          | Central            | Local                       |
|----------|-------------------------------|--------------------|-----------------------------|
| 146      | Mesh Remote Cti 2°And.        | Souza Aguiar — CO2 | CTI — 2° Andar              |
| 147      | Mesh Farmácia                 | Souza Aguiar — CO2 | Farmácia                    |
| 153      | RM Repetidor Centro Cirúrgico | Souza Aguiar — CO2 | Centro Cirúrgico            |
| 159      | Repetidor Queimados           | Souza Aguiar — CO2 | Queimados                   |

---

## 6. A identificar

| Slave ID | Nome     | Central            | Obs                                              |
|----------|----------|--------------------|--------------------------------------------------|
| 156      | Lactário | Souza Aguiar — CO2 | Sem prefixo GAS/Temp — tipo desconhecido         |
| 157      | Lactário | Souza Aguiar — CO2 | Nome duplicado do id=156 — verificar qual é qual |

> ⚠️ ids 156 e 157 têm o mesmo nome `Lactário` — provável um é GAS e outro é Temp., mas sem prefixo. Verificar no banco.

---

## Resumo por categoria

| Categoria                          | Qtd    |
|------------------------------------|--------|
| Temp CO2 ativos (sem offset)       | 15     |
| Temp CO2 ativos (com offset — pendentes fix) | 16 |
| GAS CO2 (brutos)                   | 16     |
| Temp CO2 legados (OLD-)            | 16     |
| Repetidores / Mesh                 | 4      |
| A identificar                      | 2      |
| **Total**                          | **69** |
