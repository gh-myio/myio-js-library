# Investigação de Alarme — OBRAMAX / Praia Grande (PG)

> **Status:** ⏸️ **PAUSADO em 2026-05-28** — diagnóstico preliminar fechado; aguardando confirmação da hipótese de colisão (§9.11) e ações de campo (§1.1).
> **Última atualização:** 2026-05-28
> **Resumo curto:** flapping de 116 alarmes `Bomba Ligada` em 13 h (18/05 18:06 → 19/05 07:30) decifrado. Hipótese mais forte: **dois channels "Motor Ligado" homônimos colidindo no mesmo device TB** (§9.11). Falta query `device WHERE name ILIKE '%motor ligado%'` para confirmar 1 ou 2 entities.
>
> **Unidade:** Obramax Praia Grande (sufixo de device `(PG)`)
> **Data do evento:** 2026-05-19, ~06:49 (GMT-3)
> **Canal da evidência:** Grupo Telegram "Alarmes Grupo Especial de..." (bot `Myio Dashboard`)
> **Evidência:** [`Evidencia_Alarme_Telegram_OBRAMAX_PraiaGrande.png`](./Evidencia_Alarme_Telegram_OBRAMAX_PraiaGrande.png)
> **Rule chain de referência:** [`../bkp-rule-chain-thingsboard-obramax-2026-05-20-10-34.json`](../bkp-rule-chain-thingsboard-obramax-2026-05-20-10-34.json) (`ruleChain.name = "Obramax"`, `metadata.version = 48`)
>
> **🎯 Para retomar:** começar por **§1.1 (Itens em aberto)** — tem a query SQL pronta para confirmar/refutar a hipótese de colisão.

---

## 1. Resumo executivo

No dia **2026-05-19 ~06:49** a unidade **Praia Grande** sofreu uma **queda de energia da
concessionária**. O grupo especial de alarmes do Telegram recebeu uma sequência de mensagens
de **abertura e fechamento de alarme** referentes ao device `Motor Ligado (PG)` (tipo de alarme
`Bomba Ligada`), com **duração de 0 segundos** — caracterizando *flapping* (alarme oscilando).

O operador da **HELEXIA** reportou no próprio grupo:

> *"@Rodrigo Leite HELEXIA — falha no alarme global da PG, bombas não partiram e tivemos alarme"*

Ou seja, há **dois problemas a investigar**, possivelmente relacionados:

1. **Operacional** — durante a falta de energia, as **bombas não partiram** (provavelmente
   deveriam partir no gerador). É uma falha de campo / automação elétrica.
2. **Telemetria/alarme** — o "alarme global da PG" falhou e/ou gerou mensagens
   **inconsistentes e enganosas** no Telegram (ver §5 e §6).

Este documento consolida todo o conhecimento necessário para a investigação.

> **🔴 Achado relevante (tabela `alarm` — §9):** o device **`Rede (PG)`** da Praia Grande
> (`5226a330-…`) tem um alarme **`Falta de Fase no Gerador` CRITICAL ainda ATIVO**
> (`cleared = false`), iniciado em **19/05/2026 07:33:06** e nunca limpo. Na amostra
> analisada, foi o **único device da Praia Grande que alarmou**.
>
> **🔎 Sobre "o Node-RED não ligou a bomba" (§10):** o Node-RED da Praia Grande **não tem
> lógica de partida de bomba** — só automatiza iluminação/clima e monitora/notifica. A
> partida de bomba em queda de energia é **função elétrica (QTA/ATS)**, fora do Node-RED.
> O alarme `Bomba Ligada` oscilando é **sintoma** de um motor que tentou partir e não
> sustentou — não é o Node-RED "deixando de ligar". Ver §10.4.
>
> **🔴 Causa do "alarme global falhou" (§9.6):** entre 18 e 20/05 a PG gerou **176 alarmes**;
> **116 deles (66%)** são o **flapping de um único device — `Motor Ligado (PG)` / `Bomba
> Ligada`** — abrindo/fechando a cada ~7,5 min por ~13 h seguidas (18/05 18:06 → 19/05
> 07:30). Isso = **~232 mensagens no Telegram** de um device só → *flood* que o cliente
> percebeu como "falha no alarme global". Resultado bruto em
> `query-alarmes-praia-grande-18-a-20-maio-2026.log`.
>
> **✅ VEREDITO PRELIMINAR (§9.9):** a série temporal do `status` prova que a causa-raiz é o
> **sinal digital "Motor Ligado" instável (chattering em segundos)** — não o sistema de
> alarme nem o Node-RED. O envio periódico (~7,4 min) + a regra de alarme **sem debounce**
> transformam o chattering em *flood*. **Ação:** (1) inspeção de campo da entrada digital
> "Motor Ligado" (slave 35 ch77 ou 45 ch93); (2) adicionar debounce à *alarm rule* (OBS-5).

### 1.1 Itens em aberto (atualizado 2026-05-20)

> Lista consolidada do que **ainda falta** — os demais pontos estão fechados (veredito §9.9).

| # | Item em aberto | O que fazer | Referência |
|---|----------------|-------------|------------|
| 1 | ~~`Rede (PG)` — série temporal de `status`~~ | ✅ **FECHADO (§9.10)** — sinal real (3 transições limpas), alarme legítimo; correlação 18:06/07:33 com o `Motor Ligado` confirmada | §9.10 |
| 1b | **Polaridade do sinal "Sinal De Rede"** | Confirmar se `detected` = rede normal ou = falta — define se a *alarm rule* `Falta de Fase` está invertida | campo / device profile |
| 2 | **🔴 Colisão de devices homônimos "Motor Ligado"** | Rodar a query `device` (§9.11) — se 1 device só, os channels ch77 (slave 35) **e** ch93 (slave 45) colidem → reinterpreta a §9.9. Decisivo. | §9.11 |
| 3 | **Inspeção de campo** da entrada digital "Motor Ligado" | Ação física — fiação / contato / relé / contato auxiliar | veredito §9.9 |
| 4 | **Debounce na *alarm rule* `Bomba Ligada`** | Adicionar duração mínima no device profile (mitigação) | OBS-5 · §8 |
| 5 | **Correções da rule chain** | BUG-1 (texto fixo nó 27), nós órfãos, etc. | §5 · §8 |

**Query pronta — item 1 (`Rede (PG)`):**

```sql
SELECT key, count(*) AS amostras,
       to_timestamp(min(ts)/1000) AT TIME ZONE 'America/Sao_Paulo' AS primeiro,
       to_timestamp(max(ts)/1000) AT TIME ZONE 'America/Sao_Paulo' AS ultimo
FROM ts_kv
WHERE entity_id = '5226a330-0021-11f0-9baa-8137e6ac9d72'   -- Rede (PG)
GROUP BY key ORDER BY key;
-- depois: query (C)/(D) de §11.4 trocando o entity_id, para ver os valores e a sequência.
```

---

## 2. Transcrição da evidência (print do Telegram)

Print recebido no grupo **"Alarmes Grupo Especial de..."**, enviado pelo bot `Myio Dashboard`,
às **06:49 de ter., 19 de mai.**

Mensagens visíveis, de cima para baixo:

| # | Texto da mensagem | Nó da rule chain que gerou (ver §4) |
|---|-------------------|-------------------------------------|
| 1 | `Bomba Ligada - Motor Ligado (PG) - Encerrado...` (truncada) | Nó 21 — *Send alarm to telegram* (Alarm Cleared) |
| 2 | `Falta de referência de tensão no medidor do transformador ( falta de energia ) e gerador ligado. Bomba Ligada - Motor Ligado (PG)` | Nó 27 — *Send alarm to telegram* (Alarm Created, grupo especial) |
| 3 | `Bomba Ligada - Motor Ligado (PG) - Encerrado` / `Duração: 0 segundos` | Nó 21 — *Send alarm to telegram* (Alarm Cleared) |
| 4 | `Falta de referência de tensão no medidor do transformador ( falta de energia ) e gerador ligado. Bomba Ligada - Motor Ligado (PG)` | Nó 27 — *Send alarm to telegram* (Alarm Created, grupo especial) |

Anotação manual sobre o print (operador HELEXIA):

> *"falha no alarme global da PG, bombas não partiram e tivemos alarme"*

### Leitura das mensagens

- **`msg.name`** (tipo de alarme) = `Bomba Ligada`
- **`metadata.deviceName`** = `Motor Ligado (PG)`
- A sequência criar → encerrar → criar → encerrar com **`Duração: 0 segundos`** indica
  **flapping**: o alarme abre e fecha praticamente no mesmo instante (`endTs ≈ startTs`).

---

## 3. Cadeia de propagação de alarme no ThingsBoard

```
Device (ex.: gerador / motor de bomba — Praia Grande)
   │  telemetria: status = 'detected' | 'not_detected' (e similares)
   ▼
Device Profile (ex.: "Obramax - Geradores - Falta de Fase")
   │  alarm rule avalia a condição → cria / limpa alarme
   ▼
Rule Chain "Obramax"  ──►  Device Profile Node  ──►  roteamento Telegram
```

### 3.1 Exemplo de Device Profile com alarm rule (fornecido pelo usuário)

| Campo | Valor |
|-------|-------|
| Device exemplo | `Rede (PG)` |
| `tb_id` do device | `5226a330-0021-11f0-9baa-8137e6ac9d72` |
| Device Profile | `Obramax - Geradores - Falta de Fase` |
| `id` do Device Profile | `6e6b4d60-da66-11ef-9eb2-6f10bea6c4a8` |
| Alarm type | `Falta de Fase no Gerador` |

**Create alarm rule**
- Severity: `Critical`
- Condition: `status` **equal** `'detected'`
- Schedule: *Active all the time*

**Clear alarm rule**
- Condition: `status` **equal** `'not_detected'`
- Schedule: *Active all the time*

> O alarme é puramente **estado-discreto**: a chave de telemetria `status` dispara o alarme
> quando vale `detected` e o limpa quando vale `not_detected`. Não há histerese / debounce —
> qualquer oscilação de `status` gera abertura/fechamento imediato (explica o *flapping* e o
> `Duração: 0 segundos` da evidência).

### 3.2 Tipos de alarme tratados como "Grupo Especial"

O filtro `isSpecialGroup` (nó 24) e `isSpecialGrupoOnClear` (nó 28) só deixam passar para o
**grupo especial** os alarmes cujo tipo esteja nesta lista (`allowed`):

```
Falta de Fase no Gerador
Falha Geral no Gerador
Gerador em Funcionamento (Gerador Ligado)
Gerador - Alarme Acionado
Bomba Ligada
```

A normalização é `trim` + colapsar espaços + `toLowerCase` (case-insensitive). Em caso de
erro de avaliação, o filtro retorna `false` (*fail-closed* — não envia).

> ⚠️ O alarme `Bomba Ligada` da evidência **está** nessa lista → por isso foi para o grupo
> especial. Os demais tipos da lista são todos de **geradores**.

---

## 4. Mapa da Rule Chain "Obramax"

Rule chain compartilhada por **todas as unidades Obramax** (Guadalupe, Praia Grande, ...). O
roteamento por unidade é feito via atributos do **Customer** (`telegramGroup` /
`telegramSpecialGroup`). Entrada da chain: **nó 13** (`firstNodeIndex: 13`).

### 4.1 Nós (índice → nome → tipo)

| Idx | Nome | Tipo | Papel |
|----:|------|------|-------|
| 13 | Do nothing | Transform | **Entrada** da chain |
| 10 | Device Profile Node | Profile | Avalia alarm rules do device profile · *debug ligado* |
| 6  | Message Type Switch | Filter | Roteia telemetria/atributos/RPC (fluxo não-alarme) |
| 14 | Sensores de Temperatura | DeviceTypeSwitch | Roteia por tipo de device |
| 15/16/18 | Calculate Hourly/Daily/15min Consumption | Analytics | Agregação de consumo (hidrômetros) |
| 24 | **isSpecialGroup** | JsFilter | Alarm **Created** é do grupo especial? |
| 28 | **isSpecialGrupoOnClear** | JsFilter | Alarm **Cleared** é do grupo especial? |
| 25/26 | GetTelegramSpecialGroupId | CustomerAttr | Lê attr `telegramSpecialGroup` → `metadata.telegramGroup` |
| 22/23 | Pegar dados do customer | CustomerAttr | Lê attr `telegramGroup` → `metadata.telegramGroup` |
| 29/36 | Route to Queue or Direct Send | JsFilter | `telegram_queue_enabled`? fila : envio direto |
| 27 | **Send alarm to telegram** (especial/created) | Transform | Texto **fixo** "Falta de referência de tensão..." |
| 19 | Send alarm to telegram (genérico/created) | Transform | Texto = `msg.name + ' - ' + deviceName` |
| 21 | Send alarm to telegram (cleared) | Transform | Texto = `... + ' - Encerrado\nDuração: Ns'` |
| 20 | Send Message To Telegram Group | RestApiCall | POST para a API do Telegram |
| 30-35 / 37-42 | Normalize/Resolve Priority/Fetch/Prepare/Set/Enqueue | — | Caminho de **fila** de Telegram (priorização) |
| 0, 2, 3 | (órfãos) | — | **Nós sem conexão de entrada** — legado/morto (ver §5) |

### 4.2 Fluxo de alarme (a partir do nó 10 — Device Profile Node)

```
Device Profile Node (10)
 ├─ "Success" ────────────► Message Type Switch (6)   [fluxo telemetria normal]
 │
 ├─ "Alarm Created" ──────► isSpecialGroup (24)
 │      ├─ True  ► GetTelegramSpecialGroupId (25) ► Route to Queue (29)
 │      │            ├─ True  ► fila (30→31→32→33→34→35 Enqueue)
 │      │            └─ False ► [nó 27] "Falta de referência de tensão..." ► Send (20)
 │      └─ False ► Pegar dados do customer (22) ► Route to Queue (36)
 │                   ├─ True  ► fila (37→38→39→40→41→42 Enqueue)
 │                   └─ False ► [nó 19] "msg.name - deviceName" ► Send (20)
 │
 └─ "Alarm Cleared" ──────► isSpecialGrupoOnClear (28)
        ├─ True  ► GetTelegramSpecialGroupId (26) ► [nó 21] "... - Encerrado" ► Send (20)
        └─ False ► Pegar dados do customer (23) ► [nó 21] "... - Encerrado" ► Send (20)
```

### 4.3 O caminho que produziu a evidência

As 4 mensagens do print foram geradas pelo caminho **grupo especial, envio direto**
(`telegram_queue_enabled` = false):

- **Mensagens 2 e 4** (Created): `10 → 24 (True) → 25 → 29 (False) → 27 → 20`
- **Mensagens 1 e 3** (Cleared): `10 → 28 (True) → 26 → 21 → 20`

---

## 5. Anomalias / bugs identificados na rule chain

### 🔴 BUG-1 — Texto fixo do nó 27 não corresponde ao alarme real

O nó **27** (*Send alarm to telegram*, caminho **Alarm Created → grupo especial → envio
direto**) tem o texto **hardcoded**:

```js
text: 'Falta de referência de tensão no medidor do transformador ( falta de energia ) '
    + 'e gerador ligado. ' + msg.name + ' - ' + metadata.deviceName
```

Como **qualquer** alarme da lista `allowed` passa por esse nó, um alarme `Bomba Ligada`
chega ao Telegram rotulado como *"Falta de referência de tensão no medidor do transformador
(falta de energia) e gerador ligado"*. **O texto não descreve o alarme que realmente
disparou** — daí a mensagem 2/4 da evidência misturar "falta de tensão no transformador"
com "Bomba Ligada - Motor Ligado (PG)". Isso confunde o operador e foi provavelmente o que
gerou o comentário *"falha no alarme global da PG"*.

### 🟠 BUG-2 — Texto do alarme Created depende de `telegram_queue_enabled`

Para o mesmo alarme do grupo especial:
- fila **desligada** → nó 27 → texto fixo "Falta de referência de tensão...".
- fila **ligada** → nó 30 (*Normalize for Queue*) → `text` vem da transformação anterior.

O nó 27 só roda quando a fila está **desligada** (`29 → False`). Há **inconsistência de
mensagem** dependendo de uma flag de configuração não relacionada ao conteúdo do alarme.

### 🟠 BUG-3 — Caminho genérico (nó 19) não tem texto descritivo

O nó **19** (Created, **fora** do grupo especial) usa apenas `msg.name + ' - ' + deviceName`.
Não há descrição/severidade. Já o nó 27 (especial) usa texto fixo. Não existe um nó que
componha um texto correto a partir do **tipo de alarme** + **severidade** + **device**.

### 🟡 OBS-4 — Nós órfãos (0, 2, 3)

Os nós **0** e **2** (*Send alarm to telegram* com `chat_id` **hardcoded**
`-4538419341` e `-891196587`) e o nó **3** (*Get average temperature*) **não têm conexão de
entrada** — são código morto/legado. Devem ser removidos para evitar confusão (e os
`chat_id` fixos são um risco caso sejam religados).

### 🟡 OBS-5 — Ausência de debounce/histerese

As alarm rules de device profile (§3.1) são puramente `equal` sobre `status`, sem
*delay*/`AND duration`. Qualquer oscilação de `status` (`detected` ↔ `not_detected`) gera
abertura+fechamento imediatos → **flapping** → `Duração: 0 segundos` na evidência →
*spam* no Telegram. Recomenda-se avaliar **condição com duração mínima** ou *debounce*.

### 🟡 OBS-6 — Rule chain compartilhada, sem segregação por unidade

A chain "Obramax" é única para todas as unidades. A separação Praia Grande × Guadalupe
depende **inteiramente** dos atributos `telegramGroup` / `telegramSpecialGroup` do Customer.
Se esses atributos estiverem errados/ausentes no Customer da Praia Grande, alarmes vão para
o grupo errado ou falham silenciosamente (filtro *fail-closed*).

### 🔴 OBS-7 — Devices homônimos colidem no ThingsBoard

Channels `presence_sensor` com **nome idêntico** são sincronizados como o **mesmo device**
no ThingsBoard (que casa device por **nome**) → a telemetria de equipamentos físicos
distintos **colide num só entity**.

Casos na Praia Grande (tabela `channels` / [`slaves-map.md`](./slaves-map.md)):

| Nome duplicado | Channels / slaves | Gravidade |
|----------------|-------------------|-----------|
| **`Motor Ligado`** | ch77 (slave 35, Bombas Diesel Principal) + ch93 (slave 45, Gerador Diesel) | 🔴 **suspeito de ser a causa-raiz do flapping** — ver §9.11 |
| `Comp1` / `Comp2` | repetidos em 6 slaves (39–44) | 🟠 colisão latente |
| `Teste` | ch111 (slave 48) + ch113 (slave 49) | 🟡 provisório |

**Risco:** além de poluir o dashboard, **mistura a telemetria de equipamentos diferentes**
no mesmo device → alarmes falsos / flapping. O nome duplicado é um defeito **mesmo que ainda
não tenha colidido** — qualquer re-sincronização pode colapsar os entities.

**Correção:** renomear cada channel com nome único (ex.: `Motor Ligado - Gerador`,
`Motor Ligado - Bombas Principal`) e re-sincronizar.

---

## 6. Hipóteses sobre o evento de 2026-05-19

| # | Hipótese | Evidência a favor | Como verificar |
|---|----------|-------------------|----------------|
| H1 | Houve **falta de energia real** na Praia Grande; o alarme do gerador disparou corretamente. | ✅ **Confirmado parcialmente**: device `Rede (PG)` tem alarme `Falta de Fase no Gerador` CRITICAL **ativo desde 19/05 07:33** (tabela `alarm`, §9.3). | Cruzar com logs da concessionária; verificar por que segue ativo (`cleared=false`). |
| H2 | O alarme `Bomba Ligada` em `Motor Ligado (PG)` está em **flapping** (`status` oscilando). | ✅ **Confirmado**: 116+ alarmes criados/encerrados a cada ~7,5 min (§9.6, §9.7). | Falta a **causa-raiz da oscilação** — série temporal de `status` (motor real ×  leitura instável). |
| H3 | A mensagem é **enganosa** por causa do BUG-1 — não houve necessariamente falta de tensão no transformador; o nó 27 carimba esse texto em todo alarme especial. | §5 BUG-1. | Confirmar qual `msg.name` real disparou (`Bomba Ligada` ≠ falta de fase/tensão). |
| H4 | As **bombas não partiram** no gerador — falha **elétrica / de campo**, independente da telemetria. | ✅ **Reforçado**: o Node-RED da PG **não tem lógica de partida de bomba** (§10) → a partida é elétrica (QTA/ATS). | Inspeção de campo: QTA/QGBT, ATS, partida automática das bombas no gerador. |
| H6 | "Node-RED recebeu o evento mas não ligou a bomba". | Hipótese do cliente/usuário. | ❌ **Não se sustenta** — Node-RED da PG não comanda bombas (§10.4). |
| H5 | "Falha no alarme global" = o operador esperava **um** alarme claro de falta de energia e recebeu **mensagens fragmentadas/contraditórias** (flapping + texto errado). | Print com 4 mensagens em ~1 min, texto misturado. | Revisar §5 BUG-1/2/5. |

---

## 7. Itens a coletar / próximos passos

- [x] **`customer_id` da Praia Grande identificado**: `f3455100-8360-11ef-a17c-dfe898a3f1e0`
      (confirmar `title` do customer — ver query no fim de §9.5).
- [ ] **Inventário de devices `(PG)`** envolvidos: nome, `tb_id`, device profile, customerId.
  - [x] `Rede (PG)` — `5226a330-0021-11f0-9baa-8137e6ac9d72` — profile `Obramax - Geradores - Falta de Fase`
        — 🔴 **alarme `Falta de Fase no Gerador` ATIVO desde 19/05 07:33** (registro `d141d3d8`, §9.3).
  - [x] `Motor Ligado (PG)` — `68c8aee1-f143-11ef-a212-67802bff4221` — profile `Obramax - Gerador ligado`
        — 🔴 **116 alarmes `Bomba Ligada` em flapping** (18–20/05, §9.6).
  - [x] Inventário dos **19 devices** que alarmaram na PG levantado (§9.6).
- [x] Query de alarmes 18–20/05 executada — resultado em `query-alarmes-praia-grande-18-a-20-maio-2026.log` (§9.6).
- [ ] Confirmar **o que o device `Motor Ligado (PG)` realmente monitora** (gerador? bomba? motor?) —
      nomenclatura inconsistente entre device / profile / alarm_type.
- [ ] Investigar a **causa-raiz do flapping de 7,5 min** do `Motor Ligado (PG)` (série temporal de `status`).
- [ ] Verificar a **série temporal de `status` do `Rede (PG)`**: confirmar se a falta de fase é
      real/persistente ou se a leitura **travou** em `detected` desde 19/05 07:33 (device mudo).
- [ ] **Atributos do Customer Praia Grande**: confirmar `telegramGroup` e `telegramSpecialGroup`
      (valores dos chat_ids) e se batem com o grupo "Alarmes Grupo Especial".
- [ ] **Histórico de alarmes** no TB para os devices `(PG)` em 2026-05-19, 06:30–07:30
      (created/cleared, severity, startTs/endTs).
- [ ] **Série temporal da chave `status`** de `Motor Ligado (PG)` e dos geradores no mesmo período.
- [ ] **Logs do Device Profile Node (10)** — debug está ligado (`failuresEnabled: true`); coletar.
- [ ] Confirmar device profile e a alarm rule do tipo `Bomba Ligada` (condição exata).
- [ ] **Analisar o fluxo Node-RED da Praia Grande** (`bkp-all-flows-node-red-obramax-praia-grande-2026-05-20-10-29.json`)
      — verificar se a chave `status` de `Motor Ligado (PG)` é publicada pelo Node-RED e
      se há lógica de partida/automação das bombas que possa explicar a falha de campo (H4).
- [ ] Decidir correções da rule chain: ver §8.

---

## 8. Recomendações de correção (a validar)

1. **BUG-1/2/3** — substituir os nós 19/27 por um único *Transform* que monte o texto a
   partir do **tipo de alarme real** (`msg.name`/`metadata.type`), severidade e device —
   sem texto fixo. Mapear cada `alarmType` → mensagem amigável (tabela/`switch`).
2. **OBS-4** — remover os nós órfãos 0, 2, 3 (e os `chat_id` hardcoded).
3. **OBS-5** — adicionar **duração mínima**/debounce nas alarm rules de device profile
   (ex.: `status = detected` por ≥ N segundos) para eliminar o *flapping*.
4. **OBS-6** — auditar `telegramGroup`/`telegramSpecialGroup` do Customer Praia Grande.
5. Avaliar **agrupar** mensagens de flapping (rate-limit) antes do envio ao Telegram.

---

## 9. Tabela `public.alarm` — devices que alarmaram

Cada alarme criado pelo *Device Profile Node* (§4) é persistido na tabela `public.alarm` do
PostgreSQL do ThingsBoard. **Descobrir "quais devices alarmaram" = listar os `originator_id`
distintos dessa tabela** (com `originator_type = 5`, que é DEVICE).

### 9.1 Estrutura da tabela (DDL)

```sql
CREATE TABLE public.alarm (
    id uuid NOT NULL,
    created_time int8 NOT NULL,
    ack_ts int8 NULL,
    clear_ts int8 NULL,
    additional_info varchar NULL,
    end_ts int8 NULL,
    originator_id uuid NULL,
    originator_type int4 NULL,
    propagate bool NULL,
    severity varchar(255) NULL,
    start_ts int8 NULL,
    assign_ts int8 DEFAULT 0 NULL,
    assignee_id uuid NULL,
    tenant_id uuid NULL,
    customer_id uuid NULL,
    propagate_relation_types varchar NULL,
    "type" varchar(255) NULL,
    propagate_to_owner bool NULL,
    propagate_to_tenant bool NULL,
    acknowledged bool NULL,
    cleared bool NULL,
    propagate_to_owner_hierarchy bool DEFAULT false NULL,
    CONSTRAINT alarm_pkey PRIMARY KEY (id)
);
-- índices úteis para a investigação:
-- idx_alarm_originator_created_time (originator_id, created_time DESC)
-- idx_alarm_tenant_alarm_type_created_time (tenant_id, type, created_time DESC)
-- idx_alarm_originator_alarm_type_active (originator_id, type) WHERE cleared = false
```

### 9.2 Dicionário de colunas

| Coluna | Tipo | Significado |
|--------|------|-------------|
| `id` | uuid | PK do alarme |
| `created_time` | int8 (epoch **ms**) | Quando o registro foi criado |
| `ack_ts` | int8 | Timestamp de *acknowledge* — **`0` = não reconhecido** |
| `clear_ts` | int8 | Timestamp de limpeza — **`0` = ainda não limpo** |
| `additional_info` | varchar | JSON livre (`{}` nos exemplos) |
| `end_ts` | int8 | Última atualização; enquanto o alarme está ativo, "anda" com a telemetria |
| **`originator_id`** | uuid | **Device que alarmou** (FK lógica → `device.id`) |
| `originator_type` | int4 | Tipo da entidade originadora — **`5` = DEVICE** (TB `EntityType`) |
| `propagate*` | bool | Regras de propagação do alarme |
| `severity` | varchar | `CRITICAL` / `MAJOR` / `MINOR` / `WARNING` / `INDETERMINATE` |
| `start_ts` | int8 | Início do alarme |
| `assign_ts` / `assignee_id` | int8 / uuid | Atribuição do alarme a um usuário |
| `tenant_id` | uuid | Tenant (igual p/ toda a Obramax: `e784aa80-e7cc-11ee-a1c3-ef5befd2d893`) |
| **`customer_id`** | uuid | **Customer dono do device — separa as unidades Obramax** |
| `type` | varchar | **Tipo do alarme** (= *alarm type* do device profile, ex.: `Falta de Fase no Gerador`) |
| `acknowledged` | bool | Reconhecido pelo operador |
| **`cleared`** | bool | **`false` = alarme ATIVO** · `true` = encerrado |

> `originator_type` (TB `EntityType`): `0`=TENANT, `1`=CUSTOMER, `2`=USER, `3`=DASHBOARD,
> `4`=ASSET, **`5`=DEVICE**, `6`=ALARM, ...

### 9.3 Registro de exemplo (decodificado)

Linha `d141d3d8-5743-4681-854e-d86d2fb2908d` — **é o device `Rede (PG)` da Praia Grande**:

| Campo | Valor | Leitura |
|-------|-------|---------|
| `originator_id` | `5226a330-0021-11f0-9baa-8137e6ac9d72` | Device **`Rede (PG)`** (confirmado em §3.1) |
| `customer_id` | `f3455100-8360-11ef-a17c-dfe898a3f1e0` | **Customer = Obramax Praia Grande** |
| `type` | `Falta de Fase no Gerador` | Alarm type do profile `Obramax - Geradores - Falta de Fase` |
| `severity` | `CRITICAL` | — |
| `start_ts` | `1779186786317` | **19/05/2026 07:33:06** (GMT-3) |
| `end_ts` | `1779286362056` | 20/05/2026 11:12:42 — "anda" porque o alarme segue ativo |
| `clear_ts` | `0` | **Nunca foi limpo** |
| `cleared` | `false` | 🔴 **ALARME AINDA ATIVO** |
| `acknowledged` | `false` | Não reconhecido |

### 9.4 Análise da amostra (11 registros, todos `Falta de Fase no Gerador`)

> ⚠️ A amostra fornecida contém **apenas** alarmes do tipo `Falta de Fase no Gerador`.
> Os alarmes `Bomba Ligada` vistos no print do Telegram **não aparecem** aqui — é preciso
> uma consulta mais ampla (§9.5) para cobri-los.

Agrupando os 11 registros por device (`originator_id`):

| Device (`originator_id`) | `customer_id` | Unidade | Nº alarmes | Janela (GMT-3) | Ativo? |
|---|---|---|---:|---|---|
| `5226a330-…` (**Rede (PG)**) | `f3455100-8360-11ef-a17c-dfe898a3f1e0` | **🟢 Praia Grande** | 1 | 19/05 07:33 → em aberto | 🔴 **SIM** (`cleared=false`) |
| `ebe0fb10-ce8f-11ef-…` | `bf213d20-a1d4-11ef-9e25-b7f6e6d4253b` | outra unidade Obramax | 4 | 15/05 → 20/05 | não |
| `2151ed50-f554-11ef-…` | `f62bf630-8360-11ef-a17c-dfe898a3f1e0` | outra unidade Obramax | 2 | 14/05, 18/05 | não |
| `e1c9dbc1-cec0-11ef-…` | `b6d38970-a1d4-11ef-9e25-b7f6e6d4253b` | outra unidade Obramax | 1 | 17/05 | não |
| `56d752f0-cded-11ef-…` | `c5d739d0-a1d4-11ef-9e25-b7f6e6d4253b` | outra unidade Obramax | 2 | 12/05 → 13/05 | não |

**Conclusões da amostra (foco Praia Grande):**

1. 🔴 **Na Praia Grande, 1 device alarmou: `Rede (PG)` (`5226a330-…`)** — alarme
   `Falta de Fase no Gerador`, **CRITICAL, iniciado 19/05/2026 07:33:06 e ainda ATIVO**
   (`cleared = false`, `clear_ts = 0`). Confirma falta de energia/falha no gerador da PG.
2. Os outros 4 devices pertencem a **customers diferentes** → outras unidades Obramax;
   não são Praia Grande.
3. O alarme da PG (07:33) começou **~44 min depois** do print do Telegram (06:49). Os
   alarmes `Bomba Ligada` do print são um **evento anterior e distinto** — precisam ser
   localizados com a consulta ampla (§9.5).
4. `customer_id` é o discriminador de unidade: **`f3455100-8360-11ef-a17c-dfe898a3f1e0`
   = Obramax Praia Grande** (a confirmar pelo nome do customer).

### 9.5 Consultas SQL para a investigação

A tabela `alarm` só guarda o `originator_id` (uuid). Para obter **nome do device** e
**profile**, faça `JOIN` com `device`:

```sql
-- (A) Devices que alarmaram na Praia Grande — TODOS os tipos, com nome do device
SELECT a.originator_id,
       d.name                         AS device_name,
       d.type                         AS device_profile,
       a.type                         AS alarm_type,
       a.severity,
       COUNT(*)                       AS qtd_alarmes,
       SUM((a.cleared = false)::int)   AS qtd_ativos,
       to_timestamp(MIN(a.start_ts)/1000) AT TIME ZONE 'America/Sao_Paulo' AS primeiro,
       to_timestamp(MAX(a.start_ts)/1000) AT TIME ZONE 'America/Sao_Paulo' AS ultimo
FROM   public.alarm a
JOIN   public.device d ON d.id = a.originator_id
WHERE  a.customer_id = 'f3455100-8360-11ef-a17c-dfe898a3f1e0'   -- Obramax Praia Grande
  AND  a.originator_type = 5
GROUP  BY a.originator_id, d.name, d.type, a.type, a.severity
ORDER  BY ultimo DESC;
```

```sql
-- (B) Alarmes da Praia Grande na janela do evento (19/05/2026 06:00–09:00 GMT-3)
SELECT d.name AS device_name, a.type AS alarm_type, a.severity, a.cleared,
       to_timestamp(a.start_ts/1000) AT TIME ZONE 'America/Sao_Paulo' AS inicio,
       to_timestamp(NULLIF(a.clear_ts,0)/1000) AT TIME ZONE 'America/Sao_Paulo' AS limpo,
       a.id
FROM   public.alarm a
JOIN   public.device d ON d.id = a.originator_id
WHERE  a.customer_id = 'f3455100-8360-11ef-a17c-dfe898a3f1e0'
  AND  a.start_ts BETWEEN 1779181200000 AND 1779192000000   -- 06:00–09:00 GMT-3 de 19/05
ORDER  BY a.start_ts;
```

```sql
-- (C) Alarmes 'Bomba Ligada' (os do print do Telegram), Praia Grande
SELECT d.name AS device_name, a.severity, a.cleared,
       to_timestamp(a.start_ts/1000) AT TIME ZONE 'America/Sao_Paulo' AS inicio,
       to_timestamp(NULLIF(a.end_ts,0)/1000)  AT TIME ZONE 'America/Sao_Paulo' AS fim,
       (a.end_ts - a.start_ts)/1000 AS duracao_seg
FROM   public.alarm a
JOIN   public.device d ON d.id = a.originator_id
WHERE  a.customer_id = 'f3455100-8360-11ef-a17c-dfe898a3f1e0'
  AND  a.type = 'Bomba Ligada'
ORDER  BY a.start_ts DESC;
```

```sql
-- (D) Alarmes ATIVOS (não limpos) da Praia Grande agora
SELECT d.name AS device_name, a.type AS alarm_type, a.severity,
       to_timestamp(a.start_ts/1000) AT TIME ZONE 'America/Sao_Paulo' AS inicio
FROM   public.alarm a
JOIN   public.device d ON d.id = a.originator_id
WHERE  a.customer_id = 'f3455100-8360-11ef-a17c-dfe898a3f1e0'
  AND  a.cleared = false
ORDER  BY a.start_ts;
```

```sql
-- (E) LISTAGEM COMPLETA dos alarmes do customer Praia Grande
--     (f3455100-8360-11ef-a17c-dfe898a3f1e0), 1 linha por alarme, mais recentes primeiro.
SELECT a.id,
       d.name                          AS device_name,
       d.type                          AS device_profile,
       a.type                          AS alarm_type,
       a.severity,                                       -- CRITICAL=device profile · MAJOR=Node-RED
       a.acknowledged,
       a.cleared,                                        -- false = alarme ATIVO
       to_timestamp(a.start_ts   / 1000) AT TIME ZONE 'America/Sao_Paulo' AS inicio,
       to_timestamp(a.end_ts     / 1000) AT TIME ZONE 'America/Sao_Paulo' AS ultima_atualizacao,
       to_timestamp(NULLIF(a.clear_ts,0) / 1000) AT TIME ZONE 'America/Sao_Paulo' AS encerrado_em,
       CASE WHEN a.cleared
            THEN round((a.end_ts - a.start_ts) / 1000.0, 1)
            ELSE round((extract(epoch from now())*1000 - a.start_ts) / 1000.0, 1)
       END                              AS duracao_seg,   -- duração; se ativo, até agora
       a.originator_id
FROM   public.alarm a
LEFT  JOIN public.device d ON d.id = a.originator_id
WHERE  a.customer_id = 'f3455100-8360-11ef-a17c-dfe898a3f1e0'   -- Obramax Praia Grande
ORDER  BY a.start_ts DESC;
```

> `LEFT JOIN` para não perder alarmes cujo device tenha sido removido. Para janela específica
> acrescente `AND a.start_ts BETWEEN <ini_ms> AND <fim_ms>` (19/05 06:00–09:00 GMT-3 =
> `1779181200000` a `1779192000000`). Para só ativos: `AND a.cleared = false`.

```sql
-- (F) Alarmes do customer Praia Grande entre 18 e 20/05/2026 (GMT-3, inclusive os 3 dias)
--     Janela: 18/05 00:00:00  até  21/05 00:00:00 (exclusivo) = 1779073200000 .. 1779332400000
SELECT a.id,
       d.name                          AS device_name,
       d.type                          AS device_profile,
       a.type                          AS alarm_type,
       a.severity,                                       -- CRITICAL=device profile · MAJOR=Node-RED
       a.acknowledged,
       a.cleared,                                        -- false = alarme ATIVO
       to_timestamp(a.start_ts   / 1000) AT TIME ZONE 'America/Sao_Paulo' AS inicio,
       to_timestamp(a.end_ts     / 1000) AT TIME ZONE 'America/Sao_Paulo' AS ultima_atualizacao,
       to_timestamp(NULLIF(a.clear_ts,0) / 1000) AT TIME ZONE 'America/Sao_Paulo' AS encerrado_em,
       CASE WHEN a.cleared
            THEN round((a.end_ts - a.start_ts) / 1000.0, 1)
            ELSE round((extract(epoch from now())*1000 - a.start_ts) / 1000.0, 1)
       END                              AS duracao_seg,
       a.originator_id
FROM   public.alarm a
LEFT  JOIN public.device d ON d.id = a.originator_id
WHERE  a.customer_id = 'f3455100-8360-11ef-a17c-dfe898a3f1e0'   -- Obramax Praia Grande
  AND  a.start_ts >= 1779073200000      -- 18/05/2026 00:00:00 GMT-3
  AND  a.start_ts <  1779332400000      -- 21/05/2026 00:00:00 GMT-3 (exclusivo)
ORDER  BY a.start_ts DESC;
```

> A janela filtra por **`start_ts`** (início do alarme). Para incluir também alarmes que
> *começaram antes* mas seguiram ativos na janela, troque por:
> `AND a.start_ts < 1779332400000 AND (a.clear_ts = 0 OR a.clear_ts >= 1779073200000)`.

> Para confirmar o nome da unidade do `customer_id`:
> `SELECT id, title FROM public.customer WHERE id = 'f3455100-8360-11ef-a17c-dfe898a3f1e0';`

### 9.6 Resultado da query (F) — 18 a 20/05/2026 (176 alarmes)

Resultado bruto completo salvo em
[`query-alarmes-praia-grande-18-a-20-maio-2026.log`](./query-alarmes-praia-grande-18-a-20-maio-2026.log).

**Totais:** 176 alarmes · 19 devices · 126 `CRITICAL` + 50 `MAJOR`.

| `alarm_type` | qtd | severity | `device_profile` | device(s) |
|--------------|----:|----------|------------------|-----------|
| **Bomba Ligada** | **116** | CRITICAL | Obramax - Gerador ligado | `Motor Ligado (PG)` |
| Chave seletora em manual | 50 | MAJOR | Obramax - Chaves Seletoras | 14 chaves seletoras |
| Nível Mínimo Atingido | 5 | CRITICAL | Obramax - Nível Caixa D'agua | Potável, Reuso |
| Nível Máximo Atingido | 2 | CRITICAL | Obramax - Nível Caixa D'agua | Potável |
| Estouro de Demanda | 2 | CRITICAL | Obramax Praia Grande - QGBT | QGBT |
| Falta de Fase no Gerador | 1 | CRITICAL | Obramax - Geradores - Falta de Fase | Rede (PG) |

> 🔴 **66% dos alarmes (116/176) são o flapping de UM device: `Motor Ligado (PG)`.**

#### 🔴 `Motor Ligado (PG)` — flapping massivo do alarme `Bomba Ligada`

- **116 alarmes** criados/encerrados entre **18/05 18:06:05** e **20/05 11:50:21**.
- Janela **densa**: 18/05 18:06 → 19/05 07:30 — um ciclo abre/fecha **a cada ~7,5 min**
  (~106 alarmes em ~13 h). Depois esparso (16:16, 19:16 do dia 19; e 20/05 de manhã).
- O alarme fica ativo ~7,5 min, encerra, e **~7 s depois** abre outro → o status
  `Bomba Ligada` é praticamente **contínuo**, com um *blip* curto de queda a cada ciclo.
- ➡️ Isso gerou **~232 mensagens no Telegram** (abertura + "Encerrado") só desse device.
  **É a causa direta da percepção de "falha no alarme global da PG"** — flood de alarme.
- O print do Telegram (06:49 de 19/05) caiu **no meio dessa janela densa**.
- `device_profile = "Obramax - Gerador ligado"`, device `Motor Ligado (PG)`, alarme
  `Bomba Ligada` — **nomenclatura inconsistente** (3 termos diferentes p/ a mesma coisa);
  é preciso confirmar **o que esse device realmente monitora** (gerador? bomba? motor?).

> ⚠️ **Atenção à coluna `duracao_seg` do `.log`:** ela usa `end_ts - start_ts`. Como o
> `end_ts` desses alarmes **não avança**, mostra ~0 s — *não* é a duração real. A duração
> real é `clear_ts - start_ts` (≈ 7,5 min por ciclo). É o mesmo motivo do "Duração: 0
> segundos" enganoso no Telegram (nó 21, §4 / OBS-5).

#### Bursts de "Chave seletora em manual" (50 alarmes, 14 devices)

As 14 chaves seletoras alarmam **em lote, no mesmo instante** (todas as `Auto. Selet. *`),
em horários discretos: **18/05 18:06 · 19/05 07:30 · 16:16 · 17:24 · 19:16 · 19:20 ·
20/05 03:16 · 03:28 · 11:46**. Cada lote = um evento em que as seletoras foram lidas
como "em manual" — coincide com transições de energia/automação. Severity `MAJOR`.

#### Outros alarmes CRITICAL relevantes

- **`QGBT (PG)` — Estouro de Demanda** ×2: 19/05 17:27 (~1 h 47) e 19/05 19:22 → 20/05 11:48 (~16 h).
- **`Potável (PG)` / `Reuso (PG)` — Nível Mín./Máx.**: 7 alarmes de caixa d'água (18–20/05).
- **`Rede (PG)` — Falta de Fase no Gerador**: 1, desde 19/05 07:33 — **ainda ATIVO** (§9.3).

#### Alarmes ATIVOS no momento da coleta (4)

| device | alarm_type | severity | desde |
|--------|-----------|----------|-------|
| `Motor Ligado (PG)` | Bomba Ligada | CRITICAL | 20/05 11:50:21 |
| `Auto. Selet. Ilum Externa (I) (PG)` | Chave seletora em manual | MAJOR | 20/05 11:46:46 |
| `Aut. Selet. Exaust (PG)` | Chave seletora em manual | MAJOR | 20/05 06:52:00 |
| `Rede (PG)` | Falta de Fase no Gerador | CRITICAL | 19/05 07:33:06 |

#### Linha do tempo reconstruída

| Quando (GMT-3) | Evento |
|----------------|--------|
| **18/05 18:06** | Gatilho: `Motor Ligado` inicia flapping · burst de chaves seletoras · `Reuso` nível mínimo → provável evento elétrico. |
| 18/05 18:06 → **19/05 07:30** | `Bomba Ligada` flapando a cada ~7,5 min (~106 ciclos). Print do Telegram (06:49) é daqui. |
| **19/05 07:30** | Novo burst de chaves seletoras · `Reuso` nível mínimo. |
| **19/05 07:33** | `Rede (PG)` — **Falta de Fase no Gerador** CRITICAL abre (segue ATIVO). |
| 19/05 16:16–19:22 | Bursts de chaves seletoras · `QGBT` Estouro de Demanda ×2. |
| **20/05 03:16–11:50** | Novos bursts de chaves seletoras · `Motor Ligado` volta a flapar · `QGBT` encerra 11:48. |

#### Inventário de devices que alarmaram (19 devices da PG)

| device_name | originator_id | profile |
|-------------|---------------|---------|
| Motor Ligado (PG) | `68c8aee1-f143-11ef-a212-67802bff4221` | Obramax - Gerador ligado |
| Rede (PG) | `5226a330-0021-11f0-9baa-8137e6ac9d72` | Obramax - Geradores - Falta de Fase |
| QGBT (PG) | `846c6c20-e7e1-11ee-8327-cfc6eea1d65a` | Obramax Praia Grande - QGBT |
| Potável (PG) | `dc6f08d0-f38c-11ef-a212-67802bff4221` | Obramax - Nível Caixa D'agua |
| Reuso (PG) | `dfdabc80-f38c-11ef-a212-67802bff4221` | Obramax - Nível Caixa D'agua |
| Auto. Selet. 50% Drive e Cer (H) (PG) | `21f74b00-ec69-11ee-9378-6b50e3ef4c75` | Obramax - Chaves Seletoras |
| Auto. Selet. 50% Drive e Cer (G) (PG) | `21f50110-ec69-11ee-9378-6b50e3ef4c75` | Obramax - Chaves Seletoras |
| Auto. Selet. 50% Central e Fundo Loja (E) (PG) | `21cba720-ec69-11ee-9378-6b50e3ef4c75` | Obramax - Chaves Seletoras |
| Auto. Selet. 50% Central e Fundo Loja (F) (PG) | `21cdf110-ec69-11ee-9378-6b50e3ef4c75` | Obramax - Chaves Seletoras |
| Auto. Selet. 50% Frente Loja (D) (PG) | `221ea920-ec69-11ee-9378-6b50e3ef4c75` | Obramax - Chaves Seletoras |
| Auto. Selet. 50% Frente Loja (C) (PG) | `221affa0-ec69-11ee-9378-6b50e3ef4c75` | Obramax - Chaves Seletoras |
| Auto. Selet. Ilum Externa (I) (PG) | `3811af70-ead9-11ee-8327-cfc6eea1d65a` | Obramax - Chaves Seletoras |
| Auto. Selet. Depósito (PG) | `7f4b7b00-ead9-11ee-8327-cfc6eea1d65a` | Obramax - Chaves Seletoras |
| Aut. Selet. 1 (PG) | `04980ae0-ead9-11ee-8327-cfc6eea1d65a` | Obramax - Chaves Seletoras |
| Aut. Selet. 2 (PG) | `04991c50-ead9-11ee-8327-cfc6eea1d65a` | Obramax - Chaves Seletoras |
| Aut. Selet. Exaust (PG) | `11a0fcb0-ead9-11ee-8327-cfc6eea1d65a` | Obramax - Chaves Seletoras |
| Auto. Ar Exter ADM (PG) | `44e8e2e0-ead9-11ee-8327-cfc6eea1d65a` | Obramax - Chaves Seletoras |
| Aut. Split 2 (PG) | `21dfcb60-ec69-11ee-9378-6b50e3ef4c75` | Obramax - Chaves Seletoras |
| Aut. Split 3 (PG) | `21de44c0-ec69-11ee-9378-6b50e3ef4c75` | Obramax - Chaves Seletoras |

### 9.7 Observação direta no ThingsBoard (20/05) — por que `Motor Ligado` tem "vários" alarmes

Verificação manual na aba *Alarms* do ThingsBoard, em 20/05:

- **`Rede (PG)`** → **1 único alarme**: 19/05 07:33:06 · `Falta de Fase no Gerador` ·
  Critical · **Active** Unacknowledged.
- **`Motor Ligado (PG)`** → **dezenas de alarmes** `Bomba Ligada` · Critical · quase todos
  **Cleared**, 1 **Active**. O flapping **continua**: além do `.log` (que ia até 11:50:22),
  há novos registros em 20/05 **11:55:55** e **12:01:21**.

#### Por que um device tem 1 alarme e o outro tem dezenas? — modelo de alarme do ThingsBoard

> O ThingsBoard mantém **no máximo 1 alarme ATIVO** por par (device, alarm type). Enquanto a
> *create condition* continua verdadeira, ele **não cria outro** — só atualiza o `end_ts` do
> alarme existente. Quando a *clear condition* dispara, o alarme vira **Cleared**. Se a
> condição voltar a ser verdadeira **depois**, o TB cria um **registro NOVO**.
>
> ➡️ **Nº de linhas na tabela `alarm` = nº de ciclos `detected → not_detected → detected`.**

| Device | Chave `status` | Comportamento | Linhas na tabela `alarm` |
|--------|----------------|---------------|--------------------------|
| **`Rede (PG)`** | `detected` desde 19/05 07:33, **nunca** voltou a `not_detected` | 1 alarme **contínuo** | **1** (segue Active) |
| **`Motor Ligado (PG)`** | `detected ↔ not_detected` a cada **~7,5 min** | *flapping* → 1 alarme novo por ciclo | **116+** (e contando) |

**Conclusão:** ter "vários alarmes" **não é bug do alarme nem do ThingsBoard** — é o
comportamento **correto** dado um `status` que **oscila**. O problema real está **um nível
abaixo**: a telemetria `status` do `Motor Ligado (PG)` está oscilando a cada ~7,5 min. Isso
confirma a OBS-5 e desloca a investigação para **a ORIGEM DO DADO** (leitura Modbus / sinal
de campo do "Motor Ligado").

O contraste entre os dois devices é, em si, **diagnóstico**:

- `Rede (PG)` **Active e estável** → a *create condition* (`status = detected`) é verdadeira
  **sem interrupção** desde 07:33 de 19/05. Ou a falta de fase é **real e persistente**, ou
  a leitura **travou** em `detected`. ⚠️ **Verificar a série temporal de `status`** — se o
  valor não muda há dias, pode ser device mudo / leitura congelada.
- `Motor Ligado (PG)` **flapping** → estado **intermitente**: o motor/bomba liga e desliga
  de fato, **ou** o sensor/leitura é instável (mau contato, ruído, polling Modbus falhando).

### 9.8 Série temporal `ts_kv` — telemetria que dispara o alarme (`Motor Ligado (PG)`)

Queries (B)/(C) de §11.4 executadas em 2026-05-20. Device `68c8aee1-f143-11ef-a212-67802bff4221`.

**Chaves (`ts_kv.key`):**

| key | amostras | período | o que é |
|-----|---------:|---------|---------|
| 58  | 136.696  | 2025-08-01 → 2026-05-20 | **`status`** — `str_v` ∈ {`detected`,`not_detected`} → chave do alarme |
| 106 | 156      | 2025-08-08 → 2026-05-15 | esparsa, **sem amostras na janela do evento** — irrelevante |

**Janela 18–20/05 (key 58):** `not_detected` = 1.125 (90%) · `detected` = 122 (10%).

**Leituras:**

1. 🔑 **A telemetria é PERIÓDICA (~3,1 min), não on-change.** 136.696 amostras / ~293 dias
   ⇒ ~466/dia ⇒ 1 a cada **~3,1 min**. O central reporta `status` por timer fixo.
2. 🔑 **122 `detected` ≈ 116 alarmes `Bomba Ligada`** → **~1 alarme por amostra `detected`**.
   Confirma a OBS-5: a *alarm rule* cria um alarme a cada leitura `detected`, **sem debounce**.
3. O motor fica `not_detected` ~90% do tempo; os `detected` concentram-se na janela densa
   (18/05 18:06 → 19/05 07:30).
4. ⏳ **Falta a sequência cronológica** (query D de §11.4, com `lag()`): decide se na janela
   densa os valores **alternam limpo a cada ~3 min** (ciclo real ~6–7 min → Hipótese A) ou
   se o intervalo/valores são **irregulares** (leitura instável → Hipótese B).

### 9.9 Sequência cronológica (query D) — padrão do flapping decifrado

Resultado em [`resultSerieTemporal.log`](./resultSerieTemporal.log) — device `Motor Ligado (PG)`,
key 58 (`status`), janela 18/05 17:00 → 19/05 ~05:00 (~200 amostras).

**Padrão observado** — a telemetria chega em **pares de leituras a ~7 s entre si**:

| Período | Par de leituras (~7 s apart) | Intervalo entre pares |
|---------|------------------------------|-----------------------|
| **Antes** (até 18/05 18:02) | (`not_detected`, `not_detected`) — **concordam** | ~5,4 min |
| **Durante** (18/05 18:06 →) | (`not_detected`, `detected`) — **discordam**, sempre nessa ordem | **~7,4 min** (constante: 7,2–8,6) |

**O que isso prova:**

1. As duas leituras de um mesmo par, a **~7 s de distância, DISCORDAM** → o sinal `status`
   **muda de estado dentro de ~7 s** → sinal **rápido/instável**, não ciclo lento de motor.
2. O "ciclo de 7,4 min" dos alarmes **é o período de ENVIO** da telemetria, não o ciclo do
   motor. Cada envio traz o par (`not_detected`,`detected`) → a regra encerra + recria o
   alarme → **1 alarme por envio** → explica os 116 alarmes a cada ~7,4 min.
3. Descarta as duas hipóteses originais na forma pura:
   - ❌ **A (curto-ciclo limpo do motor)** — não há ciclo de ~7 min; em 7 s já está nos 2 estados.
   - ❌ **B (artefato de amostragem de sinal estável)** — as leituras pareadas **discordam**.
   - ✅ **Terceiro caso: sinal de entrada instável / *chattering*** — o digital "Motor
     Ligado" oscila em escala de **segundos**.

> 🔴 **VEREDITO PRELIMINAR:** a causa-raiz **não é o sistema de alarme nem o Node-RED** — é o
> **sinal digital "Motor Ligado" instável** (bouncing/chattering em segundos). O envio
> periódico (~7,4 min) + a *alarm rule* **sem debounce** (OBS-5) convertem o chattering em
> *flood* de alarme — **amplificam**, mas não originam. Direção da causa-raiz:
> **campo / elétrica** — inspecionar a entrada digital "Motor Ligado" (fiação, contato,
> relé / contato auxiliar monitorado) no slave **35** (ch77) ou **45** (ch93).
>
> ⚠️ **VEREDITO REVISADO — ver §9.11:** a hipótese de **colisão de dois devices homônimos
> "Motor Ligado"** (ch77 slave 35 + ch93 slave 45 → mesmo device TB) explica o padrão de
> forma mais simples e completa. Se confirmada, o "chattering" **não existe** — é a
> telemetria de **dois equipamentos colidindo num só entity**, e a causa-raiz passa a ser
> **configuração / modelo de dados**, não campo.

### 9.10 Série temporal `ts_kv` — `Rede (PG)` (parcial)

Passos B/C executados 2026-05-20. Device `5226a330-0021-11f0-9baa-8137e6ac9d72`, key 58 (`status`).

- key 58: **74.467 amostras**, última em **2026-05-20 13:33** → o device **está vivo e
  reportando** — não está mudo.
- Janela 18–20/05: `detected` = **510** · `not_detected` = **1**.

**Leituras:**

1. Ao contrário do `Motor Ligado`, o `Rede (PG)` **não oscila** — o `status` está **preso em
   `detected`** (510 : 1). Não é flapping; é **estado contínuo**.
2. O alarme `Falta de Fase no Gerador` Active desde 19/05 07:33 é **coerente** com a
   telemetria — o `status` está de fato `detected` de forma contínua.
3. O device **não está mudo** (reporta até 20/05 13:33) → não é "alarme preso por falta de
   dado novo".
4. **Transições do `status`** (query de transições, 18–20/05) — apenas **3**, todas limpas:

   | Momento | `status` |
   |---------|----------|
   | início da janela (18/05 00:04) | `detected` |
   | **18/05 18:06:02** | → `not_detected` |
   | **19/05 07:33:06** | → `detected` (permanece até agora) |

5. ✅ **"Sensor travado" DESCARTADO** — 3 transições limpas, sem chatter → o sinal do `Rede`
   é real e confiável. O alarme `Falta de Fase` (Active desde 19/05 07:33) reflete um
   **estado genuíno e persistente**.

> 🔑 **CORRELAÇÃO-CHAVE — `Rede` e `Motor Ligado` são o MESMO evento:**
>
> | Momento | `Rede (PG)` | `Motor Ligado (PG)` |
> |---------|-------------|---------------------|
> | **18/05 18:06** | `status` → `not_detected` | **início** do flapping (§9.9) |
> | **19/05 07:33** | `status` → `detected` | flapping **para** (~07:30) + alarme `Falta de Fase` abre |
>
> O `Motor Ligado` flapou **exatamente dentro** da janela em que o `Rede` esteve
> `not_detected` (18:06 → 07:33, ~13,5 h). **Interpretação física:** essa janela é o período
> em que a **rede/energia esteve anormal** e o **diesel operou** — e a operação do diesel
> produziu o chattering do sinal "Motor Ligado". Reforça o veredito §9.9 (causa de
> campo/elétrica) e o contextualiza: o chattering ocorreu **enquanto o diesel rodava**.
>
> ⚠️ **Possível inversão de polaridade:** se `detected` = "rede normal/presente", a
> *alarm rule* `Falta de Fase no Gerador` dispara na condição **normal** — a confirmar com o
> significado físico do sinal "Sinal De Rede" (slave 46).

### 9.11 ⚠️ Hipótese forte — colisão de dois devices homônimos "Motor Ligado"

**Fato** (tabela `channels` / [`slaves-map.md`](./slaves-map.md) §1): existem **dois channels
`presence_sensor` com o nome IDÊNTICO `Motor Ligado`**:

| Channel | Slave | Equipamento |
|---------|-------|-------------|
| **ch 77** | 35 | `Alarmes Bombas Diesel Principal` |
| **ch 93** | 45 | `Gerador Diesel` |

(ch 80 "Motor Ligado **(Reserva)**" tem nome distinto → não colide.)

O ThingsBoard casa device por **nome**. Se ambos sincronizam para o **mesmo device TB**
`Motor Ligado (PG)` (`68c8aee1`), a telemetria dos **dois equipamentos físicos colide num só
entity** — e isso **reinterpreta o "flapping" da §9.9**.

**O padrão da §9.9 (par de leituras ~7 s apart, sempre `not_detected` → `detected`, a cada
~7,4 min) deixa de ser "chattering" e passa a ser a central lendo os dois slaves com ~7 s de
diferença e publicando ambos no mesmo device:**

| Período | slave 35 (Bombas Diesel Principal) | slave 45 (Gerador Diesel) | par no device TB |
|---------|-----------------------------------|---------------------------|------------------|
| Antes 18/05 18:06 | `not_detected` (parado) | `not_detected` (parado) | (N, N) |
| 18:06 → 19/05 07:33 | `not_detected` (parado) | **`detected` (rodando)** | (N, D) |

**Encaixa com toda a evidência:**
1. Explica a ordem **sempre** (N, D) — ordem fixa de polling dos 2 slaves.
2. Durante a queda (~13,5 h) o **Gerador rodou contínuo e correto** (`detected`), sem
   chattering nenhum — comportamento esperado numa falta de energia.
3. Bate com o relato do cliente **"bombas não partiram"** — o slave 35 ficou `not_detected`.

**Consequência:** se confirmada, a causa-raiz **não é falha de campo** — o veredito da §9.9
está **incorreto**. A causa-raiz passa a ser **configuração / modelo de dados**: dois
devices homônimos sincronizados para o mesmo entity ThingsBoard.

**Verificação decisiva:**

```sql
-- ThingsBoard: quantos devices se chamam "Motor Ligado..."?
SELECT id, name, type,
       to_timestamp(created_time/1000) AT TIME ZONE 'America/Sao_Paulo' AS criado
FROM device
WHERE name ILIKE '%motor ligado%';
```

- **1 linha** (`68c8aee1`) → **colisão confirmada** (2 channels físicos → 1 device TB).
- **2 linhas** → são devices separados; aí o veredito da §9.9 se mantém.

> 🔧 **Correção (se confirmada):** renomear os channels para nomes únicos — ex.:
> `Motor Ligado - Gerador` e `Motor Ligado - Bombas Principal` — e re-sincronizar para
> separar os dois entities no ThingsBoard. Vale também para os channels `Comp1`/`Comp2`
> (repetidos em 6 slaves) e `Teste` (slaves-map §3.4 / §2).

---

## 10. Node-RED Praia Grande — papel na automação e nos alarmes

Analisado o backup `bkp-all-flows-node-red-obramax-praia-grande-2026-05-20-10-29.json`
(615 nós, 9 abas).

### 10.1 O que o Node-RED da PG automatiza (atuação real)

Os nós de atuação são `activate-channel` — comandam canais/relés via Modbus
(`{slave, channel, value}`; `value: 100` = liga / `0` = desliga). Os **26** `activate-channel`
estão **exclusivamente** nestes contextos:

| Contexto | Função |
|----------|--------|
| Abas *Agendamento Estacionamento/ADM, Loja, Depósito, Ares* | Liga/desliga **iluminação/clima** por horário (`time-range`) |
| Grupo *Min temperature → Control device* | Desliga device por temperatura mínima |
| Grupo *Demand → Control device* | Desliga device por demanda máxima |
| Grupo *On/Off devices* | Endpoint HTTP de on/off **manual** (dashboard) |

➡️ **Não existe nenhuma lógica que ligue "bomba"/"motor"** — nem por horário, nem em resposta
a queda de energia ou partida de gerador. As strings `Bomba` e `Motor Ligado` **não aparecem
em nenhum nó** do flow.

### 10.2 O que o Node-RED monitora

- Lê o medidor **`Gerador (PG)`** (Schneider, Modbus **slave 3** — `_modbus_3`): kWh,
  correntes, tensões e potências A/B/C.
- Lê hidrômetros, sensores de temperatura, *three-phase sensors*, etc.
- Publica telemetria no ThingsBoard (MQTT) e na Helexia.

### 10.3 🔑 Node-RED é uma SEGUNDA fonte de alarmes

O grupo **"Alarms"** (Flow 1) cria/encerra alarmes **diretamente no ThingsBoard via REST**:

- Config de alarme por device chega via HTTP e é salva em `flow.stored_alarms`
  (função `Save individual alarm`).
- O avaliador (`34f612ad`) compara o `status` da telemetria:
  - alarme `deviceActivated` → `status ∈ {on, detected}` → **cria**; senão **encerra**.
  - alarme `deviceDeactivated` → inverso.
- `5a37826b` → `POST https://dashboard.myio.com.br/api/alarm` (cria/atualiza).
- `d41edb3f` → `POST /api/alarm/{id}/clear` (encerra).
- **Severidade fixada em `MAJOR`** nos alarmes criados pelo Node-RED (hardcoded).

➡️ **Um registro na tabela `alarm` do TB pode ter 2 origens:**

| Origem | Como identificar |
|--------|------------------|
| **Device Profile** (alarm rule do profile, §3.1) | `severity` = a do profile (ex.: `CRITICAL`) |
| **Node-RED** (grupo Alarms via REST) | `severity` = `MAJOR` (hardcoded em `5a37826b`) |

> Os 11 registros da amostra (§9.4) são todos **`CRITICAL`** → criados pelo **device profile**,
> não pelo Node-RED. Para os alarmes `Bomba Ligada` do print: **se forem `MAJOR`, vieram do
> Node-RED**; se `CRITICAL`, do profile (incluir `severity` na query (C) de §9.5).

### 10.4 Resposta à hipótese "o Node-RED não ligou a bomba"

| Pergunta | Resposta com base no flow |
|----------|---------------------------|
| O Node-RED da PG liga bombas? | **Não.** Nenhum nó/lógica de partida de bomba. Atuação = iluminação/clima por horário/temperatura/demanda. |
| Quem deveria ligar as bombas numa queda de energia? | Função **elétrica de campo** — QTA/ATS (transferência automática) e o painel da própria bomba. **Fora do escopo do Node-RED.** |
| O device `Motor Ligado (PG)` é tratado neste Node-RED? | **Não** — não aparece no flow. Sua telemetria vem de outra fonte/gateway. |
| Então o que explica "receberam telegram e a bomba não partiu"? | O alarme `Bomba Ligada` **oscilando** (created→cleared, `Duração 0s`) é **sintoma**, não causa: o `status` do motor piscou ligado→desligado → a bomba **tentou partir e não sustentou** (falha elétrica). O Telegram apenas **reportou**. |

**Conclusão:** a hipótese de que *"o Node-RED deveria ter ligado a bomba e falhou"* **não se
sustenta** neste backup — o Node-RED da PG não tem essa atribuição. A falha de partida das
bombas é **elétrica / de campo** (QTA, ATS, painel da bomba). O papel de Node-RED + ThingsBoard
foi apenas **detectar e notificar** — e o fez de forma confusa por causa do BUG-1 e da
OBS-5 (§5). O *flapping* `Duração: 0 segundos` é a assinatura de um motor que pisca on/off.

---

## 11. Lacunas para o primeiro diagnóstico

### 11.1 Diagnóstico preliminar (hipótese de trabalho)

Em **18/05/2026 ~18:06** houve um gatilho (provável evento elétrico). A partir daí o sinal
**"Motor Ligado"** passou a oscilar ON/OFF **a cada ~7,5 min por ~13 h** (até 19/05 07:30) →
116 alarmes `Bomba Ligada` criados/encerrados → ~232 mensagens no Telegram = o *flood*
percebido como "falha no alarme global". Em **19/05 07:33** abriu `Falta de Fase no Gerador`
no `Rede (PG)`, ainda ativo. O Node-RED **não liga bombas e não escreve em `logs`** (§10) —
é só monitor/notificador; a partida das bombas é função elétrica (QTA/ATS).

### 11.2 Explicações concorrentes — ✅ DECIDIDO (ver §9.9)

| | Hipótese | Status |
|-|----------|--------|
| **A** | Flapping real — motor diesel cicla a cada ~7,5 min | ❌ Descartada — não há ciclo de 7 min (§9.9) |
| **B** | Artefato de amostragem de sinal **estável** | ❌ Descartada — leituras pareadas discordam (§9.9) |
| **C** | ✅ **Sinal digital "Motor Ligado" instável / *chattering*** (muda de estado em segundos) | ✅ **Confirmada** pela série temporal (§9.9) |

> **Causa-raiz = sinal de entrada instável** (campo/elétrica). O envio periódico (~7,4 min)
> + *alarm rule* sem debounce **amplificam** para *flood*, mas não originam.

### 11.3 O que falta (priorizado)

| # | Lacuna | Por que é decisiva | Como obter |
|---|--------|--------------------|------------|
| 1 | **Série temporal da chave de telemetria** que dispara os alarmes | ✅ **FEITO p/ `Motor Ligado`** (§9.8/§9.9 — chattering confirmado). ⏳ Falta `Rede (PG)` | `ts_kv` key 58 no TB |
| 2 | **Qual channel** é o `Motor Ligado (PG)`: 77 (Bombas Diesel Principal) × 93 (Gerador Diesel) | Define se quem alarma é **bomba** ou **gerador** | mapeamento channel ↔ device TB ([`slaves-map.md`](./slaves-map.md) §1) |
| 3 | **Alarm rule do device profile `Obramax - Gerador ligado`** (a do tipo `Bomba Ligada`) | Saber a chave, condição create/clear e se há debounce | ThingsBoard → Device Profiles |
| 4 | **Query `logs` de 19/05** (slaves 34/35/36/37/45/46) | Distingue **comando local** (cena/app) × **leitura de campo** | `manual-centrais-linix-orangepi.md` §5.3 |
| 5 | **Caminho de publicação** do `presence_sensor` → ThingsBoard (o Node-RED não trata "Motor Ligado") | Saber quem envia a telemetria que vira o alarme | confirmar se é o `myio-api` / app `hubot` |
| 6 | **Contexto físico de 18/05 18:06** | Confirma se houve queda de energia e o estado de geradores/bombas/QTA | relato da equipe de campo / concessionária |
| 7 | Por que `Rede (PG)` segue **Active > 28 h** | Falta de fase real persistente × leitura congelada | resolvido pelo item 1 |

### 11.4 Como obter a série temporal (lacuna #1)

A telemetria existe em **dois lugares**, que respondem perguntas diferentes:

- **ThingsBoard** (`ts_kv` — mesma base da tabela `alarm`) → telemetria **como o motor de
  alarme viu**. É o input direto da *alarm rule*. **Fazer primeiro.**
- **Central PG** (`hubot`) → sinal **na origem** (leitura Modbus) + revela o **intervalo de
  envio** (se reporta a cada ~7,5 min e o valor alterna a cada envio → artefato de amostragem).

**ThingsBoard — `ts_kv`** (`key` é `int4`; o dicionário **não** se chama `ts_kv_dictionary`
nesta instalação — provável `key_dictionary`). As queries abaixo **não dependem** do
dicionário — a chave `status` é identificada pelos valores (`str_v` = `detected`/`not_detected`).

```sql
-- (A) achar a tabela de dicionário de chaves (opcional, só p/ nome legível)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%dict%';

-- (B) chaves (key_id) que o device tem
SELECT key, count(*) AS amostras,
       to_timestamp(min(ts)/1000) AT TIME ZONE 'America/Sao_Paulo' AS primeiro,
       to_timestamp(max(ts)/1000) AT TIME ZONE 'America/Sao_Paulo' AS ultimo
FROM ts_kv
WHERE entity_id = '68c8aee1-f143-11ef-a212-67802bff4221'   -- Motor Ligado (PG)
GROUP BY key ORDER BY key;

-- (C) identificar QUAL key é o 'status' — pelos valores distintos
SELECT key, bool_v, str_v, long_v, dbl_v, count(*)
FROM ts_kv
WHERE entity_id = '68c8aee1-f143-11ef-a212-67802bff4221'
  AND ts >= 1779073200000 AND ts < 1779332400000
GROUP BY key, bool_v, str_v, long_v, dbl_v ORDER BY key;

-- (D) série temporal — com o <KEY_ID> achado na (C)
SELECT to_timestamp(ts/1000) AT TIME ZONE 'America/Sao_Paulo' AS momento,
       bool_v, str_v, long_v, dbl_v
FROM ts_kv
WHERE entity_id = '68c8aee1-f143-11ef-a212-67802bff4221'   -- Motor Ligado (PG)
  AND key = <KEY_ID>
  AND ts >= 1779073200000 AND ts < 1779332400000           -- 18/05 00:00 → 21/05 00:00 GMT-3
ORDER BY ts;
```

> Repetir (B)–(D) para `Rede (PG)` → `entity_id = '5226a330-0021-11f0-9baa-8137e6ac9d72'`.
> **Fallback:** se a (B) não retornar nada, o `status` é um **atributo** → está em
> `attribute_kv`, não em `ts_kv`.

**Central PG** — o estado do `presence_sensor` não tem tabela óbvia (`channel_pulse_log` é só
para canais de pulso). Descobrir antes: `\d alarms`, `\d alert_history`, e checar linhas
recentes dos slaves **45** (Gerador), **35** (Bombas Principal), **46** (Rede).

### 11.5 Critério de decisão

> Itens **#1 + #4** fecham o primeiro diagnóstico:
> - chave oscila de forma **limpa/regular** **e** **sem** comando nos `logs` → **Hipótese A**
>   (falha elétrica / de campo);
> - oscilação **irregular/ruidosa**, **ou** há comando/cena nos `logs` no mesmo ritmo →
>   **Hipótese B** (artefato de leitura / automação).

---

## 12. Glossário / referências

| Termo | Significado |
|-------|-------------|
| `(PG)` | Sufixo de nome de device da unidade **Praia Grande** |
| `status = detected / not_detected` | Chave de telemetria booleana-discreta que dispara/limpa alarmes |
| Grupo Especial | Grupo Telegram para alarmes críticos de gerador/bomba (lista `allowed`, §3.2) |
| Flapping | Alarme que abre e fecha repetidamente em curtíssimo intervalo |
| `telegramGroup` / `telegramSpecialGroup` | Atributos do Customer com o `chat_id` de cada grupo Telegram |
| Device Profile Node | Nó da rule chain que avalia as alarm rules definidas no device profile |

**Arquivos relacionados:**
- Evidência: `./Evidencia_Alarme_Telegram_OBRAMAX_PraiaGrande.png`
- Resultado da query de alarmes (18–20/05): `./query-alarmes-praia-grande-18-a-20-maio-2026.log`
- Rule chain ThingsBoard: `../bkp-rule-chain-thingsboard-obramax-2026-05-20-10-34.json`
- Flows Node-RED Praia Grande: `./bkp-all-flows-node-red-obramax-praia-grande-2026-05-20-10-29.json`
- Unidade irmã (referência de estrutura): `../GUADALUPE/`

---

*Documento de investigação — atualizar conforme novas evidências forem coletadas.*
