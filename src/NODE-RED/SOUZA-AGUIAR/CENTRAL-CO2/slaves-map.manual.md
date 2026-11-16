# Slaves Map — Central CO2 (Souza Aguiar)

> Central: **Souza Aguiar — CO2** (`295628b1-75c6-4854-8031-107cd9a2ab91`)
> IPv6: `201:3941:4753:9232:901b:19fa:4978:51aa`
> Total slaves: 77 | Total channels: 72
> Snapshot DB: 2026-05-18 (`allSlaves.log` + dump de channels)

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
| 162      | outlet | 6, 249          | Temp. Co2_CTI_Pediatrico        | CTI Pediátrico       | batch5_001   | id=126 (novo HW) |
| 164      | outlet | 106, 248        | Temp. Co2_CAF                   | CAF                  | batch5_002   | id=149 (novo HW) |
| 165      | outlet | 128, 249        | Temp. Co2_Sala_Vermelha_Adulto  | Sala Vermelha Adulto | batch6_001   | id=74 (novo HW) |
| 134      | outlet | 17, 249         | Temp. Co2_Sala_Vermelha_Infantil | Sala Vermelha Infantil | batch6_002 | id=135 (ex-GAS) |
| 141      | outlet | 234, 248        | Temp. Co2_Farmácia_Satelite     | Farmácia Satélite    | batch6_003   | id=140 (ex-GAS) |

> ℹ️ **batch4 (sem log)**: 10 ambientes acima foram migrados entre `2026-05-12` (último log: batch3) e `2026-05-15` (snapshot). Não há SQL/log de execução no repo — `updated_at` dos slaves indica datas reais (87 em 2026-04-02, 45 em 2026-04-02, 152 em 2026-04-02, etc.) sugerindo que migrações foram **antes do batch3 do CME/Queimados**. Reordenar log se necessário.
>
> ℹ️ **batch5 (2026-05-15)**: CTI Pediátrico (id=126→162, -6°C) e CAF (id=149→164, -7°C) — primeiro batch usando **sensores novos físicos** ao invés de reaproveitar o GAS. SQL em `fix-temp-registry-batch5-2026-05-15.sql` (Pass 1) + `fix-temp-registry-batch5-pass2-2026-05-15.sql` (Pass 2). Log: `fix-temp-registry-execution-log-2026-05-15.md`.
>
> ℹ️ **batch6 (2026-05-18)**: estratégia mista — Sala V. Adulto (74→165) usou novo HW, Sala V. Infantil (135→134) e Farmácia Satélite (140→141) usaram GAS antigo. Rodado em one-shot 90 dias (não dividido em Pass 1+Pass 2). Total: **510.831 rows** migrados. SQL: `fix-temp-registry-batch6-2026-05-18.sql` + pass2. Log: `fix-temp-registry-execution-log-2026-05-18.md`.

---

## 2. Temperatura CO2 — Ativos, com offset (candidatos a fix-temp-registry)

| Slave ID | Type     | Addr (low,high) | Nome                                | Ambiente                  | Offset |
|----------|----------|-----------------|-------------------------------------|---------------------------|--------|
| 101      | infrared | 39, 248         | Temp. Co2_Raiox2 -3                 | Raio-X 02                 | -3°C   |

> ℹ️ Único pendente. Slaves 74, 135, 140 migrados via batch6 (2026-05-18).

---

## 3. GAS CO2 — Sensores Brutos (remanescentes)

| Slave ID | Type   | Addr (low,high) | Nome                                          | Ambiente               | Range | Fator  | Status                          |
|----------|--------|-----------------|-----------------------------------------------|------------------------|-------|--------|---------------------------------|
| 145      | outlet | 117, 249        | GAS Co2_Sala_Vermelha_Adulto 132 5000 x9.47   | Sala Vermelha Adulto   | 5000  | ×9.47  | **ÓRFÃO** (batch6 usou 165 novo HW) ⚠️ code 003 |
| 125      | outlet | 32, 249         | GAS Co2_CTI_Pediatrico 132 5000 x9.47         | CTI Pediátrico         | 5000  | ×9.47  | **ÓRFÃO** (batch5 usou 162)     |
| 148      | outlet | 36, 248         | GAS Co2_CAF 132 5000 x9.47                    | CAF                    | 5000  | ×9.47  | **ÓRFÃO** (batch5 usou 164)     |
| 98       | outlet | 102, 249        | GAS Co2_Raio-X2 132 5000 x9.47                | Raio-X 02              | 5000  | ×9.47  | Fica para batch7 (101 → 98)    |

> ℹ️ Slaves 134 e 141 saíram desta seção após batch6 — agora em seção 1 como Temp ativos sem offset.

> ⚠️ **GAS órfãos**: 3 slaves (145, 125, 148) sem destino — instalados em ambientes que escolheram outros caminhos (novo HW). Considerar desativação ou renomeação para `SPARE-` para sinalizar no UI.

> ⚠️ Slave **145** tem `code = 003-003-003-012` (todos os demais GAS são `002-002-002-012`). Verificar se afeta migração.
>
> ✅ **batch6 executado 2026-05-18** — 510.831 rows migrados (one-shot 90d):
> - 74 → **165** (Sala Vermelha Adulto, -8°C) — 165.284 rows
> - 135 → **134** (Sala Vermelha Infantil, -8°C) — 167.778 rows
> - 140 → **141** (Farmácia Satélite, -7°C) — 177.769 rows
>
> 📋 **Pendente (batch7)**:
> - 101 → 98 (Raio-X 02, -3°C) — sem novo HW, vai usar GAS 98
> - Lactário (156/157) — ainda a identificar

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
| 126      | 21, 249         | OLD-T.e.m.p. Co2_CTI_Pediatrico -6              | -6°C   | id=162       | batch5_001       |
| 149      | 5, 248          | OLD-T.e.m.p. Co2_CAF -7                         | -7°C   | id=164       | batch5_002       |
| 74       | 18, 249         | OLD-T.e.m.p. Co2_Sala_Vermelha_Adulto -8        | -8°C   | id=165       | batch6_001       |
| 135      | 104, 249        | OLD-T.e.m.p. Co2_Sala_Vermelha_Infantil -8      | -8°C   | id=134       | batch6_002       |
| 140      | 22, 249         | OLD-T.e.m.p. Co2_Farmácia_Satelite -7           | -7°C   | id=141       | batch6_003       |

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
| 161      | outlet   | 124, 249        | *(vazio)*                       | 2026-05-13 | Nome NULL — registro recém-criado, não configurado        |
| 160      | outlet   | 90, 248         | Temp Sala_vermelha_infantil     | 2026-05-13 (rename 2026-05-15) | **Instalado, não usado** (batch6 usou GAS 134) |
| 166      | outlet   | 160, 249        | Temp Sala_vermelha_infantil     | 2026-05-15 | **Instalado, não usado** (batch6 usou GAS 134) |
| 167      | outlet   | 161, 248        | Temp. Sala_Vermelha_Infantil    | 2026-05-15 | **Instalado, não usado** (batch6 usou GAS 134) |
| 168      | outlet   | 248, 248        | Temp. Farmacia_satelite         | 2026-05-15 | **Instalado, não usado** (batch6 usou GAS 141) |

> ⚠️ ids 156/157 (Lactário): pelos types, 156 (outlet) deve ser GAS e 157 (infrared) deve ser Temp. Confirmar e renomear conforme padrão `GAS Co2_Lactario 132 5000 x9.47` + `Temp. Co2_Lactario -X`.
> ⚠️ id 163 ausente (provável DELETE).
> ⚠️ id 161 ainda com nome vazio — possível novo sensor sem ambiente designado ainda.
> ⚠️ **Sala Vermelha Infantil: 3 candidatos (160, 166, 167)** — instalações múltiplas em 2026-05-15 (entre 17:48 e 18:27). Típico de campo: tenta um, não funciona, tenta outro. **Confirmar com equipe qual sensor ficou como definitivo antes do batch6.**
> ℹ️ Slaves 162/164 saíram após batch5 e 165 saiu após batch6 — agora em seção 1 (ativos sem offset).

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

| Slave | Ambiente   | Channels                                                                  |
|-------|------------|---------------------------------------------------------------------------|
| 98    | Raio-X 02  | 24 · lamp · 0 · Check (config `{"confirm":false}`)                        |
| 145   | Sala V. Adulto | (sem channels)                                                        |
| 134   | Sala V. Infantil | 67 · lamp · 0 · Teste (`{"confirm":false}`) · 68 · lamp · 1 · c2 ⚠️ |
| 125   | CTI Pediátrico | (sem channels) — **órfão pós-batch5**                                 |
| 148   | CAF        | (sem channels) — **órfão pós-batch5**                                     |
| 141   | Farmácia Satélite | 69 · **plug** · 0 · c1.0 (`{"confirm":false}`) · 70 · lamp · 1 · c2.9 (`{"confirm":false}`) ⚠️ |

> ⚠️ Slaves GAS 134 e 141 ganharam channels em 2026-05-15 — comportamento atípico (GAS normalmente não tem channels). Provavelmente **testes** antes da migração. Os channels do 141 (`type=plug`, nomes "c1.0"/"c2.9") fogem do padrão `lamp / Check / Check 2`.

### 7.3 Channels em novos slaves (instalações 2026-05-13 e 2026-05-15)

| Slave | Nome (atual)                 | Channels                                                                      | Status                  |
|-------|------------------------------|-------------------------------------------------------------------------------|-------------------------|
| 160   | Temp Sala_vermelha_infantil  | 64 · lamp · 0 · Teste                                                         | Candidato Sala V. Infantil ⚠️ |
| 162   | Temp. Co2_CTI_Pediatrico     | 56 · lamp · 0 · Teste                                                         | ✅ em uso (batch5)      |
| 164   | Temp. Co2_CAF                | 57 · lamp · 0 · Teste                                                         | ✅ em uso (batch5)      |
| 165   | Temp Sala_Vermelha_Adulto    | 62 · lamp · 0 · Teste                                                         | Candidato Sala V. Adulto |
| 166   | Temp Sala_vermelha_infantil  | 63 · lamp · 0 · Teste                                                         | Candidato Sala V. Infantil ⚠️ |
| 167   | Temp. Sala_Vermelha_Infantil | 65 · lamp · 0 · check · 66 · lamp · 1 · check2                                | **Provável definitivo** Sala V. Infantil (único com par Check/Check 2) |
| 168   | Temp. Farmacia_satelite      | 71 · lamp · 0 · c1 · 72 · lamp · 1 · c2                                       | Candidato Farmácia Satélite |

> 💡 **Pista forte sobre Sala V. Infantil**: dos 3 candidatos (160, 166, 167), apenas o **167** tem o par completo de channels (`check` + `check2`), padrão usado em todos os ambientes já migrados. Os outros dois (160, 166) só têm 1 channel "Teste" — provavelmente sensores que foram instalados e abandonados.
>
> Os channels dos slaves 165 e 168 ainda estão com nomes provisórios (`Teste`, `c1`, `c2`) — precisam ser renomeados para o padrão `Check` / `Check 2` antes/durante batch6.

### 7.4 Channels órfãos / lixo (slave_id NULL)

20 channels sem `slave_id` (ids: 1–18, 23, 28) — registros legados/teste do período 2023-2024. Candidatos a **limpeza opcional** via `DELETE FROM channels WHERE slave_id IS NULL`.

---

## Resumo por categoria

| Categoria                                    | Qtd    |
|----------------------------------------------|--------|
| Temp CO2 ativos (sem offset)                 | 30     |
| Temp CO2 ativos (com offset — pendentes fix) | 1 (101 Raio-X 02) |
| GAS CO2 (brutos remanescentes)               | 4      |
| ↳ destes: órfãos (sem par pendente)          | 3 (145, 125, 148) |
| ↳ destes: pendentes batch7                   | 1 (98 Raio-X 02)  |
| Temp CO2 legados (OLD-)                      | 31     |
| Repetidores / Mesh                           | 4      |
| A identificar                                | 7      |
| ↳ destes: instalados não-usados pós-batch6   | 4 (160, 166, 167, 168) |
| ↳ destes: Lactário pendente classificação    | 2 (156, 157) |
| ↳ destes: nome vazio                         | 1 (161) |
| **Total slaves**                             | **77** |
| Channels com slave_id válido                 | 52     |
| Channels órfãos (slave_id NULL)              | 20     |
| **Total channels**                           | **72** |

---

## Observações para próximos batches

### Batch7 (pendente) — Raio-X 02

Único ambiente restante com offset:
- **101 → 98** (Raio-X 02, -3°C) — GAS antigo (padrão batch3). Slave 98 já tem channel id=24 (`Check`).

### Padrão de migração (para referência)

1. **Histórico**: `UPDATE temperature_history SET slave_id = <novo>, value = value + (<offset>)` cobrindo 90 dias (one-shot ou em 2 passes 0-30d + 30-90d).
2. **Slaves**: Renomear OLD-T.e.m.p. (antigo infrared) + Temp. Co2_* (novo outlet).
3. **Channels**: Padronizar para `lamp ch=0 "Check"` + `lamp ch=1 "Check 2"`. Ajustes via UI ou SQL.
4. **Config JSON**: Slaves migrados ganham `config_temperature` + `channelConfig`. Replicar padrão (ver slaves 162/164/165 como referências pós-batch5/6).

### Pontos de atenção residuais

- **Channels dos novos Temp**: ainda com nomes provisórios — ajustar via UI:
  - Slave 165: criar Check 2 (ch=1) + renomear Teste → Check
  - Slave 134: renomear Teste → Check, c2 → Check 2
  - Slave 141: renomear c1.0 → Check (+ mudar plug → lamp), c2.9 → Check 2
- **GAS órfãos** (145, 125, 148): considerar desativar (atualizar `slaves.active = false`) ou renomear para `SPARE-` para sinalizar no UI que não estão em uso.
- **Slaves instalados não-usados** (160, 166, 167, 168): equipe decidiu não usar. Mesma sugestão dos GAS órfãos.
- **Lactário (156/157)**: identificar quem é GAS (156 outlet?) e quem é Temp (157 infrared?), renomear conforme padrão.
- **Slave 161**: nome vazio desde 2026-05-13 — possível DELETE ou abandono.
