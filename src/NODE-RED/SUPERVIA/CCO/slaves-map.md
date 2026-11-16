# Slaves Map — Central Supervia CCO 2026-10-05 (Supervia Estações)

> Central: **Central Supervia CCO 2026-10-05 (Supervia Estações)** · Gateway `fb924430-a756-4a45-842a-e55b6cb091dc` · Central ID `242.37.202.62` · Frequência `45`
> IPv6: `201:4536:897d:52fc:3bd0:c93f:df9f:51e4`
> Total slaves: **86** · channels: **71** · ambients: **32** · `ambients_rfir_slaves_rel`: **270** · `ambients_rfir_devices_rel`: **0**
> RFIR: `rfir_devices`: **29** · `rfir_remotes`: **29** · `rfir_commands`: **127** · `rfir_buttons`: **72**
> Capturado em **2026-11-16 14:46 UTC** por `dump-cadastro.py` (somente leitura).
> Dados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · [`ambients_slaves_rel.json`](ambients_slaves_rel.json) · [`ambients_devices_rel.json`](ambients_devices_rel.json)
> Tipos de slave: `three_phase_sensor` 42 · `outlet` 24 · `infrared` 20

## Slaves

| id | addr_low | addr_high | type | name | ch | clamp | ambients | channels (nº · type · name) |
|---:|---:|---:|---|---|---:|---:|---|---|
| 3 | 3 | 240 | three_phase_sensor | 3F.Consumo.FC1.1.(25TR) | 2 | 0 | 23 Medidores Energia, 3 ` NOBREACK , TELECOMUNICAÇÃOES - (FANCOIL1)` ⚠ espaço, 24 Fancoils, 37 Todos | — |
| 9 | 8 | 240 | outlet | SW OFF Fancoil 2.1 | 2 | — | 37 Todos, 4 ATENDIMENTO AO CLIENTE - (FANCOIL 2) | 0 · pulse_down · Fancoil 2.1 OFF |
| 16 | 15 | 240 | outlet | SW ON FC1.1+FC1.2 | 2 | — | 3 ` NOBREACK , TELECOMUNICAÇÃOES - (FANCOIL1)` ⚠ espaço, 37 Todos | 0 · pulse_up · Fancoil 1.2 ON (25TR)<br>1 · pulse_up · Fancoil 1.1 ON (25TR) |
| 17 | 16 | 240 | outlet | SW OFF FC1.1+FC1.2 | 2 | — | 3 ` NOBREACK , TELECOMUNICAÇÃOES - (FANCOIL1)` ⚠ espaço, 37 Todos | 0 · pulse_down · Fancoil 1.2 OFF (25TR)<br>1 · pulse_down · Fancoil 1.1 OFF (25TR) |
| 19 | 18 | 240 | outlet | SW OFF FC3.1+FC3.2 | 2 | — | 5 SALA DE RELÉ , TI , DESCOMPRESSÃO - (FANCOIL 3), 37 Todos | 0 · pulse_down · Fancoil 3.1 OFF (CA04)<br>1 · pulse_down · Fancoil 3.2 OFF (CA05) |
| 20 | 19 | 240 | outlet | SW ON FC3.1+FC3.2 | 2 | — | 5 SALA DE RELÉ , TI , DESCOMPRESSÃO - (FANCOIL 3), 37 Todos | 0 · pulse_up · Fancoil 3.1 ON (CA04)<br>1 · pulse_up · Fancoil 3.2 ON (CA05) |
| 26 | 22 | 240 | infrared | Repet.3.Casa.Fancoil.5 | 0 | — | 25 Comunicação, 6 `RECEPÇÃO TERREO , ADIMINISTRAÇÃO PESSOAL - (FANCOIL 5) ` ⚠ espaço, 37 Todos | — |
| 27 | 23 | 240 | outlet | SW OFF FC5.1 | 2 | — | 37 Todos, 6 `RECEPÇÃO TERREO , ADIMINISTRAÇÃO PESSOAL - (FANCOIL 5) ` ⚠ espaço | 1 · pulse_down · Fancoil 5.1 OFF |
| 29 | 25 | 240 | outlet | SW ON FC5.1 | 2 | — | 37 Todos, 6 `RECEPÇÃO TERREO , ADIMINISTRAÇÃO PESSOAL - (FANCOIL 5) ` ⚠ espaço | 0 · pulse_up · Fancoil 5.1 ON |
| 30 | 26 | 240 | infrared | Repet.1.Casa.Fancoil.5 | 0 | — | 25 Comunicação, 6 `RECEPÇÃO TERREO , ADIMINISTRAÇÃO PESSOAL - (FANCOIL 5) ` ⚠ espaço, 37 Todos | — |
| 33 | 29 | 240 | outlet | SW OFF FC4.1 | 2 | — | 7 INFRA, ARRECADAÇÃO, POSTO MEDICO, SERVIÇO SOCIAL  - (FANCOIL 4), 37 Todos, 39 SAUDE OCUPACIONAL , RECURSOS HUM , INFRAESTRUTURA  - (FANCOIL 4) | 0 · pulse_down · Fancoil 4.1 OFF |
| 34 | 30 | 240 | outlet | SW ON FC4.1 | 2 | — | 7 INFRA, ARRECADAÇÃO, POSTO MEDICO, SERVIÇO SOCIAL  - (FANCOIL 4), 37 Todos | 0 · pulse_up · Fancoil 4.1 ON |
| 36 | 32 | 240 | three_phase_sensor | 3F.Consumo.FC1.2.(25TR) | 2 | 0 | 23 Medidores Energia, 3 ` NOBREACK , TELECOMUNICAÇÃOES - (FANCOIL1)` ⚠ espaço, 24 Fancoils, 37 Todos | — |
| 48 | 43 | 240 | outlet | SW FC8.1+FC8.2 | 2 | — | 40 GUAPIMIRIM , COMPLIANCE , PARACAMBI, SEG PATRIMONIAL - (FANCOIL 8), 12 (FANCOIL8.1) SILVAFREIRE, MADUREIRA, MARACANÃ, JAPERI, BANGU, NOVAIGUAÇU, CIRCULAÇÃO (FANCOIL8.2) GUAPIMIRIM, COMPLIANCE, PARACAMBI, SEGURANÇA., 37 Todos | 0 · plug · Fancoil 8.1 ON-OFF<br>1 · plug · Fancoil 8.2 ON-OFF |
| 49 | 44 | 240 | three_phase_sensor | 3F.Consumo.FC3.2.(CA05) | 2 | 0 | 5 SALA DE RELÉ , TI , DESCOMPRESSÃO - (FANCOIL 3), 23 Medidores Energia, 24 Fancoils, 37 Todos | — |
| 50 | 45 | 240 | three_phase_sensor | 3F.Consumo.FC3.1.(CA04) | 2 | 0 | 5 SALA DE RELÉ , TI , DESCOMPRESSÃO - (FANCOIL 3), 23 Medidores Energia, 24 Fancoils, 37 Todos | — |
| 52 | 47 | 240 | three_phase_sensor | 3F.Consumo FC8.2 | 2 | 0 | 23 Medidores Energia, 12 (FANCOIL8.1) SILVAFREIRE, MADUREIRA, MARACANÃ, JAPERI, BANGU, NOVAIGUAÇU, CIRCULAÇÃO (FANCOIL8.2) GUAPIMIRIM, COMPLIANCE, PARACAMBI, SEGURANÇA., 24 Fancoils, 37 Todos | — |
| 53 | 48 | 240 | three_phase_sensor | 3F.Consumo FC9.1 | 3 | 0 | 9 COSE, CISE E SALA DE CRISE - (Fancoil 9), 23 Medidores Energia, 24 Fancoils, 37 Todos | — |
| 56 | 51 | 240 | three_phase_sensor | `3F.Consumo FC4.1 ` ⚠ espaço | 2 | 0 | 23 Medidores Energia, 7 INFRA, ARRECADAÇÃO, POSTO MEDICO, SERVIÇO SOCIAL  - (FANCOIL 4), 24 Fancoils, 37 Todos | — |
| 57 | 52 | 248 | three_phase_sensor | 3F.Consumo.FC5.1.Recepção | 3 | 0 | 23 Medidores Energia, 24 Fancoils, 37 Todos, 6 `RECEPÇÃO TERREO , ADIMINISTRAÇÃO PESSOAL - (FANCOIL 5) ` ⚠ espaço | — |
| 58 | 53 | 240 | three_phase_sensor | 3F.Consumo FC10.1 | 2 | 0 | 23 Medidores Energia, 13 Fancoil 10, 24 Fancoils, 37 Todos | — |
| 59 | 55 | 240 | three_phase_sensor | 3F.Consumo FC10.3 | 2 | 0 | 23 Medidores Energia, 13 Fancoil 10, 24 Fancoils, 37 Todos | — |
| 60 | 54 | 240 | three_phase_sensor | 3F.Consumo FC10.2 | 2 | 0 | 23 Medidores Energia, 13 Fancoil 10, 24 Fancoils, 37 Todos | — |
| 61 | 56 | 240 | three_phase_sensor | 3F.Consumo FC10.4 | 2 | 0 | 23 Medidores Energia, 13 Fancoil 10, 24 Fancoils, 37 Todos | — |
| 64 | 59 | 240 | infrared | Repet.2.Casa.Fancoil.5 | 0 | — | 25 Comunicação, 37 Todos, 6 `RECEPÇÃO TERREO , ADIMINISTRAÇÃO PESSOAL - (FANCOIL 5) ` ⚠ espaço | — |
| 66 | 57 | 240 | three_phase_sensor | 3F.Consumo FC9.2 | 3 | 0 | 9 COSE, CISE E SALA DE CRISE - (Fancoil 9), 23 Medidores Energia, 24 Fancoils, 37 Todos | — |
| 72 | 58 | 240 | three_phase_sensor | 3F.Consumo FC8.1 | 2 | 0 | 23 Medidores Energia, 12 (FANCOIL8.1) SILVAFREIRE, MADUREIRA, MARACANÃ, JAPERI, BANGU, NOVAIGUAÇU, CIRCULAÇÃO (FANCOIL8.2) GUAPIMIRIM, COMPLIANCE, PARACAMBI, SEGURANÇA., 24 Fancoils, 37 Todos | — |
| 73 | 61 | 240 | three_phase_sensor | 3F.Consumo FC7.1 | 3 | 0 | 23 Medidores Energia, 11 RECEPÇÃO , COPA , SALA , DEODORO, CENTRAL E CENTRALZINHA (FANCOIL 7), 24 Fancoils, 37 Todos | — |
| 75 | 63 | 240 | three_phase_sensor | 3F.Consumo FC6.1.Adm | 2 | — | 23 Medidores Energia, 10 DIRETORIA , PRESIDENCIA, OSWALDO CRUZ, JURÍDICO (FANCOIL 6.3) SALÃO ADMINISTRATICO E RH (FANCOIL 6.2)  SALÃO ADMINISTRATIVO (FANCOIL 6.1) - (FANCOIL 6) -, 24 Fancoils, 37 Todos | — |
| 76 | 64 | 248 | three_phase_sensor | 3F.Consumo FC6.2 | 2 | 0 | 23 Medidores Energia, 10 DIRETORIA , PRESIDENCIA, OSWALDO CRUZ, JURÍDICO (FANCOIL 6.3) SALÃO ADMINISTRATICO E RH (FANCOIL 6.2)  SALÃO ADMINISTRATIVO (FANCOIL 6.1) - (FANCOIL 6) -, 24 Fancoils, 37 Todos | — |
| 77 | 65 | 240 | outlet | SW ON-OFF FC6.3 | 2 | — | 10 DIRETORIA , PRESIDENCIA, OSWALDO CRUZ, JURÍDICO (FANCOIL 6.3) SALÃO ADMINISTRATICO E RH (FANCOIL 6.2)  SALÃO ADMINISTRATIVO (FANCOIL 6.1) - (FANCOIL 6) -, 37 Todos | 0 · plug · Diretoria (Fancoil 6.3) ON-OFF |
| 78 | 66 | 248 | three_phase_sensor | 3F.Consumo.FC6.3.Diretoria | 2 | 0 | 23 Medidores Energia, 10 DIRETORIA , PRESIDENCIA, OSWALDO CRUZ, JURÍDICO (FANCOIL 6.3) SALÃO ADMINISTRATICO E RH (FANCOIL 6.2)  SALÃO ADMINISTRATIVO (FANCOIL 6.1) - (FANCOIL 6) -, 24 Fancoils, 37 Todos | — |
| 79 | 67 | 240 | outlet | SW ON FC7.1 | 2 | — | 11 RECEPÇÃO , COPA , SALA , DEODORO, CENTRAL E CENTRALZINHA (FANCOIL 7), 37 Todos | 0 · pulse_up · Recepção (Fancoil 7.1) OFF |
| 80 | 68 | 240 | outlet | SW OFF FC7.1 | 2 | — | 11 RECEPÇÃO , COPA , SALA , DEODORO, CENTRAL E CENTRALZINHA (FANCOIL 7), 37 Todos | 0 · pulse_down · Recepção (Fancoil 7.1) ON |
| 87 | 75 | 248 | outlet | SW ON Fancoil 2.1 | 2 | — | 37 Todos, 4 ATENDIMENTO AO CLIENTE - (FANCOIL 2) | 0 · pulse_up · Fancoil 2.1 ON |
| 90 | 78 | 248 | infrared | Temp.3 Sala CCO | 0 | — | 10 DIRETORIA , PRESIDENCIA, OSWALDO CRUZ, JURÍDICO (FANCOIL 6.3) SALÃO ADMINISTRATICO E RH (FANCOIL 6.2)  SALÃO ADMINISTRATIVO (FANCOIL 6.1) - (FANCOIL 6) -, 24 Fancoils, 37 Todos, 19 Temperaturas Salas | — |
| 91 | 79 | 248 | infrared | Temp.4 Relé | 0 | — | 5 SALA DE RELÉ , TI , DESCOMPRESSÃO - (FANCOIL 3), 24 Fancoils, 37 Todos, 19 Temperaturas Salas | — |
| 94 | 82 | 248 | outlet | SW FC6.1+FC6.2 | 2 | — | 10 DIRETORIA , PRESIDENCIA, OSWALDO CRUZ, JURÍDICO (FANCOIL 6.3) SALÃO ADMINISTRATICO E RH (FANCOIL 6.2)  SALÃO ADMINISTRATIVO (FANCOIL 6.1) - (FANCOIL 6) -, 37 Todos | 0 · plug · Salão Adm (Fancoil 6.1) ON-OFF<br>1 · plug · Salão Adm e RH (Fancoil 6.2) ON-OFF |
| 99 | 28 | 249 | three_phase_sensor | 3F.Consumo.FC2.1.(7,5TR) | 3 | 0 | 23 Medidores Energia, 24 Fancoils, 37 Todos, 4 ATENDIMENTO AO CLIENTE - (FANCOIL 2) | — |
| 100 | 181 | 248 | three_phase_sensor | 3F BAG 3.0 | 3 | 0 | 14 CENTRAL DE ÁGUA GELADA - (BOMBA DE ÁGUA GELADA), 37 Todos | — |
| 101 | 54 | 249 | three_phase_sensor | 3F BAG 2.0 | 3 | 0 | 14 CENTRAL DE ÁGUA GELADA - (BOMBA DE ÁGUA GELADA), 37 Todos | — |
| 102 | 230 | 248 | three_phase_sensor | 3F BAG 1.0 | 3 | 0 | 14 CENTRAL DE ÁGUA GELADA - (BOMBA DE ÁGUA GELADA), 37 Todos | — |
| 103 | 198 | 249 | three_phase_sensor | 3F BAC 1.0 | 3 | 0 | 15 CENTRAL DE ÁGUA GELADA - (BOMBA DE AGUA CONDENSADA), 37 Todos | — |
| 104 | 232 | 248 | three_phase_sensor | 3F BAC 2.0 | 3 | 0 | 15 CENTRAL DE ÁGUA GELADA - (BOMBA DE AGUA CONDENSADA), 37 Todos | — |
| 105 | 82 | 249 | three_phase_sensor | 3F BAC 3.0 | 3 | 0 | 15 CENTRAL DE ÁGUA GELADA - (BOMBA DE AGUA CONDENSADA), 37 Todos | — |
| 106 | 156 | 249 | three_phase_sensor | 3F Torre 1 | 3 | 0 | 16 CENTRAL DE RESFRIAMENTO - (TORRE DE RESFRIAMENTO), 37 Todos | — |
| 107 | 147 | 249 | three_phase_sensor | 3F Torre 2 | 3 | 0 | 16 CENTRAL DE RESFRIAMENTO - (TORRE DE RESFRIAMENTO), 37 Todos | — |
| 108 | 214 | 249 | three_phase_sensor | 3F Torre 3.0 | 3 | 0 | 16 CENTRAL DE RESFRIAMENTO - (TORRE DE RESFRIAMENTO), 37 Todos | — |
| 109 | 143 | 248 | outlet | Sw BAG 1.0/2.0 | 2 | — | 14 CENTRAL DE ÁGUA GELADA - (BOMBA DE ÁGUA GELADA), 37 Todos | 0 · lamp · BAG 1.0<br>0 · presence_sensor · Auto BAG 1.0<br>1 · lamp · BAG 2.0<br>1 · presence_sensor · Auto BAG 2.0 |
| 110 | 244 | 249 | outlet | SW BAG 3.0 / BAC 1.0 | 2 | — | 14 CENTRAL DE ÁGUA GELADA - (BOMBA DE ÁGUA GELADA), 15 CENTRAL DE ÁGUA GELADA - (BOMBA DE AGUA CONDENSADA), 37 Todos | 0 · lamp · BAG 3.0<br>1 · lamp · BAC 1.0 |
| 111 | 250 | 249 | outlet | SW BAC 2.0/ BAC 3.0 | 2 | — | 15 CENTRAL DE ÁGUA GELADA - (BOMBA DE AGUA CONDENSADA), 37 Todos | 0 · lamp · BAC 2.0<br>1 · lamp · BAC 3.0 |
| 112 | 148 | 249 | outlet | SW Torre 1.0 /2 | 2 | — | 16 CENTRAL DE RESFRIAMENTO - (TORRE DE RESFRIAMENTO), 37 Todos | 0 · lamp · Torre 2<br>0 · presence_sensor · Termostato Torre 1.0<br>1 · lamp · Torre 1<br>1 · presence_sensor · Termostato Torre 2.0 |
| 113 | 44 | 249 | outlet | SW Torre 3.0 | 2 | — | 16 CENTRAL DE RESFRIAMENTO - (TORRE DE RESFRIAMENTO), 37 Todos | 0 · lamp · Torre 3<br>0 · presence_sensor · Termostato Torre 3.0 |
| 114 | 178 | 248 | infrared | `Temp. Sala_Nobreak ` ⚠ espaço | 1 | — | 3 ` NOBREACK , TELECOMUNICAÇÃOES - (FANCOIL1)` ⚠ espaço, 26 Sala Nobreak, 37 Todos, 19 Temperaturas Salas | — |
| 115 | 141 | 248 | infrared | RM Telecom 1 | 1 | — | 3 ` NOBREACK , TELECOMUNICAÇÃOES - (FANCOIL1)` ⚠ espaço, 27 Sala Telecom 1, 37 Todos | — |
| 116 | 137 | 248 | infrared | RM Telecom 2 | 1 | — | 28 Telecom 2, 37 Todos | — |
| 117 | 202 | 248 | infrared | Tempo. Sala Relé  Direita | 1 | — | 35 `Sala De Relé ` ⚠ espaço, 37 Todos | — |
| 118 | 229 | 248 | infrared | `Temp. Sala Relé Esquerda ` ⚠ espaço | 1 | — | 35 `Sala De Relé ` ⚠ espaço, 37 Todos | — |
| 120 | 117 | 248 | three_phase_sensor | 3F Telecom_5 / x /  Telecom_7 | 3 | 0 | 35 `Sala De Relé ` ⚠ espaço, 26 Sala Nobreak, 27 Sala Telecom 1, 28 Telecom 2, 37 Todos | — |
| 121 | 65 | 249 | three_phase_sensor | 3F Telecom_6 / x /  Telecom_8 | 3 | 0 | 35 `Sala De Relé ` ⚠ espaço, 26 Sala Nobreak, 27 Sala Telecom 1, 28 Telecom 2, 37 Todos | — |
| 122 | 142 | 249 | three_phase_sensor | 3F Relés_1 / x / Telecon1Porta | 3 | 0 | 35 `Sala De Relé ` ⚠ espaço, 26 Sala Nobreak, 27 Sala Telecom 1, 28 Telecom 2, 37 Todos | — |
| 123 | 33 | 249 | three_phase_sensor | 3F Nobreak_2 /  x  / Nobreak_4 | 3 | 0 | 35 `Sala De Relé ` ⚠ espaço, 26 Sala Nobreak, 27 Sala Telecom 1, 28 Telecom 2, 37 Todos | — |
| 124 | 108 | 248 | three_phase_sensor | 3F Ti_AC01 / x /  Ti_AC02 | 3 | 0 | 34 Sala TI x, 26 Sala Nobreak, 27 Sala Telecom 1, 28 Telecom 2, 37 Todos | — |
| 125 | 109 | 248 | three_phase_sensor | 3F Baterias_AC01 / x / Baterias_AC02 | 3 | 0 | 31 Sala De baterias(subEstacao), 26 Sala Nobreak, 27 Sala Telecom 1, 28 Telecom 2, 37 Todos | — |
| 126 | 187 | 248 | infrared | Temp. CPD | 1 | — | 30 CPD, 37 Todos | — |
| 127 | 39 | 249 | infrared | `Remote AC Esquerdo ` ⚠ espaço | 1 | — | 31 Sala De baterias(subEstacao), 37 Todos | — |
| 128 | 96 | 249 | infrared | `Remote Centro ` ⚠ espaço | 1 | — | 31 Sala De baterias(subEstacao), 37 Todos | — |
| 129 | 36 | 249 | infrared | Temp. Sala  TI Maior | 1 | — | 34 Sala TI x, 5 SALA DE RELÉ , TI , DESCOMPRESSÃO - (FANCOIL 3), 37 Todos | — |
| 130 | 11 | 249 | infrared | `Temp. Sala Ti Sala Menor ` ⚠ espaço | 1 | — | 34 Sala TI x, 37 Todos, 5 SALA DE RELÉ , TI , DESCOMPRESSÃO - (FANCOIL 3) | — |
| 131 | 189 | 249 | infrared | `Temp. Apoio Logistico ` ⚠ espaço | 1 | — | 32 Guarita Apoio Logístico, 37 Todos | — |
| 132 | 31 | 249 | three_phase_sensor | `3F Apoio_Logistico ` ⚠ espaço | 3 | 0 | 32 Guarita Apoio Logístico, 37 Todos | — |
| 133 | 128 | 249 | infrared | Guarita Estacionamento | 1 | — | 33 `Guarita Estacionamento ` ⚠ espaço, 37 Todos | — |
| 134 | 12 | 249 | three_phase_sensor | 3F Guarita Estacionamento | 3 | 0 | 33 `Guarita Estacionamento ` ⚠ espaço, 37 Todos | — |
| 135 | 139 | 248 | three_phase_sensor | 3F Refeitorio_AC01 / x / Refeitorio_AC02 | 3 | 0 | 29 Refeitório x, 26 Sala Nobreak, 27 Sala Telecom 1, 28 Telecom 2, 37 Todos | — |
| 136 | 238 | 248 | infrared | ` Refeitorio AC 01` ⚠ espaço | 1 | — | 29 Refeitório x, 37 Todos | — |
| 137 | 223 | 248 | infrared | Refeitorio Ac 02 | 1 | — | 29 Refeitório x, 37 Todos | — |
| 138 | 132 | 249 | three_phase_sensor | Chiler 02 1Q1 | 3 | 1 | 22 CENTRAL DE ÁGUA GELADA - (CHILLER 1 e 2), 37 Todos | — |
| 139 | 46 | 248 | three_phase_sensor | Chiller 02_2Q1 | 3 | 1 | 22 CENTRAL DE ÁGUA GELADA - (CHILLER 1 e 2), 37 Todos | — |
| 140 | 228 | 249 | three_phase_sensor | Chiller 01_1Q1 | 3 | 1 | 22 CENTRAL DE ÁGUA GELADA - (CHILLER 1 e 2), 37 Todos | — |
| 141 | 227 | 249 | three_phase_sensor | Chiller 01_2Q1 | 3 | 1 | 22 CENTRAL DE ÁGUA GELADA - (CHILLER 1 e 2), 37 Todos | — |
| 142 | 39 | 248 | infrared | Temp.Sala Presidência | 1 | — | 10 DIRETORIA , PRESIDENCIA, OSWALDO CRUZ, JURÍDICO (FANCOIL 6.3) SALÃO ADMINISTRATICO E RH (FANCOIL 6.2)  SALÃO ADMINISTRATIVO (FANCOIL 6.1) - (FANCOIL 6) -, 36 `Sala Presidência ` ⚠ espaço, 37 Todos | — |
| 143 | 163 | 248 | three_phase_sensor | `3F CPD_Direito / x / CPD_Esquerdo ` ⚠ espaço | 3 | 0 | 30 CPD, 26 Sala Nobreak, 27 Sala Telecom 1, 28 Telecom 2, 37 Todos | — |
| 144 | 248 | 248 | outlet | Temp.Recep.Salão ADM | 2 | — | 19 Temperaturas Salas | 0 · lamp · Check |
| 145 | 75 | 249 | outlet | Temp.Salão L.D | 2 | — | 19 Temperaturas Salas, 10 DIRETORIA , PRESIDENCIA, OSWALDO CRUZ, JURÍDICO (FANCOIL 6.3) SALÃO ADMINISTRATICO E RH (FANCOIL 6.2)  SALÃO ADMINISTRATIVO (FANCOIL 6.1) - (FANCOIL 6) - | — |
| 146 | 11 | 248 | outlet | Temp.Salão L.E | 2 | — | 10 DIRETORIA , PRESIDENCIA, OSWALDO CRUZ, JURÍDICO (FANCOIL 6.3) SALÃO ADMINISTRATICO E RH (FANCOIL 6.2)  SALÃO ADMINISTRATIVO (FANCOIL 6.1) - (FANCOIL 6) -, 19 Temperaturas Salas | — |
| 147 | 109 | 249 | outlet | `Temp. Sala Presidencia ` ⚠ espaço | 2 | — | 10 DIRETORIA , PRESIDENCIA, OSWALDO CRUZ, JURÍDICO (FANCOIL 6.3) SALÃO ADMINISTRATICO E RH (FANCOIL 6.2)  SALÃO ADMINISTRATIVO (FANCOIL 6.1) - (FANCOIL 6) -, 19 Temperaturas Salas | — |

## Ambients

| id | name | slaves |
|---:|---|---|
| 3 | ` NOBREACK , TELECOMUNICAÇÃOES - (FANCOIL1)` ⚠ espaço | 3, 16, 17, 36, 114, 115 |
| 4 | ATENDIMENTO AO CLIENTE - (FANCOIL 2) | 9, 87, 99 |
| 5 | SALA DE RELÉ , TI , DESCOMPRESSÃO - (FANCOIL 3) | 19, 20, 49, 50, 91, 129, 130 |
| 6 | `RECEPÇÃO TERREO , ADIMINISTRAÇÃO PESSOAL - (FANCOIL 5) ` ⚠ espaço | 26, 27, 29, 30, 57, 64 |
| 7 | INFRA, ARRECADAÇÃO, POSTO MEDICO, SERVIÇO SOCIAL  - (FANCOIL 4) | 33, 34, 56 |
| 9 | COSE, CISE E SALA DE CRISE - (Fancoil 9) | 53, 66 |
| 10 | DIRETORIA , PRESIDENCIA, OSWALDO CRUZ, JURÍDICO (FANCOIL 6.3) SALÃO ADMINISTRATICO E RH (FANCOIL 6.2)  SALÃO ADMINISTRATIVO (FANCOIL 6.1) - (FANCOIL 6) - | 75, 76, 77, 78, 90, 94, 142, 145, 146, 147 |
| 11 | RECEPÇÃO , COPA , SALA , DEODORO, CENTRAL E CENTRALZINHA (FANCOIL 7) | 73, 79, 80 |
| 12 | (FANCOIL8.1) SILVAFREIRE, MADUREIRA, MARACANÃ, JAPERI, BANGU, NOVAIGUAÇU, CIRCULAÇÃO (FANCOIL8.2) GUAPIMIRIM, COMPLIANCE, PARACAMBI, SEGURANÇA. | 48, 52, 72 |
| 13 | Fancoil 10 | 58, 59, 60, 61 |
| 14 | CENTRAL DE ÁGUA GELADA - (BOMBA DE ÁGUA GELADA) | 100, 101, 102, 109, 110 |
| 15 | CENTRAL DE ÁGUA GELADA - (BOMBA DE AGUA CONDENSADA) | 103, 104, 105, 110, 111 |
| 16 | CENTRAL DE RESFRIAMENTO - (TORRE DE RESFRIAMENTO) | 106, 107, 108, 112, 113 |
| 19 | Temperaturas Salas | 88, 90, 91, 92, 114, 144, 145, 146, 147 |
| 22 | CENTRAL DE ÁGUA GELADA - (CHILLER 1 e 2) | 95, 96, 97, 138, 139, 140, 141 |
| 23 | Medidores Energia | 3, 36, 49, 50, 52, 53, 56, 57, 58, 59, 60, 61, 66, 72, 73, 75, 76, 78, 95, 96, 97, 99 |
| 24 | Fancoils | 3, 36, 49, 50, 52, 53, 56, 57, 58, 59, 60, 61, 66, 72, 73, 75, 76, 78, 88, 90, 91, 92, 99 |
| 25 | Comunicação | 26, 30, 64 |
| 26 | Sala Nobreak | 114, 120, 121, 122, 123, 124, 125, 135, 143 |
| 27 | Sala Telecom 1 | 115, 120, 121, 122, 123, 124, 125, 135, 143 |
| 28 | Telecom 2 | 116, 120, 121, 122, 123, 124, 125, 135, 143 |
| 29 | Refeitório x | 135, 136, 137 |
| 30 | CPD | 126, 143 |
| 31 | Sala De baterias(subEstacao) | 125, 127, 128 |
| 32 | Guarita Apoio Logístico | 131, 132 |
| 33 | `Guarita Estacionamento ` ⚠ espaço | 133, 134 |
| 34 | Sala TI x | 124, 129, 130 |
| 35 | `Sala De Relé ` ⚠ espaço | 117, 118, 120, 121, 122, 123 |
| 36 | `Sala Presidência ` ⚠ espaço | 142 |
| 37 | Todos | 3, 9, 13, 14, 16, 17, 19, 20, 23, 25, 26, 27, 28, 29, 30, 32, 33, 34, 36, 48, 49, 50, 52, 53, 56, 57, 58, 59, 60, 61, 64, 66, 72, 73, 75, 76, 77, 78, 79, 80, 87, 88, 90, 91, 92, 94, 95, 96, 97, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143 |
| 39 | SAUDE OCUPACIONAL , RECURSOS HUM , INFRAESTRUTURA  - (FANCOIL 4) | 33 |
| 40 | GUAPIMIRIM , COMPLIANCE , PARACAMBI, SEG PATRIMONIAL - (FANCOIL 8) | 48 |

## Channels sem slave_id

| id | channel | type | name |
|---:|---:|---|---|
| 1 | 0 | plug | Desligar 1 |
| 2 | 1 | plug | Desligar 2 |
| 3 | 0 | plug | Ligar 1 |
| 4 | 1 | plug | Ligar 2 |
| 5 | 0 | plug | Desligar Bomba1 |
| 6 | 1 | plug | Desligar Bomba 2 |
| 7 | 0 | plug | Ligar Bomba1 |
| 8 | 1 | plug | Ligar Bomba 2 |
| 11 | 0 | pulse_up | BAG 1          ON |
| 12 | 1 | pulse_up | BAG 2          ON |
| 13 | 0 | pulse_down | BAG 1          OFF |
| 16 | 0 | lamp | T01 |
| 17 | 1 | lamp | T02 |
| 18 | 0 | pulse_down | BAG 2          OFF |
| 19 | 0 | pulse_down | BAG 3          OFF |
| 22 | 0 | pulse_up | BAG 3          ON |
| 23 | 1 | pulse_up | BAC 3         ON |
| 28 | 0 | pulse_up | FC2.1 LIGAR |
| 34 | 0 | plug | Bomba4 on |
| 37 | 0 | pulse_down | B6 l1 |
| 38 | 1 | lamp | B6 l2 |
| 50 | 0 | pulse_down | T1 |
| 51 | 0 | pulse_up | F7 ligar |
| 54 | 0 | plug | FC6.1 LIGAR / DESLIGAR |
| 55 | 1 | plug | FC6.2 LIGAR/ DESLIGAR |
| 57 | 0 | plug | Ligar-desligar fc6.1 |
| 58 | 1 | plug | Ligar fc6.2 |
| 59 | 0 | plug | FC6.1 |
| 60 | 1 | plug | FC6.2 |
| 66 | 0 | lamp | T1 |
| 67 | 1 | lamp | T2 |
| 68 | 0 | lamp | T1 |
| 69 | 1 | lamp | T2 |
| 72 | 0 | plug | Fc6.1 |
| 73 | 1 | plug | Fc6.2 |

## RFIR devices

| id | type | category | name | output | slave | cmd ON | cmd OFF |
|---:|---|---|---|---|---|---|---|
| 1 | ir | tv | Teste | — | 26 Repet.3.Casa.Fancoil.5 | — | — |
| 2 | ir | tv | Teste | — | 30 Repet.1.Casa.Fancoil.5 | — | — |
| 3 | ir | tv | Teste | — | None | — | — |
| 4 | ir | tv | Test | — | None | — | — |
| 5 | ir | tv | Tet | — | 64 Repet.2.Casa.Fancoil.5 | — | — |
| 6 | ir | ac | T1 | — | 88 — | — | — |
| 7 | ir | ac | T2 | — | None | — | — |
| 8 | ir | ac | T3 | — | 90 Temp.3 Sala CCO | — | — |
| 9 | ir | ac | T4 | — | 91 Temp.4 Relé | — | — |
| 10 | ir | ac | T5 | — | 92 — | — | — |
| 11 | ir | other | AC Nobreak_2 | intern | 114 `Temp. Sala_Nobreak ` ⚠ espaço | — | — |
| 12 | ir | other | AC Telecon 1 Porta(3) | extern | 115 RM Telecom 1 | — | — |
| 13 | ir | other | AC Nobreak_1 | extern | 114 `Temp. Sala_Nobreak ` ⚠ espaço | — | — |
| 14 | ir | other | AC Telecon 2 Parede | extern | 116 RM Telecom 2 | — | — |
| 15 | ir | other | AC Telecon 2 Meio | intern | 116 RM Telecom 2 | — | — |
| 16 | ir | other | AC Telecon 1 Direita (?) | intern | 115 RM Telecom 1 | — | — |
| 17 | ir | other | Ar Relé Direita (5) | both | 117 Tempo. Sala Relé  Direita | — | — |
| 18 | ir | other | Ar Relé Esquerda(6) | both | 118 `Temp. Sala Relé Esquerda ` ⚠ espaço | — | — |
| 19 | ir | other | `AC CPD Esquerdo ` ⚠ espaço | intern | 126 Temp. CPD | — | — |
| 20 | ir | other | `AC CPD Direito ` ⚠ espaço | intern | 126 Temp. CPD | — | — |
| 21 | ir | other | `AC Baterias_AC01 ` ⚠ espaço | intern | 127 `Remote AC Esquerdo ` ⚠ espaço | — | — |
| 22 | ir | other | AC 60k(Interna) | intern | 128 `Remote Centro ` ⚠ espaço | — | — |
| 23 | ir | other | `AC Baterias_AC02 ` ⚠ espaço | extern | 128 `Remote Centro ` ⚠ espaço | — | — |
| 24 | ir | other | AC Ti AC02 | both | 129 Temp. Sala  TI Maior | — | — |
| 25 | ir | other | AC Ti_AC01 | intern | 130 `Temp. Sala Ti Sala Menor ` ⚠ espaço | — | — |
| 26 | ir | other | AC Refeitório_AC01 | both | 136 ` Refeitorio AC 01` ⚠ espaço | — | — |
| 27 | ir | other | AC Refeitório_AC02 | intern | 137 Refeitorio Ac 02 | — | — |
| 28 | ir | other | Ac Guarita Estacionamento | both | 133 Guarita Estacionamento | — | — |
| 29 | ir | other | `AC Apoio_Logistico ` ⚠ espaço | both | 131 `Temp. Apoio Logistico ` ⚠ espaço | — | — |

## RFIR remotes → buttons

| id | name | rfir_device | buttons (nome · command_id) |
|---:|---|---:|---|
| 1 | Controle  - Teste | 1 | ⚠ sem botões |
| 2 | Controle  - Teste | 2 | ⚠ sem botões |
| 3 | Controle  - Teste | 3 | ⚠ sem botões |
| 4 | Controle  - Test | 4 | ⚠ sem botões |
| 5 | Controle  - Tet | 5 | ⚠ sem botões |
| 6 | Controle  - T1 | 6 | ⚠ sem botões |
| 7 | Controle  - T2 | 7 | ⚠ sem botões |
| 8 | Controle  - T3 | 8 | ⚠ sem botões |
| 9 | Controle  - T4 | 9 | ⚠ sem botões |
| 10 | Controle  - T5 | 10 | ⚠ sem botões |
| 11 | Controle  - Ar porta | 11 | 19C · 7<br>21C · 8<br>23C · 9<br>`Desligar ` ⚠ espaço · 10 |
| 12 | `Controle  - AC Porta ` ⚠ espaço | 12 | 19C · 21<br>21C · 22<br>`23C ` ⚠ espaço · 23<br>`Desligar ` ⚠ espaço · 24 |
| 13 | Controle  - Ar Canto | 13 | 19C · 11<br>21C · 12<br>23C · 13<br>`Desligar ` ⚠ espaço · 14 |
| 14 | Controle  - AC Parede | 14 | 19C · 40<br>21C · 42<br>23C · 43<br>`Desligar ` ⚠ espaço · 44 |
| 15 | Controle  - AC Meio | 15 | 19C · 32<br>21C · 37<br>23C · 38<br>`Desligar ` ⚠ espaço · 39 |
| 16 | `Controle  - AC Direita ` ⚠ espaço | 16 | 19C · 25<br>21C · 27<br>23C · 28<br>`Desligar ` ⚠ espaço · 29 |
| 17 | `Controle  - Ar Relé Direita ` ⚠ espaço | 17 | 19C · 45<br>21C · 47<br>`23C ` ⚠ espaço · 48<br>`Desligar ` ⚠ espaço · 49 |
| 18 | Controle  - Ar Relé Esquerda | 18 | 19C · 50<br>`Desligar ` ⚠ espaço · 51<br>21C · 52<br>23C · 53 |
| 19 | `Controle  - Esquerdo ` ⚠ espaço | 19 | 18C · 85<br>21C · 86<br>`Desligar ` ⚠ espaço · 87 |
| 20 | `Controle  - Direito ` ⚠ espaço | 20 | 18C · 82<br>21C · 83<br>`Desligar ` ⚠ espaço · 84 |
| 21 | `Controle  - AC Esquedo ` ⚠ espaço | 21 | 18 · 59<br>21 · 60<br>ligar 23 · 62<br>desligar · 65 |
| 22 | Controle  - Teste Interno | 22 | 18 · 70<br>21 · 71<br>Desligar · 73 |
| 23 | Controle  - Teste Interno | 23 | 19C · 88<br>21C · 89<br>`Desligar ` ⚠ espaço · 90 |
| 24 | Controle  - Sala Maior | 24 | 19C · 92<br>21C · 93<br>23C · 94<br>`Desligar ` ⚠ espaço · 95 |
| 25 | Controle  - Sala Menor | 25 | 19C · 96<br>21C · 97<br>23C · 100<br>`Desligar ` ⚠ espaço · 103 |
| 26 | Controle  - AC01 | 26 | 19C · 117<br>21C · 118<br>23C · 120<br>`Desligar ` ⚠ espaço · 121 |
| 27 | Controle  - AC02 | 27 | 19C · 104<br>21C · 108<br>23C · 113<br>`Desligar ` ⚠ espaço · 114 |
| 28 | Controle  - Ac Guarita 2 | 28 | 19C · 77<br>21C · 78<br>23C · 79<br>`Desligar ` ⚠ espaço · 80 |
| 29 | Controle  - AC Guarita 1 | 29 | 19C · 124<br>21C · 125<br>23C · 126<br>`Desligar ` ⚠ espaço · 127 |
