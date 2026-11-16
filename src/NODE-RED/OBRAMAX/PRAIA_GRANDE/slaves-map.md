# Slaves Map — Praia Grande (Obramax)

> Central: **Praia Grande (Obramax)** · Gateway `—` · Central ID `—` · Frequência `—`
> IPv6: `200:a12e:4703:c680:dfb7:936b:88b9:6f4b`
> Total slaves: **47** · channels: **117** · ambients: **23** · `ambients_rfir_slaves_rel`: **82** · `ambients_rfir_devices_rel`: **0**
> RFIR: `rfir_devices`: **5** · `rfir_remotes`: **5** · `rfir_commands`: **47** · `rfir_buttons`: **19**
> Capturado em **2026-11-16 14:47 UTC** por `dump-cadastro.py` (somente leitura).
> Dados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · [`ambients_slaves_rel.json`](ambients_slaves_rel.json) · [`ambients_devices_rel.json`](ambients_devices_rel.json)
> Tipos de slave: `outlet` 42 · `infrared` 3 · `three_phase_sensor` 2

## Slaves

| id | addr_low | addr_high | type | name | ch | clamp | ambients | channels (nº · type · name) |
|---:|---:|---:|---|---|---:|---:|---|---|
| 1 | 175 | 249 | outlet | SW ADM Iluminação Ext. 1 | 2 | — | 15 Comandos, 2 QGBT ADM | 0 · lamp · Iluminação est. Cob. Retira<br>0 · presence_sensor · Aut. Selet. 1<br>1 · lamp · Iluminação Interna Retira<br>1 · presence_sensor · Aut. Selet. 2 |
| 2 | 218 | 249 | outlet | SW Barramento I/H | 2 | — | 15 Comandos, 2 QGBT ADM | 0 · lamp · Lateral Loja<br>0 · presence_sensor · Aut. Selet. 3<br>1 · lamp · 50% est. Cob.<br>1 · presence_sensor · Aut. Selet. H |
| 3 | 230 | 248 | outlet | Sw Barramento G/F | 2 | — | 15 Comandos, 2 QGBT ADM | 0 · presence_sensor · Aut. Selet. G<br>0 · lamp · Ilum lateral, postes frente, 50% est. Cob.<br>1 · presence_sensor · Aut. Selet. F<br>1 · lamp · Ilum. Interna Mezanino |
| 5 | 145 | 249 | outlet | Sw Splitao 01 | 2 | — | 27 Termostatos, 15 Comandos, 4 Splitões | 0 · presence_sensor · Aut. Split.6<br>0 · plug · Splitao 6 |
| 6 | 233 | 248 | outlet | Sw Splitao 1/7 | 2 | — | 27 Termostatos, 15 Comandos, 4 Splitões | 0 · presence_sensor · Aut. Split 1<br>0 · plug · Splitao 1<br>1 · presence_sensor · Aut. Split 7<br>1 · plug · Splitao 7 |
| 7 | 46 | 249 | outlet | SW Split 3/2 | 2 | — | 27 Termostatos, 15 Comandos, 4 Splitões | 0 · presence_sensor · Aut. Split 3<br>0 · plug · Splitao 3<br>1 · presence_sensor · Aut. Split 2<br>1 · plug · Splitao 2 |
| 8 | 244 | 248 | outlet | SW Splitao 5/4 | 2 | — | 27 Termostatos, 15 Comandos, 4 Splitões | 0 · presence_sensor · Aut. Split 5<br>0 · plug · Splitao 5<br>1 · presence_sensor · Aut. Split 4<br>1 · plug · Splitao 4 |
| 9 | 118 | 248 | three_phase_sensor | 3F Splitao1 | 3 | 2 | 25 Medição Energia | — |
| 10 | 2 | 248 | outlet | SW Exaustão QGBT ADM | 2 | — | 5 Ares / Exaustor Cobertura, 15 Comandos | 0 · presence_sensor · Aut. Selet. Exaust<br>0 · plug · Exaust. QGBT ADM |
| 12 | 152 | 248 | outlet | SW Ares cobertura | 2 | — | 5 Ares / Exaustor Cobertura, 15 Comandos | 0 · presence_sensor · Auto. Ar Exter ADM<br>0 · plug · AR Extern ADM<br>1 · presence_sensor · Auto. Ar Preparo<br>1 · plug · AR Extern Preparo |
| 13 | 104 | 248 | outlet | SW Exaustores coz/San. | 2 | — | 5 Ares / Exaustor Cobertura, 15 Comandos | 0 · pulse_up · Desligar Exaustores<br>0 · presence_sensor · Status Comando on<br>1 · pulse_up · Ligar Exasutores<br>1 · presence_sensor · Aut. Seletora Exaustor |
| 14 | 174 | 248 | outlet | Repetidor Final loja | 2 | — | 6 Repetidores/Temperatura loja | 0 · lamp · F1<br>1 · lamp · F2 |
| 15 | 242 | 249 | outlet | SW Loja Incorp-Barra.C/D | 2 | — | 7 Loja Incorp., 15 Comandos | 0 · lamp · 50% Frente Loja (C)<br>0 · presence_sensor · Auto. Selet. 50% Frente Loja (C)<br>1 · lamp · 50% Frente Loja (D)<br>1 · presence_sensor · Auto. Selet. 50% Frente Loja (D) |
| 16 | 114 | 249 | outlet | Sw Loja Incorp Barr. E/ F | 2 | — | 7 Loja Incorp., 15 Comandos | 0 · presence_sensor · Auto. Selet. 50% Central e Fundo Loja (E)<br>0 · lamp · 50% Central e Fundo Loja (E)<br>1 · presence_sensor · Auto. Selet. 50% Central e Fundo Loja (F)<br>1 · lamp · 50% Central e Fundo Loja (F) |
| 17 | 73 | 249 | outlet | SW Depósito Barr G/H | 2 | — | 8 QT Depósito, 15 Comandos | 0 · presence_sensor · Auto. Selet. 50% Drive e Cer (G)<br>0 · lamp · 50% Drive e Cer (G)<br>1 · presence_sensor · Auto. Selet. 50% Drive e Cer (H)<br>1 · lamp · 50% Drive e Cer (H) |
| 18 | 85 | 249 | outlet | Sw Depósito Barr. i | 2 | — | 8 QT Depósito, 15 Comandos | 0 · presence_sensor · Auto. Selet. Ilum Externa (I)<br>0 · lamp · Ilum Externa (I) |
| 19 | 94 | 249 | outlet | `SW Depósito Manutenção ` ⚠ espaço | 2 | — | 8 QT Depósito, 15 Comandos | 0 · presence_sensor · Auto. Selet. Depósito<br>0 · lamp · Depósito |
| 20 | 214 | 248 | outlet | SW Agua potavel | 2 | — | 9 Hidraulica | 0 · presence_sensor · Energia água potavel<br>1 · flow_sensor · Água potÁvel(x10) |
| 21 | 6 | 249 | outlet | sw REUSO | 2 | — | 9 Hidraulica | 0 · presence_sensor · ENERGIA REUSO<br>1 · flow_sensor · ÁGUA Reuso(x10) |
| 22 | 169 | 248 | outlet | Sw caixa dagua | 2 | — | 9 Hidraulica | 0 · presence_sensor · Agua potavel<br>1 · presence_sensor · Agua Reuso |
| 23 | 132 | 248 | three_phase_sensor | 3F Cpd / X/ Rack | 3 | 0 | 25 Medição Energia | — |
| 24 | 29 | 249 | infrared | `A/C No-break ` ⚠ espaço | 1 | — | 5 Ares / Exaustor Cobertura, 26 remotes | — |
| 26 | 51 | 249 | infrared | A/C CPD | 1 | — | 5 Ares / Exaustor Cobertura, 26 remotes | — |
| 28 | 156 | 249 | infrared | `A/C Monitoramento ` ⚠ espaço | 1 | — | 5 Ares / Exaustor Cobertura, 26 remotes | — |
| 29 | 107 | 249 | outlet | Temp. Frente Loja | 2 | — | 6 Repetidores/Temperatura loja | 1 · lamp · S2 |
| 30 | 12 | 249 | outlet | `Temp. Meio Loja ` ⚠ espaço | 2 | — | 6 Repetidores/Temperatura loja | 0 · lamp · S3<br>1 · lamp · S4 |
| 31 | 116 | 248 | outlet | Temp. Fundo Loja | 2 | — | 6 Repetidores/Temperatura loja, 14 Desligar Automação | 0 · lamp · Automação Obramax<br>1 · lamp · S6 |
| 32 | 58 | 249 | outlet | SCD Reuso 132 160 x1.95 | 2 | — | 16 `Nível ` ⚠ espaço | — |
| 33 | 129 | 249 | outlet | SCD Potável 132 160 x1.95 | 2 | — | 16 `Nível ` ⚠ espaço | — |
| 34 | 162 | 249 | outlet | `Alarmes Bomba Diesel Principal ` ⚠ espaço | 2 | — | 17 Alarmes Bomba Diesel | 0 · presence_sensor · `Seletor Automático ` ⚠ espaço |
| 35 | 204 | 248 | outlet | `Alarmes Bombas Diesel Principal ` ⚠ espaço | 2 | — | 17 Alarmes Bomba Diesel | 0 · presence_sensor · Falha Geral<br>1 · presence_sensor · Motor Ligado Bomba Diesel |
| 36 | 190 | 249 | outlet | Bombas Diesel Reserva | 2 | — | 17 Alarmes Bomba Diesel | 0 · presence_sensor · Seletor Automático (Reserva) |
| 37 | 90 | 248 | outlet | `Bombas Diesel Reserva ` ⚠ espaço | 2 | — | 17 Alarmes Bomba Diesel | 0 · presence_sensor · Falha Geral (Reserva)<br>1 · presence_sensor · Motor Ligado (Reserva) |
| 38 | 84 | 249 | outlet |  | 2 | — | ⚠ sem ambient | — |
| 39 | 201 | 248 | outlet | Termostato 6 | 2 | — | 27 Termostatos, 18 Termostato 6, 15 Comandos | 0 · lamp · SPT6:COMP1<br>0 · presence_sensor · Comp1<br>1 · lamp · SPT6:COMP2<br>1 · presence_sensor · Comp2 |
| 40 | 6 | 248 | outlet | Termostato 7 | 2 | — | 19 Termostato 7, 27 Termostatos, 15 Comandos | 0 · lamp · SPT7:COMP1<br>0 · presence_sensor · Comp1<br>1 · lamp · SPT7:COMP2<br>1 · presence_sensor · Comp2 |
| 41 | 94 | 248 | outlet | SPST2 : COMP1/ COMP2 | 2 | — | 20 Termostato 2, 27 Termostatos, 15 Comandos | 0 · lamp · SPST2 : COMP1<br>0 · presence_sensor · Comp1<br>1 · lamp · SPST2: COMP 2<br>1 · presence_sensor · Comp2 |
| 42 | 107 | 248 | outlet | Termostato 4 | 2 | — | 21 Termostato 4, 27 Termostatos, 15 Comandos | 0 · lamp · SPT4:COMP1<br>0 · presence_sensor · Comp1<br>1 · lamp · SPT4:COMP2<br>1 · presence_sensor · Comp2 |
| 43 | 224 | 248 | outlet | Termostato 3 | 2 | — | 23 Termostato 3, 27 Termostatos, 15 Comandos | 0 · lamp · SPT3:COMP1<br>0 · presence_sensor · Comp1<br>1 · lamp · SPT3:COMP2<br>1 · presence_sensor · Comp2 |
| 44 | 146 | 249 | outlet | SPST5:COMP1/COMP2 | 2 | — | 22 Termostato 5, 27 Termostatos, 15 Comandos | 0 · lamp · SPST5: COMP1<br>0 · presence_sensor · Comp1<br>1 · lamp · SPST5: COMP2<br>1 · presence_sensor · Comp2 |
| 45 | 111 | 248 | outlet | `Gerador Diesel ` ⚠ espaço | 2 | — | 24 Gerador Diesel | 0 · presence_sensor · `Motor Ligado ` ⚠ espaço<br>0 · lamp · c1<br>1 · presence_sensor · Defeito Geral<br>1 · lamp · c2 |
| 46 | 171 | 249 | outlet | Sinal De Rede | 2 | — | 24 Gerador Diesel | 0 · presence_sensor · Rede<br>0 · lamp · c1<br>1 · lamp · c2 |
| 47 | 71 | 249 | outlet | Solenoide Água Potável/caixa De Reuso | 2 | — | 29 Água Potável Entra Novo, 28 Solenoide Água Potável/caixa De Reuso | 0 · inverted_actionable · Solenoide Água Potável/caixa De Reuso |
| 48 | 185 | 249 | outlet | Água Potável Entra Novo | 2 | — | 29 Água Potável Entra Novo | 0 · presence_sensor · Fonte<br>0 · lamp · Teste<br>1 · flow_sensor · Hidr. Água_Potável_Entrada x10 |
| 49 | 139 | 248 | outlet | Sw ENTRADA POTÁVEL Redundância | 2 | — | 29 Água Potável Entra Novo | 0 · lamp · Teste<br>1 · flow_sensor · Hidr. EntradaPotavel_Redundancia x10 |
| 50 | 150 | 248 | outlet | Eletroboia Reuso | 2 | — | 29 Água Potável Entra Novo | 0 · presence_sensor · `Nivel Mínimo Pluvial ` ⚠ espaço<br>0 · lamp · 1<br>1 · lamp · 2 |
| 52 | 174 | 249 | outlet | `Reservatório Inferior ` ⚠ espaço | 2 | — | 16 `Nível ` ⚠ espaço | — |

## Ambients

| id | name | slaves |
|---:|---|---|
| 2 | QGBT ADM | 1, 2, 3 |
| 4 | Splitões | 5, 6, 7, 8 |
| 5 | Ares / Exaustor Cobertura | 10, 12, 13, 24, 26, 28 |
| 6 | Repetidores/Temperatura loja | 14, 29, 30, 31 |
| 7 | Loja Incorp. | 15, 16 |
| 8 | QT Depósito | 17, 18, 19 |
| 9 | Hidraulica | 20, 21, 22 |
| 14 | Desligar Automação | 31 |
| 15 | Comandos | 1, 2, 3, 5, 6, 7, 8, 10, 12, 13, 15, 16, 17, 18, 19, 39, 40, 41, 42, 43, 44 |
| 16 | `Nível ` ⚠ espaço | 32, 33, 52 |
| 17 | Alarmes Bomba Diesel | 34, 35, 36, 37 |
| 18 | Termostato 6 | 39 |
| 19 | Termostato 7 | 40 |
| 20 | Termostato 2 | 41 |
| 21 | Termostato 4 | 42 |
| 22 | Termostato 5 | 44 |
| 23 | Termostato 3 | 43 |
| 24 | Gerador Diesel | 45, 46 |
| 25 | Medição Energia | 9, 23 |
| 26 | remotes | 24, 26, 28 |
| 27 | Termostatos | 5, 6, 7, 8, 39, 40, 41, 42, 43, 44 |
| 28 | Solenoide Água Potável/caixa De Reuso | 47 |
| 29 | Água Potável Entra Novo | 47, 48, 49, 50 |

## Channels sem slave_id

| id | channel | type | name |
|---:|---:|---|---|
| 33 | 0 | lamp | Ref 1 |
| 34 | 1 | lamp | Ref 2 |
| 65 | 0 | lamp | 01 |
| 66 | 1 | lamp | 02 |
| 67 | 0 | plug | Automação OBramax PG |
| 68 | 1 | lamp | 002 |

## RFIR devices

| id | type | category | name | output | slave | cmd ON | cmd OFF |
|---:|---|---|---|---|---|---|---|
| 1 | ir | other | A/C No-break  Springer | both | 24 `A/C No-break ` ⚠ espaço | — | — |
| 2 | ir | other | A/C Springer | both | 26 A/C CPD | — | — |
| 3 | ir | other | A/C Hitachi | both | 26 A/C CPD | — | 11 Command |
| 4 | ir | other | `A/C Hitachi Monitoramento ` ⚠ espaço | both | 28 `A/C Monitoramento ` ⚠ espaço | — | — |
| 5 | ir | other | A/C No-break Hitachi | both | 24 `A/C No-break ` ⚠ espaço | — | — |

## RFIR remotes → buttons

| id | name | rfir_device | buttons (nome · command_id) |
|---:|---|---:|---|
| 1 | Controle  - A/C Rack | 1 | 19C M · 13<br>20C M · 14<br>21C M · 15<br>22C M · 17<br>23 C M · 18<br>24C M · 19<br>Dry 21C · 20<br>Desligar · 21 |
| 2 | `Controle  - A/C ` ⚠ espaço | 2 | on · 8<br>24a · 9 |
| 3 | Controle  - A/C Hitachi | 3 | 19C M · 24<br>20C M · 27<br>21C M · 28<br>22C M · 29<br>Dry 21 M · 30<br>Desligar · 31 |
| 4 | Controle  - A/C Hitachi | 4 | 19C M · 43<br>23C M · 45<br>Desligar · 47 |
| 5 | Controle  - A/C No-break Springer | 5 | ⚠ sem botões |
