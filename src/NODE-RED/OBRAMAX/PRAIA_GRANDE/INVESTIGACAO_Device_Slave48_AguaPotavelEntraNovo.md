# Investigação de Device — `Água Potável Entra Novo` (slave 48)

> **Status:** ⏸️ **PAUSADO em 2026-05-28** — cadeia de publicação rastreada; envio matematicamente correto. Falta rodar T1–T4 para confirmar bug do widget.
> **Última atualização:** 2026-05-28
> **Resumo curto:** dashboard mostra anomalias `Min > Avg` (matematicamente impossíveis no envio — §B), portanto o bug é **no widget/recebimento TB** (hipótese F1 🔥). Cadeia rastreada: postgres SQL → Map devices → function (adiciona `(PG)`) → `mqtt out` → `mqtt.myio-bas.com:1883` topic `v1/gateway/telemetry`. Detalhes em §A.
>
> **Central:** Obramax Praia Grande (`200:a12e:4703:c680:dfb7:936b:88b9:6f4b`)
> **Customer TB:** `f3455100-8360-11ef-a17c-dfe898a3f1e0`
> **Data inicial:** 2026-05-25
> **Referências:** [`slaves-map.md`](./slaves-map.md) §2 · `manual-centrais-linix-orangepi.md` §1/§4
>
> **🎯 Para retomar:** começar pela seção **⭐ Foco → Queries (T1–T4)** — em especial **(T3)** no `ts_kv` do TB para confirmar `Min ≤ Avg ≤ Max` no que foi enviado. Decide se o bug é do widget (F1) ou de outra fonte.

---

## ⭐ Foco — `pulses` × `pulsesHourlyAverage` × `pulsesHourlyAverageMin` (envio × dashboard)

> **Pergunta-chave:** o que o Node-RED **envia** para o ThingsBoard nessas 3 chaves
> bate com o que o **dashboard mostra** para o usuário?

### Evidência — dashboard ThingsBoard, 2026-05-25 (hoje)

Device: `Hidr. Água_Potável_Entrada x10` (slave 48 / ch 98).
**Total exibido no painel:** **9.830 L hoje**.

| Hora (GMT-3) | Média Horária | Mínima Horária | Litros (hoje) |
|--------------|--------------:|---------------:|--------------:|
| 03–04 | 2790    | 2790      | 0    |
| 04–05 | 860     | **1485** ⚠️ | 0    |
| 05–06 | 1718.3  | 750       | 0    |
| 06–07 | 1726.4  | 10        | 0    |
| 07–08 | 1423.8  | 10        | 0    |
| 08–09 | 2342.1  | 400       | **3570** |
| 09–10 | 2441.1  | 80        | 0    |
| 10–11 | 2554.4  | 560       | 0    |
| 11–12 | 2593.8  | 1140      | 0    |
| 12–13 | 2099.2  | 40        | **3190** |
| 13–14 | 2508.10 | 20        | 0    |
| 14–15 | 1970.7  | **3070** ⚠️ | 480  |
| 15–16 | 1508.80 | 10        | 0    |
| 16–17 | 2418    | 230       | 0    |
| 17–18 | 1388    | 20        | 0    |
| **Σ (sanidade)** | **30 342,7** | **10 615** | **7 240** |

### Sanity checks — anomalias visíveis nos dados acima

1. ⚠️ **`Mínima > Média` em 2 horas** — **matematicamente impossível** pela construção da
   query SQL (§3.2): por definição `MIN(hourly_sum) ≤ AVG(hourly_sum)`.
   - **04–05** → Média 860 vs Mínima **1485**
   - **14–15** → Média 1970,7 vs Mínima **3070**

   Possíveis explicações: (a) colunas Min/Avg **trocadas no widget**; (b) bug na pipeline
   publicando valores cruzados; (c) **dois devices homônimos** publicando no mesmo entity
   (cf. OBS-7 do `INVESTIGACAO_Alarme_*`).

2. ⚠️ **Total exibido (9 830 L) ≠ Σ da coluna "Litros" (7 240 L)** — divergência de **2 590 L**.
   - Σ "Média Horária" = 30 342,7 (≠ 9 830)
   - Σ "Mínima Horária" = 10 615 (≠ 9 830)

   Origem do "Total hoje" precisa ser identificada — provavelmente vem de **outra chave**
   (talvez o contador acumulado `pulses` × 10 no instante da leitura).

3. ⚠️ **"Litros" = 0 em 12 das 15 horas** — para entrada de água potável de uma loja em
   horário comercial, é improvável. Os 3 valores não-zero (3570 / 3190 / 480 L) parecem
   **enchimentos de cisterna em batch**, com horas zeradas entre eles. Verificar se a
   coluna calcula **delta de contador** entre amostras.

4. **`Média == Mínima` em 03–04 (2790 cada)** — coerente se só 1 dia tem dados para a
   hora 03 (slave criado 2026-03-12 + ingestão noturna esparsa) → Min = Max = Média = único
   valor.

### Hipóteses a verificar

| # | Hipótese | Status | Como verificar |
|---|----------|--------|----------------|
| **F1** 🔥 | Widget do dashboard tem **Min/Avg trocados** em alguma linha | **PROVÁVEL — ver §A** (envio é matematicamente correto) | Comparar `ts_kv` (`pulsesHourlyAverage` × `…Min` × `…Max`) hora a hora — (T3) |
| **F2** | Pipeline dispara 2× por hora ou colide com outro device | Possível — verificar nº de samples / hora | Contar samples em `ts_kv` (deveria ser 1/hora) |
| **F3** | Coluna "Litros" calcula **delta de `pulses`** (batches de cisterna) | Possível | Comparar com `channel_pulse_log` slave 48 ch 1 |
| **F4** | "Total 9 830 L" vem de **outra chave** (ex.: contador acumulado `pulses` × 10) | Provável | Listar chaves do device (T2) |
| **F5** | Dois devices TB homônimos publicando — um dá Média, outro dá Min | Possível | `SELECT id,name FROM device WHERE name ILIKE '%hidr%potavel%'` (T1) |

### Queries para AGORA — comparar envio × display

```sql
-- (T1) ThingsBoard — entity_id do device
SELECT id, name, type FROM device WHERE name ILIKE '%hidr%potavel%entrada%';

-- (T2) ThingsBoard — listar TODAS as chaves do device hoje (GMT-3)
--      Identifica de onde sai o "Total 9 830 L"
SELECT kd.key, count(*) AS amostras,
       min(tk.long_v) AS min_l, max(tk.long_v) AS max_l,
       min(tk.dbl_v)  AS min_d, max(tk.dbl_v)  AS max_d
FROM ts_kv tk JOIN key_dictionary kd ON kd.key_id = tk.key
WHERE tk.entity_id = '<UUID>'
  AND tk.ts >= (EXTRACT(EPOCH FROM TIMESTAMP '2026-05-25 00:00:00-03')*1000)::bigint
GROUP BY kd.key ORDER BY count(*) DESC;

-- (T3) ThingsBoard — série hora-a-hora HOJE das 3 chaves alvo
--      (compara com a tabela do dashboard linha por linha)
SELECT to_timestamp(tk.ts/1000) AT TIME ZONE 'America/Sao_Paulo' AS hora,
       kd.key, tk.long_v, tk.dbl_v
FROM ts_kv tk JOIN key_dictionary kd ON kd.key_id = tk.key
WHERE tk.entity_id = '<UUID>'
  AND kd.key IN ('pulses','pulsesHourlyAverage','pulsesHourlyAverageMin','pulsesHourlyAverageMax')
  AND tk.ts >= (EXTRACT(EPOCH FROM TIMESTAMP '2026-05-25 00:00:00-03')*1000)::bigint
ORDER BY tk.ts, kd.key;

-- (T4) CENTRAL PG (DB hubot) — pulsos brutos HOJE do slave 48 ch 1
--      Esperado: hora a hora deve casar com a coluna 'Litros' / 10 do dashboard
SELECT date_trunc('hour', timestamp) AS hora,
       SUM(value)        AS pulsos_hora,
       SUM(value) * 10   AS litros_estimados
FROM channel_pulse_log
WHERE slave_id = 48 AND channel = 1
  AND timestamp >= date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo')
GROUP BY hora ORDER BY hora;
```

### Como vou ler os 3 resultados

| Comparação | Decide |
|------------|--------|
| (T3) `pulsesHourlyAverage`/`…Min`/`…Max` × tabela do dashboard | F1 / F2 — se valores casarem mas estiverem em colunas trocadas → widget bug; se não casarem → pipeline bug |
| (T4) pulsos central × (T3) `pulses` no TB | F3 — confirma se o "Litros" mostrado é delta do `pulses` |
| (T2) chave com 1 sample / valor enorme | F4 — provável fonte do "9 830 L total" |
| (T1) >1 linha | F5 — colisão de nomes (mesmo padrão da OBS-7) |

### §A — Cadeia de publicação MQTT rastreada (Node-RED → ThingsBoard)

Decifrada lendo o flow backup. **6 pipelines convergem** num único publisher MQTT:

```
[Get 30 days average every hour]  link out dd26b6d7 ┐
[Get pulses every 10 min]         link out c65c3035 ┤
[telemetria real-time x2]         link outs 3cc5e4e3, 17d1c236 ┼─► link in e917d9d9
[Min temperature → Control]       link out 6bc51d1c ┤        │
[Demand → Control]                link out 97f1ad80 ┘        ▼
                                                  function 7cf444b7 (adiciona " (PG)")
                                                              │
                                                              ▼
                                              mqtt out "Thingsboard PE"
                                              broker:  mqtt.myio-bas.com:1883
                                              topic:   v1/gateway/telemetry  (TB Gateway API)
                                              clientid: ak0a8m0pdofe3hyt4gc3
```

**Function `7cf444b7` (snippet exato):**

```js
const keys = Object.keys(msg.payload);
const newPayload = keys.reduce((acc, key) => {
    acc[`${key} (PG)`] = msg.payload[key];   // 🔑 hardcoded " (PG)"
    return acc;
}, {});
msg.payload = newPayload;
```

➡️ **Daqui sai o sufixo `(PG)`** em todos os device names do TB. Hardcoded para Praia
Grande — em outra unidade marcaria "(PG)" erradamente (bug latente).

**Formato publicado** (TB Gateway API espera exatamente esse JSON):

```json
{
  "Hidr. Água_Potável_Entrada x10 (PG)": [
    { "ts": <ms>, "values": {
        "pulsesHourlyAverage":    <num>,
        "pulsesHourlyAverageMin": <num>,
        "pulsesHourlyAverageMax": <num>
    }}
  ]
}
```

### §B — 🔥 Conclusão sobre as anomalias `Min > Avg`

A query SQL do `Get 30 days average every hour` calcula `MIN()`, `AVG()`, `MAX()` sobre o
**mesmo conjunto** `hourly_sum`. Pela definição matemática de agregação:

> `MIN ≤ AVG ≤ MAX` — **garantido**.

Logo, as duas linhas anômalas da tabela do dashboard (`04–05: Mín 1485 > Méd 860` e
`14–15: Mín 3070 > Méd 1970,7`) **não podem ter origem no envio**. A causa está:

1. **Mais provável (F1):** no **widget do dashboard** — colunas Min e Avg trocadas, ou
   *keys* mapeadas erradas no template.
2. **Possível (F2):** dois pipelines publicando com keys cruzadas.
3. **Possível (F5):** dois devices TB homônimos misturando dados.

A query **(T3)** decide entre os três — ela mostra exatamente os 3 valores enviados por
hora para a chave correta. Se na (T3) **`pulsesHourlyAverageMin ≤ pulsesHourlyAverage`**
sempre, então o envio está OK e o bug é puramente do widget (F1 confirmado).

> ℹ️ **Sobre o `emitter.js`** (node type `myio-emitter`): esse pipeline NÃO usa `emitter` —
> publica direto via `mqtt out` padrão. Não precisamos inspecionar `emitter.js` para esta
> investigação. O `emitter` MyIO é usado em fluxos diferentes (provavelmente comandos
> cloud → central).

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| `slave_id` | **48** |
| `name` (slave) | **`Água Potável Entra Novo`** |
| `type` (slave) | `outlet` |
| `code` | `002-002-002-012` |
| `version` | `6.0.0` |
| `addr_low / addr_high` | `185 / 249` |
| `created_at` | `2026-03-12 18:35:37` |
| `updated_at` | `2026-04-16 16:05:18` |
| Categoria (slaves-map) | §2 Água / Reuso / Potável |

### Channels do slave 48 (3)

| Ch ID | ch | Tipo                  | Nome do channel                          | Criado | Observação |
|-------|----|-----------------------|------------------------------------------|--------|------------|
| 97    | 0  | `presence_sensor`     | `Fonte`                                  | 2026-03-12 | status de presença de fonte |
| **98** | **1** | **`flow_sensor`** | **`Hidr. Água_Potável_Entrada x10`**     | 2026-03-12 (upd. 2026-04-16) | **🔑 hidrômetro alvo desta investigação** — contador de pulsos com multiplicador `×10` |
| 111   | 0  | `lamp`                | `Teste`                                  | 2026-04-16 | ⚠️ channel provisório — slaves-map §2 |

---

## 2. Hardware / Modbus

`channelConfig` do slave (extraído de `slaves.config`):

```json
{
  "channelConfig": {
    "channel0": { "slaveId": 48, "channel": 0, "channel_type": "REMOTE_INPUT",    "pulses": 1, "output": "HOLDING" },
    "channel1": { "slaveId": 48, "channel": 1, "channel_type": "PULSE_ON_POWER",  "pulses": 1, "output": "HOLDING" }
  }
}
```

- **ch1 = `PULSE_ON_POWER`** → contagem de pulsos de hidrômetro (cada pulso de energia = 1 evento) → alimenta o `flow_sensor` ch98.
- **ch0 = `REMOTE_INPUT`** → entrada digital usada pelo `presence_sensor` "Fonte" (ch97) e pelo `lamp` "Teste" (ch111).

> O sufixo **`x10`** no nome do channel 98 é um **multiplicador parseado por SQL** no Node-RED
> (regex `x([0-9.]+)`) — ver §3.2. Cada pulso = **10 unidades** (provavelmente **litros**).

---

## 3. Pipeline de processamento — Node-RED

Flow: `bkp-all-flows-node-red-obramax-praia-grande-2026-05-20-10-29.json`

### 3.1 Onde o slave 48 aparece (diretamente)

Por ser um `flow_sensor`, o slave 48 entra **automaticamente** em todos os pipelines que
iteram `flow.get('devices')` filtrando `type === 'flow_sensor'`. As linhas explícitas com
"slave 48" / "channel 98" são **inexistentes** — a configuração vem do `slaves` no banco
local e o flow age sobre o conjunto inteiro de hidrômetros.

### 3.2 Pipelines (Flow 1) que consomem este channel

| Grupo / pipeline (Flow 1) | Frequência | O que produz para o ch 98 |
|---------------------------|-----------|---------------------------|
| `Get pulses every 10 min` | a cada 10 min | série de pulsos brutos por device |
| `Get 30 days average every hour` | a cada **1 h** | **`pulsesHourlyAverage` / `…Min` / `…Max`** (ver `INVESTIGACAO_Alarme*` §… e o nó `Map devices` 3698e036.d2c23) |
| `API Export Water` (×2) | HTTP on-demand | exporta consumo de hidrômetros (usa `x10` como multiplicador) |
| Pipeline interno usando `regexp_match(name, 'x([0-9.]+)')` (postgres node `aedff484.e22a9`) | on-demand | aplica multiplicador `×10` aos pulsos para virar consumo em litros |

### 3.3 Tabelas locais (DB `hubot`) que recebem dados deste channel

- **`channel_pulse_log`** — log bruto de pulsos por `(slave_id, channel, timestamp, value)`.
  Queries-chave em §8.

---

## 4. Telemetria produzida → ThingsBoard

### 4.1 Chaves esperadas (a confirmar via `ts_kv`)

| Chave (key)              | Origem                    | Periodicidade | Unidade |
|--------------------------|---------------------------|---------------|---------|
| `pulses` (raw)           | Get pulses every 10 min   | 10 min        | pulsos  |
| **`pulsesHourlyAverage`**| Get 30 days average / h   | 1 h           | pulsos / hora |
| `pulsesHourlyAverageMin` | idem                      | 1 h           | pulsos / hora |
| `pulsesHourlyAverageMax` | idem                      | 1 h           | pulsos / hora |
| Consumo em litros (×10)  | aplicado nas APIs/queries | sob demanda   | litros |

### 4.2 Mapeamento `channel ↔ device ThingsBoard`

O `flow_sensor` ch98 deve estar exposto no TB como o device cujo **nome bate com o do channel**:
**`Hidr. Água_Potável_Entrada x10`** (ou variação adicionando ` (PG)`).

**Verificar `entity_id` do device TB:**

```sql
SELECT id, name, type,
       to_timestamp(created_time/1000) AT TIME ZONE 'America/Sao_Paulo' AS criado
FROM device
WHERE name ILIKE '%hidr%potavel%entrada%' OR name ILIKE '%potavel entra novo%';
```

> ⚠️ **Risco de colisão de nome (vide OBS-7 do `INVESTIGACAO_Alarme*`):**
> O channel irmão `Hidr. EntradaPotavel_Redundancia x10` (ch112, slave 49) tem nome
> **diferente** o suficiente — provavelmente **não** colide. Mas há um channel
> `Água potÁvel(x10)` (ch57, slave 20) que é semanticamente o **mesmo equipamento**
> (entrada de potável original) — verificar se hoje há **dois devices distintos** no TB
> ou se houve substituição/migração.

---

## 5. Contexto — evolução do sistema de água potável da PG

Há **três medidores** de potável, criados em momentos diferentes — sugere upgrade/redundância:

| Slave | Nome | Channel hidrômetro | Criado | Papel provável |
|-------|------|-------------------|--------|----------------|
| 20    | `SW Agua potavel` | ch 57 `Água potÁvel(x10)` | 2024-01-31 | **Original** (instalação inicial) |
| **48** | **`Água Potável Entra Novo`** | **ch 98 `Hidr. Água_Potável_Entrada x10`** | **2026-03-12** | **Nova entrada** (foco desta investigação) |
| 49    | `Sw ENTRADA POTÁVEL Redundância` | ch 112 `Hidr. EntradaPotavel_Redundancia x10` | 2026-04-16 | **Redundância** |

Apoio:
- Slave 47 `Solenoide Água Potável/caixa De Reuso` (ch 96, `inverted_actionable`) — atuador.
- Slave 22 `Sw caixa dagua` (ch 61 `Agua potavel` presence) — status de caixa.
- Slave 33 `SCD Potável 132 160 x1.95` — SCD (Sensor Contador D'Água) com fator distinto `×1.95`.

> ❓ A coexistência de **3 medidores** de potável + 1 SCD na mesma unidade levanta a pergunta:
> são pontos físicos distintos do sistema, ou é redundância/teste? Mapear fisicamente.

---

## 6. Pontos de atenção / hipóteses

### ⚠️ 6.1 Channel "Teste" (ch 111) no mesmo slave

O slave 48 recebeu, em **2026-04-16**, um channel adicional `lamp` chamado `Teste` (ch 111).
A pasta sister (slave 49) também tem um `Teste` (ch 113). Já flagado como **colisão de nome
"Teste"** (OBS-7 do `INVESTIGACAO_Alarme*`). Confirmar se é teste/debug deixado para trás.

### ❓ 6.2 Multiplicador `×10` — semântica

A regex no postgres node parseia `x10` do nome → multiplica por 10. Confirmar com a equipe se
a unidade é **litros** (caso típico de hidrômetro com fator ×10 = 10 L/pulso) — porque vai
afetar todo o cálculo de consumo de potável desta unidade.

### ❓ 6.3 Substituição × convivência com slave 20

Os pulsos do slave 20 (`SW Agua potavel` / ch 57) continuam sendo registrados em
`channel_pulse_log` após 2026-03-12? Se sim → 2 medidores ativos no mesmo ponto = **dupla
contagem**. Se não → houve substituição e o slave 20 deveria ser desativado.

### ❓ 6.4 Channel `Fonte` (ch 97)

`presence_sensor` "Fonte" — o que esse status representa fisicamente? Presença/ausência de
água? Sinal da bomba que alimenta? Documentar.

---

## 7. Queries de investigação

### 7.1 Central PG (DB `hubot`)

```sql
-- (A) Pulsos brutos do hidrômetro nos últimos 7 dias
SELECT date_trunc('hour', timestamp) AS hora, SUM(value) AS pulsos_hora
FROM channel_pulse_log
WHERE slave_id = 48 AND channel = 1
  AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY hora ORDER BY hora;

-- (B) Comparar com o medidor original (slave 20 ch 1) — verificar dupla contagem
SELECT slave_id, channel,
       date_trunc('day', timestamp) AS dia,
       SUM(value) AS pulsos_dia,
       SUM(value) * CASE WHEN slave_id = 48 THEN 10
                         WHEN slave_id = 20 THEN 10
                         WHEN slave_id = 49 THEN 10
                    END AS litros_dia
FROM channel_pulse_log
WHERE (slave_id, channel) IN ((48,1),(20,1),(49,1))
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY slave_id, channel, dia ORDER BY dia, slave_id;

-- (C) Última atividade dos channels do slave 48
SELECT channel, MAX(timestamp) AS ultima_leitura, COUNT(*) AS amostras
FROM channel_pulse_log
WHERE slave_id = 48
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY channel;
```

### 7.2 ThingsBoard (DB `ts_kv`)

```sql
-- (D) Descobrir o entity_id do device "Hidr. Água Potável Entrada"
SELECT id, name FROM device WHERE name ILIKE '%hidr%potavel%entrada%';

-- (E) Chaves de telemetria do device (key_dictionary disponível)
SELECT key, count(*) AS amostras,
       to_timestamp(min(ts)/1000) AT TIME ZONE 'America/Sao_Paulo' AS primeiro,
       to_timestamp(max(ts)/1000) AT TIME ZONE 'America/Sao_Paulo' AS ultimo
FROM ts_kv WHERE entity_id = '<UUID>'
GROUP BY key ORDER BY key;
```

> Para resolver o nome textual da `key`, fazer JOIN com `key_dictionary`:
> `JOIN key_dictionary kd ON kd.key_id = ts_kv.key`.

---

## 8. Itens em aberto

**Foco atual** (⭐ topo do doc):
- [ ] Rodar **(T1)** — descobrir `entity_id` do device TB.
- [ ] Rodar **(T2)** — listar chaves do device hoje, identificar de onde sai o "Total 9 830 L".
- [ ] Rodar **(T3)** — série hora-a-hora de hoje p/ as 3 chaves alvo e cruzar com a tabela do dashboard.
- [ ] Rodar **(T4)** — pulsos brutos da central no slave 48 ch 1 e comparar com (T3).
- [ ] **Confirmar/refutar** as anomalias `Mínima > Média` (04–05 e 14–15).
- [ ] **Confirmar/refutar** a divergência total-exibido (9 830) × Σ "Litros" (7 240).

**Contexto / device:**
- [ ] Confirmar a unidade do multiplicador `×10` (litros?).
- [ ] Cruzar slaves 20 e 48 — substituição × dupla contagem (query B).
- [ ] Documentar o que `Fonte` (ch 97) representa fisicamente.
- [ ] Decidir se o channel `Teste` (ch 111) é provisório e deve ser removido.
- [ ] Comparar com o medidor de redundância (slave 49 ch 112) — vazões devem bater.

---

## 9. Referências

- Investigação de alarme (mesma unidade): [`INVESTIGACAO_Alarme_OBRAMAX_PraiaGrande.md`](./INVESTIGACAO_Alarme_OBRAMAX_PraiaGrande.md)
- Mapa de slaves/channels: [`slaves-map.md`](./slaves-map.md) §2
- Manual das centrais: `../../GLOBAL_INFO/manual-centrais-linix-orangepi.md`
- Flow Node-RED: [`bkp-all-flows-node-red-obramax-praia-grande-2026-05-20-10-29.json`](./bkp-all-flows-node-red-obramax-praia-grande-2026-05-20-10-29.json) — Flow 1, grupos `Get pulses every 10 min`, `Get 30 days average every hour`, `API Export Water`.
