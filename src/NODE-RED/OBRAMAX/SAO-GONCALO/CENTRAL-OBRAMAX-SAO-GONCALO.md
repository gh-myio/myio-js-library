# Central Obramax São Gonçalo — Node-RED, Modbus e Runbook

> Documento vivo (base para a futura seção de wiki). Construído a partir do backup de flows
> de **30/09/2026 12:00** e do registro de centrais.
>
> Ticket: [ED-1299](https://myio.atlassian.net/browse/ED-1299) — adicionar Modbus no Node-RED.
> Branch: `feat/ED-1299-obramax-sao-goncalo-modbus`.
>
> Referências: [`../README.md`](../README.md) (holding Obramax) ·
> [`../../GLOBAL_INFO/manual-centrais-linix-orangepi.md`](../../GLOBAL_INFO/manual-centrais-linix-orangepi.md) (operação comum)

---

## 1. Identificação

| Campo | Valor |
| --- | --- |
| Loja | Obramax São Gonçalo (RJ) |
| Nome no registry | `Obramax são Gonçalo ` (com espaço no fim) · display: **Central Obramax São Gonçalo** |
| IPv6 (`ygg0`) | `201:16bc:18d:dd1f:373c:c603:92bf:b83d` |
| UUID da central | `6cbe447e-f32c-46fa-85d7-0340a009aebe` |
| MAC / Serial | `02:42:99:a5:4e:69` / `024299a54e69` |
| Registrada em | 01/12/2025 |
| Gateway ID / Central ID / Frequência | _a levantar_ |
| Fonte | `src/NODE-RED/GLOBAL_INFO/centrals-registry.json` |

> ⚠️ A central **ainda não consta** na tabela OBRAMAX do manual de centrais Orange Pi — incluir
> quando Gateway ID / Central ID / Frequência forem levantados (item do ED-1299).

### 1.1 Acesso

```bash
ssh -i id_rsa root@201:16bc:18d:dd1f:373c:c603:92bf:b83d
```

- Editor Node-RED: `http://[201:16bc:18d:dd1f:373c:c603:92bf:b83d]:<porta>/red` — o README da holding
  cita `1880`, o manual global cita `8080` (Node-RED embarcado no `myio-api`). **Confirmar na central.**
- userDir ativo (padrão Orange Pi): `/usr/lib/node_modules/API/nodered_data/`.
- Arquivos de dados do Supervisório: `/data/*.json` (ver §3.3).

---

## 2. Backups Node-RED

| Arquivo | Data | Conteúdo |
| --- | --- | --- |
| `bkp-all-flows-OBRAMAX-SAO-GONCALO-2026-09-30-12-00.json` | 30/09/2026 12:00 | Export completo — **461 nós, 4 abas, 0 subflows, nenhum nó desabilitado** |

> 🔒 **Segredo no backup original:** o token do bot do Telegram aparece **2 vezes** escrito no código,
> como *fallback* (`var TOKEN = global.get('tg_token') || '<token>'`). A versão
> versionada no repositório tem os dois valores **redigidos** (`<REDACTED_TG_TOKEN>`); o restante do
> JSON está intacto e válido. Recomendação:
> remover o fallback do flow na central e deixar o token só em `global.tg_token` / PostgreSQL.

---

## 3. Arquitetura do flow (estado em 30/09/2026)

| Aba | Nós | Papel |
| --- | --- | --- |
| **Flow 1** | 229 | Fluxo "padrão MYIO": MQTT → ThingsBoard, schedules, On/Off, pulsos, APIs, **Modbus legado** |
| **SMS + status real** | 13 | Envio de SMS com status |
| **SMS com IMEI+ICCID** | 10 | Envio de SMS com identificação do modem |
| **Supervisório (Dashboard)** | 147 | Dashboard local (UI), automações, alarmes (e-mail/Telegram), **poller Modbus dinâmico** |

### 3.1 Integrações de saída (config nodes)

| Nó | Tipo | Destino |
| --- | --- | --- |
| `Thingsboard PE` | mqtt-broker | `mqtt.myio-bas.com:1883` — tópicos `v1/gateway/telemetry` e `v1/gateway/attributes` |
| `Helexia` | mqtt-broker (TLS) | `HLXIotHub.azure-devices.net:8883` — device `HLXBR_OMCA_MYIO_UTCM3` |
| `DB` + 2 anônimos | postgreSQLConfig | `DB_HOST`/`DB_PORT`/`DB_PASSWORD` via variáveis de ambiente (sem segredo no flow) |

### 3.2 Flow 1 — grupos

| Grupo | Nós | Observação |
| --- | --- | --- |
| MQTT | 31 | Envio de telemetria/atributos ao TB (inject 15 s) |
| Thingsboard | 8 | |
| Store devices to flow.devices | 18 | |
| Save Schedule from Thingsboard | 80 | Schedules V6 |
| On/Off devices | 9 | `http in /OnOff` |
| Get pulses every 10 min | 15 | Pulses report V4 / Multiple V1 |
| Get 30 days average every hour | 8 | |
| API Export Water | 6 | `http in /export` |
| Fix values in database | 3 | |
| **Modbus** | 11 | **Leitura legada — ver §4.1** |
| (2 grupos sem nome) | 7 + 19 | |

Endpoints `http in` do Flow 1: `/rpc`, `/OnOff`, `/export`,
`/dash_api/v2/devices_pulses/:slaveIds/:start_ts/:end_ts`, `/dash_api/devices_pulses/:name/:start_ts/:end_ts`,
`/dash_api/demand_pulses/:name/:start_ts/:end_ts`, `/dash_api/lojas_consumption_pulses/:start_ts/:end_ts`.

### 3.3 Supervisório — persistência local

| Arquivo | Uso |
| --- | --- |
| `/data/envs.json` | Ambientes / vínculos |
| `/data/automacoes.json` | Automações |
| `/data/feriados.json` | Feriados |
| `/data/alarmes.json` | Alarmes |
| `/data/modbus_poll_cfg.json` | **Configuração do poller Modbus** (medidores ativos) |
| `/tmp/myio_mailer.js` | Script de e-mail gerado no boot (`exec node /tmp/myio_mailer.js`) |

Também grava em PostgreSQL (tabelas de ambientes, histórico, log de ACL, config de Telegram/Modbus).

---

## 4. Modbus — estado atual

**Já existem dois pipelines Modbus**, ambos na **mesma porta serial `/dev/ttyUSB0`**
(9600 bps, 8N2):

| | Pipeline legado (Flow 1) | Poller dinâmico (Supervisório) |
| --- | --- | --- |
| Nó `modbus` | `5abe8e37.1b686` · `autoopen: true` · timeout 1500 ms | `c15a233d.526af8` · `autoopen: false` · timeout 500 ms |
| Disparo | inject **a cada 5 s** | inject **a cada 1 s**, com *gate* em `cfg.intervalMs` (default 5000 ms) |
| Medidores | **hardcoded**: endereço `4` → `Trafo` (demais comentados) | `/data/modbus_poll_cfg.json` → `global.modbusPollCfg`; sem arquivo, usa **default: `4` Geral + `5` Rede (Kron)** |
| Modelos | só Kron (mapa próprio, ver §4.2) | `kron` e `schneider` (mapas fixos por modelo) |
| Prioridade | lê `Potencia Ativa Trifásica` do Trafo a cada 60 s | configurável (`cfg.priority`) |
| Saída | **Helexia (MQTT) + ThingsBoard** (link out → `Format Device`) | **só UI do Supervisório** + motor de automações/alarmes; o nó "Compat Helexia/TB" termina num `debug` |

### 4.1 Pontos de atenção

1. **Dois nós Modbus disputando `/dev/ttyUSB0`.** Com os dois ativos, as leituras podem colidir
   no barramento RS-485 (timeouts intermitentes, respostas trocadas). Antes de adicionar
   medidores, decidir **qual pipeline fica como fonte única** — ver §5.
2. **Mapas de registradores Kron divergentes.** O legado lê Tensão A em `4`, o dinâmico em `16`;
   Potência Trifásica em `34` vs `12`; Energia Ativa em `200` vs `52`. Um dos dois está errado para o
   medidor instalado (possivelmente modelos Kron diferentes). **Validar com o manual do medidor
   físico** antes de replicar.
3. **Endereço do Trafo divergente.** A função ativa usa `4`; a função legada não conectada
   (`wires: [[]]`) usa `14`; o mapa Helexia aponta `Trafo → ..._modbus_14`. O mapa Helexia é por
   nome, então funciona, mas o endereço `14` indica cópia de outra loja.
4. **Mapa Helexia herdado.** Os nomes `QFAC Portaria`, `QFAC-1A`, `QFAC-QGBT`, `QFAC-VBF` etc. e os IDs
   `edf9a41f..._modbus_1x` parecem vir de outra loja — confirmar com a Helexia os IDs corretos de São Gonçalo.
5. O poller dinâmico **não envia** para TB/Helexia — os medidores adicionados pela tela do
   Supervisório só aparecem localmente.

### 4.2 Mapas de registradores (FLOAT32, 2 registradores)

**Kron — poller dinâmico** (`readType: input`, formato `float32_be_swap`):

| Grandeza | Chave | Reg. |
| --- | --- | --- |
| Tensão A / B / C | `voltage_a/b/c` | 16 / 18 / 20 |
| Corrente A / B / C | `current_a/b/c` | 22 / 24 / 26 |
| Potência Ativa A / B / C | `power_a/b/c` | 28 / 30 / 32 |
| Potência Ativa Trifásica | `power` | 12 |
| Potência Reativa Trifásica | `power_reactive` | 10 |
| Potência Reativa A / B / C | `power_reactive_a/b/c` | 34 / 36 / 38 |
| FP Trifásico | `fp` | 6 |
| FP A / B / C | `fp_a/b/c` | 46 / 48 / 50 |
| Energia Ativa Positiva | `kWh` | 52 |
| Energia Reativa Positiva | `KVArh` | 54 |

**Kron — legado (Flow 1)** (`readType: input`):

| Grandeza | Chave | Reg. |
| --- | --- | --- |
| Tensão A / B / C | `voltage_a/b/c` | 4 / 6 / 8 |
| Corrente A / B / C | `current_a/b/c` | 20 / 22 / 24 |
| Potência Ativa A / B / C | `power_a/b/c` | 36 / 38 / 40 |
| Potência Ativa Trifásica | `power` | 34 |
| Potência Reativa Trifásica | `power_reactive` | 42 |
| Potência Reativa A / B / C | `power_reactive_a/b/c` | 44 / 46 / 48 |
| FP Trifásico | `fp` | 58 |
| FP A / B / C | `fp_a/b/c` | 60 / 62 / 64 |
| Energia Ativa / Reativa Positiva | `kWh` / `kVArh` | 200 / 202 |
| Demanda Ativa | `kW` | 210 |

**Schneider — poller dinâmico** (`readType: hold`, nó devolve `float32`):

| Grandeza | Chave | Reg. | Escala |
| --- | --- | --- | --- |
| Energia Ativa Positiva | `kWh` | 2699 | — |
| Corrente A / B / C | `current_a/b/c` | 2999 / 3001 / 3003 | — |
| Tensão A / B / C | `voltage_a/b/c` | 3027 / 3029 / 3031 | — |
| Potência Ativa A / B / C | `power_a/b/c` | 3053 / 3055 / 3057 | ×1000 |
| Potência Ativa Trifásica | `power` | 3059 | ×1000 |
| Potência Reativa A / B / C | `power_reactive_a/b/c` | 3061 / 3063 / 3065 | ÷1000 |
| Potência Reativa Trifásica | `power_reactive` | 3067 | ×1000 |
| FP A / B / C / Trifásico | `fp_a/b/c`, `fp` | 3077 / 3079 / 3081 / 3083 | FP especial (leading/lagging) |

> Observação: no Schneider a Potência Reativa por fase está `÷1000` e a trifásica `×1000` —
> inconsistência a validar.

### 4.3 Formato do `modbus_poll_cfg.json`

```json
{
  "intervalMs": 5000,
  "priority": { "enabled": false, "deviceName": "Geral", "attributeName": "Potencia Ativa Trifásica", "everyMs": 60000 },
  "devices": [
    { "address": 4, "name": "Geral", "model": "kron",      "enabled": true },
    { "address": 5, "name": "Rede",  "model": "kron",      "enabled": true }
  ]
}
```

Salvo pela tela do Supervisório (`Salvar config → global + arquivo`), carregado no boot
(`Carregar config`) e espelhado no PostgreSQL (`Modbus cfg -> PG`).

---

## 5. ED-1299 — plano de trabalho

- [ ] **Levantamento em campo:** medidores a integrar (modelo Kron/Schneider/outro, endereço/slave id,
      parâmetros seriais), nomes dos circuitos e IDs Helexia correspondentes
- [ ] **Validar mapas de registradores** com o manual do(s) medidor(es) físico(s) (§4.1 item 2)
- [ ] **Decidir a fonte única de leitura** (§4.1 item 1). Proposta: manter o **poller dinâmico** e
      ligar a saída "Compat Helexia/TB" ao envio para TB/Helexia, desativando o grupo Modbus legado —
      ou o inverso, se a tela do Supervisório não for usada
- [ ] Backup `flows.json` + `/data/modbus_poll_cfg.json` antes de alterar
- [ ] Configurar os medidores e fazer o deploy
- [ ] Validar leituras (debug `Modbus_Debug` / `medidor`), chegada no TB e na Helexia
- [ ] Verificar que automações, SMS, alarmes e pulsos continuam funcionando
- [ ] Novo backup pós-mudança nesta pasta
- [ ] Incluir a central no manual de centrais Orange Pi (Gateway ID, Central ID, Frequência)

---

## 6. Histórico

| Data | Evento |
| --- | --- |
| 01/12/2025 | Central registrada |
| 29/07/2026 | Automação não rodou — analisado em [ED-1068](https://myio.atlassian.net/browse/ED-1068) (concluído) |
| 30/09/2026 | Backup de flows capturado; início do ED-1299 (Modbus) |
