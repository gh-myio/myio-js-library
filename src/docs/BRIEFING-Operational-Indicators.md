# BRIEFING: Indicadores Operacionais - Requisitos de Dados

**Data:** 2026-01-29
**Versao:** 1.0
**Status:** Em desenvolvimento
**RFCs Relacionados:** RFC-0152, RFC-0154, RFC-0155, RFC-0156

---

## 1. Visao Geral

Este documento consolida todos os requisitos de dados necessarios para popular os paineis de Indicadores Operacionais. O objetivo e garantir que o backend e a equipe de alarmes tenham clareza sobre quais dados precisam ser fornecidos.

### 1.1 Componentes do Sistema

| Componente | Descricao | Status |
|------------|-----------|--------|
| **Lista Geral** | Grid de cards de equipamentos com KPIs individuais | Implementado |
| **Alarmes e Notificacoes** | Lista filtravel + Dashboard de alarmes | Pendente |
| **Dashboard Gerencial** | KPIs agregados da frota + graficos de tendencia | Implementado |

### 1.2 Feature Flag

Para habilitar os paineis operacionais, o cliente precisa ter o atributo:

```
Atributo: show-indicators-operational-panels
Escopo: SERVER_SCOPE (ThingsBoard Customer Attributes)
Tipo: boolean
Valor: true | false
```

---

## 2. LISTA GERAL - Dados por Equipamento

### 2.1 Estrutura de Dados: `EquipmentCardData`

Cada equipamento (escada rolante ou elevador) precisa fornecer:

```typescript
interface EquipmentCardData {
  // === IDENTIFICACAO ===
  id: string;              // ID unico do equipamento (ex: "device_abc123")
  name: string;            // Nome de exibicao (ex: "ESC-01", "ELV-02")
  entityId?: string;       // Entity ID no ThingsBoard

  // === CLASSIFICACAO ===
  type: 'escada' | 'elevador';  // Tipo do equipamento

  // === STATUS OPERACIONAL ===
  status: 'online' | 'offline' | 'maintenance';

  // === METRICAS DE DISPONIBILIDADE ===
  availability: number;    // Percentual de disponibilidade (0-100)
  mtbf: number;            // Mean Time Between Failures em HORAS
  mttr: number;            // Mean Time To Repair em HORAS

  // === ALERTAS ===
  hasReversal: boolean;    // Flag de deteccao de reversao
  recentAlerts: number;    // Contagem de alertas recentes

  // === LOCALIZACAO ===
  customerId?: string;     // ID do cliente/shopping no ThingsBoard
  customerName: string;    // Nome do shopping (ex: "Shopping Madureira")
  location: string;        // Localizacao especifica (ex: "Piso 1", "Torre A")
}
```

### 2.2 Formulas de Calculo

```
MTBF = (Tempo Total de Operacao - Tempo de Manutencao) / Numero de Falhas

MTTR = Tempo Total de Manutencao / Numero de Falhas

Disponibilidade = (MTBF / (MTBF + MTTR)) * 100
```

### 2.3 Estatisticas Agregadas: `EquipmentStats`

O header da lista precisa dos totais:

```typescript
interface EquipmentStats {
  total: number;              // Total de equipamentos
  online: number;             // Quantidade online
  offline: number;            // Quantidade offline
  maintenance: number;        // Quantidade em manutencao
  fleetAvailability: number;  // Disponibilidade media da frota (%)
  avgMtbf: number;            // MTBF medio (horas)
  avgMttr: number;            // MTTR medio (horas)
}
```

### 2.4 Origem dos Dados - LISTA GERAL

| Campo | Fonte Sugerida | Observacoes |
|-------|----------------|-------------|
| `id`, `name`, `entityId` | ThingsBoard Device | Ja disponivel |
| `type` | Device Type / Device Profile | Classificar por ESCADA_ROLANTE ou ELEVADOR |
| `status` | Telemetria ou atributo calculado | Regras de status existentes |
| `availability` | **CALCULAR** | Precisa historico de uptime/downtime |
| `mtbf` | **CALCULAR** | Precisa historico de falhas |
| `mttr` | **CALCULAR** | Precisa historico de tempo de reparo |
| `hasReversal` | Telemetria `reversal_detected` | Se aplicavel ao equipamento |
| `recentAlerts` | Alarms API ThingsBoard | Contar alarmes ativos por device |
| `customerName`, `customerId` | Customer relation | Ja disponivel via relacao |
| `location` | Device attribute `location` | Atributo customizado |

---

## 3. DASHBOARD GERENCIAL - KPIs da Frota

### 3.1 Estrutura de Dados: `DashboardKPIs`

```typescript
interface DashboardKPIs {
  // === KPIs PRINCIPAIS ===
  fleetAvailability: number;   // Disponibilidade media da frota (%)
  availabilityTrend: number;   // Tendencia vs periodo anterior (+/- %)
  avgAvailability: number;     // Disponibilidade media
  activeAlerts: number;        // Numero de alertas ativos na frota

  // === METRICAS DE CONFIABILIDADE ===
  fleetMTBF: number;           // MTBF medio da frota (horas)
  fleetMTTR: number;           // MTTR medio da frota (horas)

  // === CONTADORES DE STATUS ===
  totalEquipment: number;      // Total de equipamentos
  onlineCount: number;         // Equipamentos online
  offlineCount: number;        // Equipamentos offline
  maintenanceCount: number;    // Equipamentos em manutencao

  // === METRICAS AVANCADAS (RFC-0155) ===
  onlineTrend?: number;            // Tendencia online vs periodo anterior
  offlineTrend?: number;           // Tendencia offline vs periodo anterior
  maintenanceTrend?: number;       // Tendencia manutencao vs periodo anterior
  offlineCriticalCount?: number;   // Equipamentos offline > 24h
  recurrentFailuresCount?: number; // Equipamentos com 3+ falhas no periodo

  avgTimeInStatus?: {              // Tempo medio em cada status (horas)
    online: number;
    offline: number;
    maintenance: number;
  };
}
```

### 3.2 Periodos de Consulta

O dashboard suporta 4 periodos:

| Periodo | Valor | Descricao |
|---------|-------|-----------|
| Hoje | `today` | Das 00:00 ate agora |
| Esta Semana | `week` | Desde segunda-feira |
| Este Mes | `month` | Desde o dia 1 |
| Este Trimestre | `quarter` | Desde o inicio do trimestre |

### 3.3 Dados de Tendencia: `TrendDataPoint[]`

Para o grafico de Disponibilidade por Periodo:

```typescript
interface TrendDataPoint {
  label: string;              // Label para eixo X (ex: "01/01", "Seg")
  timestamp: number;          // Timestamp em milliseconds
  value: number;              // Valor da disponibilidade (%)
  secondaryValue?: number;    // Valor secundario (ex: MTTR)

  // === DADOS ENRIQUECIDOS (RFC-0156) ===
  failureCount?: number;      // Numero de falhas neste dia/periodo
  downtimeHours?: number;     // Horas de parada neste dia/periodo
  affectedEquipment?: number; // Quantidade de equipamentos afetados
  hasEvent?: boolean;         // Flag se houve evento significativo
  eventDescription?: string;  // Descricao do evento
}
```

### 3.4 Lista de Downtime: `DowntimeEntry[]`

Top 5 equipamentos com maior tempo parado:

```typescript
interface DowntimeEntry {
  name: string;           // Nome do equipamento (ex: "ESC-02")
  location: string;       // Shopping/localizacao
  downtime: number;       // Total de horas parado
  percentage: number;     // Percentual do periodo total
}
```

### 3.5 Timeline MTBF: `MTBFTimelineData` (RFC-0154)

Para o grafico de Timeline de Operacao vs Paradas:

```typescript
interface MTBFTimelineSegment {
  startTime: string;           // ISO timestamp inicio
  endTime: string;             // ISO timestamp fim
  durationHours: number;       // Duracao em horas
  state: 'operating' | 'stopped' | 'maintenance';

  // Para segmentos 'stopped':
  failureNumber?: number;      // Numero sequencial da falha
  affectedEquipments?: number; // Equipamentos afetados
  failureType?: string;        // Tipo (Eletrica, Mecanica, etc.)

  // Para segmentos 'operating':
  activeEquipments?: number;   // Equipamentos ativos
}

interface MTBFTimelineData {
  periodStart: string;         // Inicio do periodo (ISO)
  periodEnd: string;           // Fim do periodo (ISO)
  totalEquipment: number;      // Total de equipamentos
  totalHours: number;          // Total de horas no periodo
  segments: MTBFTimelineSegment[];
  operatingHours: number;      // Total de horas operando
  failureCount: number;        // Total de falhas
  mtbfValue: number;           // MTBF calculado
  mttrValue?: number;          // MTTR calculado
}
```

---

## 4. ALARMES E NOTIFICACOES - Dados de Alarmes

### 4.1 Estrutura de Dados: `Alarm`

```typescript
interface Alarm {
  // === IDENTIFICACAO ===
  id: string;                  // ID unico do alarme
  customerId: string;          // ID do cliente
  customerName: string;        // Nome do shopping
  source: string;              // Dispositivo de origem (ex: "ESC-02")

  // === CLASSIFICACAO ===
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  state: 'OPEN' | 'ACK' | 'SNOOZED' | 'ESCALATED' | 'CLOSED';

  // === CONTEUDO ===
  title: string;               // Titulo do alarme
  description: string;         // Descricao detalhada
  tags: Record<string, string>; // Tags customizadas (ex: {tipo: "comunicacao"})

  // === TEMPORALIDADE ===
  firstOccurrence: string;     // ISO timestamp primeira ocorrencia
  lastOccurrence: string;      // ISO timestamp ultima ocorrencia
  occurrenceCount: number;     // Contagem de ocorrencias

  // === WORKFLOW ===
  acknowledgedAt?: string;     // Quando foi reconhecido
  acknowledgedBy?: string;     // Usuario que reconheceu
  snoozedUntil?: string;       // Adiado ate quando
  closedAt?: string;           // Quando foi fechado
  closedBy?: string;           // Usuario que fechou
  closedReason?: string;       // Motivo do fechamento
}
```

### 4.2 Estatisticas de Alarmes: `AlarmStats`

```typescript
interface AlarmStats {
  total: number;                           // Total de alarmes
  bySeverity: Record<AlarmSeverity, number>; // Por severidade
  byState: Record<AlarmState, number>;     // Por estado
  openCritical: number;                    // Criticos abertos
  openHigh: number;                        // Altos abertos
  last24Hours: number;                     // Ultimas 24h
  trendData?: AlarmTrendPoint[];           // Tendencia para grafico
}

interface AlarmTrendPoint {
  timestamp: number;
  label: string;
  count: number;
}
```

### 4.3 Severidades e Estados

**Severidades:**
| Codigo | Label | Cor | Prioridade |
|--------|-------|-----|------------|
| `CRITICAL` | Critico | Vermelho (#ef4444) | 1 (mais alta) |
| `HIGH` | Alto | Laranja (#f97316) | 2 |
| `MEDIUM` | Medio | Amarelo (#eab308) | 3 |
| `LOW` | Baixo | Azul (#3b82f6) | 4 |
| `INFO` | Informativo | Cinza (#6b7280) | 5 (mais baixa) |

**Estados:**
| Codigo | Label | Descricao |
|--------|-------|-----------|
| `OPEN` | Aberto | Alarme ativo, requer atencao |
| `ACK` | Reconhecido | Alarme visto, em tratamento |
| `SNOOZED` | Adiado | Temporariamente silenciado |
| `ESCALATED` | Escalado | Enviado para nivel superior |
| `CLOSED` | Fechado | Resolvido ou descartado |

---

## 5. APIs NECESSARIAS

### 5.1 Endpoints Sugeridos

```
GET /api/operational/equipment
  Query params: customerId, period, status, type
  Response: EquipmentCardData[]

GET /api/operational/equipment/stats
  Query params: customerId, period
  Response: EquipmentStats

GET /api/operational/dashboard/kpis
  Query params: customerId, period
  Response: DashboardKPIs

GET /api/operational/dashboard/trend
  Query params: customerId, period
  Response: TrendDataPoint[]

GET /api/operational/dashboard/downtime
  Query params: customerId, period, limit=5
  Response: DowntimeEntry[]

GET /api/operational/dashboard/mtbf-timeline
  Query params: customerId, period
  Response: MTBFTimelineData

GET /api/operational/alarms
  Query params: customerId, severity[], state[], fromDate, toDate, search
  Response: Alarm[]

GET /api/operational/alarms/stats
  Query params: customerId
  Response: AlarmStats

POST /api/operational/alarms/:id/acknowledge
POST /api/operational/alarms/:id/close
POST /api/operational/alarms/:id/escalate
```

### 5.2 Integracao com ThingsBoard

Dados que podem vir diretamente do ThingsBoard:

| Dado | API ThingsBoard |
|------|-----------------|
| Lista de devices | `/api/customer/{customerId}/deviceInfos` |
| Telemetria atual | `/api/plugins/telemetry/{entityType}/{entityId}/values/timeseries` |
| Alarmes | `/api/alarm/{entityType}/{entityId}` |
| Atributos | `/api/plugins/telemetry/{entityType}/{entityId}/values/attributes` |

Dados que precisam ser **CALCULADOS** pelo backend:

| Dado | Logica |
|------|--------|
| MTBF | Historico de tempo entre falhas |
| MTTR | Historico de tempo de reparo |
| Disponibilidade | MTBF / (MTBF + MTTR) |
| Tendencias | Comparacao com periodo anterior |
| offlineCriticalCount | Devices offline > 24h |
| recurrentFailuresCount | Devices com 3+ falhas no periodo |

---

## 6. CHECKLIST DE DADOS

### 6.1 Lista Geral

- [ ] Device ID e nome
- [ ] Tipo (escada/elevador)
- [ ] Status atual (online/offline/maintenance)
- [ ] Disponibilidade calculada
- [ ] MTBF calculado
- [ ] MTTR calculado
- [ ] Flag de reversao
- [ ] Contagem de alertas recentes
- [ ] Nome do shopping
- [ ] Localizacao especifica

### 6.2 Dashboard Gerencial

- [ ] Disponibilidade da frota
- [ ] Tendencia de disponibilidade
- [ ] MTBF medio
- [ ] MTTR medio
- [ ] Contadores por status
- [ ] Alertas ativos
- [ ] Equipamentos offline > 24h
- [ ] Equipamentos com falhas recorrentes
- [ ] Tempo medio em cada status
- [ ] Dados de tendencia diaria
- [ ] Top 5 downtime
- [ ] Timeline MTBF

### 6.3 Alarmes

- [ ] Lista de alarmes com filtros
- [ ] Severidade e estado
- [ ] Timestamps (primeira/ultima ocorrencia)
- [ ] Contagem de ocorrencias
- [ ] Workflow (acknowledge/close/escalate)
- [ ] Estatisticas agregadas
- [ ] Tendencia de alarmes

---

## 7. PERGUNTAS PARA O BACKEND

1. **Historico de Falhas**: Temos registro de quando cada equipamento falhou e quando voltou a funcionar?

2. **Tempo de Manutencao**: Temos registro do tempo gasto em cada manutencao?

3. **Reversao**: Ja temos telemetria de deteccao de reversao para escadas?

4. **Alertas por Device**: Conseguimos contar alarmes ativos filtrados por device?

5. **Offline > 24h**: Temos como identificar devices que estao offline ha mais de 24h?

6. **Falhas Recorrentes**: Conseguimos identificar devices com 3+ falhas em um periodo?

7. **Tempo em Status**: Temos historico de transicoes de status?

8. **Integracao de Alarmes**: Os alarmes do ThingsBoard ja estao sendo populados com severidade correta?

---

## 8. PROXIMOS PASSOS

1. **Backend**: Revisar este briefing e identificar gaps de dados
2. **Alarmes**: Definir regras de severidade e estados
3. **Frontend**: Ajustar mock data para formato acordado
4. **Integracao**: Definir endpoints e contrato de API
5. **Testes**: Validar com dados reais

---

## Historico de Revisoes

| Data | Versao | Autor | Alteracoes |
|------|--------|-------|------------|
| 2026-01-29 | 1.0 | Claude | Documento inicial |

