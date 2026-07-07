# Slaves Map — Contagem (Soul Malls)

> Central: **Contagem** · Gateway: _não capturado no log_
> Grupo: **Soul Malls** · Shopping: **Contagem**
> Total slaves: **227** · Total channels: **156** · Total ambients: **225** · Junction (`ambients_rfir_slaves_rel`): **305**
> Fonte: `logsMaps-CONTAGEM.log` (`SELECT *` de ambients/junction/slaves/channels), capturado em **2026-07-07**.
> Dados estruturados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · [`ambients_slaves_rel.json`](ambients_slaves_rel.json).
> `version` de todos os slaves: **`6.0.0`** · `aggregate`: `t` em todos · `type` de todos: **`three_phase_sensor`**

> Status: **🟢 mapeado** · **✅ REVERT EXECUTADO em 2026-07-07 (~11:20 GMT-3)** via [`revert-import-2026-07-06.sql`](revert-import-2026-07-06.sql): pré-check `227/148/148/218` ✓, `DELETE 227/148/148/218`, pós-check `79/8/7/78` ✓, `COMMIT`.
>
> **⚠️ Este documento e os 4 JSONs retratam o snapshot PRÉ-revert** (log de 2026-07-07, com o import ainda presente). Estado atual da central após o revert: **79 slaves** (manuais), **8 channels** (teste), **7 ambients** (5 L1 · 6 L2 · 7 Serviço · 8 L3 · 9 Piso G4 · 10 Identificar · 229 Piso G3), **78 junction**. Recapturar o log e regerar os JSONs quando conveniente.
>
> **💾 Backup feito em 2026-07-07 ~11:12 (GMT-3), em `/tmp` da central (antes do revert):**
> - `/tmp/backup-cadastro-20260707-111232.sql` — 4 tabelas de cadastro (`slaves`, `channels`, `ambients`, `ambients_rfir_slaves_rel`), gerado com `--clean --if-exists` → restaura por si só (dropa e recria).
> - `/tmp/backup-full-20260707-111207.sql` — banco completo. ⚠️ o `pg_dump` emitiu NOTICEs do TimescaleDB: o `COPY` das **hypertables** (`channel_pulse_log`, `consumption_realtime` etc.) não copia dados pela tabela-mãe — os dados de série temporal ficam nos **chunks** (`_timescaledb_internal`), incluídos no dump completo, mas o restore pode exigir cuidado (constraints circulares em `hypertable`/`chunk`). Para o revert do cadastro, o backup que importa é o **cadastro**.
> - ⚠️ `/tmp` é volátil (perdido no reboot) — copiar via `scp` antes de reiniciar a central se quiser guardar.
>
> Central de **lojas de shopping 100% energia**: todos os 227 slaves são medidores
> (`three_phase_sensor`). **Sem água, sem temperatura, sem outlets/reboot, sem seletor.**
> Há **duas populações** de slaves:
> 1. **79 medidores cadastrados manualmente** (2026-07-03 → 07-06): 3 canais, `code 002-002-002-015`, sem channel materializado, agrupados nos ambients L1/L2/L3.
> 2. **148 medidores importados em lote** (evento único `2026-07-06 16:59:39.352285`): 1 canal, **sem `code`**, cada um com **1 channel materializado** e **1 ambient SCO\* individual**. O mesmo import também vinculou os 79 manuais a ambients SCO\* — medidores manuais têm **2 ambients** (grupo + loja).

---

## 🔑 Padrões de nomenclatura

| Padrão | Significado | Exemplo |
|--------|-------------|---------|
| `3F SCO<luc>` | **Medidor de loja**; `SCO` = Shopping Contagem, `<luc>` = código da loja (RFC-0128 = Lojas → `3F_MEDIDOR`) | `3F SCO01016` |
| `SCO01xxx` / `SCO02xxx` / `SCO03xxx` | Loja do **piso L1 / L2 / L3** | `SCO02089` |
| `SCO<luc><A/B/C>` | Subdivisão da loja (sufixo de letra) | `SCO1039A`, `SCO1039B` |
| `SCOQ*` | Provável **quiosque** (a confirmar) | `SCOQ0101` |
| `SCOES*` / `SCOETSG4` / `SCODP*` / `SCOPE*` / `SCOM*` | Áreas técnicas/comuns (escada rolante etc. — a confirmar) | `SCOES101` |

> `code` dos medidores manuais: sempre `002-002-002-015`. Medidores do import em lote **não têm** `code`.
> `clamp_type` (manuais): `0` em 43, `NULL` em 36 · 35 manuais têm `config_clamp` confirmado no `config`. Bulk: `clamp_type` sempre `NULL`, `config` sempre `NULL`.

---

## 1. Energia — Medidores cadastrados manualmente · 79 slaves · 3 canais · `002-002-002-015`

| Slave ID | Nome | Grupo (ambient) | Ambient SCO (import) | clamp_type | config |
|----------|------|-----------------|----------------------|-----------:|--------|
| 5 | `3F SCO01067` | L1 | ⚠️ SCO01015 (15) | 0 | — |
| 6 | `3F SCO01016` | L1 | SCO01016 (16) | 0 | — |
| 7 | `3F SCO01018` | L1 | SCO01018 (17) | 0 | — |
| 8 | `3F SCO01019` | L1 | SCO01019 (18) | 0 | — |
| 9 | `3F SCO01020` | L1 | SCO01020 (19) | 0 | — |
| 10 | `3F SCO01021` | L1 | SCO01021 (20) | 0 | — |
| 11 | `3F SCO01022` | L1 | SCO01022 (21) | 0 | — |
| 12 | `3F SCO01023` | L1 | SCO01023 (22) | 0 | — |
| 13 | `3F SCO01025` | L1 | SCO01025 (23) | 0 | — |
| 14 | `3F SCO01027` | L1 | SCO01027 (24) | 0 | — |
| 15 | `3F SCO01028` | L2 | SCO01028 (25) | 0 | — |
| 16 | `3F SCO01029` | L1 | SCO01029 (26) | 0 | — |
| 17 | `3F SCO1031` | L1 | ⚠️ SCO01031 (27) | 0 | — |
| 18 | `3F SCO01035` | L1 | SCO01035 (28) | 0 | — |
| 19 | `3F SCO01036` | L2 | SCO01036 (29) | 0 | — |
| 20 | `3F SCO01037` | L2 | SCO01037 (30) | 0 | — |
| 21 | `3F SCO01041` | L1 | SCO01041 (31) | 0 | — |
| 22 | `3F SCO01044` | L1 | SCO01044 (32) | 0 | — |
| 23 | `3F SCO01046` | L1 | SCO01046 (33) | 0 | — |
| 24 | `3F SCO1047` | L2 | ⚠️ SCO01047 (34) | 0 | — |
| 25 | `3F SCO01048` | L1 | SCO01048 (35) | 0 | — |
| 26 | `3F SCO01053` | L2 | SCO01053 (36) | 0 | — |
| 27 | `3F SCO01054` | L1 | SCO01054 (37) | 0 | — |
| 28 | `3F SCO01059` | L2 | SCO01059 (38) | 0 | — |
| 29 | `3F SCO01060` | L2 | SCO01060 (39) | 0 | — |
| 30 | `3F SCO01064` | L1 | SCO01064 (40) | 0 | — |
| 31 | `3F SCO01065` | L1 | SCO01065 (41) | NULL | `config_clamp` confirmed |
| 32 | `3F SCO1045A` | L2 | ⚠️ SCO01065 (41) | NULL | `config_clamp` confirmed |
| 33 | `3F SCO01066` | L2 | SCO01066 (42) | NULL | `config_clamp` confirmed |
| 34 | `3F SCO01071` | L1 | SCO01071 (43) | NULL | `config_clamp` confirmed |
| 35 | `3F SCO01072` | L3 | SCO01072 (44) | NULL | — |
| 36 | `3F SCO01073` | L1 | SCO01073 (45) | 0 | — |
| 37 | `3F SCO01074` | L2 | SCO01074 (46) | NULL | `config_clamp` confirmed |
| 38 | `3F SCO01082` | L2 | SCO01082 (47) | NULL | `config_clamp` confirmed |
| 39 | `3F SCO01084` | L2 | SCO01084 (48) | NULL | `config_clamp` confirmed |
| 40 | `3F SCO01085` | L2 | SCO01085 (49) | NULL | — |
| 41 | `3F SCO01088` | L2 | SCO01088 (50) | NULL | `config_clamp` confirmed |
| 42 | `3F SCO01090` | L2 | ⚠️ SCO01091 (51) | NULL | `config_clamp` confirmed |
| 43 | `3F SCO01091` | L2 | SCO01091 (51) | NULL | `config_clamp` confirmed |
| 44 | `3F SCO01092` | L2 | SCO01092 (52) | NULL | `config_clamp` confirmed |
| 45 | `3F SCO01093` | L2 | SCO01093 (53) | NULL | `config_clamp` confirmed |
| 46 | `3F SCO01097` | L2 | SCO01097 (54) | NULL | `config_clamp` confirmed |
| 47 | `3F SCO01098` | L3 | SCO01098 (55) | NULL | `config_clamp` confirmed |
| 48 | `3F SCO01099` | L3 | SCO01099 (56) | NULL | `config_clamp` confirmed |
| 49 | `3F SCO01100` | L3 | SCO01100 (57) | NULL | `config_clamp` confirmed |
| 50 | `3F SCO01106` | L3 | SCO01106 (58) | 0 | `config_clamp` confirmed |
| 51 | `3F SCO02089` | L3 | ⚠️ SCO01106 (58) | 0 | `config_clamp` confirmed |
| 52 | `3F SCO02001` | L3 | SCO02001 (59) | NULL | `config_clamp` confirmed |
| 53 | `3F SCO02002` | L3 | SCO02002 (60) | NULL | `config_clamp` confirmed |
| 54 | `3F SCO02003` | Piso G4 | SCO02003 (61) | NULL | `config_clamp` confirmed |
| 55 | `3F SCO02004` | Piso G4 | SCO02004 (62) | NULL | `config_clamp` confirmed |
| 88 | `3F SCO02048` | L1 | SCO02048 (93) | NULL | `config_clamp` confirmed |
| 89 | `3F SCO02054` | Identificar | SCO02054 (94) | NULL | `config_clamp` confirmed |
| 91 | `3F SCO02060` | L3 | SCO02060 (96) | NULL | `config_clamp` confirmed |
| 92 | `3F SCO02061` | L3 | SCO02061 (97) | NULL | `config_clamp` confirmed |
| 93 | `3F SCO02062` | L3 | SCO02062 (98) | NULL | `config_clamp` confirmed |
| 94 | `3F SCO02063` | L3 | SCO02063 (99) | NULL | `config_clamp` confirmed |
| 95 | `3F SCO02065` | L1 | SCO02065 (100) | 0 | — |
| 96 | `3F SCO02071` | L1 | SCO02071 (101) | 0 | — |
| 97 | `3F SCO02072` | L1 | SCO02072 (102) | NULL | `config_clamp` confirmed |
| 98 | `3F SCO02073` | L1 | SCO02073 (103) | NULL | `config_clamp` confirmed |
| 99 | `3F SCO02066` | L1 | ⚠️ SCO02074 (104) | NULL | `config_clamp` confirmed |
| 100 | `3F SCO02074` | L1 | SCO02074 (104) | 0 | — |
| 101 | `3F SCO02076` | L1 | SCO02076 (105) | 0 | — |
| 102 | `3F SCO02078` | L1 | SCO02078 (106) | 0 | — |
| 103 | `3F SCO02079` | L1 | SCO02079 (107) | 0 | — |
| 104 | `3F SCO02080` | L1 | SCO02080 (108) | 0 | — |
| 105 | `3F SCO02081` | L1 | SCO02081 (109) | 0 | — |
| 106 | `3F SCO02083` | **—** | SCO02083 (110) | NULL | — |
| 107 | `3F SCO02085` | L1 | SCO02085 (111) | NULL | `config_clamp` confirmed |
| 108 | `3F SCO02086` | L1 | SCO02086 (112) | NULL | `config_clamp` confirmed |
| 109 | `3F SCO02087` | L1 | SCO02087 (113) | NULL | `config_clamp` confirmed |
| 110 | `3F SCO02088` | L1 | SCO02088 (114) | NULL | `config_clamp` confirmed |
| 111 | `3F SCO02089` | L2 | SCO02089 (115) | 0 | — |
| 112 | `3F SCO02090` | L2 | SCO02090 (116) | 0 | — |
| 113 | `3F SCO02091` | L2 | SCO02091 (117) | 0 | — |
| 114 | `3F SCO02092` | L1 | SCO02092 (118) | 0 | — |
| 115 | `3F SCO02093` | L1 | SCO02093 (119) | 0 | — |
| 116 | `3F SCO02094` | L2 | SCO02094 (120) | 0 | — |

> Distribuição por grupo: **L1** = 40 · **L2** = 23 · **L3** = 12 · **Piso G4** = 2 · **Identificar** = 1 · **sem grupo** = 1.
> ⚠️ = nome do slave difere do ambient SCO vinculado pelo import (ver Inconsistências).

---

## 2. Energia — Medidores do import em lote · 148 slaves · 1 canal · sem `code`

> Criados em `2026-07-06 16:59:39.352285` junto com seus channels e ambients SCO\*.
> `addr_low` = id do slave; `addr_high` cresce em passos de 2 (sequência sintética do import).

| Slave ID | Nome | Ambient SCO | Channel ID |
|----------|------|-------------|-----------:|
| 1 | `3F SCO01002` | SCO01002 (11) | 9 |
| 2 | `3F SCO01006` | SCO01006 (12) | 10 |
| 3 | `3F SCO01011` | SCO01011 (13) | 11 |
| 4 | `3F SCO01012` | SCO01012 (14) | 12 |
| 56 | `3F SCO02005` | SCO02005 (63) | 13 |
| 57 | `3F SCO02006` | SCO02006 (64) | 14 |
| 58 | `3F SCO02007` | SCO02007 (65) | 15 |
| 59 | `3F SCO02008` | SCO02008 (66) | 16 |
| 60 | `3F SCO02010` | SCO02010 (67) | 17 |
| 61 | `3F SCO02011` | SCO02011 (68) | 18 |
| 62 | `3F SCO02013` | SCO02013 (69) | 19 |
| 63 | `3F SCO02015` | SCO02015 (70) | 20 |
| 64 | `3F SCO02017` | SCO02017 (71) | 21 |
| 65 | `3F SCO02018` | SCO02018 (72) | 22 |
| 66 | `3F SCO02019` | SCO02019 (73) | 23 |
| 67 | `3F SCO02020` | SCO02020 (74) | 24 |
| 68 | `3F SCO02021` | SCO02021 (75) | 25 |
| 69 | `3F SCO02022` | SCO02022 (76) | 26 |
| 70 | `3F SCO01058` | ⚠️ SCO02024 (77) | 27 |
| 71 | `3F SCO02024` | SCO02024 (77) | 28 |
| 72 | `3F SCO02025` | SCO02025 (78) | 29 |
| 73 | `3F SCO02027` | SCO02027 (79) | 30 |
| 74 | `3F SCO02028` | SCO02028 (80) | 31 |
| 75 | `3F SCO02029` | SCO02029 (81) | 32 |
| 76 | `3F SCO02030` | SCO02030 (82) | 33 |
| 77 | `3F SCO02031` | SCO02031 (83) | 34 |
| 78 | `3F SCO02032` | SCO02032 (84) | 35 |
| 79 | `3F SCO02036` | ⚠️ SCO02032 (84) | 36 |
| 80 | `3F SCO02034` | SCO02034 (85) | 37 |
| 81 | `3F SCO02035` | SCO02035 (86) | 38 |
| 82 | `3F SCO02037` | SCO02037 (87) | 39 |
| 83 | `3F SCO02038` | SCO02038 (88) | 40 |
| 84 | `3F SCO02039` | SCO02039 (89) | 41 |
| 85 | `3F SCO02041` | SCO02041 (90) | 42 |
| 86 | `3F SCO02045` | SCO02045 (91) | 43 |
| 87 | `3F SCO02047` | SCO02047 (92) | 44 |
| 90 | `3F SCO02056` | SCO02056 (95) | 45 |
| 117 | `3F SCO02095` | SCO02095 (121) | 46 |
| 118 | `3F SCO02096` | SCO02096 (122) | 47 |
| 119 | `3F SCO02097` | SCO02097 (123) | 48 |
| 120 | `3F SCO02099` | SCO02099 (124) | 49 |
| 121 | `3F SCO02100` | SCO02100 (125) | 50 |
| 122 | `3F SCO02101` | SCO02101 (126) | 51 |
| 123 | `3F SCO02102` | SCO02102 (127) | 52 |
| 124 | `3F SCO02108` | ⚠️ SCO02102 (127) | 53 |
| 125 | `3F SCO02104` | SCO02104 (128) | 54 |
| 126 | `3F SCO02106` | ⚠️ SCO02107 (129) | 55 |
| 127 | `3F SCO2108` | ⚠️ SCO02108 (130) | 56 |
| 128 | `3F SCO02110` | SCO02110 (131) | 57 |
| 129 | `3F SCO02111` | SCO02111 (132) | 58 |
| 130 | `3F SCO02112` | SCO02112 (133) | 59 |
| 131 | `3F SCO02114` | SCO02114 (134) | 60 |
| 132 | `3F SCO02116` | SCO02116 (135) | 61 |
| 133 | `3F SCO02117` | SCO02117 (136) | 62 |
| 134 | `3F SCO02119` | SCO02119 (137) | 63 |
| 135 | `3F SCO02121` | SCO02121 (138) | 64 |
| 136 | `3F SCO02122` | SCO02122 (139) | 65 |
| 137 | `3F SCO02123` | SCO02123 (140) | 66 |
| 138 | `3F SCO02124` | SCO02124 (141) | 67 |
| 139 | `3F SCO02126` | SCO02126 (142) | 68 |
| 140 | `3F SCO02127` | SCO02127 (143) | 69 |
| 141 | `3F SCO03002` | SCO03002 (144) | 70 |
| 142 | `3F SCO03004` | SCO03004 (145) | 71 |
| 143 | `3F SCO03005` | SCO03005 (146) | 72 |
| 144 | `3F SCO03007` | SCO03007 (147) | 73 |
| 145 | `3F SCO1001A` | SCO1001A (148) | 74 |
| 146 | `3F SCO1013B` | SCO1013B (149) | 75 |
| 147 | `3F SCO1039A` | SCO1039A (150) | 76 |
| 148 | `3F SCO1039B` | SCO1039B (151) | 77 |
| 149 | `3F SCO1045B` | SCO1045B (152) | 78 |
| 150 | `3F SCO1057A` | SCO1057A (153) | 79 |
| 151 | `3F SCO1057C` | SCO1057C (154) | 80 |
| 152 | `3F SCO01017` | ⚠️ SCO1069B (155) | 81 |
| 153 | `3F SCO1069B` | SCO1069B (155) | 82 |
| 154 | `3F SCO1078A` | SCO1078A (156) | 83 |
| 155 | `3F SCO1094A` | SCO1094A (157) | 84 |
| 156 | `3F SCO1094C` | SCO1094C (158) | 85 |
| 157 | `3F SCO1095C` | SCO1095C (159) | 86 |
| 158 | `3F SCO2026A` | SCO2026A (160) | 87 |
| 159 | `3F SCO2026B` | SCO2026B (161) | 88 |
| 160 | `3F SCO2033A` | SCO2033A (162) | 89 |
| 161 | `3F SCO2076A` | SCO2076A (163) | 90 |
| 162 | `3F SCO2076B` | SCO2076B (164) | 91 |
| 163 | `3F SCO2077A` | SCO2077A (165) | 92 |
| 164 | `3F SCO2078A` | SCO2078A (166) | 93 |
| 165 | `3F SCO2084A` | SCO2084A (167) | 94 |
| 166 | `3F SCO2084B` | SCO2084B (168) | 95 |
| 167 | `3F SCO2088A` | SCO2088A (169) | 96 |
| 168 | `3F SCO2103A` | SCO2103A (170) | 97 |
| 169 | `3F SCO2103C` | SCO2103C (171) | 98 |
| 170 | `3F SCO2113B` | SCO2113B (172) | 99 |
| 171 | `3F SCO2125A` | SCO2125A (173) | 100 |
| 172 | `3F SCO2125B` | SCO2125B (174) | 101 |
| 173 | `3F SCO3006A` | SCO3006A (175) | 102 |
| 174 | `3F SCO3006B` | SCO3006B (176) | 103 |
| 175 | `3F SCODP002` | SCODP002 (177) | 104 |
| 176 | `3F SCOES001` | SCOES001 (178) | 105 |
| 177 | `3F SCOES101` | SCOES101 (179) | 106 |
| 178 | `3F SCOES302` | SCOES302 (180) | 107 |
| 179 | `3F SCOETSG4` | SCOETSG4 (181) | 108 |
| 180 | `3F SCOM0001` | SCOM0001 (182) | 109 |
| 181 | `3F SCOPE001` | SCOPE001 (183) | 110 |
| 182 | `3F SCOP003` | ⚠️ SCOPE003 (184) | 111 |
| 183 | `3F SCOQ0101` | SCOQ0101 (185) | 112 |
| 184 | `3F SCOQ0102B` | ⚠️ SCOQ0102 (186) | 113 |
| 185 | `3F SCOQ0103` | SCOQ0103 (187) | 114 |
| 186 | `3F SCOQ0104` | SCOQ0104 (188) | 115 |
| 187 | `3F SCOQ103` | ⚠️ SCOQ0104B (189) | 116 |
| 188 | `3F SCOQ0106` | SCOQ0106 (190) | 117 |
| 189 | `3F SCOQ0108` | SCOQ0108 (191) | 118 |
| 190 | `3F SCOQ0109` | SCOQ0109 (192) | 119 |
| 191 | `3F SCOQ0115` | SCOQ0115 (193) | 120 |
| 192 | `3F SCOQ0116` | SCOQ0116 (194) | 121 |
| 193 | `3F SCOQ0201` | SCOQ0201 (195) | 122 |
| 194 | `3F SCOQ0202` | SCOQ0202 (196) | 123 |
| 195 | `3F SCOQ0204` | SCOQ0204 (197) | 124 |
| 196 | `3F SCOQ0206` | SCOQ0206 (198) | 125 |
| 197 | `3F SCOQ206` | ⚠️ SCOQ0206 (198) | 126 |
| 198 | `3F SCOQ0207` | SCOQ0207 (199) | 127 |
| 199 | `3F SCOQ0209` | SCOQ0209 (200) | 128 |
| 200 | `3F SCOQ0210` | SCOQ0210 (201) | 129 |
| 201 | `3F SCOQ0212` | SCOQ0212 (202) | 130 |
| 202 | `3F SCOQ0213` | SCOQ0213 (203) | 131 |
| 203 | `3F SCOQ0214` | SCOQ0214 (204) | 132 |
| 204 | `3F SCOQ0300` | SCOQ0300 (205) | 133 |
| 205 | `3F SCOQ0301` | SCOQ0301 (206) | 134 |
| 206 | `3F SCOQ0302` | SCOQ0302 (207) | 135 |
| 207 | `3F SCOQ0304` | SCOQ0304 (208) | 136 |
| 208 | `3F SCOQ0305` | SCOQ0305 (209) | 137 |
| 209 | `3F SCOQ0311` | SCOQ0311 (210) | 138 |
| 210 | `3F SCOQ1015` | SCOQ1015 (211) | 139 |
| 211 | `3F SCOQ102A` | SCOQ102A (212) | 140 |
| 212 | `3F SCOQ102B` | SCOQ102B (213) | 141 |
| 213 | `3F SCOQ104A` | SCOQ104A (214) | 142 |
| 214 | `3F SCO01096` | ⚠️ SCOQ1096 (215) | 143 |
| 215 | `3F SCOQ114` | ⚠️ SCOQ114A (216) | 144 |
| 216 | `3F SCOQ200B` | SCOQ200B (217) | 145 |
| 217 | `3F SCOQ202B` | SCOQ202B (218) | 146 |
| 218 | `3F SCOQ0205` | ⚠️ SCOQ205 (219) | 147 |
| 219 | `3F SCO0211` | ⚠️ SCOQ211 (220) | 148 |
| 220 | `3F SCOQ212` | SCOQ212 (221) | 149 |
| 221 | `3F SCOQ212B` | SCOQ212B (222) | 150 |
| 222 | `3F SCOQ213` | SCOQ213 (223) | 151 |
| 223 | `3F SCOQ214` | SCOQ214 (224) | 152 |
| 224 | `3F SCOQ214B` | SCOQ214B (225) | 153 |
| 225 | `3F SCOQ303B` | SCOQ303B (226) | 154 |
| 226 | `3F SCOQ304A` | SCOQ304A (227) | 155 |
| 227 | `3F SCOQ312` | SCOQ312 (228) | 156 |

---

## 3. Água — Hidrômetros

> **Nenhum** nesta central (existe apenas um channel de teste chamado "Hidrometro", sem slave — descartar).

## 4. Temperatura — Termostatos

> **Nenhum** nesta central.

## 5. Switch / Reboot (`outlet`) e Seletor Auto/Manual

> **Nenhum** nesta central.

---

## Estrutura de `channels` · 156 channels

### Channels de teste (sem slave) · 8 — **descartar no transform**

| ID | type | channel | name | config |
|----|------|---------|------|--------|
| 1 | `lamp` | 1 | `Teste 02` | `{"confirm":false}` |
| 2 | `presence_sensor` | 1 | `Teste Presença 02` | — |
| 3 | `presence_sensor` | 0 | `Energia 01` | — |
| 4 | `presence_sensor` | 1 | `Energia 02` | — |
| 5 | `presence_sensor` | 0 | `Energia` | — |
| 6 | `presence_sensor` | 1 | `Hidrometro` | `{"confirm":false}` |
| 7 | `lamp` | 0 | `01` | — |
| 8 | `lamp` | 1 | `02` | — |

> Criados em 2026-06-17 (bancada/comissionamento): "Teste 02", "Energia", "Hidrometro" etc. — nenhum aponta para slave.

### Channels de medidor · 148 × `three_phase_sensor`

> 1 channel por slave do import em lote (ids 9–156, `channel = 1`, `config = {}`), nome igual ao do slave.
> Os 79 medidores manuais **não têm channel materializado** (leitura direto do slave, como em Ilha Plaza/Benfica/Suzano).

---

## Ambients e associação (`ambients_rfir_slaves_rel`)

> A junction tem **2 camadas**: vínculos manuais aos grupos (ambients 5/6/8/9/10, 78 linhas) e o import em lote que vinculou **cada um dos 227 slaves** ao seu ambient SCO\* (227 linhas). Medidores manuais ficam com **2 ambients**.

### Ambients manuais

| Ambient ID | Nome | Slaves | Qtd |
|-----------:|------|--------|----:|
| 5 | `L1 Medidores 3F` | 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 21, 22, 23, 25, 27, 30, 31, 34, 36, 88, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 107, 108, 109, 110, 114, 115 | 40 |
| 6 | `L2 Medidores 3F` | 15, 19, 20, 24, 26, 28, 29, 32, 33, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 111, 112, 113, 116 | 23 |
| 7 | ` Serviço Medidores 3F` | — | 0 |
| 8 | `L3 Medidores 3F` | 35, 47, 48, 49, 50, 51, 52, 53, 91, 92, 93, 94 | 12 |
| 9 | `Piso G4` | 54, 55 | 2 |
| 10 | `Identificar` | 89 | 1 |
| 229 | `Piso G3` | — | 0 |

### Ambients SCO\* (import) · 218

> 1 ambient por loja (ids 11–228, `config = {}`, `order = 0`), todos com ≥1 slave. **9 ambients têm 2 slaves**:

| Ambient | Slaves | Nomes |
|---------|--------|-------|
| `SCO02032` (84) | 78, 79 | `3F SCO02032` · `3F SCO02036` |
| `SCO01065` (41) | 31, 32 | `3F SCO01065` · `3F SCO1045A` |
| `SCO01091` (51) | 42, 43 | `3F SCO01090` · `3F SCO01091` |
| `SCO01106` (58) | 50, 51 | `3F SCO01106` · `3F SCO02089` |
| `SCO02024` (77) | 70, 71 | `3F SCO01058` · `3F SCO02024` |
| `SCO02074` (104) | 99, 100 | `3F SCO02066` · `3F SCO02074` |
| `SCO02102` (127) | 123, 124 | `3F SCO02102` · `3F SCO02108` |
| `SCO1069B` (155) | 152, 153 | `3F SCO01017` · `3F SCO1069B` |
| `SCOQ0206` (198) | 196, 197 | `3F SCOQ0206` · `3F SCOQ206` |

---

## ⚠️ Inconsistências

1. **Nome duplicado**: `3F SCO02089` existe em **2 slaves** — 51 (manual, grupo L3, vinculado ao ambient `SCO01106` ⚠️) e 111 (manual, grupo L2, vinculado ao ambient `SCO02089` ✅).
2. **21 divergências slave × ambient no pareamento do import** (nome do slave ≠ nome do ambient SCO vinculado) — mistura de typos no nome do slave e deslocamentos do pareamento:

   | Slave | Nome do slave | Ambient vinculado | Provável causa |
   |-------|---------------|-------------------|----------------|
   | 5 | `3F SCO01067` | `SCO01015` (15) | não existe ambient `SCO01067`; pareamento posicional |
   | 17 | `3F SCO1031` | `SCO01031` (27) | typo (falta `0`) |
   | 24 | `3F SCO1047` | `SCO01047` (34) | typo (falta `0`) |
   | 32 | `3F SCO1045A` | `SCO01065` (41) | pareado junto com slave 31 (`SCO01065`); existe ambient `SCO1045B` mas não `SCO1045A` |
   | 42 | `3F SCO01090` | `SCO01091` (51) | não existe ambient `SCO01090` |
   | 51 | `3F SCO02089` | `SCO01106` (58) | duplicata do nome (ver item 1) |
   | 70 | `3F SCO01058` | `SCO02024` (77) | slave bulk com nome de loja L1 no meio da faixa L2 |
   | 79 | `3F SCO02036` | `SCO02032` (84) | não existe ambient `SCO02036` |
   | 99 | `3F SCO02066` | `SCO02074` (104) | não existe ambient `SCO02066` |
   | 124 | `3F SCO02108` | `SCO02102` (127) | deslocamento (ver 127) |
   | 126 | `3F SCO02106` | `SCO02107` (129) | não existe ambient `SCO02106`; não há slave `SCO02107` |
   | 127 | `3F SCO2108` | `SCO02108` (130) | typo (falta `0`) |
   | 152 | `3F SCO01017` | `SCO1069B` (155) | slave com nome de loja L1 na faixa dos `SCO1xxx?` |
   | 182 | `3F SCOP003` | `SCOPE003` (184) | typo (falta `E`) |
   | 184 | `3F SCOQ0102B` | `SCOQ0102` (186) | sufixo `B` só no slave |
   | 187 | `3F SCOQ103` | `SCOQ0104B` (189) | typo/deslocamento |
   | 197 | `3F SCOQ206` | `SCOQ0206` (198) | typo (falta `0`); slave 196 = `SCOQ0206` no mesmo ambient |
   | 214 | `3F SCO01096` | `SCOQ1096` (215) | prefixo `Q` só no ambient |
   | 215 | `3F SCOQ114` | `SCOQ114A` (216) | sufixo `A` só no ambient |
   | 218 | `3F SCOQ0205` | `SCOQ205` (219) | `0` extra no slave |
   | 219 | `3F SCO0211` | `SCOQ211` (220) | falta `Q` no slave |

3. **Slave 106 (`3F SCO02083`, manual) sem vínculo a grupo** — é o único medidor manual que não está em L1/L2/L3/Piso G4/Identificar; só tem o ambient `SCO02083` do import.
4. **Ambient 7 `" Serviço Medidores 3F"`** — nome com **espaço à esquerda** e **vazio** (nenhum slave). Provável grupo planejado e não usado.
5. **Ambients vazios**: 7 (` Serviço Medidores 3F`) e 229 (`Piso G3`, criado 2026-07-07 03:14 — provável grupo novo aguardando vínculos).
6. **Channels de teste 1–8** (2026-06-17, sem `slave_id`): "Teste 02", "Teste Presença 02", "Energia", "Hidrometro" etc. — sobras de bancada, **descartar no transform**.
7. **Dupla associação dos medidores manuais** — 78 dos 79 têm 2 ambients (grupo L1/L2/L3 **e** loja SCO\*); o transform precisa escolher a camada (grupo × loja) ou tratar ambas.
8. **Slave 215 (`3F SCOQ114`)** é o único com `updated_at` posterior ao import (`2026-07-07 05:06`) — provável renomeação manual recente.
9. **Ambient 10 `Identificar`** contém o slave 89 (`3F SCO02054`) — pendência de identificação apesar do nome de loja.
10. **9 ambients SCO\* com 2 slaves** (tabela acima) — em geral 1 manual + 1 typo/duplicata; conferir qual medidor é o real de cada loja.

---

## Resumo por categoria

| Categoria | Slaves |
|-----------|--------|
| Energia — Medidores manuais (3 canais, `code 002-002-002-015`) | 79 |
| Energia — Medidores do import em lote (1 canal, sem `code`) | 148 |
| **Total** | **227** |

| Métrica | Valor |
|---------|-------|
| `three_phase_sensor` | 227 (100%) |
| `channels` | 156 (8 teste órfãos + 148 de medidor) |
| `ambients` | 225 (5 grupos manuais c/ slaves + 2 vazios + 218 SCO\*) |
| Junction | 305 (78 grupo + 227 import) |
| `version` (todos) | `6.0.0` |
