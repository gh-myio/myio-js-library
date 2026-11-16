# Slaves & Channels Map — Central Praia Grande (Obramax)

> Central: **Obramax — Praia Grande**
> IPv6: `200:a12e:4703:c680:dfb7:936b:88b9:6f4b`
> Total slaves: 46 · Total channels: 113
> Snapshot DB: 2026-05-20

---

## Convenções de Type / Code (slaves)

| Type                 | Code              | Versão | Significado                                            |
|----------------------|-------------------|--------|--------------------------------------------------------|
| `outlet`             | `002-002-002-012` | 6.0.0  | Sensor outlet padrão — switches, SCDs, temperatura, alarmes |
| `infrared`           | `002-002-002-014` | 7.0.0  | Blaster IR (controle de A/C) ou repetidor passivo      |
| `three_phase_sensor` | `002-002-002-015` | 6.0.0  | Sensor de medição trifásica (quadro elétrico)          |

> ✅ Sem versões anômalas — firmwares consistentes (`6.0.0` / `7.0.0`).

## Tipos de Channel

| `channels.type`       | Significado                                                        |
|-----------------------|--------------------------------------------------------------------|
| `presence_sensor`     | **Entrada digital de estado** (status / alarme). Vira device de status no ThingsBoard. |
| `lamp`                | Saída de iluminação controlável                                    |
| `plug`                | Saída de tomada / split controlável                                |
| `flow_sensor`         | Sensor de vazão de água (contador, sufixo `x10`)                   |
| `pulse_up`            | Comando de pulso momentâneo (liga/desliga por pulso)               |
| `inverted_actionable` | Atuador com lógica invertida                                       |

> Um slave `outlet` tem 2 canais físicos (`channel` 0 e 1); cada canal físico pode expor
> **um atuador** (`lamp`/`plug`) **e um sensor** (`presence_sensor`/`flow_sensor`).
> Slaves `infrared`, `three_phase_sensor` e os `SCD` **não têm linhas em `channels`**.

---

## 1. 🔴 Geração de Energia, Bombas Diesel e Rede

> **Categoria crítica para a investigação de alarmes** — ver
> [`INVESTIGACAO_Alarme_OBRAMAX_PraiaGrande.md`](./INVESTIGACAO_Alarme_OBRAMAX_PraiaGrande.md).
> Slaves `outlet` `002-002-002-012` v6.0.0. Todos os channels são `presence_sensor`.

| Slave | Nome do slave                   | Ch ID | ch | Nome do channel               |
|-------|---------------------------------|-------|----|-------------------------------|
| 45    | Gerador Diesel                  | 93    | 0  | **Motor Ligado**              |
| 45    | Gerador Diesel                  | 94    | 1  | Defeito Geral                 |
| 46    | Sinal De Rede                   | 95    | 0  | **Rede**                      |
| 35    | Alarmes Bombas Diesel Principal | 76    | 0  | Falha Geral                   |
| 35    | Alarmes Bombas Diesel Principal | 77    | 1  | **Motor Ligado**              |
| 34    | Alarmes Bomba Diesel Principal  | 75    | 0  | Seletor Automático            |
| 37    | Bombas Diesel Reserva           | 79    | 0  | Falha Geral (Reserva)         |
| 37    | Bombas Diesel Reserva           | 80    | 1  | **Motor Ligado (Reserva)**    |
| 36    | Bombas Diesel Reserva           | 78    | 0  | Seletor Automático (Reserva)  |

> 🔴 **ACHADO-CHAVE — resolve o mapeamento da investigação:**
> - O device ThingsBoard **`Rede (PG)`** (alarme `Falta de Fase no Gerador`) corresponde ao
>   channel **95 "Rede"** / slave 46 `Sinal De Rede`.
> - O device ThingsBoard **`Motor Ligado (PG)`** (alarme `Bomba Ligada`, em *flapping*)
>   corresponde a um channel chamado literalmente **"Motor Ligado"** — e existem **TRÊS**:
>   - **ch 93** — slave 45 `Gerador Diesel`
>   - **ch 77** — slave 35 `Alarmes Bombas Diesel Principal`
>   - **ch 80** — slave 37 `Bombas Diesel Reserva` (nome "Motor Ligado (Reserva)")
>
> ⚠️ **Ambiguidade**: dois channels têm o nome **idêntico** "Motor Ligado" (93 e 77). Se
> ambos forem sincronizados ao ThingsBoard, colidem no nome do device. **Confirmar qual
> channel alimenta o device `Motor Ligado (PG)`** — provavelmente o **93 (Gerador Diesel)**,
> dado o texto do alarme no Telegram ("gerador ligado"). É a causa-raiz a investigar:
> o `presence_sensor` "Motor Ligado" oscilando a cada ~7,5 min (§ investigação 9.6/9.7).

---

## 2. Água / Reuso / Potável

Slaves `outlet` `002-002-002-012` v6.0.0.

| Slave | Nome do slave                            | Ch ID | ch | Tipo            | Nome do channel                      |
|-------|------------------------------------------|-------|----|-----------------|--------------------------------------|
| 22    | Sw caixa dagua                           | 61    | 0  | presence_sensor | Agua potavel                         |
| 22    | Sw caixa dagua                           | 62    | 1  | presence_sensor | Agua Reuso                           |
| 20    | SW Agua potavel                          | 58    | 0  | presence_sensor | Energia água potavel                 |
| 20    | SW Agua potavel                          | 57    | 1  | flow_sensor     | Água potÁvel(x10)                    |
| 21    | sw REUSO                                 | 60    | 0  | presence_sensor | ENERGIA REUSO                        |
| 21    | sw REUSO                                 | 59    | 1  | flow_sensor     | ÁGUA Reuso(x10)                      |
| 49    | Sw ENTRADA POTÁVEL Redundância           | 113   | 0  | lamp            | Teste                                |
| 49    | Sw ENTRADA POTÁVEL Redundância           | 112   | 1  | flow_sensor     | Hidr. EntradaPotavel_Redundancia x10 |
| 48    | Água Potável Entra Novo                  | 111   | 0  | lamp            | Teste                                |
| 48    | Água Potável Entra Novo                  | 97    | 0  | presence_sensor | Fonte                                |
| 48    | Água Potável Entra Novo                  | 98    | 1  | flow_sensor     | Hidr. Água_Potável_Entrada x10       |
| 47    | Solenoide Água Potável/caixa De Reuso    | 96    | 0  | inverted_actionable | Solenoide Água Potável/caixa De Reuso |
| 50    | Eletroboia Reuso                         | 114   | 0  | presence_sensor | Nivel Mínimo Pluvial                 |
| 50    | Eletroboia Reuso                         | 116   | 0  | lamp            | 1                                    |
| 50    | Eletroboia Reuso                         | 117   | 1  | lamp            | 2                                    |
| 32    | SCD Reuso 132 160 x1.95                  | —     | —  | —               | *(SCD não tem channels)*             |
| 33    | SCD Potável 132 160 x1.95                | —     | —  | —               | *(SCD não tem channels)*             |

> Os `flow_sensor` (57, 59, 98, 112) são os contadores de hidrômetro (sufixo `x10`).
> Channels "Teste" (111, 113) e "1"/"2" (116/117) parecem provisórios — verificar.

---

## 3. Switches — Iluminação / Climatização / Barramentos / Compressores

Slaves `outlet` `002-002-002-012` v6.0.0.

### 3.1 Iluminação e Barramentos

| Slave | Nome do slave              | Ch ID | ch | Tipo            | Nome do channel                            |
|-------|----------------------------|-------|----|-----------------|--------------------------------------------|
| 1     | SW ADM Iluminação Ext. 1   | 1     | 0  | lamp            | Iluminação est. Cob. Retira                |
| 1     | SW ADM Iluminação Ext. 1   | 2     | 1  | lamp            | Iluminação Interna Retira                  |
| 1     | SW ADM Iluminação Ext. 1   | 3     | 0  | presence_sensor | Aut. Selet. 1                              |
| 1     | SW ADM Iluminação Ext. 1   | 4     | 1  | presence_sensor | Aut. Selet. 2                              |
| 2     | SW Barramento I/H          | 5     | 0  | lamp            | Lateral Loja                               |
| 2     | SW Barramento I/H          | 6     | 1  | lamp            | 50% est. Cob.                              |
| 2     | SW Barramento I/H          | 8     | 0  | presence_sensor | Aut. Selet. 3                              |
| 2     | SW Barramento I/H          | 7     | 1  | presence_sensor | Aut. Selet. H                              |
| 3     | Sw Barramento G/F          | 11    | 0  | lamp            | Ilum lateral, postes frente, 50% est. Cob. |
| 3     | Sw Barramento G/F          | 12    | 1  | lamp            | Ilum. Interna Mezanino                     |
| 3     | Sw Barramento G/F          | 9     | 0  | presence_sensor | Aut. Selet. G                              |
| 3     | Sw Barramento G/F          | 10    | 1  | presence_sensor | Aut. Selet. F                              |
| 15    | SW Loja Incorp-Barra.C/D   | 40    | 0  | lamp            | 50% Frente Loja (C)                        |
| 15    | SW Loja Incorp-Barra.C/D   | 41    | 1  | lamp            | 50% Frente Loja (D)                        |
| 15    | SW Loja Incorp-Barra.C/D   | 42    | 0  | presence_sensor | Auto. Selet. 50% Frente Loja (C)           |
| 15    | SW Loja Incorp-Barra.C/D   | 43    | 1  | presence_sensor | Auto. Selet. 50% Frente Loja (D)           |
| 16    | Sw Loja Incorp Barr. E/ F  | 46    | 0  | lamp            | 50% Central e Fundo Loja (E)               |
| 16    | Sw Loja Incorp Barr. E/ F  | 47    | 1  | lamp            | 50% Central e Fundo Loja (F)               |
| 16    | Sw Loja Incorp Barr. E/ F  | 44    | 0  | presence_sensor | Auto. Selet. 50% Central e Fundo Loja (E)  |
| 16    | Sw Loja Incorp Barr. E/ F  | 45    | 1  | presence_sensor | Auto. Selet. 50% Central e Fundo Loja (F)  |
| 17    | SW Depósito Barr G/H       | 50    | 0  | lamp            | 50% Drive e Cer (G)                        |
| 17    | SW Depósito Barr G/H       | 51    | 1  | lamp            | 50% Drive e Cer (H)                        |
| 17    | SW Depósito Barr G/H       | 48    | 0  | presence_sensor | Auto. Selet. 50% Drive e Cer (G)           |
| 17    | SW Depósito Barr G/H       | 49    | 1  | presence_sensor | Auto. Selet. 50% Drive e Cer (H)           |
| 18    | Sw Depósito Barr. i        | 53    | 0  | lamp            | Ilum Externa (I)                           |
| 18    | Sw Depósito Barr. i        | 52    | 0  | presence_sensor | Auto. Selet. Ilum Externa (I)              |
| 19    | SW Depósito Manutenção     | 56    | 0  | lamp            | Depósito                                   |
| 19    | SW Depósito Manutenção     | 55    | 0  | presence_sensor | Auto. Selet. Depósito                      |

### 3.2 Climatização — Splits

| Slave | Nome do slave   | Ch ID | ch | Tipo            | Nome do channel |
|-------|-----------------|-------|----|-----------------|-----------------|
| 5     | Sw Splitao 01   | 13    | 0  | presence_sensor | Aut. Split.6    |
| 5     | Sw Splitao 01   | 14    | 0  | plug            | Splitao 6       |
| 6     | Sw Splitao 1/7  | 15    | 0  | presence_sensor | Aut. Split 1    |
| 6     | Sw Splitao 1/7  | 16    | 1  | presence_sensor | Aut. Split 7    |
| 6     | Sw Splitao 1/7  | 17    | 0  | plug            | Splitao 1       |
| 6     | Sw Splitao 1/7  | 18    | 1  | plug            | Splitao 7       |
| 7     | SW Split 3/2    | 19    | 0  | presence_sensor | Aut. Split 3    |
| 7     | SW Split 3/2    | 20    | 1  | presence_sensor | Aut. Split 2    |
| 7     | SW Split 3/2    | 22    | 0  | plug            | Splitao 3       |
| 7     | SW Split 3/2    | 21    | 1  | plug            | Splitao 2       |
| 8     | SW Splitao 5/4  | 23    | 0  | presence_sensor | Aut. Split 5    |
| 8     | SW Splitao 5/4  | 24    | 1  | presence_sensor | Aut. Split 4    |
| 8     | SW Splitao 5/4  | 25    | 0  | plug            | Splitao 5       |
| 8     | SW Splitao 5/4  | 26    | 1  | plug            | Splitao 4       |

### 3.3 Climatização — Ares / Exaustão

| Slave | Nome do slave          | Ch ID | ch | Tipo            | Nome do channel        |
|-------|------------------------|-------|----|-----------------|------------------------|
| 12    | SW Ares cobertura      | 29    | 0  | presence_sensor | Auto. Ar Exter ADM     |
| 12    | SW Ares cobertura      | 30    | 1  | presence_sensor | Auto. Ar Preparo       |
| 12    | SW Ares cobertura      | 31    | 0  | plug            | AR Extern ADM          |
| 12    | SW Ares cobertura      | 32    | 1  | plug            | AR Extern Preparo      |
| 10    | SW Exaustão QGBT ADM   | 27    | 0  | presence_sensor | Aut. Selet. Exaust     |
| 10    | SW Exaustão QGBT ADM   | 28    | 0  | plug            | Exaust. QGBT ADM       |
| 13    | SW Exaustores coz/San. | 37    | 1  | presence_sensor | Aut. Seletora Exaustor |
| 13    | SW Exaustores coz/San. | 54    | 0  | presence_sensor | Status Comando on      |
| 13    | SW Exaustores coz/San. | 35    | 1  | pulse_up        | Ligar Exasutores       |
| 13    | SW Exaustores coz/San. | 36    | 0  | pulse_up        | Desligar Exaustores    |

### 3.4 Climatização — Compressores (Termostatos / SPST)

| Slave | Nome do slave        | Ch ID | ch | Tipo            | Nome do channel |
|-------|----------------------|-------|----|-----------------|-----------------|
| 39    | Termostato 6         | 81    | 0  | lamp            | SPT6:COMP1      |
| 39    | Termostato 6         | 82    | 1  | lamp            | SPT6:COMP2      |
| 39    | Termostato 6         | 105   | 0  | presence_sensor | Comp1           |
| 39    | Termostato 6         | 106   | 1  | presence_sensor | Comp2           |
| 40    | Termostato 7         | 83    | 0  | lamp            | SPT7:COMP1      |
| 40    | Termostato 7         | 84    | 1  | lamp            | SPT7:COMP2      |
| 40    | Termostato 7         | 107   | 0  | presence_sensor | Comp1           |
| 40    | Termostato 7         | 108   | 1  | presence_sensor | Comp2           |
| 41    | SPST2 : COMP1/ COMP2 | 85    | 0  | lamp            | SPST2 : COMP1   |
| 41    | SPST2 : COMP1/ COMP2 | 86    | 1  | lamp            | SPST2: COMP 2   |
| 41    | SPST2 : COMP1/ COMP2 | 109   | 0  | presence_sensor | Comp1           |
| 41    | SPST2 : COMP1/ COMP2 | 110   | 1  | presence_sensor | Comp2           |
| 42    | Termostato 4         | 87    | 0  | lamp            | SPT4:COMP1      |
| 42    | Termostato 4         | 88    | 1  | lamp            | SPT4:COMP2      |
| 42    | Termostato 4         | 101   | 0  | presence_sensor | Comp1           |
| 42    | Termostato 4         | 102   | 1  | presence_sensor | Comp2           |
| 43    | Termostato 3         | 89    | 0  | lamp            | SPT3:COMP1      |
| 43    | Termostato 3         | 91    | 1  | lamp            | SPT3:COMP2      |
| 43    | Termostato 3         | 99    | 0  | presence_sensor | Comp1           |
| 43    | Termostato 3         | 100   | 1  | presence_sensor | Comp2           |
| 44    | SPST5:COMP1/COMP2    | 90    | 0  | lamp            | SPST5: COMP1    |
| 44    | SPST5:COMP1/COMP2    | 92    | 1  | lamp            | SPST5: COMP2    |
| 44    | SPST5:COMP1/COMP2    | 104   | 0  | presence_sensor | Comp1           |
| 44    | SPST5:COMP1/COMP2    | 103   | 1  | presence_sensor | Comp2           |

> ⚠️ Os channels `presence_sensor` "Comp1"/"Comp2" (id 99–110) têm **nomes idênticos** em
> 6 slaves diferentes — se sincronizados ao TB sem prefixo, colidem. Verificar.

---

## 4. Temperatura — Loja

Slaves `outlet` `002-002-002-012` v6.0.0 (criados 2024-07-12).

| Slave | Nome do slave      | Ch ID | ch | Tipo | Nome do channel    |
|-------|--------------------|-------|----|------|--------------------|
| 29    | Temp. Frente Loja  | 70    | 1  | lamp | S2                 |
| 30    | Temp. Meio Loja    | 71    | 0  | lamp | S3                 |
| 30    | Temp. Meio Loja    | 72    | 1  | lamp | S4                 |
| 31    | Temp. Fundo Loja   | 73    | 0  | lamp | Automação Obramax  |
| 31    | Temp. Fundo Loja   | 74    | 1  | lamp | S6                 |

> ℹ️ Slaves nomeados "Temp." mas com channels `lamp` (S2/S3/S4/S6) — não há channel de
> temperatura propriamente dito. Verificar de onde sai a leitura de temperatura.

---

## 5. A/C — Infravermelho (`infrared`) · 6. Trifásicos · 7. Repetidor · 8. Sem nome

| Slave | Type                 | Code              | Nome do slave        | Channels |
|-------|----------------------|-------------------|----------------------|----------|
| 24    | infrared             | 002-002-002-014   | A/C No-break         | — (usa tabelas `rfir_*`) |
| 26    | infrared             | 002-002-002-014   | A/C CPD              | — (usa tabelas `rfir_*`) |
| 28    | infrared             | 002-002-002-014   | A/C Monitoramento    | — (usa tabelas `rfir_*`) |
| 9     | three_phase_sensor   | 002-002-002-015   | 3F Splitao1          | — (sem channels) |
| 23    | three_phase_sensor   | 002-002-002-015   | 3F Cpd / X/ Rack     | — (sem channels) |
| 14    | outlet               | 002-002-002-012   | Repetidor Final loja | 38 `lamp` ch0 **F1** · 39 `lamp` ch1 **F2** |
| 38 ⚠️ | outlet               | 002-002-002-012   | *(sem nome)*         | — (sem channels) — provável teste abandonado |

---

## 9. Channels órfãos (sem `slave_id`)

| Ch ID | ch | Tipo | Nome do channel        | Observação |
|-------|----|------|------------------------|------------|
| 33    | 0  | lamp | Ref 1                  | sem slave  |
| 34    | 1  | lamp | Ref 2                  | sem slave  |
| 65    | 0  | lamp | 01                     | sem slave  |
| 66    | 1  | lamp | 02                     | sem slave  |
| 68    | 1  | lamp | 002                    | sem slave  |
| 67    | 0  | plug | Automação OBramax PG   | sem slave  |

> ⚠️ 6 channels sem `slave_id` — provavelmente vestígios de teste/diagnóstico. Candidatos a
> limpeza (não estão ligados a hardware).

---

## Resumo

| Categoria (slaves)                              | Slaves | Channels |
|-------------------------------------------------|-------:|---------:|
| Geração / Bombas Diesel / Rede 🔴               | 6      | 9        |
| Água / Reuso / Potável                          | 9      | 15       |
| Switches Iluminação / Barramentos               | 9      | 28       |
| Climatização (Splits / Ares / Exaustão)         | 6      | 24       |
| Climatização — Compressores (Termostato/SPST)   | 6      | 24       |
| Temperatura Loja                                | 3      | 5        |
| A/C Infravermelho                               | 3      | 0        |
| Sensores trifásicos                             | 2      | 0        |
| Repetidor                                       | 1      | 2        |
| SCD (sem channels)                              | 2      | 0        |
| Sem nome / abandonado                           | 1 ⚠️   | 0        |
| Channels órfãos (sem slave)                     | —      | 6        |
| **Total**                                       | **46** | **113**  |

Por `channels.type`: `presence_sensor` 53 · `lamp` 42 · `plug` 10 · `flow_sensor` 4 ·
`pulse_up` 2 · `inverted_actionable` 1.

---

## Mapeamento Channel ↔ Device ThingsBoard

Os channels **`presence_sensor`** são os que viram **devices de status/alarme** no
ThingsBoard (o nome do channel = nome-base do device, + sufixo ` (PG)`).

| Channel (central)            | Device ThingsBoard        | Alarme associado            |
|------------------------------|---------------------------|-----------------------------|
| 95 `Rede` (slave 46)         | `Rede (PG)`               | `Falta de Fase no Gerador`  |
| 93 / 77 `Motor Ligado`       | `Motor Ligado (PG)`       | `Bomba Ligada` (em flapping)|
| 48/49 `Auto. Selet. ... (G/H)` etc. | `Auto. Selet. ... (PG)` | `Chave seletora em manual`  |

> ⚠️ **Riscos de colisão de nome** confirmados pela tabela `channels`:
> 1. **"Motor Ligado"** — channels 77 (slave 35) e 93 (slave 45) têm nome idêntico.
> 2. **"Comp1" / "Comp2"** — channels 99–110, repetidos em 6 slaves.
> 3. **"Teste"** — channels 111 e 113.
> Sem prefixo único por slave, esses devices se sobrepõem no ThingsBoard.

---

## Pontos de atenção (resumo)

1. 🔴 **Mapeamento da investigação resolvido**: `Rede (PG)` ← ch 95; `Motor Ligado (PG)`
   ← ch "Motor Ligado" (93 ou 77 — confirmar). Causa-raiz do flapping está no
   `presence_sensor` "Motor Ligado".
2. ⚠️ **Nome de channel duplicado "Motor Ligado"** (77 e 93) — risco de colisão no TB.
3. ⚠️ **Nomes de slave ambíguos**: `34` vs `35` (Bomba/Bombas Diesel Principal); `36` ≡ `37`.
4. ⚠️ **Channels "Comp1"/"Comp2"** repetidos em 6 slaves (39–44).
5. ⚠️ **Slave 38 sem nome**; **6 channels órfãos** (sem slave) — candidatos a limpeza.
6. Channels "Teste" (111/113) e "1"/"2" (116/117) parecem provisórios.
7. Slaves `infrared` (24/26/28), `three_phase_sensor` (9/23) e `SCD` (32/33) **não têm
   linhas em `channels`** — leitura vem por outro caminho (`rfir_*` / leitura direta).

---

## Próximos passos

- [ ] Confirmar qual channel "Motor Ligado" (77 vs 93) alimenta o device TB `Motor Ligado (PG)`.
- [ ] Consultar a tabela `logs` filtrando `slave_id IN (34,35,36,37,45,46)` e
      `channel IN (0,1)` na janela 18–20/05 (ver `manual-centrais-linix-orangepi.md` §5.3).
- [ ] Investigar a oscilação de ~7,5 min do `presence_sensor` "Motor Ligado".
- [ ] Padronizar nomes de channels duplicados (Motor Ligado, Comp1/Comp2, Teste).
