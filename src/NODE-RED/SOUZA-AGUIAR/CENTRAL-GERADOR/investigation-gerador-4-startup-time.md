# Investigação — `Gerador 4` / campo `startupTime`

> **Status:** investigação aberta. Cálculo do flow entendido (§3, §4). Aritmética dos 4 pontos consistente (§4.2). Pendente: (a) entender por que o gerador disparou 3 transições OFF→ON em uma única queda da rede (§5); (b) confirmar com operação se o cálculo atual é o desejado ou se é bug (§4.4, §8).
> **Central:** Souza Aguiar — Gerador
> **Devices TB:** `Gerador 4 (Souza Aguiar Gerador)` e `Rede 4 time (Souza Aguiar Gerador)` (virtuais — criados pelo TB ao receber a 1ª telemetria do Node-RED)
> **Holding:** Souza Aguiar
> **Backups analisados:**
> - `bkp_all_flows_souza_aguiar_gerador_2026-05-04-12_30.json`
> - `QTA4/bkp_QTA4_flow_souza_aguiar_gerador_2026-05-04-12_32.json`
> - Functions extraídas: `QTA4/*.js`

---

## 1. Identificadores da central

| Campo      | Valor                                                      |
| ---------- | ---------------------------------------------------------- |
| Central    | Souza Aguiar — Gerador                                     |
| IPv6       | `200:dd4c:53b0:28d5:33dc:fbef:2c98:b23`                    |
| Gateway ID | `bb8193d9-a132-44b5-8605-e50c0521ceb9`                     |
| SSH        | `ssh -i id_rsa root@200:dd4c:53b0:28d5:33dc:fbef:2c98:b23` |
| Tab Node-RED | `f58a5c30.bc029` ("Flow 1")                              |
| Group QTA4 | `36513397.a434cc`                                          |

Referência: `src/NODE-RED/GLOBAL_INFO/manual-centrais-linix-orangepi.md` §2.2.

---

## 2. Observação que motivou a investigação

### 2.1 Widgets do dashboard ThingsBoard (QTA4)

Dois widgets na tela do TB consomem a telemetria emitida pelo group QTA4:

| Widget                          | Device TB                        | Telemetry key | Label exibido     |
| ------------------------------- | -------------------------------- | ------------- | ----------------- |
| Histórico de Partida do Gerador | `Gerador 4 (Souza Aguiar Gerador)` | `startupTime` | **Tempo de Partida** |
| Histórico de Falha da Rede      | `Rede 4 time (Souza Aguiar Gerador)` | `startupTime` | **Tempo de Retorno** |

> ⚠️ Ambos os devices virtuais TB usam o **mesmo nome de campo** `startupTime`, mas com semânticas diferentes nos dashboards. Isso já é uma armadilha — torna o campo ambíguo fora do contexto do widget.

### 2.2 Registros observados em abril/2026

**Widget 1 — Histórico de Partida do Gerador** (`Gerador 4 → startupTime`):

| date time             | startupTime (ms) | Tempo de Partida exibido |
| --------------------- | ---------------- | ------------------------ |
| 2026-04-15 07:00:33   | 13.954           | 13,95 s                  |
| 2026-04-15 07:15:02   | 883.159          | 883,16 s                 |
| 2026-04-15 07:37:51   | 2.252.214        | 2.252,21 s (~37 min)     |

**Widget 2 — Histórico de Falha da Rede** (`Rede 4 time → startupTime`):

| date time             | startupTime (ms) | Tempo de Retorno exibido |
| --------------------- | ---------------- | ------------------------ |
| 2026-04-15 07:52:31   | 3.131.820        | 3.131,82 s (~52 min)     |

O Widget 1 cresceu de ~14 s para ~37 min em 37 min de wall-clock, o que parecia incompatível com "tempo de partida do gerador". O Widget 2 reportou **um único** evento de falha de rede no dia. Essa inconsistência entre os dois widgets dispara a investigação e, como veremos em §4, **fecha** o diagnóstico do bug.

### 2.3 Hipótese inicial (descartada)

> Que `startupTime` fosse uptime do device em ms, com boot ~07:00:19. Os 3 pontos batiam matematicamente, mas a leitura do flow refutou: o valor é calculado a partir de transições rede/gerador, **não** de um uptime monotônico.

---

## 3. Como `startupTime` é realmente calculado

### 3.1 Diagrama do group QTA4 (Gerador 4)

```
                  ┌──────────────────────────┐
                  │ link in 1dd55047.29013   │  ← recebe do filter-slave 6
                  └────────────┬─────────────┘
                               │ msg.payload.channels[]
                ┌──────────────┼──────────────┬──────────────────┐
                ▼              ▼              ▼                  ▼
    ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐ ┌────────────────────┐
    │ 2faa4fd1.66fbf   │ │ d4f4992c.    │ │ 25facd11.288612  │ │ e05d3e4b.c3369     │
    │ Status Rede      │ │ 1d82d8       │ │ Store Status     │ │ Detect Gerador ON  │
    │ (channel[1])     │ │ Status       │ │ Rede (ATIVO)     │ │ (channel[0])       │
    │ → "Rede 4"       │ │ Gerador      │ │ → "Rede 4 time"  │ │ → timeDelta puro   │
    │   { status }     │ │ (channel[0]) │ │   { startupTime }│ │                    │
    │                  │ │ → "Gerador 4"│ │                  │ │                    │
    │                  │ │   { status } │ │                  │ │                    │
    └────────┬─────────┘ └──────┬───────┘ └────────┬─────────┘ └─────────┬──────────┘
             │                  │                  │                     │
             │                  │                  │                     ▼
             │                  │                  │           ┌──────────────────────┐
             │                  │                  │           │ 6ea7cdcf.a463c4      │
             │                  │                  │           │ Send Gerador         │
             │                  │                  │           │ StartupTime          │
             │                  │                  │           │ → "Gerador 4"        │
             │                  │                  │           │   { startupTime }    │
             │                  │                  │           └──────────┬───────────┘
             │                  │                  │                      │
             ▼                  ▼                  ▼                      ▼
        ┌────────────────────────────────────────────────────────────────────┐
        │ ff42b7a3.bd4718  link out  → 5cc7bf8e.1546a  → HTTP POST TB        │
        └────────────────────────────────────────────────────────────────────┘

Dead code (no group, mas wires: [], outputs: 0):
    cdfb0afe.c4e898  Store Status Rede (v1 — versão antiga, NUNCA executa)
```

> Quanto ao significado dos canais: o `msg.payload` que entra vem do slave 6 ("QTA 4", `type: outlet`), e cada canal é um dispositivo lógico do tipo `presence_sensor` (sensor de presença de tensão) — `channels[0]` = saída do Gerador 4, `channels[1]` = barramento da rede da concessionária. Detalhes em §6.5.

### 3.2 Lógica das 4 funções ativas

**`2faa4fd1.66fbf` — Status Rede**
```js
msg.payload = {
  'Rede 4 (Souza Aguiar Gerador)': [{
    ts: new Date().getTime(),
    values: { status: msg.payload.channels[1].input }
  }]
}
```
Emite o estado bruto do canal 1 (rede) ao TB.

**`d4f4992c.1d82d8` — Status Gerador**
```js
msg.payload = {
  'Gerador 4 (Souza Aguiar Gerador)': [{
    ts: new Date().getTime(),
    values: { status: msg.payload.channels[0].input }
  }]
}
```
Emite o estado bruto do canal 0 (gerador) ao TB.

**`25facd11.288612` — Store Status Rede (ATIVO)**
```js
const storedState = flow.get('STATUS_REDE4');
const input       = msg.payload.channels[1].input;
const newState    = input === 0 ? 'ON' : 'OFF';
flow.set('STATUS_REDE4', newState);

if (newState === 'OFF' && storedState === 'ON') {
  flow.set('REDE_OFF_TIME4', new Date().getTime());
  return null;                                     // ON→OFF: marca instante, não emite
}
else if (storedState === 'OFF' && newState === 'ON') {
  const timeDelta = Date.now() - flow.get('REDE_OFF_TIME4');
  msg.payload = {
    'Rede 4 time (Souza Aguiar Gerador)': [{
      ts: new Date().getTime(),
      values: { startupTime: timeDelta }           // OFF→ON: emite duração da queda
    }]
  };
  return msg;
}
return null;
```
Mantém o estado da rede e mede **quanto tempo a rede ficou fora** (emitido como `Rede 4 time → startupTime`).

**`e05d3e4b.c3369` — Detect Gerador ON**
```js
const lastStatusGerador = flow.get('STATUS_GERADOR4');
const statusRede        = flow.get('STATUS_REDE4');
const input             = msg.payload.channels[0].input;
const statusGerador     = input > 0 ? 'OFF' : 'ON';
flow.set('STATUS_GERADOR4', statusGerador);

if (statusRede === 'OFF'
 && statusGerador === 'ON'
 && lastStatusGerador === 'OFF') {
  const redeOffTime = flow.get('REDE_OFF_TIME4');
  const timeDelta   = Date.now() - redeOffTime;
  msg.payload = timeDelta;                          // número puro, próximo node empacota
  return msg;
}
```
Quando gerador transita OFF→ON com rede ainda OFF, calcula `now - REDE_OFF_TIME4`.

**`6ea7cdcf.a463c4` — Send Gerador StartupTime**
```js
msg.payload = {
  'Gerador 4 (Souza Aguiar Gerador)': [{
    ts: new Date().getTime(),
    values: { startupTime: msg.payload }
  }]
}
```
Empacota o `timeDelta` recebido como `Gerador 4 → startupTime` para o TB.

### 3.3 Fan-out e ordem de execução

O `link in 1dd55047.29013` distribui o mesmo `msg` para 4 nodes na ordem do array `wires[0]`:

```
[2faa4fd1.66fbf, d4f4992c.1d82d8, 25facd11.288612, e05d3e4b.c3369]
   Status Rede   Status Gerador   Store Status     Detect Gerador
                                  Rede (ATIVO)     ON
```

Como Node-RED processa serialmente, **`Store Status Rede` executa antes de `Detect Gerador ON`**. Isso importa: quando rede OFF→ON num mesmo msg, `Store Status Rede` já atualizou `STATUS_REDE4='ON'` antes do `Detect Gerador ON` ler — e `Detect Gerador ON` exige `statusRede==='OFF'`, então não emite. Comportamento **correto**: enquanto a rede está fora, o "startupTime do gerador" tem semântica; assim que a rede volta, o evento de partida do gerador subsequente não é mais reportado por esse caminho.

---

## 4. O bug — interpretação semântica de `startupTime`

### 4.1 Reconciliação dos 4 pontos (3 do Widget 1 + 1 do Widget 2)

Aplicando a lógica do flow + cross-check com o Widget "Histórico de Falha da Rede":

| date time           | Widget                         | Device         | startupTime (ms) | Em segundos      | Interpretação correta                                  |
| ------------------- | ------------------------------ | -------------- | ---------------- | ---------------- | ------------------------------------------------------ |
| 2026-04-15 07:00:33 | Histórico de Partida do Gerador| `Gerador 4`    | 13.954           | 13,95 s          | 1ª transição gerador OFF→ON. Tempo desde queda da rede.|
| 2026-04-15 07:15:02 | Histórico de Partida do Gerador| `Gerador 4`    | 883.159          | 883,16 s         | 2ª transição gerador OFF→ON. Tempo desde queda da rede.|
| 2026-04-15 07:37:51 | Histórico de Partida do Gerador| `Gerador 4`    | 2.252.214        | 2.252,21 s       | 3ª transição gerador OFF→ON. Tempo desde queda da rede.|
| 2026-04-15 07:52:31 | Histórico de Falha da Rede     | `Rede 4 time`  | 3.131.820        | 3.131,82 s       | Rede OFF→ON. Duração total da queda.                   |

### 4.2 Validação aritmética da queda da rede

A queda da rede deve ter ocorrido em `07:52:31 − 3.131,82 s = 07:00:19,18`. Cruzando com os 3 eventos do Widget 1 e o instante deduzido:

| Evento                          | Wall-clock observado | Wall-clock derivado                          | Δ      |
| ------------------------------- | -------------------- | -------------------------------------------- | ------ |
| Queda da rede                   | (não direto)         | 07:00:19,18                                  | ref    |
| 1ª partida gerador (Widget 1)   | 07:00:33             | 07:00:19,18 + 13,954 s = **07:00:33,134**    | +0,134 |
| 2ª partida gerador (Widget 1)   | 07:15:02             | 07:00:19,18 + 883,159 s = **07:15:02,339**   | +0,339 |
| 3ª partida gerador (Widget 1)   | 07:37:51             | 07:00:19,18 + 2.252,214 s = **07:37:51,394** | +0,394 |
| Retorno da rede (Widget 2)      | 07:52:31             | (referência)                                 | —      |

Os 4 timestamps são **internamente consistentes** com uma única queda da rede às 07:00:19,18 e um único retorno às 07:52:31. **Confirma:** todas as 3 emissões do Widget 1 usaram o **mesmo `REDE_OFF_TIME4` = 07:00:19,18`**, porque entre 07:00:19 e 07:52:31 **não houve outra transição rede ON→OFF** que pudesse atualizá-lo (do contrário o Widget 2 teria 2+ registros).

### 4.3 Cenário confirmado

```
07:00:19,18  Rede ON → OFF                    flow.set REDE_OFF_TIME4 = 07:00:19,18
07:00:33,13  Gerador OFF → ON                 Widget 1: startupTime ≈ 14 s   ← partida real do gerador
   ?         Gerador ON → OFF (instabilidade) STATUS_GERADOR4 = 'OFF'
07:15:02,34  Gerador OFF → ON                 Widget 1: startupTime ≈ 883 s  ← FALSO (reusa REDE_OFF_TIME4)
   ?         Gerador ON → OFF (instabilidade) STATUS_GERADOR4 = 'OFF'
07:37:51,39  Gerador OFF → ON                 Widget 1: startupTime ≈ 2252 s ← FALSO (reusa REDE_OFF_TIME4)
   ?         Gerador ON ou estável até 07:52
07:52:31,00  Rede OFF → ON                    Widget 2: startupTime ≈ 3131 s ← duração TOTAL da queda
                                              flow.set STATUS_REDE4 = 'ON'
                                              (REDE_OFF_TIME4 só será resetada na PRÓXIMA queda)
```

**Conclusão operacional:** o gerador 4 partiu rápido (~14 s), oscilou pelo menos 2x durante a queda de 52 min da rede e todas as suas re-partidas foram registradas como se fossem partidas iniciais cada vez mais lentas — o que é falso.

### 4.4 O bug

O label do dashboard ("Tempo de Partida") sugere "tempo que o gerador levou pra partir nesta transição". O código de `Detect Gerador ON` (`QTA4/detect_gerador_ON.js`) entrega "tempo desde a queda da rede até a partida atual do gerador".

Os dois conceitos coincidem **somente na primeira partida** após uma queda de rede. Quando o gerador oscila (parte → para → parte de novo) com a rede ainda OFF, todas as partidas posteriores reportam `now − REDE_OFF_TIME4`, que é monotonicamente crescente porque `REDE_OFF_TIME4` só é atualizado em transições rede ON→OFF (vide `QTA4/store_status_rede.js`).

O caso de 2026-04-15 é o exemplo perfeito: 1 evento real de rede + 3 emissões registradas no Widget 1, sendo apenas a primeira (~14 s) representativa da partida do gerador. O TB mostra "degradação da partida" quando na verdade o que aconteceu foi **instabilidade do gerador**.

### 4.5 Por que o `Rede 4 time` (Widget 2) não tem o mesmo bug

Na função `store_status_rede.js`, o `startupTime` do device `Rede 4 time` é emitido **somente** na transição rede OFF→ON, e o `REDE_OFF_TIME4` é capturado na transição rede ON→OFF imediatamente anterior. Como rede só faz uma transição ON→OFF antes de uma transição OFF→ON, **não há reuso indevido**. O Widget 2 reporta corretamente "duração da queda da rede".

Resumindo:

| Device         | Emitido em                          | Lê                | Bug?         |
| -------------- | ----------------------------------- | ----------------- | ------------ |
| `Rede 4 time`  | rede OFF→ON                         | `REDE_OFF_TIME4`  | ❌ não        |
| `Gerador 4`    | gerador OFF→ON (com rede ainda OFF) | `REDE_OFF_TIME4`  | ✅ **sim**    |

A diferença é que o `Gerador 4` usa um cronômetro (`REDE_OFF_TIME4`) que **não pertence** ao seu próprio ciclo OFF→ON.

### 4.6 Severidade

- **Não corrompe os widgets de status** (`Status Rede`, `Status Gerador`) — esses usam input bruto do canal.
- **Não corrompe o Widget 2** (Histórico de Falha da Rede) — ver §4.5.
- **Distorce o Widget 1** (Histórico de Partida do Gerador) — registra eventos falsos durante uma única queda de rede com gerador instável.
- **Distorce alarmes "tempo de partida > X"** — disparam falsos positivos.
- **Distorce relatórios SLA do gerador** — métricas de "tempo médio de partida" ficam infladas.

---

## 5. Por que vieram 3 emissões em vez de 1? — questionamentos abertos

### 5.1 A pergunta operacional

O esperado para um evento de queda da rede com gerador funcionando bem é **uma única emissão** no Widget 1 ("Histórico de Partida do Gerador"), correspondendo à 1ª e única partida do gerador após a queda. O dia 2026-04-15 traz:

| date time           | startupTime (ms) | Tempo de Partida exibido |
| ------------------- | ---------------- | ------------------------ |
| 2026-04-15 07:00:33 | 13.954           | 13,95 s                  |
| 2026-04-15 07:15:02 | 883.159          | 883,16 s ← **extra**     |
| 2026-04-15 07:37:51 | 2.252.214        | 2.252,21 s ← **extra**   |

Apenas o primeiro (~14 s, partida real do gerador) é o registro esperado. Por que vieram os outros 2?

### 5.2 O que precisa acontecer pra `Detect Gerador ON` emitir

Recapitulando o código de `QTA4/detect_gerador_ON.js`:

```js
const lastStatusGerador = flow.get('STATUS_GERADOR4');   // estado anterior do gerador
const statusRede        = flow.get('STATUS_REDE4');      // estado atual da rede
const input             = msg.payload.channels[0].input; // canal 0 = gerador
const statusGerador     = input > 0 ? 'OFF' : 'ON';      // calcula estado novo
flow.set('STATUS_GERADOR4', statusGerador);

if (statusRede === 'OFF'
 && statusGerador === 'ON'
 && lastStatusGerador === 'OFF') { ... emite ... }
```

Para emitir, **as três condições precisam valer ao mesmo tempo**:
1. Rede está OFF (não voltou).
2. Estado novo do gerador é ON (`channels[0].input === 0`).
3. Estado anterior do gerador era OFF (`STATUS_GERADOR4 === 'OFF'`).

Como o estado anterior precisa ser explicitamente `'OFF'` (não `undefined`), houve **necessariamente** uma transição prévia do `STATUS_GERADOR4` para `'OFF'` antes de cada uma das 3 emissões. Ou seja, o flow recebeu pelo menos:

- **5 msgs com transição relevante de canal 0** entre 07:00:19 (queda da rede) e 07:52:31 (retorno):
  - canal 0 = ON (gerador ligou pela 1ª vez) → emite às 07:00:33
  - canal 0 = OFF (gerador desligou — alguma causa)
  - canal 0 = ON (gerador ligou pela 2ª vez) → emite às 07:15:02
  - canal 0 = OFF (gerador desligou de novo)
  - canal 0 = ON (gerador ligou pela 3ª vez) → emite às 07:37:51

A pergunta passa a ser: **por que o canal 0 (gerador) leu OFF→ON três vezes durante uma única queda de rede?**

### 5.3 Hipóteses operacionais

> Atualizado em 2026-05-04 com a descoberta de que o canal 0 é um **`presence_sensor`** (sensor de presença de tensão) ligado à saída do Gerador 4. Ver §6.5–§6.6 para o detalhamento da topologia. Isso muda significativamente as probabilidades a priori.

| #   | Hipótese                                            | Como validar                                                     | Probabilidade a priori |
| --- | --------------------------------------------------- | ---------------------------------------------------------------- | ---------------------- |
| H1  | **Gerador realmente oscilou** (ligou-desligou-ligou) por falha do automatismo, problema mecânico, intervenção manual. | Histórico de manutenção do dia. Logs do QTA físico. Histórico cru do canal 0 no TB. | Plausível, mas 22 min entre re-partidas é estranho para uma falha real. |
| H2  | **Pisca do `presence_sensor` durante transitórios de partida do gerador** — picos de tensão, falha de excitação, oscilação de frequência fazem o sensor digital alternar ON/OFF/ON enquanto o gerador estabiliza. Sem debouncing no driver Modbus nem no flow. | Histórico cru do canal 0 (`Gerador 4 → status`) no TB. Procurar transições muito rápidas (< 5 s) próximas a 07:15:02 e 07:37:51. | **Forte.** Comportamento clássico de sensor de presença em ambiente elétrico ruidoso (vide §6.6). |
| H3  | **ATS (chave de transferência automática) re-comuta carga** durante a queda longa — ao perceber que o gerador estabilizou, transfere a carga; depois detecta sub-tensão / sobrecarga e devolve. O presence_sensor da saída do gerador vê o pisca. | Logs do ATS / QTA físico. Padrão de oscilação coincidente em outros sensores (corrente, tensão de saída). | **Plausível.** Conhecido em QTAs com ATS imperfeito. |
| H4  | **Falha de comunicação Modbus intermitente** entre slave 6 e Orange Pi — driver retorna stale value ou default que o flow interpreta como OFF. | Logs do `myio.service`/`myio-api.service` do dia 15/04. Procurar timeouts no slave 6. | Possível mas menos provável que H2 — nesse caso esperaríamos glitches em **ambos** os canais (rede e gerador), não só no canal 0. |
| H5  | **Reset do flow.context** zerando `STATUS_GERADOR4`. | `journalctl -u nodered` por reinícios do serviço. | **Descartada.** Se fosse, `REDE_OFF_TIME4` também sumiria → `timeDelta = NaN`. Os 3 valores são números válidos consistentes com a queda às 07:00:19,18. |
| H6  | **Teste programado do automatismo** — gerador liga, faz auto-teste e desliga em ciclos enquanto a rede está fora. | Documentação do automatismo / QTA. | Improvável durante uma queda real de rede de 52 min. |

**Avaliação atual:** H2 + H3 são as candidatas mais prováveis dada a natureza do device (`presence_sensor` em ambiente de transitório de gerador). H1 não está descartada — só vai ser separada de H2/H3 olhando o histórico cru do canal 0 e ver se as transições intermediárias são instantâneas (=glitch) ou tem duração mínima realista pro gerador parar e re-partir (=oscilação real, mínimos de minutos).

### 5.4 Dados que precisamos coletar pra responder

1. **Histórico cru do canal 0 (Status Gerador)** entre 07:00 e 07:55 do dia 2026-04-15. O Widget "Status Gerador" do TB (alimentado por `Gerador 4 → status`, função `QTA4/status_gerador.js`) deveria ter esse histórico — ele emite a cada msg recebido. Cruzar:
   - quantas transições ON→OFF e OFF→ON ocorreram?
   - os instantes batem com 07:00:33 / 07:15:02 / 07:37:51 e os ON→OFF entre eles?
2. **Histórico cru do canal 1 (Status Rede)** no mesmo período — verificar se houve algum "blip" ON→OFF→ON da rede que tenha passado despercebido (improvável dado o flow, mas vale conferir).
3. **Logs do Node-RED** do dia 2026-04-15 (`journalctl -u nodered --since "2026-04-15 06:55:00" --until "2026-04-15 07:55:00"`) — procurar erros de leitura Modbus do slave 6.
4. **Confirmar slave 6 = QTA Gerador 4** via Postgres (§7.4 abaixo).
5. **Comparar com outros geradores no mesmo dia** — `Gerador 1/2/3/sem-sufixo` tiveram emissões espúrias no mesmo evento? Se sim, sugere problema sistêmico (rede Modbus, central) e não problema do gerador 4 em particular. Se não, sugere problema localizado no QTA do gerador 4.
6. **Falar com o cliente / time de campo** sobre o que aconteceu naquele dia — houve manutenção? alguém estava no QTA?

### 5.5 Se H1 for verdade (gerador oscilou de fato)

Aí o cálculo do flow não é "extra emissão errada" — é literal: o gerador transitou OFF→ON 3 vezes durante a queda da rede, e o flow registrou isso. O que é discutível é só a **semântica do label** "Tempo de Partida":

- Se a leitura esperada é "tempo do evento atual desde a queda da rede" → flow está correto, label confunde, basta renomear.
- Se a leitura esperada é "tempo que o gerador levou nesta partida" → flow está errado para re-partidas; precisa de Opção A ou B do §8.

### 5.6 Se H2 ou H3 for verdade (sensor pisca, gerador estável)

Cenário: o gerador efetivamente partiu às 07:00:33 e ficou ON até a rede voltar. As 2 emissões extras são artefatos do `presence_sensor` (canal 0) flutuando durante transitórios elétricos do gerador ou re-comutações do ATS.

Nesse cenário, a correção certa é **debouncing** do estado do canal 0 — descartar transições muito curtas que não correspondem a um evento físico real (gerador realmente desliga e religa em segundos não acontece no mundo real). Pseudocódigo:

```js
// em detect_gerador_ON.js, antes da lógica atual
const DEBOUNCE_MS = 10000;                                  // 10 s — calibrar com operação
const lastTransitionTs = flow.get('GERADOR4_LAST_TS') || 0;
const now = Date.now();
if (now - lastTransitionTs < DEBOUNCE_MS) return null;      // ignora glitch
flow.set('GERADOR4_LAST_TS', now);
// segue lógica original do detect_gerador_ON.js
```

`DEBOUNCE_MS` precisa vir do time de operação. Geradores diesel típicos não conseguem desligar e religar em menos de 30–60 s (purga, ciclo de partida), então 10 s já é seguramente "glitch". Se o time confirmar 30 s como mínimo realista, o valor pode subir.

Vide também §8.3 (Opção C) que descreve essa correção como uma das alternativas formais.

---

## 6. Detalhes técnicos adicionais

### 6.1 Dead code no group QTA4

| Node ID            | Nome              | Estado               |
| ------------------ | ----------------- | -------------------- |
| `cdfb0afe.c4e898`  | Store Status Rede | **Órfão** — listado no group, sem wires de entrada, `outputs: 0`. Nunca executa. Provavelmente versão antiga não removida quando `25facd11.288612` foi adicionado. |

Recomenda-se **remover** este node para evitar confusão (há duas funções com o mesmo nome no JSON).

### 6.2 Outros geradores (1, 2, 3) e o `Gerador` (sem número)

O `bkp_all_flows` mostra **5 grupos análogos** (`Gerador`, `Gerador 1`, `Gerador 2`, `Gerador 3`, `Gerador 4`), todos com a mesma estrutura. **A mesma análise e os mesmos questionamentos provavelmente se aplicam a todos.** Auditar os 5 grupos antes de propor correção.

### 6.3 Nó inject de teste

Na linha 3033 do all-flows há um node inject com payload hardcoded:
```json
{"Gerador 4 (Souza Aguiar Gerador)":[{"ts":1768239265000,"values":{"startupTime":17430}}]}
```
Confirma que `startupTime: 17430 ms` (17,4 s) era o valor esperado/normal de partida do gerador.

### 6.4 Origem do msg (filter-slave 6)

A entrada do QTA4 vem de:
```
link in 7642a0c1.062af "QTA4"
  ← link out 88096cc8.87dbf
filter-slave 3bcf8435.f3accc  slaves: ["6"]
  → link out db04bf61.96f04
    → link in 1dd55047.29013 (entrada do group QTA4)
```

Ou seja, o canal de origem é o **slave Modbus ID 6**, lendo dois canais digitais:
- `channels[0].input` → estado do gerador (0 = ON, >0 = OFF)
- `channels[1].input` → estado da rede (0 = ON, qualquer outro = OFF)

### 6.5 Natureza do slave 6 — QTA 4 com 2 sensores de presença

Inspeção em runtime (Node-RED → Context Data → Flow → `slave_data[2]` e `devices`):

**Slave 6 (`type: "outlet"` — entendido como módulo de I/O do QTA físico):**

| Campo                   | Valor             |
| ----------------------- | ----------------- |
| `id`                    | 6                 |
| `type`                  | `"outlet"`        |
| `name`                  | `"QTA 4"`         |
| `code`                  | `"002-002-002-012"` |
| `addr_low` / `addr_high`| 129 / 248         |
| `channels`              | 2                 |
| `aggregate`             | true              |
| `version`               | `"6.0.0"`         |

**channelConfig** (config Modbus por canal):

| Canal     | `slaveId` | `channel` | `channel_type` | `output`   | `pulses` |
| --------- | --------- | --------- | -------------- | ---------- | -------- |
| channel 0 | 6         | 0         | `REPLICATED`   | `HOLDING`  | 1        |
| channel 1 | 6         | 1         | `REPLICATED`   | `HOLDING`  | 1        |

**channels_list** (devices lógicos mapeados sobre os canais físicos):

| `id` (DB) | `channel` | `type`             | `name`     |
| --------- | --------- | ------------------ | ---------- |
| 10        | 1         | `presence_sensor`  | Rede 4     |
| 11        | 0         | `presence_sensor`  | Gerador 4  |

**Device "Gerador 4" (objeto entregue ao flow):**

| Campo          | Valor                                             |
| -------------- | ------------------------------------------------- |
| `type`         | `presence_sensor`                                 |
| `name`         | `Gerador 4`                                       |
| `slaveId`      | 6                                                 |
| `channelId`    | 0                                                 |
| `channelType`  | `REPLICATED`                                      |
| `outputType`   | `HOLDING`                                         |
| `deviceKind`   | `presence_sensor`                                 |
| `uniqueId`     | `bb8193d9-a132-44b5-8605-e50c0521ceb9_6_11`       |

O `uniqueId` decompõe em `<gatewayId>_<slaveId>_<channelDbId>` — `bb8193d9-...` é o Gateway ID da central Souza Aguiar Gerador (manual §2.2), `6` é o slaveId Modbus, `11` é o `id` do channel no Postgres (não o channel number — note que channelId=0 mas channelDbId=11).

### 6.6 Implicações de "presence_sensor" pra investigação

Em automação predial, `presence_sensor` ligado a um QTA com nome "Rede"/"Gerador" tipicamente significa **sensor de presença de tensão** (ou _voltage detection relay_): um optoacoplador/transdutor que vê se há tensão (24V/220V) no barramento monitorado e devolve um bit digital. Não é um "sensor de movimento" no sentido coloquial.

Aplicado ao QTA 4:
- canal 0 (Gerador 4) → presença de tensão na **saída do gerador** (gerador energizado = ON);
- canal 1 (Rede 4) → presença de tensão no **barramento da concessionária** (rede ativa = ON).

Por que isso reforça as hipóteses **H2 (glitch Modbus)** e **H3 (ATS pisca durante transferência)** da §5.3:

1. **Transitório elétrico de partida do gerador é severo.** Quando o gerador entra (alguns segundos após a queda), há rampas de tensão, picos, falhas de excitação, oscilação de frequência até o regulador estabilizar. Sensores de presença de tensão em ambientes com transitório alto **costumam disparar leituras intermitentes** durante o evento.
2. **Sem debouncing por design.** O `output: "HOLDING"` significa que o serviço de leitura grava o valor no holding register sem filtro. Qualquer "blink" do sinal vira um msg pro Node-RED.
3. **`pulses: 1`** — sugere que o canal não está em modo de contagem de pulsos (estaria > 1 se fosse contador), confirmando que é leitura direta de estado.
4. **Queda de carga ou re-aquisição de carga pelo ATS** pode fazer a saída do gerador piscar enquanto o automatismo do QTA decide quando comutar a carga. O `presence_sensor` da saída do gerador veria isso como ON→OFF→ON.

Conclusão: H2 e H3 deixam de ser hipóteses especulativas e passam a ser **as candidatas mais prováveis** para os 2 eventos extras de 07:15:02 e 07:37:51, sem precisar inventar uma falha do gerador físico em si. Ainda precisam ser confirmadas pelos dados crus de §7.7, mas agora têm explicação física plausível.

---

## 7. Roteiro de validação na central

### 7.1 Conectar
```bash
ssh -i id_rsa root@200:dd4c:53b0:28d5:33dc:fbef:2c98:b23
```

### 7.2 Confirmar que o flow ativo é o do backup
```bash
diff <(jq -S . /root/.node-red/flows.json) <(jq -S . /tmp/bkp_all_flows.json)
# (subir o backup pra /tmp antes via scp)
```

### 7.3 Logs do Node-RED ao redor de 2026-04-15 07:00–07:55

> Útil para responder à §5: capturar os instantes exatos das transições do canal 0 (gerador) e procurar erros de leitura Modbus.

```bash
journalctl -u nodered --since "2026-04-15 06:55:00" --until "2026-04-15 07:55:00"
journalctl -u nodered --since "2026-04-15 06:55:00" --until "2026-04-15 07:55:00" | grep -iE "gerador 4|rede 4|startupTime|REDE_OFF_TIME4|STATUS_GERADOR4|modbus|slave"
```

Procurar:
- transição rede ON→OFF (espera-se um set de `REDE_OFF_TIME4` em ~07:00:19);
- as 3 transições gerador OFF→ON em 07:00:33, 07:15:02 e 07:37:51 (e os ON→OFF entre elas);
- transição rede OFF→ON em 07:52:31 (espera-se a emissão de `Rede 4 time`);
- erros/timeouts de leitura Modbus do slave 6 (avalia hipóteses H2/H4 da §5.3).

### 7.4 Confirmar slave 6 = QTA do Gerador 4
```bash
psql -U hubot -h /var/run/postgresql
```
```sql
SELECT id, name, type, addr_low, addr_high, channels, config
FROM slaves
WHERE id = 6;

-- Listar todos os slaves (panorama) — esperado ver 5 QTAs
SELECT id, name, type FROM slaves ORDER BY id;
```

### 7.5 Estado atual do flow.context
No editor Node-RED `http://[200:dd4c:53b0:28d5:33dc:fbef:2c98:b23]:1880` aba **Context Data → Flow**, conferir as variáveis:
- `STATUS_REDE4`, `REDE_OFF_TIME4`, `STATUS_GERADOR4`
- (e análogos para `_1`, `_2`, `_3`, sem sufixo)

### 7.6 Auditar mesma lógica em Gerador 1/2/3/sem-sufixo
```bash
grep -nE "REDE_OFF_TIME[0-9]?|STATUS_GERADOR[0-9]?" /root/.node-red/flows.json
```
Esperado encontrar 5 conjuntos espelhados.

### 7.7 Histórico cru do canal 0 (Status Gerador) e canal 1 (Status Rede) no TB

No ThingsBoard, pra alimentar a §5.4:
- Abrir o histórico do device `Gerador 4 (Souza Aguiar Gerador)`, dataKey `status` (não `startupTime`), entre 06:55 e 07:55 do dia 2026-04-15.
- Mesmo histórico para o device `Rede 4 (Souza Aguiar Gerador)`, dataKey `status`.
- Contar as transições e cruzar com os 3 instantes do Widget 1.

---

## 8. Possíveis correções (a discutir após responder §5)

> ⚠️ **Não aplicar antes de §5 ser respondida.** Se o gerador realmente oscilou (H1), o tipo de correção é diferente do caso em que a leitura do canal está com glitch (H2/H4).

A lógica atual emite `startupTime` em toda transição gerador OFF→ON com rede em OFF. As opções abaixo cobrem cenários distintos.

### 8.1 Opção A — emitir `startupTime` apenas na 1ª partida pós-queda

Mexe só em `QTA4/detect_gerador_ON.js` + um setter em `QTA4/store_status_rede.js`. Não muda contrato com o TB.

`detect_gerador_ON.js`:
```js
const lastStatusGerador  = flow.get('STATUS_GERADOR4');
const statusRede         = flow.get('STATUS_REDE4');
const alreadyReported    = flow.get('GERADOR4_REPORTED') || false;
const input              = msg.payload.channels[0].input;
const statusGerador      = input > 0 ? 'OFF' : 'ON';
flow.set('STATUS_GERADOR4', statusGerador);

if (statusRede === 'OFF'
 && statusGerador === 'ON'
 && lastStatusGerador === 'OFF'
 && !alreadyReported) {
  const timeDelta = Date.now() - flow.get('REDE_OFF_TIME4');
  flow.set('GERADOR4_REPORTED', true);            // só reporta 1x por queda
  msg.payload = timeDelta;
  return msg;
}
```

`store_status_rede.js`, no branch ON→OFF, acrescentar:
```js
flow.set('GERADOR4_REPORTED', false);             // libera próxima janela
```

**Resultado esperado para o evento de 2026-04-15:** Widget 1 receberia apenas o ponto de 07:00:33 com `startupTime ≈ 14 s`. Os pontos espúrios de 07:15:02 e 07:37:51 não seriam emitidos.

**Trade-off:** perde visibilidade sobre instabilidade do gerador (re-partidas durante uma mesma queda). Para recuperar isso, ver Opção B.

### 8.2 Opção B — separar "tempo de partida" de "instabilidade pós-partida"

- `startupTime` (no `Gerador 4`) → continua emitido só na 1ª partida pós-queda (igual à Opção A). Reflete o que o widget "Tempo de Partida" promete.
- Novo campo `restartCount` ou `restartEventMs` → emitido nas re-partidas subsequentes (gerador OFF→ON com rede ainda OFF e `GERADOR4_REPORTED === true`). Pode alimentar um terceiro widget "Histórico de Instabilidade do Gerador".

**Trade-off:** muda contrato com o TB. Requer ajuste do dashboard (datakeys) e possivelmente nova rule chain. Só faz sentido se §5 confirmar que o gerador realmente oscilou (H1).

### 8.3 Opção C — debounce do canal 0 (gerador) antes de processar transição

Aplicável se §5 concluir que as 2 emissões extras vieram de glitches de leitura Modbus (H2/H4), e não de oscilação real do gerador. Ignora transições muito curtas:

```js
const DEBOUNCE_MS = 5000;                                    // valor a definir
const last = flow.get('GERADOR4_LAST_TRANSITION_TS') || 0;
if (Date.now() - last < DEBOUNCE_MS) return null;            // ignora glitch
flow.set('GERADOR4_LAST_TRANSITION_TS', Date.now());
// segue lógica original
```

**Trade-off:** mascara oscilações reais que sejam mais rápidas que o debounce. Valor de `DEBOUNCE_MS` precisa vir de quanto tempo o gerador legitimamente leva entre transições.

### 8.4 Opção D — apenas renomear o label do widget no TB

Aplicável se §5 confirmar que o gerador realmente oscilou (H1) **e** o time de operação considerar o cálculo atual ("tempo desde queda da rede até esta partida do gerador") uma métrica útil. Não mexe no flow Node-RED. Renomear o label do Widget 1 de "Tempo de Partida" para algo como "Tempo desde Queda da Rede até Partida do Gerador" remove a ambiguidade.

**Trade-off:** zero código, mas o nome longo polui o widget.

### 8.5 Limpezas que podem ir junto (independentes da escolha A/B/C/D)

- Remover dead code `cdfb0afe.c4e898` (Store Status Rede v1) do group QTA4. Documentado no header de `QTA4/store_status_rede.js`.
- Replicar a decisão escolhida nos 4 outros groups análogos (`Gerador`, `Gerador 1`, `Gerador 2`, `Gerador 3`).

---

## 9. Próximos passos

### Concluídos
- [x] Identificar onde o `startupTime` é calculado (§3).
- [x] Validar aritmeticamente os 4 pontos (3 do Widget 1 + 1 do Widget 2) — todos consistentes com queda da rede em 07:00:19,18 (§4.2).
- [x] Extrair as 5 functions do group QTA4 para `QTA4/*.js`.
- [x] Levantar hipóteses para as 2 emissões extras (§5.3).

### Pendentes — investigação operacional (§5)
1. [ ] Coletar histórico cru do canal 0 (`Gerador 4 → status`) e canal 1 (`Rede 4 → status`) no TB para 2026-04-15 06:55–07:55 (§7.7).
2. [ ] Coletar logs do Node-RED do mesmo período (§7.3).
3. [ ] Avaliar hipóteses H1–H4 da §5.3 com os dados acima.
4. [ ] Conferir se `Gerador 1/2/3/sem-sufixo` emitiram pontos espúrios no mesmo dia. Se sim → problema sistêmico (rede Modbus / central). Se não → problema localizado no QTA do gerador 4.
5. [ ] Falar com o cliente / time de campo: houve manutenção, intervenção ou alguma anomalia conhecida no QTA4 em 2026-04-15?

### Pendentes — pré-correção
6. [x] Confirmado: `slave 6` é **QTA 4** (`type: outlet`, 2 canais), com `presence_sensor` no canal 0 (Gerador 4) e canal 1 (Rede 4). Inspecionado via Node-RED Context Data → Flow → `slave_data[2]` e `devices` (§6.5).
7. [ ] Mapear o slaveId equivalente de `Gerador 1/2/3/sem-sufixo` (mesma fonte: `slave_data` + `filter-slave` config dos respectivos groups).
8. [ ] Validar com o time de operação a **intenção** do campo `startupTime` (medir tempo de partida do gerador? tempo desde queda da rede? ambos?). Decide entre Opção A/B/C/D do §8.

### Pendentes — correção
8. [ ] Aplicar a opção escolhida e replicar nos 4 outros groups.
9. [ ] Remover dead code `cdfb0afe.c4e898` do group QTA4 (e análogos).
10. [ ] Criar `slaves-map.md` para a CENTRAL-GERADOR seguindo o padrão das outras centrais (CENTRAL-T&D, CENTRAL-CO2 etc).

---

_Última atualização: 2026-05-04_
