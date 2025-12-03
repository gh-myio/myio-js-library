# RFC-0093: WebSocket Migration Study - Real-Time Telemetry via ThingsBoard WebSocket API

- **Status**: Draft (Study)
- **Created**: 2025-12-03
- **Author**: MyIO Team
- **Related RFCs**: RFC-0093 (Equipments Grid Real-Time Mode)

## Executive Summary

Este documento analisa a viabilidade de migrar o modo real-time do widget EQUIPMENTS de polling REST API para WebSocket API do ThingsBoard, visando true real-time updates com menor latência e carga no servidor.

## Current Implementation (REST Polling)

### Arquitetura Atual

```
┌─────────────────────────────────────────────────────────────────┐
│                     EQUIPMENTS Widget                            │
│                                                                  │
│  ┌─────────────────────┐                                        │
│  │  RealTimeService    │    Polling Loop (8s interval)          │
│  │  ─────────────────  │                                        │
│  │  - setInterval 8s   │───▶ For each device:                   │
│  │  - batch 10 devices │     GET /api/plugins/telemetry/DEVICE  │
│  │  - 100ms delay      │         /{id}/values/timeseries        │
│  └─────────────────────┘         ?keys=power&limit=1            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Problemas do Polling

| Problema | Impacto |
|----------|---------|
| Latência mínima de 8s | Não é true real-time |
| N chamadas HTTP por ciclo | Alto consumo de banda e CPU |
| Sem garantia de ordem | Dados podem chegar fora de ordem |
| Overhead de conexão | TCP handshake a cada request |
| Carga no servidor | Múltiplas queries ao DB por ciclo |

### Métricas Atuais (Estimativa)

Para 50 dispositivos visíveis:
- **Requests por ciclo**: 50 (5 batches de 10)
- **Requests por minuto**: ~375 (50 × 60/8)
- **Latência média**: 8s + tempo de resposta (~200ms)

---

## Proposed Implementation (WebSocket)

### Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                     EQUIPMENTS Widget                            │
│                                                                  │
│  ┌─────────────────────┐    Single WebSocket Connection         │
│  │  WebSocketService   │                                        │
│  │  ─────────────────  │    ws://host/api/ws                    │
│  │  - single connection│◀──────────────────────────────────────▶│
│  │  - N subscriptions  │    Push updates (instant)              │
│  │  - auto-reconnect   │                                        │
│  └─────────────────────┘                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Benefícios do WebSocket

| Benefício | Descrição |
|-----------|-----------|
| True Real-Time | Updates instantâneos (< 100ms latência) |
| Eficiência | Uma conexão para N dispositivos |
| Menor carga | Push em vez de pull |
| Ordenação garantida | Mensagens em ordem |
| Bi-direcional | Pode enviar/receber na mesma conexão |

---

## ThingsBoard WebSocket API

### Connection URL

```javascript
const WS_URL = `wss://${host}/api/ws`;
// ou com token na URL:
const WS_URL = `wss://${host}/api/ws/plugins/telemetry?token=${JWT_TOKEN}`;
```

### Authentication Command

```javascript
// Após conectar, enviar em até 10 segundos:
const authCmd = {
  authCmd: {
    cmdId: 0,
    token: JWT_TOKEN
  }
};
ws.send(JSON.stringify(authCmd));
```

### Subscription Commands

#### Opção 1: TIMESERIES (Latest Value)

```javascript
// Subscribe para telemetria de um dispositivo
const subscribeCmd = {
  cmds: [
    {
      entityType: "DEVICE",
      entityId: "device-uuid-here",
      scope: "LATEST_TELEMETRY",
      cmdId: 1,
      type: "TIMESERIES",
      keys: "power"
    }
  ]
};
ws.send(JSON.stringify(subscribeCmd));
```

#### Opção 2: ENTITY_DATA (Múltiplos Dispositivos)

```javascript
// Subscribe para múltiplos dispositivos com Entity Data Query
const entityDataCmd = {
  cmds: [
    {
      cmdId: 1,
      type: "ENTITY_DATA",
      query: {
        entityFilter: {
          type: "entityList",
          entityType: "DEVICE",
          entityList: ["device-1-uuid", "device-2-uuid", "device-3-uuid"]
        },
        entityFields: [
          { type: "ENTITY_FIELD", key: "name" }
        ],
        latestValues: [
          { type: "TIME_SERIES", key: "power" }
        ]
      }
    }
  ]
};
ws.send(JSON.stringify(entityDataCmd));
```

### Response Format

```javascript
// Resposta de update de telemetria:
{
  "subscriptionId": 1,
  "data": {
    "power": [
      [1733234567890, "3.42"]  // [timestamp, value]
    ]
  }
}

// Resposta de Entity Data:
{
  "cmdId": 1,
  "data": {
    "data": [
      {
        "entityId": { "entityType": "DEVICE", "id": "device-uuid" },
        "latest": {
          "TIME_SERIES": {
            "power": { "ts": 1733234567890, "value": "3.42" }
          }
        }
      }
    ],
    "totalPages": 1,
    "totalElements": 1,
    "hasNext": false
  },
  "update": [...] // Updates subsequentes
}
```

### Unsubscribe Commands

```javascript
// Para parar de receber updates:
const unsubscribeCmd = {
  cmds: [
    {
      cmdId: 1,
      type: "ENTITY_DATA_UNSUBSCRIBE"
    }
  ]
};
ws.send(JSON.stringify(unsubscribeCmd));
```

---

## Implementation Design

### WebSocketService Interface

```typescript
interface WebSocketServiceConfig {
  /** WebSocket URL */
  wsUrl: string;

  /** JWT token for authentication */
  token: string;

  /** Telemetry keys to subscribe */
  keys: string[];

  /** Callback when data arrives */
  onData: (deviceId: string, key: string, value: number, timestamp: number) => void;

  /** Callback when connection status changes */
  onConnectionChange: (connected: boolean) => void;

  /** Callback for errors */
  onError: (error: Error) => void;

  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;

  /** Reconnect delay in ms */
  reconnectDelay?: number;
}

interface WebSocketService {
  /** Connect to WebSocket server */
  connect(): Promise<void>;

  /** Disconnect and cleanup */
  disconnect(): void;

  /** Subscribe to device telemetry */
  subscribe(deviceIds: string[]): void;

  /** Unsubscribe from device telemetry */
  unsubscribe(deviceIds: string[]): void;

  /** Check connection status */
  isConnected(): boolean;

  /** Get list of subscribed devices */
  getSubscribedDevices(): string[];
}
```

### Implementation Skeleton

```javascript
class RealTimeWebSocketService {
  constructor(config) {
    this.config = config;
    this.ws = null;
    this.cmdIdCounter = 0;
    this.subscriptions = new Map(); // cmdId -> deviceIds
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.authenticate();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        this.config.onConnectionChange(false);
        if (this.config.autoReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.config.onError(error);
        reject(error);
      };
    });
  }

  authenticate() {
    const authCmd = {
      authCmd: {
        cmdId: this.nextCmdId(),
        token: this.config.token
      }
    };
    this.ws.send(JSON.stringify(authCmd));
  }

  subscribe(deviceIds) {
    const cmdId = this.nextCmdId();

    // Usar Entity Data Query para múltiplos dispositivos
    const subscribeCmd = {
      cmds: [{
        cmdId: cmdId,
        type: "ENTITY_DATA",
        query: {
          entityFilter: {
            type: "entityList",
            entityType: "DEVICE",
            entityList: deviceIds
          },
          entityFields: [
            { type: "ENTITY_FIELD", key: "name" }
          ],
          latestValues: this.config.keys.map(key => ({
            type: "TIME_SERIES",
            key: key
          }))
        }
      }]
    };

    this.subscriptions.set(cmdId, deviceIds);
    this.ws.send(JSON.stringify(subscribeCmd));

    console.log(`[WebSocket] Subscribed to ${deviceIds.length} devices (cmdId: ${cmdId})`);
    return cmdId;
  }

  unsubscribe(cmdId) {
    const unsubscribeCmd = {
      cmds: [{
        cmdId: cmdId,
        type: "ENTITY_DATA_UNSUBSCRIBE"
      }]
    };

    this.ws.send(JSON.stringify(unsubscribeCmd));
    this.subscriptions.delete(cmdId);

    console.log(`[WebSocket] Unsubscribed (cmdId: ${cmdId})`);
  }

  handleMessage(message) {
    // Handle authentication response
    if (message.authCmd) {
      if (message.authCmd.success) {
        console.log('[WebSocket] Authentication successful');
        this.config.onConnectionChange(true);
      } else {
        console.error('[WebSocket] Authentication failed');
        this.config.onError(new Error('Authentication failed'));
      }
      return;
    }

    // Handle data updates
    if (message.cmdId && message.data) {
      this.processDataUpdate(message);
    }

    // Handle updates (for subscriptions)
    if (message.update) {
      this.processDataUpdate({ ...message, data: { data: message.update } });
    }
  }

  processDataUpdate(message) {
    const { cmdId, data } = message;

    if (!data?.data) return;

    data.data.forEach(item => {
      const deviceId = item.entityId?.id;
      if (!deviceId) return;

      const latest = item.latest?.TIME_SERIES || {};

      Object.entries(latest).forEach(([key, entry]) => {
        const value = parseFloat(entry.value) || 0;
        const timestamp = entry.ts || Date.now();

        this.config.onData(deviceId, key, value, timestamp);
      });
    });
  }

  disconnect() {
    if (this.ws) {
      // Unsubscribe from all
      this.subscriptions.forEach((_, cmdId) => {
        this.unsubscribe(cmdId);
      });

      this.ws.close();
      this.ws = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  nextCmdId() {
    return ++this.cmdIdCounter;
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
```

---

## Migration Strategy

### Phase 1: Parallel Implementation (Low Risk)

1. Criar `RealTimeWebSocketService` como alternativa ao polling
2. Adicionar feature flag para alternar entre modos
3. Testar em ambiente de desenvolvimento

```javascript
const REALTIME_CONFIG = {
  // ... existing config
  USE_WEBSOCKET: false, // Feature flag
};

function startRealTimeMode() {
  if (REALTIME_CONFIG.USE_WEBSOCKET) {
    startWebSocketMode();
  } else {
    startPollingMode(); // Current implementation
  }
}
```

### Phase 2: A/B Testing (Medium Risk)

1. Habilitar WebSocket para subset de usuários
2. Monitorar métricas (latência, erros, uso de recursos)
3. Coletar feedback

### Phase 3: Full Migration (After Validation)

1. WebSocket como padrão
2. Polling como fallback
3. Remover polling após período de estabilidade

---

## Comparison Table

| Aspecto | REST Polling | WebSocket |
|---------|--------------|-----------|
| **Latência** | 8s (intervalo) + RTT | < 100ms |
| **Conexões** | N por ciclo | 1 persistente |
| **Servidor** | N queries/ciclo | Push on change |
| **Banda** | Alta (headers HTTP) | Baixa (frames WS) |
| **Complexidade** | Baixa | Média |
| **Reconnect** | Automático (HTTP) | Implementar |
| **Escalabilidade** | Limitada | Alta |
| **Browser Support** | Universal | IE10+ (99%+) |
| **Debug** | Fácil (DevTools Network) | Médio (WS frames) |

---

## Risks and Mitigations

### Risk 1: Connection Stability
**Risco**: WebSocket pode desconectar inesperadamente.
**Mitigação**: Implementar auto-reconnect com exponential backoff.

### Risk 2: Token Expiration
**Risco**: JWT token expira durante conexão.
**Mitigação**: Monitorar token expiry, re-autenticar antes de expirar.

### Risk 3: Memory Leaks
**Risco**: Subscriptions não removidas podem causar memory leaks.
**Mitigação**: Garantir cleanup em `onDestroy`, usar WeakMap se apropriado.

### Risk 4: Browser Compatibility
**Risco**: Browsers antigos não suportam WebSocket.
**Mitigação**: Fallback para polling se WebSocket não disponível.

```javascript
if ('WebSocket' in window) {
  startWebSocketMode();
} else {
  console.warn('WebSocket not supported, falling back to polling');
  startPollingMode();
}
```

---

## Performance Estimates

### Cenário: 50 Dispositivos Visíveis

| Métrica | REST Polling (8s) | WebSocket |
|---------|-------------------|-----------|
| Requests/min | 375 | 0 (após subscribe) |
| Latência média | ~8.2s | < 100ms |
| Banda (estimada) | ~750KB/min | ~5KB/min |
| Conexões TCP | 375/min | 1 |

### Savings

- **Redução de requests**: ~99.7%
- **Redução de latência**: ~98%
- **Redução de banda**: ~99%

---

## Proof of Concept

### Minimal Test Code

```javascript
// Testar conexão WebSocket com ThingsBoard
async function testWebSocketConnection() {
  const JWT_TOKEN = localStorage.getItem('jwt_token');
  const WS_URL = `wss://dashboard.myio-bas.com/api/ws`;

  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('Connected!');

    // Authenticate
    ws.send(JSON.stringify({
      authCmd: { cmdId: 0, token: JWT_TOKEN }
    }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data);

    // After auth success, subscribe to a device
    if (data.authCmd?.success) {
      ws.send(JSON.stringify({
        cmds: [{
          cmdId: 1,
          type: "TIMESERIES",
          entityType: "DEVICE",
          entityId: "YOUR_DEVICE_ID",
          scope: "LATEST_TELEMETRY",
          keys: "power"
        }]
      }));
    }
  };

  ws.onerror = (err) => console.error('Error:', err);
  ws.onclose = () => console.log('Disconnected');

  // Return for manual testing
  return ws;
}

// Run: const ws = await testWebSocketConnection();
```

---

## Conclusion

A migração para WebSocket API é **altamente recomendada** para o modo real-time devido aos benefícios significativos em latência, eficiência e escalabilidade.

### Recomendações

1. **Curto prazo**: Implementar PoC para validar conectividade e formato de dados
2. **Médio prazo**: Implementar `RealTimeWebSocketService` com feature flag
3. **Longo prazo**: Migrar completamente, manter polling como fallback

### Next Steps

- [ ] Validar PoC em ambiente de desenvolvimento
- [ ] Confirmar formato de resposta com ThingsBoard instalado
- [ ] Implementar `RealTimeWebSocketService`
- [ ] Adicionar testes de reconexão
- [ ] Documentar API específica do ambiente MyIO

---

## References

- [ThingsBoard Telemetry Documentation](https://thingsboard.io/docs/user-guide/telemetry/)
- [ThingsBoard WebSocket Commands (GitHub)](https://github.com/thingsboard/thingsboard/blob/release-3.6/application/src/main/java/org/thingsboard/server/service/ws/WsCommandsWrapper.java)
- [Stack Overflow: WebSocket for Multiple Devices](https://stackoverflow.com/questions/56345204/how-to-retrieve-telemetry-for-all-customer-devices-from-thingsboard-via-websocke)
- [GitHub Issue: WebSocket Telemetry Subscription](https://github.com/thingsboard/thingsboard/issues/10595)
- RFC-0093: Equipments Grid Real-Time Mode (Current Implementation)
