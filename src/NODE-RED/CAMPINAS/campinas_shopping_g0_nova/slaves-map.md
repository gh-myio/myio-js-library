# Slaves Map — Campinas Shopping G0 Nova (Argo Plan)

> Central: **Campinas Shopping — G0 Nova** · Gateway `401230d1-e7d6-46dd-9bb1-059387683303`
> IPv6: `200:83a1:247a:8c7b:d428:3ed4:21dd:389f`
> Grupo: **Argo Plan** · Shopping: **Campinas Shopping** (módulo G0)
> Total slaves: **73** · Total channels: **15** · Total ambients: **22** · Junction (`ambients_rfir_slaves_rel`): **209**
> Fonte: dump `psql -U hubot` (`SELECT *` de ambients/junction/channels/slaves), capturado em **2026-06-30**.
> Dados estruturados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · [`ambients_slaves_rel.json`](ambients_slaves_rel.json).
> `version` de todos os slaves: **`6.0.0`** (exceto o IR `Repetidor Niveis`, `7.0.0`) · `aggregate`: `t` em todos

> Status: **🟢 mapeado**.
>
> ⚠️ **Grupo correto = Argo Plan** (não Soul Malls). Campinas Shopping pertence à
> holding **Argo Plan**; o módulo G0 ("G0 Nova") é uma das centrais do shopping
> (irmãs: G1 G2, Hidrômetros G0/G1-G2, Subestação Principal).
> Central mista: medidores de loja (energia 3F), hidrômetros (pulso), os "SCD"
> de níveis/terraço e 1 blaster IR.

---

## 🔑 Padrões de nomenclatura

| Padrão | Tipo | Significado | Exemplo |
|--------|------|-------------|---------|
| `3F SCP<código> <Loja>` | three_phase_sensor | **Medidor de loja** (RFC-0128 = Lojas → `3F_MEDIDOR`) | `3F SCP00434 Kalunga` |
| `3F SCP0Q<num> <Loja>` / `3F SCP0L<num>` | three_phase_sensor | Variantes de código (`0Q`, `0L`, `0QM`, `0QXXX`) | `3F SCP0Q023 Pandora` |
| `3f Novo <Loja>` | three_phase_sensor | Medidor adicionado depois (caixa minúscula `3f`) | `3f Novo We Pink` |
| `3F Relógio <num> (<obs>)` | three_phase_sensor | **Relógio/medição de área** (laje/postinho) | `3F Relógio 40094488 ( Laje expansão )` |
| `Entrada_Sub2 …` | three_phase_sensor | **Entrada/Subestação** (RFC-0128 = Entrada) | `Entrada_Sub2 x1600 x10A x160V` |
| `Hidr. <loja> x<mult> 0m3` / `Hidr.SI …` | outlet | **Hidrômetro** (par presence+flow) | `Hidr. Outback x1 0m3` |
| `SCD <Inferior/Superior/Nível>(X) …` | outlet | **Medição "SCD" de níveis/terraço** (cada uma com channel `Check`) | `SCD Inferior(B) 132 235 x1.9` |
| `SW Reborne` | outlet | **Switch de reboot remoto** | `SW Reborne` |
| `Repetidor Niveis` | infrared | **Blaster/repetidor IR** dos níveis | `Repetidor Niveis` |

> `code`: `002-002-002-015` (medidores 3F, com exceções `020-010-029-015` no slave 109 e
> `020-010-036-015` no 152) · `002-002-002-012` (outlets) · `002-002-002-014` (IR).
> `clamp_type`: `0` na maioria; `1` e `2` em vários; **NULL** em todos os outlets e em
> medidores recentes que usam só `config.config_clamp.value` (ver não-conformidades).

---

## 1. Energia — Medidores de Loja / Entrada (`3F …`, etc.)  · 61 slaves · `three_phase_sensor` · `3F_MEDIDOR`

> 58 medidores de loja + 2 relógios de área (125, 126) + 1 entrada/subestação (128).

| Slave ID | Nome | code | clamp_type | config |
|----------|------|------|-----------:|--------|
| 1  | `3F SCP00434 Kalunga` | 002-002-002-015 | 2 | — |
| 2  | `3F SCP00307 McDonald's` | 002-002-002-015 | 2 | — |
| 3  | `3F SCP00300 Cia Da Criança` | 002-002-002-015 | 2 | — |
| 4  | `3F SCP00601 Lojas Americanas` | 002-002-002-015 | 2 | `config_clamp` value 2 |
| 5  | `3F SCP00431 Casas Bahia` | 002-002-002-015 | 2 | — |
| 6  | `3F SCP00253 DiGaspi` | 002-002-002-015 | 2 | — |
| 7  | `3F SCP00432 Riachuelo` | 002-002-002-015 | 2 | — |
| 10 | `3F SCP00428 Inovathi` | 002-002-002-015 | 0 | `config_clamp` value 0 |
| 76 | `3F SCP00001_E2_Maravilha Do Lar` | 002-002-002-015 | 1 | — |
| 77 | `3F SCP00001_E1_Maravilha Do Lar` | 002-002-002-015 | 1 | — |
| 78 | `3F SCP0L00055 Pernambucanas` | 002-002-002-015 | 1 | — |
| 79 | `3F SCP0L405 Makibela 01` | 002-002-002-015 | 1 | — |
| 80 | `3F SCP0L405 Makibela 02` | 002-002-002-015 | 0 | — |
| 81 | `3F SCP0L00252 Marabraz` | 002-002-002-015 | 2 | — |
| 82 | `3F SCP00110 Lupo` | 002-002-002-015 | 0 | — |
| 83 | `3F SCP00409 Morana` | 002-002-002-015 | 0 | — |
| 85 | `3F SCP0L00303 KFC` | 002-002-002-015 | 2 | — |
| 86 | `3F SCP0L00306 sushiFan` | 002-002-002-015 | 1 | `config_clamp` value 1 |
| 89 | `3F SCP0Q020 Samsung` | 002-002-002-015 | 0 | — |
| 90 | `3F SCP0Q002 Fini` | 002-002-002-015 | 0 | — |
| 92 | `3F SCP0Q0261 Jah Açaí` | 002-002-002-015 | 0 | `config_clamp` value 0 |
| 95 | `3F SCP0Q013 piticas` | 002-002-002-015 | 0 | — |
| 96 | `3F SCP0Q027 QDonuts` | 002-002-002-015 | 0 | — |
| 97 | `3F SCP0Q111 Showcolate` | 002-002-002-015 | 0 | — |
| 98 | `3F SCP0Q004 Love Case` | 002-002-002-015 | 0 | `config_clamp` value 0 |
| 99 | `3F SCP0Q040 Kids Race` | 002-002-002-015 | 0 | — |
| 100 | `3F SCP0QM006 NXT` | 002-002-002-015 | 0 | — |
| 102 | `3F SCP0Q023 Pandora` | 002-002-002-015 | 0 | — |
| 103 | `3F SCP0Q012 Wells Bijuterias` | 002-002-002-015 | 0 | — |
| 105 | `3F SCP0Q212 Burguer King G0` | 002-002-002-015 | 1 | `config_clamp` value 1 |
| 106 | `3F SCP0Q007 McDonald's  P7` | 002-002-002-015 | 1 | — (espaço duplo no nome) |
| 107 | `3F SCP0Q017 Via Lorran` | 002-002-002-015 | 0 | — |
| 109 | `3F SCP0Q011 Gi Celulares` | **020-010-029-015** | 0 | `config_clamp` value 0 |
| 110 | `3F SCP0Q147 Boticário` | 002-002-002-015 | **NULL** | — |
| 111 | `3F SCP0Q043 Kolmeia` | 002-002-002-015 | 0 | — |
| 112 | `3F SCP0Qxxx Doce Mimo( Sem Lista)` | 002-002-002-015 | 1 | — |
| 113 | `3F SCP0Q024 Gold Spell` | 002-002-002-015 | 0 | — |
| 114 | `3F SCP0Q039 Touti` | 002-002-002-015 | 1 | — |
| 115 | `3F SCP0Q205 Massage Express` | 002-002-002-015 | 1 | — |
| 116 | `3F SCP0Q022 London Bus` | 002-002-002-015 | 1 | — |
| 117 | `3F SCP0Q035 Sunshine Crane` | 002-002-002-015 | 0 | — |
| 118 | `3F SCP0QXXX Global 1` | 002-002-002-015 | 0 | — |
| 119 | `3F SCP0Q265 Game Simulador` | 002-002-002-015 | 0 | — |
| 120 | `3F SCP0Q006 ACIUM` | 002-002-002-015 | 0 | — |
| 121 | `3F SCP0Q243 Kopenhagen` | 002-002-002-015 | 1 | — |
| 122 | `3F SCP0Q113 Feira Arte Mix` | 002-002-002-015 | 0 | — |
| 123 | `3F SCP0QXXX Global 4` | 002-002-002-015 | 0 | — |
| 125 | `3F Relógio 40094488 ( Laje expansão )` | 002-002-002-015 | 2 | **relógio de área** |
| 126 | `3F Relógio 303587911 (Postinho expansão)` | 002-002-002-015 | 1 | `config_clamp` value 1 · **relógio de área** |
| 128 | `Entrada_Sub2 x1600 x10A x160V` | 002-002-002-015 | 0 | **Entrada/Subestação** |
| 130 | `3F SCP00061 Sicoob` | 002-002-002-015 | 1 | `config_clamp` value 1 |
| 148 | `3f Novo Realme` | 002-002-002-015 | NULL | `config_clamp` value 0 |
| 149 | `3f Novo Quiosque Bobs G0` | 002-002-002-015 | NULL | `config_clamp` value 0 |
| 150 | `3f Novo Loccitane au Brésil` | 002-002-002-015 | NULL | `config_clamp` value 0 |
| 151 | `3f Novo We Pink` | 002-002-002-015 | NULL | `config_clamp` value 0 |
| 152 | `3f Novo Estitosa Make` | **020-010-036-015** | NULL | — |
| 153 | `3F Vago Hope` | 002-002-002-015 | NULL | `config_clamp` value 0 · loja vaga |
| 155 | `Quiosque K-Hot` | 002-002-002-015 | 1 | — (sem prefixo `3F`) |
| 157 | `3F Q029 HUB` | 002-002-002-015 | NULL | `config_clamp` value 0 |
| 158 | `3F QSCP Bom Milho` | 002-002-002-015 | NULL | `config_clamp` value 1 |
| 159 | `Coco Bambu × 50` | 002-002-002-015 | NULL | `config_clamp` value 0 · `×` unicode, sem `3F` |

---

## 2. Água — Hidrômetros (`outlet` + par de channels)  · 3 slaves

| Slave ID | Nome | code | Channels | config |
|----------|------|------|----------|--------|
| 133 | `Hidr. Outback x1 0m3` | 002-002-002-012 | 3 (`Energia`) + 4 (`Hidr. Outback x1 0m3`) | `channelConfig` REMOTE_INPUT/PULSE_ON_POWER |
| 156 | `Entrada Sanasa` | 002-002-002-012 | 12 (`Fonte`) + 13 (`Hidr. Entrada_Sanasa x100`) | `channelConfig` REMOTE_INPUT/PULSE_ON_POWER |
| 160 | `Hidr.SI SENNOR` | 002-002-002-012 | 14 (`Energia`) + 15 (`HIDR. SCP00023 x100`) | `channelConfig` REMOTE_INPUT/PULSE_ON_POWER |

> Padrão hidrômetro MyIO: 1 `presence_sensor` (channel 0, `Energia`/`Fonte`) + 1 `flow_sensor`
> (channel 1, `Hidr. …`). O multiplicador (`x1`, `x100`) está no nome do channel.

---

## 3. SCD — Níveis / Terraço (`outlet` + channel `lamp` "Check")  · 7 slaves

| Slave ID | Nome | code | Channel `Check` | Obs |
|----------|------|------|-----------------|-----|
| 134 | `SCD Inferior(B) 132 235 x1.9` | 002-002-002-012 | 7 (`Check B`) | grupo Níveis (17) |
| 135 | `SCD Inferior(A) 132 216 x1.9` | 002-002-002-012 | 6 (`Check A`) | grupo Níveis (17) |
| 136 | `SCD Inferior(D) 132 414 x3.9` | 002-002-002-012 | 8 (`Check D`) | grupo Níveis (17) |
| 137 | `SCD Superior(E) 132 720 x3.9` | 002-002-002-012 | 9 (`Check E`) | grupo Níveis (17) |
| 139 | `SCD Superior(C) 132 750 x3.9` | 002-002-002-012 | 10 (`Check (C)`) | grupo Níveis (17) |
| 140 | `SCD Superior_C(Com_Aspas) 132 900 x3.9` | 002-002-002-012 | 5 (`Check C'`) | grupo Níveis (17) |
| 142 | `SCD Nível_Terraço 132 168 x1.95` | 002-002-002-012 | 11 (`Chek Terraço`) | grupo Níveis (17) |

> Os SCD são `outlet` com um channel `lamp` "Check" cada, agrupados no ambient **Níveis (17)**,
> cujo `config.hide_devices_v1` os oculta como **temperatura**. Acompanham o IR `Repetidor Niveis`
> (slave 141). Os números no nome (`132 720 x3.9`) parecem calibração/escala.

---

## 4. Switch / BAS — Reboot remoto (`outlet`)  · 1 slave

| Slave ID | Nome | code | config | Obs |
|----------|------|------|--------|-----|
| 154 | `SW Reborne` | 002-002-002-012 | — | switch de reboot · **"Reborne"** = provável typo de "Reboot" |

---

## 5. Infravermelho (`infrared`)  · 1 slave

| Slave ID | Nome | code | version | Obs |
|----------|------|------|---------|-----|
| 141 | `Repetidor Niveis` | 002-002-002-014 | **7.0.0** | blaster/repetidor IR dos níveis |

---

## Estrutura de `channels`  · 15 channels

| ID | type | channel | name | slave_id | Pertence a |
|----|------|---------|------|----------|-----------|
| 3  | `presence_sensor` | 0 | `Energia` | 133 | `Hidr. Outback` |
| 4  | `flow_sensor` | 1 | `Hidr. Outback x1 0m3` | 133 | `Hidr. Outback` |
| 12 | `presence_sensor` | 0 | `Fonte` | 156 | `Entrada Sanasa` |
| 13 | `flow_sensor` | 1 | `Hidr. Entrada_Sanasa x100` | 156 | `Entrada Sanasa` (`config {confirm:false}`) |
| 14 | `presence_sensor` | 0 | `Energia` | 160 | `Hidr.SI SENNOR` |
| 15 | `flow_sensor` | 1 | `HIDR. SCP00023 x100` | 160 | `Hidr.SI SENNOR` (`config {confirm:false}`) |
| 5  | `lamp` | 0 | `Check C'` | 140 | `SCD Superior_C` |
| 6  | `lamp` | 0 | `Check A` | 135 | `SCD Inferior(A)` |
| 7  | `lamp` | 0 | `Check B` | 134 | `SCD Inferior(B)` |
| 8  | `lamp` | 0 | `Check D` | 136 | `SCD Inferior(D)` |
| 9  | `lamp` | 0 | `Check E` | 137 | `SCD Superior(E)` |
| 10 | `lamp` | 0 | `Check (C)` | 139 | `SCD Superior(C)` |
| 11 | `lamp` | 0 | `Chek Terraço` | 142 | `SCD Nível_Terraço` |
| 1  | `presence_sensor` | 0 | `Energia` | **NULL** | **órfão** (RiHappy removido) |
| 2  | `flow_sensor` | 1 | `Hidr. RiHappy x1 0m3` | **NULL** | **órfão** (RiHappy removido) |

> Os 61 medidores `3F` **não têm** channel materializado (leitura direto do slave).
> Channels existem só para hidrômetros (presence+flow) e SCD (lamp `Check`).
> Channels 1 e 2 são **órfãos** (`slave_id` NULL) — restos do slave RiHappy.

---

## Ambients e associação (`ambients_rfir_slaves_rel`)

> A associação **slave ↔ ambient** é feita pela junction `ambients_rfir_slaves_rel`
> (PK `(slave_id, ambient_id)`, `created_at`/`updated_at` NOT NULL **sem default**).
> Diferente da Ilha Plaza AL1, aqui **alguns ambients também trazem `config.hide_devices_v1`**
> (ver §Inconsistências).

| Ambient ID | Nome | Slaves vinculados (qtd) | config.hide_devices_v1 |
|-----------:|------|------------------------:|------------------------|
| 8  | `Todos` | 70 | — |
| 18 | `Tudo` | 61 | — |
| 4  | `Loja G0` | 19 | — |
| 7  | `Quiosque G0` | 34 | — |
| 17 | `Níveis` | 8 (134,135,136,137,139,140,141,142) | slaves 134–142 (temp) + 138 (inexistente) |
| 11 | `ADM` | 2 (125, 126) | — |
| 19 | `Todos Hidrometros` | 2 (125, 126) | — ⚠️ contém **relógios**, não hidrômetros |
| 9  | `Sem numero` | 2 (118, 123) | — |
| 12 | `Trafo` | 1 (128) | slave **129** (inexistente) |
| 13 | `Sicob` | 1 (130) | — |
| 16 | `Outback` | 1 (133) | slave 133 (energy) |
| 21 | `SW Reborne` | 1 (154) | slave 154 (temp) |
| 22 | `Quiosque K-Hot` | 1 (155) | — |
| 23 | `Vago Hope` | 1 (153) | — |
| 24 | `Entrada Sanasa` | 1 (156) | slave 156 (temp) |
| 25 | `SCP0Q029` | 1 (157) | — |
| 26 | `SCP0QBM` | 1 (158) | — |
| 27 | `Coco Bambu` | 1 (159) | — |
| 28 | `SCP00023` | 1 (160) | slave 160 (energy) |
| 10 | `Depósito` | 0 | — |
| 14 | `RiHappy` | 0 | slave **131** (inexistente) — só config |
| 20 | `Para Excluir` | 0 | — |

> `Todos` (id 8, 70 slaves) e `Tudo` (id 18, 61 slaves) são **dois ambients "tudo"** que se
> sobrepõem — provável redundância. `Todos` é o mais completo (inclui hidrômetros/SCD/IR).

---

## ⚠️ Inconsistências

1. **Grupo errado herdado** — esta central estava sob `SOUL-MALLS` no repositório; o correto é
   **Argo Plan**. Vale também a central irmã `CAMPINAS-G1-G2`.
2. **Dois ambients "tudo"** — `Todos` (8) e `Tudo` (18) se sobrepõem; consolidar em um só.
3. **`config.hide_devices_v1` referencia slaves inexistentes**: `129` (ambient Trafo),
   `131` (RiHappy), `138` (Níveis). Referências fantasmas — limpar o JSON do config.
4. **2 channels órfãos (`slave_id` NULL)**: ids 1 (`Energia`) e 2 (`Hidr. RiHappy x1 0m3`) —
   restos do slave RiHappy removido. Candidatos a DELETE.
5. **Ambient `Todos Hidrometros` (19)** contém **relógios** (125, 126), não hidrômetros — nome
   enganoso. Os hidrômetros reais (133, 156, 160) **não** estão nesse ambient.
6. **Naming mismatch ambient × slave** — o ambient `Outback` (16) hide_devices marca o slave 133
   (`Hidr. Outback`, um **outlet/hidrômetro**) como `energy`; o `Entrada Sanasa` (24) e o
   `SCP00023` (28) também ocultam outlets como temp/energia.
7. **`SW Reborne` (slave 154)** — provável typo de "Reboot".
8. **Medidores recentes com `clamp_type` NULL** divergindo de `config.config_clamp.value`
   (regra do manual §7.1: `clamp_type` deve ser NOT NULL e igual ao config): ids 110, 148, 149,
   150, 151, 153, 157, 158, 159 (e os SCD/outlets, esperado NULL). Correção em massa: query §7.4.
9. **`code` fora do padrão** `002-002-002-015`: id 109 (`020-010-029-015`) e id 152
   (`020-010-036-015`).
10. **Espaço duplo** em `3F SCP0Q007 McDonald's  P7` (slave 106).
11. **Caractere unicode** `×` em `Coco Bambu × 50` (slave 159) — usar `x` para matching consistente.
12. **Ambients vazios / lixo**: `Depósito` (10), `Para Excluir` (20), `RiHappy` (14, só config
    fantasma) — candidatos a limpeza.
13. **Slave sem prefixo `3F`**: `Quiosque K-Hot` (155), `Coco Bambu × 50` (159), `Entrada_Sub2 …`
    (128) — quebra matching por prefixo no dashboard.

---

## Resumo por categoria

| Categoria | Slaves |
|-----------|--------|
| Energia — Medidores 3F (lojas + 2 relógios + 1 entrada) | 61 |
| Água — Hidrômetros (outlet) | 3 |
| SCD — Níveis/Terraço (outlet) | 7 |
| Switch — Reboot remoto (outlet) | 1 |
| Infravermelho (infrared) | 1 |
| **Total** | **73** |

| Métrica | Valor |
|---------|-------|
| `three_phase_sensor` | 61 |
| `outlet` (3 hidr. + 7 SCD + 1 switch) | 11 |
| `infrared` | 1 |
| `channels` (6 hidr. + 7 lamp Check + 2 órfãos) | 15 |
| `version` (todos exceto IR) | `6.0.0` |
| `version` (IR slave 141) | `7.0.0` |
