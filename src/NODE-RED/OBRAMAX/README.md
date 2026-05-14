# Obramax — Node-RED das Centrais Linix / Orange Pi

> Documento vivo com inventário e conhecimento operacional das centrais Node-RED
> da holding **Obramax** (rede brasileira de varejo de materiais de construção).
>
> Referência operacional comum a todas as holdings:
> [`../GLOBAL_INFO/manual-centrais-linix-orangepi.md`](../GLOBAL_INFO/manual-centrais-linix-orangepi.md).
>
> Padrões de documentação por central seguem os modelos usados em:
> - [`../SOUL-MALLS/MACAE/CENTRAL-MACAE.md`](../SOUL-MALLS/MACAE/CENTRAL-MACAE.md)
> - [`../RAIZ-EDUCACAO/CENTRAL-RAIZ-EDUCACAO.md`](../RAIZ-EDUCACAO/CENTRAL-RAIZ-EDUCACAO.md)

---

## 1. Identificação da Holding

| Campo                 | Valor                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| Holding               | Obramax                                                               |
| Segmento              | Varejo de materiais de construção                                     |
| Stack das centrais    | Orange Pi + Armbian/Ubuntu + Node-RED + PostgreSQL (`hubot`) + Modbus |
| Integrações de saída  | ThingsBoard PE (MQTT) + Helexia (Azure IoT Hub MQTT)                  |
| Porta Node-RED        | `1880`                                                                |
| Usuário PostgreSQL    | `hubot` (socket `/var/run/postgresql`, DB `hubot`)                    |

Conexão SSH (padrão das centrais Linix):

```bash
ssh -i id_rsa root@<IPv6_da_mesh>
```

Acesso PostgreSQL na central:

```bash
psql -U hubot -h /var/run/postgresql
```

---

## 2. Inventário de Centrais

Cada subpasta corresponde a uma loja Obramax. **9 sites mapeados** — 5 no RJ e 4
em SP.

| Subpasta       | Estado | Backup capturado | Doc dedicada |
| -------------- | ------ | ---------------- | ------------ |
| `BENFICA/`     | RJ     | —                | —            |
| `CAXIAS/`      | RJ     | —                | —            |
| `GUADALUPE/`   | RJ     | ✅ `2026-05-12`  | —            |
| `JACAREPAGUA/` | RJ     | —                | —            |
| `MESQUITA/`    | RJ     | —                | —            |
| `MOOCA/`       | SP     | —                | —            |
| `PIRACICABA/`  | SP     | —                | —            |
| `PRAIA-GRANDE/`| SP     | —                | —            |
| `SUZANO/`      | SP     | —                | —            |

> **Status (2026-05-12)**: apenas a central de **Guadalupe** tem backup de flow
> commitado. As demais pastas existem como placeholders e precisam de:
> 1. backup `bkp-all-flows-obramax-<site>-YYYY-MM-DD-HH-MM.json` exportado do Node-RED
> 2. doc por central (`CENTRAL-OBRAMAX-<site>.md`) seguindo o modelo do CENTRAL-MACAE
>    (identificação IPv6/Gateway ID, `\dt`, `SELECT * FROM slaves`, runbook).

### 2.1 Convenção de nomes de backup

```
bkp-all-flows-obramax-<site>-YYYY-MM-DD-HH-MM.json
```

Exemplo presente no repo:
`GUADALUPE/bkp-all-flows-obramax-guadalupe-2026-05-12-11-39.json`.

Para exportar todos os flows de uma central:

```
Editor Node-RED → menu (≡) → Export → All flows → Download → renomear com a convenção acima
```

---

## 3. Arquitetura padrão de fluxo (capturada em Guadalupe)

A inspeção do backup de Guadalupe revela o padrão que deve se repetir nas demais
lojas Obramax — vale como **template mental** ao abrir uma central nova.

### 3.1 Tabs (3)

| Tab id              | Label           | Função                                                                                  |
| ------------------- | --------------- | --------------------------------------------------------------------------------------- |
| `268efb5c.1d7a54`   | `MQTT`          | Ingestão dos slaves → transformação → publicação no ThingsBoard PE e Helexia            |
| `d415fa7.58cd708`   | `Monitoramento` | Schedules, automações on/off, controle por demanda/temperatura, persistência            |
| `16861db4.8d4a42`   | `Flow 1`        | Aux / debug / desenvolvimento                                                           |

### 3.2 Brokers MQTT (2 saídas)

| Broker config        | Host                                                                          | Porta  | Client ID                              |
| -------------------- | ----------------------------------------------------------------------------- | ------ | -------------------------------------- |
| **Thingsboard PE**   | `mqtt.myio-bas.com`                                                           | `1883` | `1607utmj4wqq3m31pmsh` (Guadalupe)     |
| **Helexia (Azure)**  | `HLXIotHub.azure-devices.net/devices/HLXBR_OMGU_MYIO_UTCM3`                   | `8883` | `HLXBR_OMGU_MYIO_UTCM3`                |

Tópicos publicados:

| Broker         | Tópico                                                                                       | Conteúdo                          |
| -------------- | -------------------------------------------------------------------------------------------- | --------------------------------- |
| Thingsboard PE | `v1/gateway/telemetry`                                                                       | Leituras consolidadas             |
| Thingsboard PE | `v1/gateway/attributes`                                                                      | Atributos / metadados             |
| Helexia        | `devices/HLXBR_OMGU_MYIO_UTCM3/messages/events/$.ct=application%2Fjson&$.ce=utf-8`           | Telemetria espelhada Azure IoT    |

> **Convenção esperada por site**: o sufixo `OMGU` em `HLXBR_OMGU_MYIO_UTCM3`
> identifica Obramax-Guadalupe. Demais lojas devem seguir `HLXBR_<sigla>_MYIO_<id>`.
> Levantar a sigla correta de cada site ao documentar (provavelmente `OMBE`,
> `OMCA`, `OMJA`, `OMME`, `OMMO`, `OMPI`, `OMPG`, `OMSU` — confirmar com a Helexia).

### 3.3 Endpoints HTTP expostos pelo Node-RED

8 rotas, mistas de RPC/automação e API de dashboards:

| Método | URL                                                                  | Nome                          | Função                                        |
| ------ | -------------------------------------------------------------------- | ----------------------------- | --------------------------------------------- |
| POST   | `/rpc`                                                               | —                             | RPC genérico ThingsBoard → central            |
| POST   | `/OnOff`                                                             | —                             | Liga/desliga dispositivos                     |
| POST   | `/rpc/update_automation_status`                                      | —                             | Habilita/desabilita automação                 |
| GET    | `/export`                                                            | —                             | Export de dados                               |
| GET    | `/dash_api/v2/devices_pulses/:slaveIds/:start_ts/:end_ts`            | Average Consumption pulses V2 | Consumo médio por slaves (v2, lista de IDs)   |
| GET    | `/dash_api/devices_pulses/:name/:start_ts/:end_ts`                   | Average Consumption pulses V2 | Consumo médio por nome de device              |
| GET    | `/dash_api/demand_pulses/:name/:start_ts/:end_ts`                    | Daily Devices Pulses V2       | Demanda diária por device                     |
| GET    | `/dash_api/lojas_consumption_pulses/:start_ts/:end_ts`               | Average Consumption lojas Agua| Consumo agregado de hidrômetros das lojas     |

### 3.4 PostgreSQL — config

Todos os 6 nós `postgreSQLConfig` apontam para o mesmo banco local, lendo
variáveis de ambiente (não há credenciais hardcoded):

```
host:     $DB_HOST
port:     $DB_PORT
database: $DB_DATABASE
user:     $DB_USERNAME
```

A base local é a `hubot` (mesmo schema documentado em Raiz Educação / Macaé —
ver §2 dos READMEs daquelas centrais).

### 3.5 Schedules e timers (inject)

Intervalos relevantes observados no flow:

| Repetição | Propósito provável                                            |
| --------- | ------------------------------------------------------------- |
| `1 s`     | Tick rápido (status / heartbeat)                              |
| `5 s`     | Polling curto                                                 |
| `60 s`    | Logs / send-check minuto a minuto                             |
| `600 s`   | Loop de 10 min (pulses) — grupo "Get pulses every 10 min"     |
| `1800 s`  | Loop de 30 min — médias horárias e auxiliares                 |

Cargas `inject` com chaves nomeadas: `stored_schedules`, `stored_holidays`,
`stored_excludedDays`, `CENTRAL_UUID`, `deviceatual` — usadas para hidratar o
`flow.context` no boot.

### 3.6 Custom nodes MyIO em uso

Identificados pelos `type` no JSON (definidos no pacote interno do Node-RED da MyIO):

| Custom node           | Uso                                                                    |
| --------------------- | ---------------------------------------------------------------------- |
| `myio-emitter`        | Roteador multi-saída para classificar dispositivos por tipo            |
| `activate-channel`    | Aciona canal de um slave Modbus (15 nós no flow de Guadalupe)          |
| `filter-slave`        | Filtra mensagens por slave                                             |
| `filter-consumption`  | Filtra leituras de consumo                                             |
| `get-data`            | Lê dado consolidado do contexto/BD                                     |
| `persist-in`/`persist-out` | Persistência em arquivo/contexto                                  |
| `send-check`          | Validação de envio (idempotência / retry guard)                        |

### 3.7 Grupos lógicos relevantes do flow

Os 20 grupos do flow Guadalupe — bom roteiro para entender as responsabilidades:

| Grupo                                          | Função                                                      |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `Store devices to flow.devices`                | Carrega devices da base para `flow.devices`                 |
| `MQTT`                                         | Pipeline principal de saída ThingsBoard                     |
| `Thingsboard`                                  | Transformações específicas para o tópico TB                 |
| `Get pulses every 10 min`                      | Coleta de pulses periódica                                  |
| `Get 30 days average every hour`               | Médias móveis horárias                                      |
| `Send logs every 1 minute`                     | Log telemetry para `logs`/`alarms`                          |
| `Save Schedule from Thingsboard`               | Persiste agendamentos recebidos do dashboard                |
| `Status da Automação`                          | Liga/desliga automação                                      |
| `Demand -> Control device`                     | Controle reativo por demanda (estouro)                      |
| `Min temperature -> Control device V0`         | Controle reativo por temperatura mínima                     |
| `Estouro Demanda`                              | Detecção de estouro                                         |
| `Central Monitor`                              | Monitor da própria central                                  |
| `API Export Water`                             | Endpoint /export para hidrômetros                           |
| `Modbus`                                       | Bridge Modbus → slaves                                      |
| `Compressor to flow`                           | Mantém status do compressor no contexto                     |

### 3.8 Topologia do pipeline `Save Schedule from Thingsboard` (Guadalupe)

Mapeado em 2026-05-12 a partir do flow ativo. A decisão de liga/desliga por
schedule percorre uma árvore de roteamento que separa **devices regulares**
(lâmpadas, plugs, sensores, atuadores invertidos) de **devices de status com
acionamento por pulso** (laje técnica, exaustor cozinha, ADM armários):

```
automacao-on-off PROD  (node 8ed1be0.eb6714, conteúdo ≡ automacao-on-off-PROD.js)
  │
  └─► switch by device.type  (5 saídas)
        ├─ lamp                 ─┐
        ├─ plug                  │
        ├─ presence_sensor       ├─► activate/deactivate (45eaa8)
        ├─ inverted_actionable  ─┘       (devolve { generic, id, channel, value } ou null)
        └─ otherwise            ─►  ✗   (descartado — tipo não suportado)
                                  │
                                  ▼
                          switch ("is true" / otherwise)
                                  │
                  ┌───────────────┴──────────────┐
                  ▼                              ▼
              "is true"                      otherwise
                  │                       (payload sem ação — descartado)
                  ▼
        switch by device.deviceName  (4 saídas)
                  │
   ┌──────────────┼──────────────┬─────────────────────────┐
   ▼              ▼              ▼                         ▼
Status Laje  Status Exaust.  Status ADM            otherwise
Técnica      Cozinha         ARMÁRIOS                  │
   │              │              │                     ▼
   ▼              ▼              ▼              Should ignore?  (e66f95)
activate    activate     activate                    │
channel     channel      channel                     ▼
(pulse_up)  (pulse_up)   (pulse_up)         idempotency guard
                                            (unnamed--f64ab8.js)
                                                     │
                                                     ▼
                                            MQTT → slave Modbus
```

**Notas operacionais**:

1. **Branch principal vs. status devices**: `Status Laje Técnica`,
   `Status Exaust. Cozinha` e `Status ADM ARMÁRIOS` têm `type: pulse_up` no
   `flow.devices`. Eles **não passam** por `Should ignore?` nem pelo idempotency
   guard `unnamed--f64ab8.js` — usam flows dedicados de "activate channel" que
   disparam pulsos via pares de devices `Ligar Exaust. LT` / `Desligar Exaust. LT`
   (slaveId+channel específicos, ver
   [`GUADALUPE/devices_node_red.log`](./GUADALUPE/devices_node_red.log)).
2. **Filtro "is true"**: o switch `activate/deactivate` (45eaa8) devolve `null`
   quando `shouldActivate=false && shouldShutdown=false` (nada a fazer) e
   devolve um payload Modbus em qualquer outro caso. O switch "is true"
   filtra payloads inválidos antes do roteamento por device.
3. **`Should ignore?`** (`unnamed--e66f95.js`) é o único guard para o branch
   dos devices regulares. Consulta `flow.ignore_schedules_list` +
   `flow.demand_ignore_schedule_list` (alimentados pelos branches de demanda /
   temperatura) e implementa a regra **COMP1 antes de COMP2**.
4. **Idempotency guard final** (`unnamed--f64ab8.js`, node `7acdb880.f64ab8`):
   lê `global.deviceatual` e suprime a mensagem se o canal já está no `value`
   solicitado. Mesma função existe em 3 cópias byte-iguais nos grupos
   `Save Schedule from Thingsboard`, `Demand -> Control device` e
   `Min temperature -> Control device V0` — alterar uma exige alterar as três.
5. **`persister-schedule` está órfão**: o node `d129aa3c.a543` (group
   `Save Schedule from Thingsboard`) **não tem wire de entrada** vindo do
   `automacao-on-off`. Resultado: `flow.automation_logs` permanece vazio em
   runtime — sem rastreamento das decisões de schedule. Para reativar logging,
   plugar `automacao-on-off PROD` → `persister-schedule` (ramo paralelo, sem
   afetar o pipeline de comando).
6. **Variante `5b8a9c` provavelmente órfã**: o segundo `automacao-on-off`
   (`67678315.5b8a9c`, conteúdo ≡ `automacao-on-off-BKP.js`) tem o bug de
   cross-midnight documentado em §4.4 do `_inventory.md`. Como a rota ativa
   confirmada acima passa pelo PROD, o `5b8a9c` é candidato a remoção —
   auditar wires de entrada/saída no backup do flow antes de deletar.

---

---

## 4. Catálogo de Functions Node-RED

> **Premissa que ainda precisa ser comprovada**: as 9 lojas Obramax foram
> provisionadas a partir de um mesmo template de flow, então **em tese** as
> functions deveriam ser idênticas entre sites. **Na prática isso não é
> verdade** — divergências aparecem em quase toda comparação que fizemos com
> outras holdings (lojas que receberam manutenção isolada, fix de bug em uma
> central só, evolução incremental sem rebase, etc.). Esta seção existe para
> dar visibilidade a essas divergências e crescer à medida que importarmos os
> backups das demais lojas.

### 4.1 Como funcionam os backups das functions neste repo

Cada subpasta de loja contém:

- O backup completo (`bkp-all-flows-obramax-<site>-YYYY-MM-DD-HH-MM.json`) —
  fonte da verdade (round-trip Node-RED ↔ disco).
- Opcionalmente, snapshots do **flow.context** capturados via Node-RED debug
  sidebar — nome `context_data_flow_<site>_<YYYY_MM_DD_HH_MM>.json` (ex.:
  [`GUADALUPE/context_data_flow_guadalupe_2026_05_12_11_56.json`](./GUADALUPE/context_data_flow_guadalupe_2026_05_12_11_56.json)).
  Esses arquivos são **snapshots parciais** — valores opacos no inspector
  ('object' / 'array[N]') ficam vazios, e o cabeçalho `_meta.truncated_keys`
  lista chaves cuja preview foi cortada com '…'.
- Uma subpasta `functions/` com:
  - `_extract.js` — script Node.js standalone que lê o backup `.json` mais
    recente da loja e regrava um `.js` por function node.
  - `_inventory.md` — índice gerado por tab → grupo → função, com link para
    cada arquivo `.js`.
  - 1 arquivo `.js` por function node, nomeado `<slug-do-nome>--<id-curto>.js`
    onde `<id-curto>` são os 6 últimos caracteres do node id (desambigua
    homônimos como os 7 `Associate slave to msg` e os 4 `Send on/off history`
    do flow de Guadalupe).

Para regenerar após substituir o `.json` por um backup mais novo:

```bash
cd src/NODE-RED/OBRAMAX/<SITE>/functions
node _extract.js
```

> Os arquivos `.js` são **somente leitura conceitual**: edições devem ser
> feitas no Node-RED real e capturadas via novo export. O cabeçalho gerado
> deixa isso explícito.

### 4.2 Inventário por loja

| Loja        | Functions | Inventário                                                         |
| ----------- | --------- | ------------------------------------------------------------------ |
| GUADALUPE   | **89**    | [`GUADALUPE/functions/_inventory.md`](./GUADALUPE/functions/_inventory.md) |
| BENFICA     | —         | —                                                                  |
| CAXIAS      | —         | —                                                                  |
| JACAREPAGUA | —         | —                                                                  |
| MESQUITA    | —         | —                                                                  |
| MOOCA       | —         | —                                                                  |
| PIRACICABA  | —         | —                                                                  |
| PRAIA-GRANDE| —         | —                                                                  |
| SUZANO      | —         | —                                                                  |

### 4.3 Functions identificadas em Guadalupe (catálogo nominal)

Lista única por nome — número entre parênteses indica quantas instâncias do
mesmo nome existem no flow (duplicatas frequentemente têm **lógica diferente**;
sempre comparar os `.js` antes de assumir equivalência).

| Função                                              | Inst.  | Tab/Grupo principal                              | Responsabilidade                                                                  |
| --------------------------------------------------- | ------ | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `Transform outlet devices`                          | 1      | MQTT / Store devices to flow.devices             | Normaliza slaves do tipo outlet (tomadas) para o shape interno de device          |
| `Transform three_phase_sensor devices`              | 1      | MQTT / Store devices to flow.devices             | Normaliza slaves trifásicos para device                                           |
| `Transform infrared devices`                        | 1      | MQTT / Store devices to flow.devices             | Normaliza slaves IR/RFIR para device                                              |
| `Merge into a single obj`                           | 1      | MQTT / Store devices to flow.devices             | Consolida outlets+3F+IR num único objeto, gravado em `flow.devices`               |
| `Add namespace`                                     | 3      | MQTT (vários grupos)                             | Prefixa keys/topics com namespace do customer                                     |
| `Associate slave to msg`                            | 7      | MQTT (vários)                                    | Anexa metadados do slave (id/name/type) ao `msg`                                  |
| `Transform channel list to device`                  | 1      | MQTT / MQTT                                      | Converte lista de canais em devices lógicos                                       |
| `Transform temperature reading to device update`    | 1      | MQTT / MQTT                                      | Telemetria de temperatura → update do device                                      |
| `Transform consumption reading to device update`    | 1      | MQTT / MQTT                                      | Telemetria de consumo → update do device                                          |
| `Transform current reading to device update`        | 1      | MQTT / MQTT                                      | Leitura de corrente → update                                                      |
| `Transform voltage reading to device update`        | 1      | MQTT / MQTT                                      | Leitura de tensão → update                                                        |
| `Transform consumption reading to nivel de agua`    | 1      | MQTT / MQTT                                      | Pulsos do hidrômetro → nível d'água                                               |
| `Format humidity`                                   | 1      | MQTT / MQTT                                      | Formata leitura de umidade                                                        |
| `Wh`                                                | 2      | MQTT / MQTT                                      | Conversão para Wh (provável agregação por janela)                                 |
| `Format name`                                       | 4      | MQTT (vários)                                    | Normaliza nome do device para chave/topic                                         |
| `Format Device`                                     | 2      | MQTT / Modbus                                    | Empacota device no formato do nó Modbus                                           |
| `Assembly devices`                                  | 3      | MQTT / Get 30 days avg + Get pulses every 10 min | Monta lista de devices para o batch periódico                                     |
| `Map devices`                                       | 2      | MQTT / Get 30 days avg + Get pulses every 10 min | Mapeia devices por id/slug                                                        |
| `Transform for helexia`                             | 1      | MQTT / Get pulses every 10 min                   | Reformata payload para o Azure IoT Hub do Helexia                                 |
| `automacao-on-off`                                  | 2      | MQTT / Save Schedule from Thingsboard            | Decide liga/desliga conforme schedule + estado da automação                       |
| `activate/deactivate`                               | 2      | MQTT (duas variantes — ver §4.4)                 | Converte device + status em payload Modbus (`{generic, id, channel, value}`)      |
| `save schedule` / `save multiple schedule`          | 1 / 1  | MQTT / Save Schedule from Thingsboard            | Persiste agendamentos vindos do dashboard                                         |
| `save holiday` / `save excluded days`               | 1 / 1  | MQTT / Save Schedule from Thingsboard            | Persistência de feriados e dias excluídos                                         |
| `save automations`                                  | 2      | MQTT / Save Schedule from Thingsboard            | Persiste estado de automações                                                     |
| `persister-schedule`                                | 1      | MQTT / Save Schedule from Thingsboard            | Helper genérico de persistência                                                   |
| `Device Status Array`                               | 1      | MQTT / Save Schedule from Thingsboard            | Monta array de status para o dashboard                                            |
| `Should ignore?`                                    | 1      | MQTT / Save Schedule from Thingsboard            | Guarda para evitar acionamento durante janelas excluídas                          |
| `automacao-log-clean-up`                            | 1      | MQTT / Save Schedule from Thingsboard            | Housekeeping da tabela de log de automação                                        |
| `LogTelemetry-Automacao`                            | 1      | MQTT / Save Schedule from Thingsboard            | Telemetria de evento de automação                                                 |
| `Check for max demand`                              | 1      | MQTT / Demand -> Control device                  | Detecta estouro de demanda                                                        |
| `Check for min temperatures`                        | 1      | MQTT / Min temperature -> Control device V0      | Detecta temperatura mínima                                                        |
| `Turn off and ignore.`                              | 2      | MQTT / Min temp + Demand control                 | Desliga device e marca para ignorar até `Stop ignoring.`                          |
| `Stop ignoring.`                                    | 3      | MQTT / Estouro Demanda + Min temp + Demand       | Libera device de volta à automação                                                |
| `Send on/off history`                               | 4      | MQTT / Min temp + Demand control                 | Persiste histórico de on/off                                                      |
| `Store compressor status to flow`                   | 1      | MQTT / Compressor to flow                        | Mantém status do compressor em `flow.context`                                     |
| **(unnamed)**                                       | 27     | Vários                                           | Functions sem nome — quase sempre debug, parsing rápido, ou helpers locais        |

### 4.4 Drift conhecido — `activate/deactivate`

Exemplo concreto do tipo de divergência interna que pode existir entre lojas
(e que **já existe dentro do mesmo flow** em Guadalupe):

| Instância                                                                               | Group                           | Lógica                                                                                                 |
| --------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`activate-deactivate--45eaa8.js`](./GUADALUPE/functions/activate-deactivate--45eaa8.js)| Save Schedule from Thingsboard  | Lê `shouldShutdown`/`shouldActivate`; **suporta `device.type === 'inverted_actionable'`** (inverte 0↔100) |
| [`activate-deactivate--956a9e.js`](./GUADALUPE/functions/activate-deactivate--956a9e.js)| (sem grupo)                     | Lê `status` (`'on'`/`'off'`) e `flow.get('devices')`; **não suporta** `inverted_actionable`            |

> Conclusão prática: ao mexer em uma função `activate/deactivate` em qualquer
> loja, **olhar todas as instâncias daquele nome** antes de assumir que o fix
> está completo. O mesmo cuidado vale para `Format name` (4×), `Send on/off
> history` (4×), `Add namespace` (3×) etc.

### 4.5 Política de atualização do catálogo

À medida que cada novo backup chegar:

1. Salvar o `bkp-all-flows-obramax-<site>-YYYY-MM-DD-HH-MM.json` na pasta da loja.
2. Copiar `GUADALUPE/functions/_extract.js` para `<SITE>/functions/_extract.js`
   (o script já é parametrizado pelo nome do arquivo).
3. Rodar `node _extract.js` dentro de `<SITE>/functions/`.
4. Comparar `_inventory.md` da loja nova com Guadalupe — flagrar functions
   ausentes, extras, ou com mesmo nome mas código divergente.
5. Atualizar a tabela em §4.2 com a contagem.
6. Quando encontrar um drift relevante (não-cosmético), documentar em §4.4 com
   link para os arquivos comparados.

---

## 5. Conhecimento operacional consolidado

### 4.1 Gateway ThingsBoard único por loja

Cada loja tem **1 gateway** no ThingsBoard PE (cliente `mqtt.myio-bas.com`). O
`clientid` MQTT é o token do gateway — é a chave para autenticar a central
contra o tenant Obramax. Trocar a central implica trocar/regenerar esse token.

### 4.2 Espelhamento para Helexia (Azure IoT Hub)

O cliente Obramax exige duplicação da telemetria no Helexia para fins
contratuais/energia. O fluxo de transformação `Transform for helexia` molda o
payload no formato esperado pelo Azure IoT Hub (CT=`application/json`,
CE=`utf-8` no tópico).

> Ao subir uma loja nova, garantir que **ambas** as credenciais MQTT
> (ThingsBoard PE + Helexia) estejam provisionadas — senão a telemetria sai
> para um lado só e ninguém percebe até a auditoria mensal.

### 4.3 Variáveis de ambiente esperadas

A central precisa expor (via `~/.node-red/settings.js` ou systemd unit):

```
DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD
CENTRAL_UUID         # identificador da central no contexto do flow
```

### 4.4 Diferenças vs. demais holdings

- **Helexia** (Azure IoT Hub) — exclusivo da Obramax dentro do que está
  catalogado no repo. Soul Malls / Raiz Educação / Sá Cavalcante só publicam
  no ThingsBoard PE.
- **`/dash_api/lojas_consumption_pulses`** — endpoint específico de hidrômetros
  de lojas, refletindo o foco em medição de água por loja varejista.
- **Convenção de naming `HLXBR_<sigla>_MYIO_<id>`** — específica da
  integração Helexia.

---

## 6. Próximos passos sugeridos

- [ ] Exportar `bkp-all-flows-*` das 8 lojas faltantes (`BENFICA`, `CAXIAS`,
      `JACAREPAGUA`, `MESQUITA`, `MOOCA`, `PIRACICABA`, `PRAIA-GRANDE`, `SUZANO`)
      e commitar em cada subpasta.
- [ ] Criar `CENTRAL-OBRAMAX-<site>.md` por loja com:
      - IPv6 da mesh + Gateway ID (UUID ThingsBoard)
      - `\dt` do banco local (`hubot`)
      - `SELECT * FROM slaves` (inventário de slaves)
      - Sigla Helexia (`HLXBR_<sigla>_MYIO_<id>`)
      - Particularidades locais (incidentes, integrações, customizações)
- [ ] Confirmar IPv6 de cada central no
      [`manual-centrais-linix-orangepi.md`](../GLOBAL_INFO/manual-centrais-linix-orangepi.md)
      §2.2 (atualmente não há seção "Holding: OBRAMAX" no manual).
- [ ] Auditar se todos os flows estão alinhados — drift entre lojas é o risco
      principal quando há 9 centrais com cópias-irmãs do mesmo flow.

---

## 7. Histórico do documento

| Data       | Autor             | Alteração                                                      |
| ---------- | ----------------- | -------------------------------------------------------------- |
| 2026-05-12 | rplago@gmail.com  | Criação inicial — inventário das 9 lojas + análise do flow Guadalupe       |
| 2026-05-12 | rplago@gmail.com  | §4 Catálogo de Functions — extração de 89 functions em `GUADALUPE/functions/` |
| 2026-05-12 | rplago@gmail.com  | Snapshot do flow.context de Guadalupe (`context_data_flow_guadalupe_2026_05_12_11_56.json`) |
| 2026-05-12 | rplago@gmail.com  | §3.8 Topologia do pipeline `Save Schedule from Thingsboard` (Guadalupe) — árvore de roteamento + `persister-schedule` órfão + `5b8a9c` órfão suspeito |
