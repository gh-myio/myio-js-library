# mqttSyncStatus v2 — Diagramas do Fluxo

Central: **Ilha Plaza AL1** (Soul Malls) · Gateway `81a60176-222c-4bb9-88f5-bc2b47802d82`
Spec: [`../setMqttSyncStatus-payload-spec.md`](../setMqttSyncStatus-payload-spec.md)

Functions numeradas por step em [`v2/`](./v2/) (índice: [`v2/README.md`](./v2/README.md)):
- `v2/01-validate-gate.js` — step 1: gate de validação (2 saídas)
- `v2/02-engine-holds-ttl-record.js` — step 2: engine holds + TTL + record + global derivado (2 saídas)
- `v2/03-get-status-ttl-sweep.js` — step 3: leitura GET com TTL sweep (1 saída)

---

## 0. O que é o Node-RED

**Node-RED** é um runtime de automação baseado em **fluxos**: a lógica é montada
ligando **nós** (caixas) por **fios**, e cada mensagem (`msg`, um objeto JS com
`msg.payload`) percorre esses fios de nó em nó. Nas **centrais MyIO** (Orange Pi
com Linux) ele roda **embarcado** pelo `myio-api.service` e faz a ponte entre os
medidores no campo (Modbus/MQTT) e a nuvem — expondo a REST local em `/api/*`
(porta 8080), onde GCDR, Alarmes, ThingsBoard e o App disparam chamadas como
`POST /api/setMqttSyncStatus`. Os nós `function` são blocos de JavaScript; o
estado entre execuções fica no **contexto** `global` (em memória por padrão).
Editor em `/red`; fluxos salvos como JSON
(`../../bkp-all-flows-ilha-plaza-al1-2026-06-16.json`).

---

## 1. Topologia do flow no Node-RED

```mermaid
flowchart LR
    subgraph SYS["Sistemas que disparam"]
        GCDR[GCDR]
        ALM[Alarmes]
        TB[ThingsBoard]
        APP[App Mobile]
        OPS[Ops / Manual]
    end

    GCDR & ALM & TB & APP & OPS -->|"POST /api/setMqttSyncStatus"| HIN["http in<br/>/setMqttSyncStatus"]

    HIN --> VAL["function:<br/>validate (gate)"]
    VAL -->|"out1: válido<br/>msg.params=[envelope]"| ENG["function:<br/>v2 holds+TTL+record"]
    VAL -->|"out2: inválido<br/>400 + {error}"| RESPerr["http response"]

    ENG -->|"out1: RESPONSE"| RESPok["http response"]
    ENG -->|"out2: RECORD (append-only)"| PERSIST["persistência / forward"]

    PERSIST --> PG[("Postgres<br/>state JSON")]
    PERSIST --> FWD["HTTP request → GCDR<br/>(buffer se offline)"]

    ENG -.->|"global.set"| G[["global:<br/>mqttHolds · mqttSyncStatus<br/>mqttAuditLog · mqttLastChange"]]

    GET["http in<br/>GET /mqttSyncStatus"] --> GETF["function:<br/>GET v2 (TTL sweep)"]
    GETF --> GRESP["http response<br/>(estado rico + string legada)"]
    GETF -.->|"lê + varre TTL"| G

    classDef sys fill:#eef2ff,stroke:#6366f1;
    classDef fn fill:#ecfdf5,stroke:#10b981;
    classDef io fill:#fff7ed,stroke:#f59e0b;
    classDef store fill:#fef2f2,stroke:#ef4444;
    class GCDR,ALM,TB,APP,OPS sys;
    class VAL,ENG,GETF fn;
    class HIN,GET,RESPerr,RESPok,GRESP,PERSIST,FWD io;
    class PG,G store;
```

---

## 2. Decisão do `effectiveStatus` (modelo de holds)

> Regra única: **MQTT habilitado ⟺ nenhum hold ativo.**

```mermaid
flowchart TD
    START([POST chega na engine v2]) --> SWEEP["TTL sweep:<br/>remove holds com expiresAt ≤ now"]
    SWEEP --> IDEM{"requestId/idempotencyKey<br/>já visto?"}
    IDEM -->|sim| NOOP["decidedBy = NOOP<br/>(não altera holds)"]
    IDEM -->|não| INT{intent?}

    INT -->|DISABLE| ACQ["adquire hold<br/>{holdId, system, expiresAt = now+ttl}"]
    INT -->|ENABLE| REL{"holdId existe?"}
    INT -->|FORCE_DISABLE| FD["insere hold sentinela<br/>manual:force:*"]
    INT -->|FORCE_ENABLE| FE["limpa TODOS os holds"]
    INT -->|QUERY| NOOP

    REL -->|sim| RELY["remove aquele hold"]
    REL -->|não| RELN["decidedBy = NOOP<br/>(idempotente)"]

    ACQ --> COUNT
    RELY --> COUNT
    RELN --> COUNT
    FD --> COUNT
    FE --> COUNT
    NOOP --> COUNT

    COUNT{"holdCount > 0 ?"}
    COUNT -->|sim| DIS["effectiveStatus = disable"]
    COUNT -->|não| ENA["effectiveStatus = enable"]

    DIS --> PERSIST2["global.set(mqttSyncStatus)<br/>push RECORD no ring + saída 2"]
    ENA --> PERSIST2
    PERSIST2 --> DONE([RESPONSE + RECORD])

    classDef warn fill:#fef9c3,stroke:#ca8a04;
    classDef ok fill:#dcfce7,stroke:#16a34a;
    class DIS warn;
    class ENA ok;
```

---

## 3. O problema que o modelo resolve — concorrência multi-sistema

Linha do tempo: **GCDR** e **Alarmes** pausam o MQTT ao mesmo tempo, por razões diferentes.
Com boolean (last-writer-wins) o MQTT voltaria cedo demais. Com holds, não.

```mermaid
sequenceDiagram
    autonumber
    participant G as GCDR
    participant A as Alarmes
    participant N as Node-RED (engine)
    participant M as MQTT publish

    Note over M: enable (0 holds)
    G->>N: DISABLE hold=gcdr:provisioning (ttl 900s)
    N->>M: disable  (holds=1)
    A->>N: DISABLE hold=alarms:storm (ttl 300s)
    N-->>N: holds=2 (sem mudança de estado)
    G->>N: ENABLE hold=gcdr:provisioning
    N-->>N: remove hold gcdr · holds=1
    Note over N,M: ❌ boolean voltaria aqui (errado)<br/>✅ holds: continua disable
    A->>N: ENABLE hold=alarms:storm
    N->>M: enable  (holds=0) ✅
```

### Dead-man switch (TTL) — auto-recuperação

```mermaid
sequenceDiagram
    autonumber
    participant A as Alarmes
    participant N as Node-RED
    participant M as MQTT publish

    A->>N: DISABLE hold=alarms:storm (ttl 300s)
    N->>M: disable (holds=1)
    Note over A: 💥 instância do Alarmes cai<br/>(nunca manda ENABLE)
    Note over N: ...300s depois...
    N->>N: TTL sweep (no próximo GET/POST/timer)
    N->>M: enable (holds=0) — MQTT volta sozinho ✅
```

---

## 4. Três documentos, um por etapa

```mermaid
flowchart LR
    REQ["REQUEST<br/>(cliente envia)<br/>intent · hold · actor · request"]
      -->|"validate gate"| ENVL["ENVELOPE<br/>(normalizado)<br/>+ requestId · receivedAtMs · ip"]
    ENVL -->|"engine v2"| REC["RECORD<br/>(persistido, append-only)<br/>+ outcome: effectiveStatus,<br/>previousStatus, changed,<br/>decidedBy, activeHolds, clockSkew"]
    ENVL -->|"engine v2"| RES["RESPONSE<br/>(eco HTTP enxuto)<br/>ok · effectiveStatus · holdCount · expiresAt"]

    classDef a fill:#eff6ff,stroke:#3b82f6;
    classDef b fill:#f5f3ff,stroke:#8b5cf6;
    classDef c fill:#ecfdf5,stroke:#10b981;
    class REQ a;
    class ENVL b;
    class REC,RES c;
```

> `previousStatus` / `changed` / `effectiveStatus` são **resultado do servidor** — vivem só no RECORD/RESPONSE, nunca no REQUEST.

---

## 5. `decidedBy` — por que o estado é o que é

| valor | quando | observabilidade |
|-------|--------|-----------------|
| `HOLD_COUNT` | fluxo normal (acquire/release) | estado segue a contagem de holds |
| `FORCE` | `FORCE_ENABLE` / `FORCE_DISABLE` (override ops) | sempre auditado: quem forçou e por quê |
| `TTL_EXPIRED` | hold venceu e foi varrido | auto-recuperação registrada |
| `NOOP` | idempotência / `QUERY` / hold já liberado | retry seguro, sem efeito colateral |
