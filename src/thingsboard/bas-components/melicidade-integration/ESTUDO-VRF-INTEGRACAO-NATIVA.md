# Estudo de Integração Nativa — VRF Hitachi (Reiri DCPF04)

> **Sistema**: Hitachi Reiri for Office Touch — modelo DCPF04
> **URL atual (iframe)**: `https://melicidade2.myio-bas.com/`
> **Manual de referência**: `INS_DCPF04_Reiri for Office Touch_DHOS-CS-IM-2107002G.pdf`
> **Objetivo**: substituir o acesso via iframe/túnel por integração nativa, com resiliência
> offline, relatórios, agendamentos e sync automático no MyIO.

---

## 1. O que é o DCPF04

O **Reiri for Office Touch (DCPF04)** é o **controlador central** do sistema VRF.
Na instalação da Melicidade, as **unidades de ar condicionado são da Daikin** — e o
DCPF04 as gerencia via adaptador **DCPA01**, que traduz o protocolo proprietário da
Daikin (DIII-Net) para Modbus RTU.

```
[Unidades Internas Daikin VRF]
  └─ DIII-Net (barramento proprietário Daikin)
        │
        ▼
[DCPA01 — Adaptador DIII-Net → Modbus RTU]
        │
        │ RS485 / Modbus RTU
        ▼
[DCPF04 — Reiri for Office Touch]  ←── hoje: expõe UI web via melicidade2.myio-bas.com
        │
        │ Ethernet (Gigabit)
        ▼
[Central MyIO — proxy reverso nginx]
        │
        │ HTTPS (iframe)
        ▼
[Dashboard MyIO — aba VRF]
```

> **Detalhe importante**: as unidades são Daikin, mas o controlador é Hitachi Reiri.
> Isso é comum no mercado — o integrador escolheu o Reiri como BMS central independente
> do fabricante das UIs. Para o MyIO Gateway, isso é transparente: a integração é sempre
> com o DCPF04 via Modbus, independente da marca das UIs por baixo.

**Objetivo da integração nativa**: cortar o caminho do iframe e conectar diretamente ao
DCPF04 via Modbus, eliminando a dependência da UI web.

---

## 2. Interfaces Físicas do DCPF04

### Barramento de Campo (RS485)

| Porta | Terminais | Dispositivos suportados |
|-------|-----------|------------------------|
| D1 | D1+, D1− | Modbus RTU: DCPA01, IAQ sensors, smart meters, NetPro |
| D2 | D2+, D2− | Modbus RTU: mesmos tipos, independente de D1 |

**Parâmetros RS485:**

| Parâmetro | Opções |
|-----------|--------|
| Baud rate | 9600 bps ou 19200 bps (via DIP switch no dispositivo) |
| Data bits | 8 (fixo) |
| Paridade | Par ou Ímpar (configurável) |
| Stop bits | 1 ou 2 |
| Topologia | Daisy chain (estrela não recomendada) |
| Cabo | Twisted pair AWG 24–18 (0,25–0,75 mm²) |
| Distância máx | 200 m |
| Terminação | Resistor obrigatório nas extremidades do barramento |

### Rede Ethernet

| Parâmetro | Valor |
|-----------|-------|
| Padrão | Gigabit Ethernet (RJ-45) |
| Cabo | CAT 5 / 5e / 6 |
| IP | DHCP (padrão) ou estático |
| Serviços | UI web, cloud Reiri, (provável) Modbus TCP porta 502 |

### USB

| Porta | Uso |
|-------|-----|
| A1 (Prioridade 1) | Adaptador CH341-S (RS485/USB) para dispositivos Modbus adicionais |
| A2 (Prioridade 2) | Segundo adaptador CH341-S |
| Type-C | Alimentação 5V DC |

---

## 3. Dispositivos no Barramento (Melicidade — a confirmar)

O DCPF04 conecta dispositivos via Modbus. Na Melicidade, o barramento provavelmente inclui:

### DCPA01 / DTA116A51 — Adaptador VRF → Modbus

| Parâmetro | Valor |
|-----------|-------|
| Função | Traduz barramento proprietário das UIs Hitachi para Modbus RTU |
| Endereços Modbus | 1 ou 2 (DIP switch DS2) |
| Qtd máx por porta RS485 | 2 adaptadores em daisy chain |
| Qtd máx total (DCPF04) | 4 adaptadores (2 por porta × 2 portas) |
| Unidades internas por adaptador | até 64 UIs + 10 UEs |
| DIP switch DS1 | Baud rate + paridade |
| DIP switch DS2 | Endereço Modbus (1 ou 2) |

**Pontos controlados via DCPA01:**

| Ponto | Acesso | Valores |
|-------|--------|---------|
| Liga/desliga | R/W | 0 = desligado, 1 = ligado |
| Modo de operação | R/W | cooling, heating, fan, dry, auto |
| Temperatura setpoint | R/W | 16–32°C (típico) |
| Velocidade do ventilador | R/W | auto, low, mid, high (ou 1–4 níveis) |
| Direção do ar (flap) | R/W | swing, fixo (ângulos) |
| Temperatura ambiente (leitura) | R | °C — sensor interno da UI |
| Status de operação | R | running, standby, error |
| Código de erro | R | código numérico do erro ativo |

### Smart Energy Meters — Medidores de Energia

| Parâmetro | Valor |
|-----------|-------|
| Endereços Modbus | 1–30 (únicos por medidor) |
| Qtd máx | 30 em daisy chain por porta |
| Baud rate | 9600 bps típico |

**Pontos disponíveis:**

| Ponto | Unidade |
|-------|---------|
| Consumo acumulado | kWh |
| Potência ativa instantânea | W ou kW |
| PPD (energia por grau) | kWh/°C — faturamento proporcional |

### Reiri IAQ Multi-Sensor — Qualidade do Ar (se instalado)

| Ponto | Unidade |
|-------|---------|
| Temperatura | °C |
| Umidade relativa | % |
| CO2 | ppm |
| PM2.5 | μg/m³ |
| TVOC | ppb |

---

## 4. Modelo de Dados (Point Types)

O DCPF04 organiza todos os pontos em uma estrutura hierárquica:

```
DCPF04
├── Zona Norte
│   ├── UI-01  (Ac) → liga, modo, setpoint, fan, flap, temp_ambiente, erro
│   ├── UI-02  (Ac)
│   └── Medidor-Norte (SMeter) → kWh, W
├── Zona Sul
│   ├── UI-03  (Ac)
│   └── Medidor-Sul (SMeter)
└── Sensores IAQ
    ├── IAQ-01 (Valor) → temp, humi, co2, pm25, tvoc
    └── IAQ-02 (Valor)
```

### Atributos configuráveis por ponto (relevantes para MyIO)

| Atributo | Tipo | Uso na integração |
|----------|------|-------------------|
| `ID` | string | Chave única do ponto |
| `Nome` | string | Label para o dashboard |
| `Tipo` | enum | Ac, SMeter, Valor, Chave, Status, Alerta |
| `Armazenar no banco` | bool | Se `true`, DCPF04 guarda histórico interno |
| `Armazenar setpoint` (AC) | bool | Guarda histórico de setpoints |
| `Armazenar temp` (AC) | bool | Guarda histórico de temperatura ambiente |
| `Unidade` | string | °C, %, ppm, W, kWh |
| `Calibração` | float | Offset para correção do sensor |
| `AV Range Min/Max` | float | Escala de conversão |
| `Casas decimais` | int | Precisão de exibição |

---

## 5. Estratégia de Conexão ao DCPF04

### 5.1 Opção A — Modbus TCP via Ethernet ✅ Preferida

```
[MyIO Gateway Node-RED]
        │
        │ TCP porta 502 (Modbus TCP)
        │ mesma rede local (LAN)
        ▼
[DCPF04 — IP: x.x.x.x]
```

**Vantagens:**
- Sem cabeamento adicional — usa a rede Ethernet já existente
- Gateway pode estar em qualquer ponto da rede
- Mais fácil de monitorar e debugar

**Pré-requisito:** confirmar que o DCPF04 expõe Modbus TCP na porta 502.
O manual não documenta explicitamente, mas é comum em controladores embedded Linux
com Modbus RTU — muitos expõem Modbus TCP nativamente ou via bridge software.

**Como confirmar:**
```bash
# Do gateway ou de qualquer máquina na mesma rede:
nmap -p 502 <IP_do_DCPF04>

# Ou teste direto Modbus TCP (Function Code 03, Read Holding Registers):
mbpoll <IP_do_DCPF04> -p 502 -a 1 -r 1 -c 10
```

### 5.2 Opção B — Modbus RTU via RS485 (cabo físico)

```
[MyIO Gateway]
  └── Adaptador USB/RS485 (ex.: CH341-S ou similar)
        │
        │ RS485 twisted pair (até 200m)
        │ 9600 ou 19200 bps
        ▼
[DCPF04 porta D1 ou D2]
```

**Quando usar:** se Modbus TCP não estiver disponível ou se o Gateway precisar estar
fisicamente próximo ao DCPF04 (rack técnico).

**Hardware necessário:**
- Adaptador USB-RS485 (ex.: CH341-S, ou qualquer conversor FTDI/CP2102)
- Cabo twisted pair 2 vias (A+/B−)
- Resistor de terminação 120Ω nas extremidades

### 5.3 Opção C — API HTTP local (Engenharia Reversa)

O app Reiri for Office usa HTTPS para comunicação cloud. É provável que o DCPF04
exponha endpoints HTTP locais na LAN (API privada).

**Como investigar:**
```bash
# Capturar tráfego entre o app Reiri e o DCPF04 na LAN
# usando Wireshark ou mitmproxy na mesma rede
# Procurar chamadas HTTP/HTTPS para o IP do DCPF04

# Ou varrer portas comuns de API:
nmap -p 80,443,8080,8443,3000,5000 <IP_do_DCPF04>
```

Se existir API HTTP, é a opção mais rica (JSON, sem conversão de registros Modbus).
Requer contato com Hitachi para documentação oficial ou engenharia reversa.

**Recomendação:** investigar em paralelo, não bloquear o MVP nessa opção.

---

## 6. Mapeamento de Registros Modbus (a levantar)

O DCPF04 não publica o mapa de registros Modbus no manual de instalação.
Para obter o mapa completo, as opções são:

1. **Solicitar à Hitachi** o "Modbus Register Map" ou "Communication Specification" do DCPF04
2. **Solicitar ao DCPA01** a especificação de comunicação (o adaptador tem documentação própria)
3. **Descoberta ativa**: usar `mbpoll` ou `ModScan` para varrer registros e inferir o mapa
4. **Exportar CSV do Reiri Setup Tool** (Windows) — lista todos os pontos configurados com IDs

### Estrutura típica de registros Modbus para controladores VRF

> Os endereços abaixo são **estimativas baseadas em padrões de mercado** — precisam
> ser validados contra o mapa real do DCPF04:

| Registro (Holding) | Ponto | Tipo | Escala |
|--------------------|-------|------|--------|
| 0x0001 | UI-01: Liga/Desliga | R/W | 0=off, 1=on |
| 0x0002 | UI-01: Modo | R/W | 0=cool,1=heat,2=fan,3=dry,4=auto |
| 0x0003 | UI-01: Setpoint temp | R/W | valor × 10 → ex: 220 = 22,0°C |
| 0x0004 | UI-01: Vel. ventilador | R/W | 0=auto,1=low,2=mid,3=high |
| 0x0005 | UI-01: Temp ambiente | R | valor × 10 → °C |
| 0x0006 | UI-01: Status | R | 0=standby,1=running,2=error |
| 0x0007 | UI-01: Código erro | R | código numérico |
| ... | (repete para UI-02, UI-03...) | | |
| 0x0100 | Medidor-01: Potência | R | W |
| 0x0102 | Medidor-01: Energia acum. | R | kWh × 10 |

**Ação necessária:** solicitar documentação técnica à Hitachi ou usar o Reiri Setup Tool
para exportar CSV com os IDs dos pontos e correlacionar com os registros Modbus.

---

## 7. Arquitetura de Integração Nativa MyIO

### 7.1 Componentes

```
┌──────────────────────────────────────────────────────┐
│              ThingsBoard (MyIO Cloud)                │
│                                                      │
│  Device: "Melicidade-VRF-ZonaNorte"                 │
│  Device: "Melicidade-VRF-ZonaSul"                   │
│  Device: "Melicidade-VRF-ZonaComum"                 │
│                                                      │
│  Dashboard BAS MyIO ← dados nativos (sem iframe)    │
│  Relatórios MyIO    ← histórico no TB               │
│  Rule Engine        ← agendamentos e alertas        │
└──────────────────────┬───────────────────────────────┘
                       │
          MQTT (quando online) / HTTP telemetry
          Sync assíncrono de backlog (quando volta)
                       │
┌──────────────────────▼───────────────────────────────┐
│           MyIO Gateway Agent (on-premise)            │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Scheduler  │  │ Buffer Local │  │ Sync Engine│  │
│  │  (cron)     │  │ (SQLite /    │  │ backlog →  │  │
│  │  ações off  │  │  InfluxDB)   │  │ ThingsBoard│  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                │                │         │
│         └────────────────┴────────────────┘         │
│                          │                          │
│              ┌───────────▼──────────┐               │
│              │   Modbus Adapter     │               │
│              │  (node-red-contrib-  │               │
│              │   modbus)            │               │
│              └───────────┬──────────┘               │
└──────────────────────────┼──────────────────────────┘
                           │
              Modbus TCP (502) ou RTU (RS485)
                           │
┌──────────────────────────▼──────────────────────────┐
│          DCPF04 — Reiri for Office Touch             │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  DCPA01 ×N  │  │ Smart Meters │  │ IAQ Sensors│  │
│  │  (RS485)    │  │  (RS485)     │  │  (RS485)   │  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                │                │         │
└─────────┼────────────────┼────────────────┼─────────┘
          │                │                │
    [UIs Hitachi     [Medidores       [Sensores
     VRF internas]    de energia]      IAQ]
```

### 7.2 Node-RED — Flows Principais

#### Flow 1: Polling de Telemetria (a cada 60s)

```
[Inject: cron 60s]
    │
    ▼
[Modbus Read: FC03, addr=0x0001, count=7, unit=1]  → UI-01
    │
    ▼
[Function: parseVRFUnit(buffer)]
    │  Liga/desliga, Modo, Setpoint, Fan, Temp_amb, Status, Erro
    ▼
[Buffer Local: SQLite insert]
    │
    ▼
[ThingsBoard: POST telemetry] ──(falha)──► [Queue: backlog]
```

#### Flow 2: Sync de Backlog (quando conexão volta)

```
[Inject: cron 5min]
    │
    ▼
[Check: ThingsBoard reachable?]
    │ sim
    ▼
[SQLite: SELECT não-sincronizados ORDER BY ts ASC LIMIT 500]
    │
    ▼
[ThingsBoard: POST telemetry com ts original]
    │ ok
    ▼
[SQLite: UPDATE sincronizado=true]
```

#### Flow 3: Agendamento de Ação (ex.: desligar às 22h)

```
[TB Rule Engine] ──MQTT──► [Gateway]
    │  payload: { device: "VRF-ZonaNorte", action: "off", scheduledAt: "22:00" }
    ▼
[Scheduler: registra cron local]
    │
    ▼ (às 22:00, com ou sem internet)
[Modbus Write: FC06, addr=0x0001, value=0]  → UI liga=0
    │
    ▼
[Buffer: registra ação executada + resultado]
    │
    ▼
[ThingsBoard: confirma execução] ──(offline)──► [Queue]
```

#### Flow 4: Alertas e Erros

```
[Modbus Read: FC03, código_erro UI-01]
    │
    ▼
[Function: if (codigo !== 0) → gerar alerta]
    │
    ▼
[ThingsBoard: POST alarm] → Rule Engine → notificação dashboard
```

---

## 8. Modelo de Dispositivos no ThingsBoard

### Device por zona/unidade

```
Device: "Melicidade-VRF-ZonaNorte-UI01"
  Telemetry:
    - power_on          (bool)
    - mode              (string: cooling/heating/fan/dry/auto)
    - setpoint_temp     (float, °C)
    - fan_speed         (string: auto/low/mid/high)
    - ambient_temp      (float, °C)
    - status            (string: running/standby/error)
    - error_code        (int)
  Server Attributes:
    - location          (string: "Zona Norte - Sala 101")
    - modbus_unit_id    (int: 1)
    - modbus_register   (int: 0x0001)
```

### Device por medidor de energia

```
Device: "Melicidade-VRF-Medidor-Norte"
  Telemetry:
    - power_w           (float, W)
    - energy_kwh        (float, kWh)
    - energy_delta_kwh  (float, consumo do período)
  Server Attributes:
    - modbus_unit_id    (int: 10)
```

### Asset de grupo (hierarquia TB)

```
Asset: "Melicidade-VRF"
  └── Asset: "Zona Norte"
      ├── Device: VRF-ZonaNorte-UI01
      ├── Device: VRF-ZonaNorte-UI02
      └── Device: VRF-Medidor-Norte
  └── Asset: "Zona Sul"
      ├── Device: VRF-ZonaSul-UI03
      └── Device: VRF-Medidor-Sul
```

---

## 9. Relatórios — O que o MyIO pode gerar nativamente

Com os dados no ThingsBoard, esses relatórios ficam disponíveis **sem depender do DCPF04**:

| Relatório | Dados necessários | Frequência |
|-----------|------------------|------------|
| Consumo de energia por zona | `energy_kwh` por medidor | Diário / Mensal |
| Horas de operação por UI | `power_on` + timestamp | Diário / Mensal |
| Temperatura média por ambiente | `ambient_temp` | Horário / Diário |
| Setpoint vs Temperatura real | `setpoint_temp` + `ambient_temp` | Contínuo |
| Histórico de modos de operação | `mode` | Sob demanda |
| Alarmes e erros | `error_code` + `status` | Evento |
| Eficiência energética (COP estimado) | `power_w` + `ambient_temp` | Calculado |
| Comparativo entre zonas | Todos os medidores | Mensal |

---

## 10. Agendamentos — Ações Nativas MyIO

Exemplos de agendamentos que o Gateway executa localmente:

| Agendamento | Ação Modbus | Horário típico |
|------------|-------------|---------------|
| Ligar sistema VRF | Write UI: power=1 | 07:00 (dias úteis) |
| Desligar sistema VRF | Write UI: power=0 | 22:00 |
| Setar modo cooling | Write UI: mode=cooling | Verão automático |
| Reduzir setpoint | Write UI: setpoint=24 | Horário de pico (conta de luz) |
| Desligar zonas vazias | Write UI específica: power=0 | Fim de expediente por zona |
| Relatório de consumo | Leitura medidores | 00:00 diário |

---

## 11. Resiliência Offline

### O que funciona SEM internet / SEM conexão com ThingsBoard

| Funcionalidade | Offline? | Como |
|---------------|---------|------|
| Coleta de telemetria | ✅ Sim | Polling Modbus contínuo → buffer local |
| Armazenamento histórico | ✅ Sim | SQLite / InfluxDB local no Gateway |
| Agendamentos | ✅ Sim | Cron local no Node-RED |
| Controle manual via DCPF04 UI | ✅ Sim | Interface web local do DCPF04 (não depende de MyIO) |
| Alertas push (app MyIO) | ❌ Não | Requer conexão com ThingsBoard |
| Dashboard MyIO | ❌ Não | Requer conexão com ThingsBoard |
| Relatórios MyIO | ❌ Não | Gerados no ThingsBoard |

### Quando a conexão volta

1. Gateway detecta ThingsBoard acessível (health check periódico)
2. Sync Engine lê backlog local (ordenado por timestamp original)
3. Envia em lotes para ThingsBoard via HTTP telemetry API com `ts` original
4. Dados aparecem no histórico do TB com timestamps corretos
5. Relatórios gerados com dados completos (sem lacunas)

### Política de retenção do buffer local

| Dado | Retenção local |
|------|---------------|
| Telemetria de UIs | 30 dias |
| Energia (kWh) | 90 dias |
| Alarmes / erros | 90 dias |
| Ações executadas | 90 dias |

---

## 12. Checklist de Implementação

### Fase 0 — Levantamento (antes de desenvolver)

- [ ] Obter IP do DCPF04 na rede local da Melicidade
- [ ] Testar port scan: `nmap -p 502,80,443,8080 <IP_DCPF04>`
- [ ] Se porta 502 aberta → testar Modbus TCP: `mbpoll <IP> -p 502 -a 1 -r 1 -c 10`
- [ ] Solicitar à Hitachi o mapa de registros Modbus do DCPF04 / DCPA01
- [ ] Exportar CSV do Reiri Setup Tool com todos os pontos configurados
- [ ] Levantar: quantas UIs, quantas zonas, quantos medidores, tem IAQ?
- [ ] Decidir: Modbus TCP (Opção A) ou RS485 físico (Opção B)?

### Fase 1 — MVP (leitura + telemetria)

- [ ] Configurar Gateway MyIO (Node-RED) com acesso à rede do DCPF04
- [ ] Implementar polling Modbus (FC03) para todas as UIs
- [ ] Implementar polling de medidores de energia
- [ ] Buffer local SQLite para resiliência offline
- [ ] Sync para ThingsBoard (telemetry API com `ts`)
- [ ] Criar Devices no ThingsBoard por zona/UI
- [ ] Dashboard BAS MyIO: cards VRF com dados nativos (sem iframe)

### Fase 2 — Controle

- [ ] Implementar Modbus Write (FC06) para liga/desliga, setpoint, modo
- [ ] Expor comandos via ThingsBoard RPC
- [ ] Gateway escuta RPC → executa Modbus Write → confirma no TB
- [ ] Interface de controle no Dashboard MyIO

### Fase 3 — Agendamentos + Relatórios

- [ ] Agendamentos via TB Rule Engine → MQTT → Gateway cron
- [ ] Relatório de consumo por zona (diário/mensal)
- [ ] Relatório de horas de operação
- [ ] Alerta de erro/alarme → notificação push

### Fase 4 — Deprecar iframe

- [ ] Validar que todos os casos de uso estão cobertos nativamente
- [ ] Remover aba VRF do `IntegrationsModal` ou manter como fallback
- [ ] Documentar migração para o cliente

---

## 13. Dependências e Ferramentas

### Node-RED packages necessários

```bash
npm install node-red-contrib-modbus        # Modbus RTU + TCP
npm install node-red-contrib-thingsboard   # TB telemetry + RPC
npm install node-red-node-sqlite           # Buffer local
npm install node-red-contrib-cron-plus     # Agendamentos offline
npm install node-red-contrib-influxdb      # Alternativa ao SQLite para séries temporais
```

### Ferramentas de diagnóstico

```bash
# Testar Modbus TCP
npm install -g mbpoll

# Descoberta de dispositivos na rede
nmap -p 502 192.168.1.0/24

# Monitorar tráfego RS485 (se usando RTU)
# Wireshark com plugin Serial ou CoolTerm
```

### Hardware (se Opção B — RS485 físico)

| Item | Exemplo |
|------|---------|
| Adaptador USB-RS485 | CH341-S (mesmo usado pelo DCPF04), FTDI, CP2102 |
| Cabo twisted pair | 2 vias, AWG 24, blindado |
| Resistor terminação | 120Ω ¼W nas extremidades |

---

## 14. Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| DCPF04 não expõe Modbus TCP | Média | Usar RS485 físico (Opção B) |
| Mapa de registros não disponível | Alta | Solicitar Hitachi + descoberta ativa |
| Firewall bloqueia porta 502 | Baixa | Configurar regra no roteador |
| Latência RS485 alta (200m) | Baixa | Usar Modbus TCP se disponível |
| Versão de firmware do DCPF04 sem TCP | Média | Verificar versão + solicitar update |
| Volume de dados excede buffer local | Baixa | Configurar retenção + alertas de disco |
| Credenciais de rede Melicidade indisponíveis | Baixa | Solicitar ao cliente antes do início |

---

## 15. Referências

| Recurso | Localização / Link |
|---------|--------------------|
| Manual DCPF04 | `INS_DCPF04_Reiri for Office Touch_DHOS-CS-IM-2107002G.pdf` |
| Screenshot VRF login | `screenshot-integracao-vrf-melicidade-2026-04-16-15-49.png` |
| Estudo geral integração nativa | `ESTUDO-INTEGRACAO-NATIVA.md` |
| Documentação integração atual (iframe) | `MELICIDADE-INTEGRATION.md` |
| node-red-contrib-modbus | https://flows.nodered.org/node/node-red-contrib-modbus |
| ThingsBoard Telemetry API | https://thingsboard.io/docs/reference/http-api/ |
| ThingsBoard RPC API | https://thingsboard.io/docs/user-guide/rpc/ |
| Modbus Application Protocol Spec | modbus.org/docs/Modbus_Application_Protocol_V1_1b3.pdf |
