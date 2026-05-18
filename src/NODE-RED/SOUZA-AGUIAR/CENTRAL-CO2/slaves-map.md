# Slaves Map — Central CO2 (Souza Aguiar)

> Central: **Souza Aguiar — CO2** (`295628b1-75c6-4854-8031-107cd9a2ab91`)
> IPv6: `201:3941:4753:9232:901b:19fa:4978:51aa`
> Total slaves: 73 | Total channels: 61
> Snapshot DB: 2026-05-15

---

## Convenções de Type / Code

| Type       | Code            | Versão | Significado                                        |
|------------|-----------------|--------|----------------------------------------------------|
| `infrared` | `002-002-002-014` | 7.0.0  | Sensor de temperatura (Temp original / OLD- / Repetidor) |
| `outlet`   | `002-002-002-012` | 6.0.0  | Sensor GAS / Temp já migrado (ex-GAS) / novos          |
| `outlet`   | `003-003-003-012` | 6.0.0  | ⚠️ Anômalo — usado apenas no slave 145 (GAS Sala Vermelha Adulto) |

> **Regra prática**: após migrar GAS → Temp, o slave fica **`outlet`** (mantém código `002-002-002-012`). Os Temp ainda com offset são todos **`infrared`** (sensores originais).

---

## 1. Temperatura CO2 — Ativos, já renomeados (sem offset no nome)

Slaves cujo fix-temp-registry já foi concluído: histórico migrado, OLD renomeado, slave novo sem offset.

| Slave ID | Type   | Addr (low,high) | Nome                            | Ambiente             | fix-temp row | Migrado de |
|----------|--------|-----------------|---------------------------------|----------------------|--------------|------------|
| 76       | outlet | 217, 249        | Temp. Co2_Cirurgia1             | Centro Cirúrgico 01  | row_001      | id=75      |
| 110      | outlet | 182, 249        | Temp. CO2_CC02                  | Centro Cirúrgico 02  | row_002      | id=111     |
| 52       | outlet | 34, 249         | Temp. Co2_CC_03                 | Centro Cirúrgico 03  | row_003      | id=53      |
| 114      | outlet | 26, 248         | Temp. Co2_CC05                  | Centro Cirúrgico 05  | row_004      | id=115     |
| 107      | outlet | 85, 249         | Temp. Co2_Cirurgia06            | Centro Cirúrgico 06  | row_005      | id=106     |
| 64       | outlet | 89, 249         | Temp. Co2_Cirurgia7             | Centro Cirúrgico 07  | row_006 / row_007 | id=63 / id=158 |
| 50       | outlet | 169, 249        | Temp. Co2_Cirurgia8             | Centro Cirúrgico 08  | row_008      | id=143     |
| 54       | outlet | 98, 249         | Temp. Co2_Cirurgia9             | Centro Cirúrgico 09  | row_009      | id=155     |
| 108      | outlet | 91, 248         | Temp. CO2_RPA                   | RPA                  | row_010      | id=109     |
| 112      | outlet | 190, 248        | Temp. CO2_CC10                  | Centro Cirúrgico 10  | row_011      | id=113     |
| 79       | outlet | 31, 248         | Temp. Co2_Laboratorio           | Laboratório          | row_012      | id=80      |
| 127      | outlet | 67, 248         | Temp. Co2_CTI_03                | CTI 03               | row_013      | id=128     |
| 122      | outlet | 176, 248        | Temp. Co2_CME_SL01              | CME — SL01           | batch3_001   | id=121     |
| 123      | outlet | 108, 249        | Temp. Co2_CME_SL02              | CME — SL02           | batch3_002 (0 rows) | id=124 |
| 151      | outlet | 87, 248         | Temp. Co2_Queimados             | Queimados            | batch3_003   | id=150     |
| 87       | outlet | 242, 249        | Temp. Co2_CTI_01                | CTI 01               | batch4 (sem log) | id=88   |
| 45       | outlet | 246, 248        | Temp. Co2_Cirurgia4             | Centro Cirúrgico 04  | batch4 (sem log) | id=44   |
| 152      | outlet | 179, 249        | Temp. Co2_CTI_02                | CTI 02               | batch4 (sem log) | id=144  |
| 91       | outlet | 141, 248        | Temp. Co2_CTI_04                | CTI 04               | batch4 (sem log) | id=84   |
| 104      | outlet | 40, 249         | Temp. Co2_Raiox3                | Raio-X 03            | batch4 (sem log) | id=105  |
| 100      | outlet | 79, 248         | Temp. Co2_Raiox4                | Raio-X 04            | batch4 (sem log) | id=99   |
| 133      | outlet | 135, 248        | Temp. Co2_Tomografia            | Tomografia           | batch4 (sem log) | id=132  |
| 102      | outlet | 31, 249         | Temp. Co2_Raiox1                | Raio-X 01            | batch4 (sem log) | id=103  |
| 131      | outlet | 126, 249        | Temp. Co2_Hemodialise           | Hemodiálise          | batch4 (sem log) | id=130  |
| 138      | outlet | 132, 249        | Temp. Co2_Agencia_Transfusional | Agência Transfusional | batch4 (sem log) | id=137 |

> ℹ️ **batch4 (sem log)**: 10 ambientes acima foram migrados entre `2026-05-12` (último log: batch3) e `2026-05-15` (snapshot). Não há SQL/log de execução no repo — `updated_at` dos slaves indica datas reais (87 em 2026-04-02, 45 em 2026-04-02, 152 em 2026-04-02, etc.) sugerindo que migrações foram **antes do batch3 do CME/Queimados**. Reordenar log se necessário.

---

## 2. Temperatura CO2 — Ativos, com offset (candidatos a fix-temp-registry)

| Slave ID | Type     | Addr (low,high) | Nome                                | Ambiente                  | Offset |
|----------|----------|-----------------|-------------------------------------|---------------------------|--------|
| 74       | infrared | 18, 249         | Temp. Co2_Sala_Vermelha_Adulto -8   | Sala Vermelha Adulto      | -8°C   |
| 135      | infrared | 104, 249        | Temp. Co2_Sala_Vermelha_Infantil -8 | Sala Vermelha Infantil    | -8°C   |
| 126      | infrared | 21, 249         | Temp. Co2_CTI_Pediatrico -6         | CTI Pediátrico            | -6°C   |
| 149      | infrared | 5, 248          | Temp. Co2_CAF -7                    | CAF                       | -7°C   |
| 140      | infrared | 22, 249         | Temp. Co2_Farmácia_Satelite -7      | Farmácia Satélite         | -7°C   |
| 101      | infrared | 39, 248         | Temp. Co2_Raiox2 -3                 | Raio-X 02                 | -3°C   |

---

## 3. GAS CO2 — Sensores Brutos (remanescentes)

| Slave ID | Type   | Addr (low,high) | Nome                                          | Ambiente               | Range | Fator  |
|----------|--------|-----------------|-----------------------------------------------|------------------------|-------|--------|
| 145      | outlet | 117, 249        | GAS Co2_Sala_Vermelha_Adulto 132 5000 x9.47   | Sala Vermelha Adulto   | 5000  | ×9.47  |
| 134      | outlet | 17, 249         | GAS Co2_Sala_Vermelha_Infantil 132 5000 x9.47 | Sala Vermelha Infantil | 5000  | ×9.47  |
| 125      | outlet | 32, 249         | GAS Co2_CTI_Pediatrico 132 5000 x9.47         | CTI Pediátrico         | 5000  | ×9.47  |
| 148      | outlet | 36, 248         | GAS Co2_CAF 132 5000 x9.47                    | CAF                    | 5000  | ×9.47  |
| 141      | outlet | 234, 248        | Gas Co2_Farmácia_Satelite 132 5000 x9.47      | Farmácia Satélite      | 5000  | ×9.47  |
| 98       | outlet | 102, 249        | GAS Co2_Raio-X2 132 5000 x9.47                | Raio-X 02              | 5000  | ×9.47  |

> ⚠️ Slave **145** tem `code = 003-003-003-012` (todos os demais GAS são `002-002-002-012`). Verificar se afeta migração.

> ✅ **Pares prontos para o próximo batch (substituição GAS → Temp)**:
> - 74 ← 145 (Sala Vermelha Adulto, -8°C) ⚠️ code anômalo no 145
> - 135 ← 134 (Sala Vermelha Infantil, -8°C)
> - 126 ← 125 (CTI Pediátrico, -6°C)
> - 149 ← 148 (CAF, -7°C)
> - 140 ← 141 (Farmácia Satélite, -7°C)
> - 101 ← 98 (Raio-X 02, -3°C) — slave 98 já tem channel `Check ch=0` (id=24)

---

## 4. Temperatura CO2 — Legados (pré-fix, renomeados com OLD-)

Todos `type=infrared`, `code=002-002-002-014`, `version=7.0.0`.

| Slave ID | Addr (low,high) | Nome                                            | Offset | Migrado para | fix-temp row    |
|----------|-----------------|-------------------------------------------------|--------|--------------|-----------------|
| 75       | 130, 248        | OLD-T.e.m.p. Co2_Cirurgia1 -3                   | -3°C   | id=76        | row_001         |
| 111      | 144, 248        | OLD-T.e.m.p. CO2_CC02 -5                        | -5°C   | id=110       | row_002         |
| 53       | 237, 249        | OLD-T.e.m.p. Co2_CC_03 -8                       | -8°C   | id=52        | row_003         |
| 115      | 164, 249        | OLD-T.e.m.p. Co2_CC05 -6                        | -6°C   | id=114       | row_004         |
| 106      | 106, 249        | OLD-T.e.m.p. Co2_Cirurgia06 -4                  | -4°C   | id=107       | row_005         |
| 63       | 96, 248         | OLD-T.e.m.p. Co2_Cirurgia7 -2                   | -2°C   | id=64        | row_006         |
| 158      | 143, 249        | OLD-T.e.m.p. Co2_Cirurgia7_Apos_04_Fev_2026 -4  | -4°C   | id=64        | row_007         |
| 143      | 33, 248         | OLD-T.e.m.p. Co2_Cirurgia8 -3                   | -3°C   | id=50        | row_008         |
| 155      | 241, 248        | OLD-T.e.m.p. Co2_Cirurgia9 -3                   | -3°C   | id=54        | row_009         |
| 109      | 111, 248        | OLD-T.e.m.p. CO2_RPA -8                         | -8°C   | id=108       | row_010         |
| 113      | 92, 249         | OLD-T.e.m.p. CO2_CC10 -5                        | -5°C   | id=112       | row_011         |
| 80       | 251, 249        | OLD-T.e.m.p. Co2_Laboratorio -6                 | -6°C   | id=79        | row_012         |
| 128      | 123, 249        | OLD-T.e.m.p. Co2_CTI_03 -9                      | -9°C   | id=127       | row_013         |
| 121      | 84, 249         | OLD-T.e.m.p. Co2_CME_SL01 -6                    | -6°C   | id=122       | batch3_001      |
| 124      | 71, 248         | OLD-T.e.m.p. Co2_CME_SL02 -7                    | -7°C   | id=123       | batch3_002 (0 rows) |
| 150      | 158, 249        | OLD-T.e.m.p. Co2_Queimados -4                   | -4°C   | id=151       | batch3_003      |
| 88       | 9, 248          | OLD-T.e.m.p. Co2_CTI_01 -2                      | -2°C   | id=87        | batch4 (sem log) |
| 44       | 254, 249        | OLD-T.e.m.p. Co2_Cirurgia4 -7                   | -7°C   | id=45        | batch4 (sem log) |
| 144      | 56, 248         | OLD-T.e.m.p. Co2_CTI_02 -4                      | -4°C   | id=152       | batch4 (sem log) |
| 84       | 33, 249         | OLD-T.e.m.p. Co2_CTI_04 -5                      | -5°C   | id=91        | batch4 (sem log) |
| 105      | 16, 248         | OLD-T.e.m.p. Co2_Raiox3 -4                      | -4°C   | id=104       | batch4 (sem log) |
| 99       | 172, 249        | OLD-T.e.m.p. Co2_Raiox4 -5                      | -5°C   | id=100       | batch4 (sem log) |
| 132      | 223, 248        | OLD-T.e.m.p. Co2_Tomografia -6                  | -6°C   | id=133       | batch4 (sem log) |
| 103      | 118, 248        | OLD-T.e.m.p. Co2_Raiox1 -5                      | -5°C   | id=102       | batch4 (sem log) |
| 130      | 211, 248        | OLD-T.e.m.p. Co2_Hemodialise -6                 | -6°C   | id=131       | batch4 (sem log) |
| 137      | 24, 249         | OLD-T.e.m.p. Co2_Agencia_Transfusional -5       | -5°C   | id=138       | batch4 (sem log) |

---

## 5. Repetidores / Mesh

Todos `type=infrared`, `code=002-002-002-014`.

| Slave ID | Addr (low,high) | Nome                          | Local                       |
|----------|-----------------|-------------------------------|-----------------------------|
| 146      | 251, 248        | Mesh Remote Cti 2°And.        | CTI — 2° Andar              |
| 147      | 21, 248         | Mesh Farmácia                 | Farmácia                    |
| 153      | 175, 248        | RM Repetidor Centro Cirúrgico | Centro Cirúrgico            |
| 159      | 65, 248         | Repetidor Queimados           | Queimados                   |

---

## 6. A identificar / Pendentes de classificação

| Slave ID | Type     | Addr (low,high) | Nome                            | Created    | Obs                                                       |
|----------|----------|-----------------|---------------------------------|------------|-----------------------------------------------------------|
| 156      | outlet   | 239, 248        | Lactário                        | 2025-09-10 | Provável **GAS** Lactário (outlet) — sem prefixo          |
| 157      | infrared | 113, 248        | Lactário                        | 2025-09-10 | Provável **Temp** Lactário (infrared) — sem prefixo       |
| 160      | outlet   | 90, 248         | *(vazio)*                       | 2026-05-13 | Nome NULL — registro recém-criado, não configurado        |
| 161      | outlet   | 124, 249        | *(vazio)*                       | 2026-05-13 | Nome NULL — registro recém-criado, não configurado        |
| 162      | outlet   | 6, 249          | CTI Pediátrico_ sétimo-andar    | 2026-05-13 | Tem channel id=56 `lamp ch=0 Teste` — em configuração     |
| 164      | outlet   | 106, 248        | TEMP_FARMACIA-CAF               | 2026-05-13 | Tem channel id=57 `lamp ch=0 Teste` — em configuração     |

> ⚠️ ids 156/157 (Lactário): pelos types, 156 (outlet) deve ser GAS e 157 (infrared) deve ser Temp. Confirmar e renomear conforme padrão `GAS Co2_Lactario 132 5000 x9.47` + `Temp. Co2_Lactario -X`.
> ⚠️ id 163 ausente (provável DELETE).
> ⚠️ ids 160/161 com nome vazio — possíveis novos sensores ainda não nomeados. Os 4 novos slaves de 2026-05-13 sugerem **expansão da central** (2 ambientes novos: CTI Pediátrico 7º andar + Farmácia CAF).

---

## 7. Channels por Slave

Padrão observado para Temp migrados: `lamp ch=0 "Check"` + `lamp ch=1 "Check 2"`. Alguns possuem `presence_sensor "Energia"` extra (energia da central no ambiente).

### 7.1 Channels ativos (slaves migrados)

| Slave | Ambiente              | Channels (id · type · ch · name)                                                  |
|-------|-----------------------|-----------------------------------------------------------------------------------|
| 76    | Cirurgia 01           | 19 · lamp · 0 · Check Sala 01                                                     |
| 54    | Cirurgia 09           | 20 · lamp · 0 · Check Sala 09                                                     |
| 50    | Cirurgia 08           | 21 · lamp · 0 · Check Sala 08                                                     |
| 64    | Cirurgia 07           | 22 · lamp · 0 · Check Sala 07                                                     |
| 112   | CC 10                 | 30 · lamp · 0 · Check CC10                                                        |
| 110   | CC 02                 | 31 · lamp · 0 · Check                                                             |
| 52    | CC 03                 | 32 · lamp · 0 · Check · 61 · lamp · 1 · check2                                    |
| 114   | CC 05                 | 33 · lamp · 0 · Check                                                             |
| 107   | Cirurgia 06           | 34 · lamp · 0 · Check                                                             |
| 108   | RPA                   | 35 · lamp · 0 · Check                                                             |
| 79    | Laboratório           | 36 · lamp · 0 · Check                                                             |
| 127   | CTI 03                | 37 · lamp · 0 · Check                                                             |
| 87    | CTI 01                | 38 · lamp · 0 · Check · 40 · presence · 0 · Energia · 60 · lamp · 1 · check2      |
| 45    | Cirurgia 04           | 39 · lamp · 0 · Check                                                             |
| 152   | CTI 02                | 29 · lamp · 0 · Check · 45 · lamp · 1 · Check 2                                   |
| 133   | Tomografia            | 41 · lamp · 0 · Check                                                             |
| 131   | Hemodiálise           | 42 · lamp · 0 · Check · 46 · lamp · 1 · Check 2                                   |
| 138   | Agência Transfusional | 43 · lamp · 0 · Check · 47 · lamp · 1 · Check2                                    |
| 91    | CTI 04                | 44 · lamp · 0 · Check                                                             |
| 123   | CME SL02              | 48 · presence · 0 · Energia · 49 · lamp · 0 · Check · 50 · lamp · 1 · Check 2     |
| 122   | CME SL01              | 51 · lamp · 0 · Check · 52 · lamp · 1 · Check2                                    |
| 151   | Queimados             | 54 · lamp · 0 · Check · 55 · lamp · 1 · Check 2                                   |
| 100   | Raio-X 04             | 25 · lamp · 0 · Check · 53 · lamp · 1 · Check2                                    |
| 104   | Raio-X 03             | 27 · lamp · 0 · Check · 58 · lamp · 1 · check2                                    |
| 102   | Raio-X 01             | 26 · lamp · 0 · Check · 59 · lamp · 1 · checl2 ⚠️ typo                            |

### 7.2 Channels em GAS pendentes

| Slave | Ambiente   | Channels                                              |
|-------|------------|-------------------------------------------------------|
| 98    | Raio-X 02  | 24 · lamp · 0 · Check (config `{"confirm":false}`)    |
| 145   | Sala V. Adulto | (sem channels)                                    |
| 134   | Sala V. Infantil | (sem channels)                                  |
| 125   | CTI Pediátrico | (sem channels)                                    |
| 148   | CAF        | (sem channels)                                        |
| 141   | Farmácia Satélite | (sem channels)                                 |

### 7.3 Channels em novos slaves (2026-05-13)

| Slave | Nome                        | Channels                                  |
|-------|-----------------------------|-------------------------------------------|
| 162   | CTI Pediátrico_ sétimo-andar | 56 · lamp · 0 · Teste                    |
| 164   | TEMP_FARMACIA-CAF           | 57 · lamp · 0 · Teste                     |

### 7.4 Channels órfãos / lixo (slave_id NULL)

20 channels sem `slave_id` (ids: 1–18, 23, 28) — registros legados/teste do período 2023-2024. Candidatos a **limpeza opcional** via `DELETE FROM channels WHERE slave_id IS NULL`.

---

## Resumo por categoria

| Categoria                                    | Qtd    |
|----------------------------------------------|--------|
| Temp CO2 ativos (sem offset)                 | 25     |
| Temp CO2 ativos (com offset — pendentes fix) | 6      |
| GAS CO2 (brutos remanescentes)               | 6      |
| Temp CO2 legados (OLD-)                      | 26     |
| Repetidores / Mesh                           | 4      |
| A identificar                                | 6      |
| **Total slaves**                             | **73** |
| Channels com slave_id válido                 | 41     |
| Channels órfãos (slave_id NULL)              | 20     |
| **Total channels**                           | **61** |

---

## Observações para o próximo batch (migração GAS → Temp)

Quando migrar um par GAS → Temp, lembrar de:

1. **Histórico**: `UPDATE temperature_history SET slave_id = <novo>, value = value + (<offset>)` em 2 passes (0-30d, 30-90d).
2. **Slaves**: Renomear OLD-T.e.m.p. (antigo infrared) + Temp. Co2_* (novo outlet).
3. **Channels**: Após migração, criar/atualizar canais `Check ch=0` + `Check 2 ch=1` no slave novo (outlet). Verificar se já existe channel antigo no slave (ex.: 98 já tem channel id=24).
4. **Config JSON**: Slaves migrados ganham `config_temperature` + `channelConfig` no `slaves.config`. Replicar padrão.
5. **Atenção ao slave 145** (Sala Vermelha Adulto): `code=003-003-003-012` diverge do padrão `002-002-002-012`. Validar comportamento antes da migração.
