# calculateDeviceStatus

Função utilitária para calcular o status de um dispositivo com base no status de conexão e consumo de energia.

## Visão Geral

A função `calculateDeviceStatus` determina o estado operacional de um dispositivo analisando seu status de conexão e valores de consumo de energia, aplicando regras de negócio para classificar o dispositivo em diferentes estados.

## Importação

```javascript
import { calculateDeviceStatus, DeviceStatusType } from 'myio-js-library';
```

## Assinatura

```typescript
calculateDeviceStatus({
  connectionStatus: string,
  lastConsumptionValue: number | null,
  limitOfPowerOnStandByWatts: number,
  limitOfPowerOnAlertWatts: number,
  limitOfPowerOnFailureWatts: number
}): string
```

## Parâmetros

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `connectionStatus` | `"waiting" \| "offline" \| "online"` | Status da conexão do dispositivo |
| `lastConsumptionValue` | `number \| null` | Último valor de consumo em watts (W) |
| `limitOfPowerOnStandByWatts` | `number` | Limite superior para modo standby em watts |
| `limitOfPowerOnAlertWatts` | `number` | Limite superior para modo normal (power_on) em watts |
| `limitOfPowerOnFailureWatts` | `number` | Limite superior para modo de alerta (warning) em watts |

## Retorno

Retorna uma string do enum `DeviceStatusType`:

- `"not_installed"` - Dispositivo aguardando instalação
- `"no_info"` - Dispositivo offline, sem informações
- `"power_on"` - Dispositivo em operação normal
- `"standby"` - Dispositivo em standby (baixo consumo)
- `"warning"` - Dispositivo em estado de alerta (consumo elevado)
- `"failure"` - Dispositivo em estado de falha (consumo crítico)
- `"maintenance"` - Dispositivo requer manutenção (estado inválido)

## Lógica de Decisão

### 1. Dispositivo Aguardando Instalação
```
connectionStatus === "waiting" → NOT_INSTALLED
```

### 2. Dispositivo Offline
```
connectionStatus === "offline" → NO_INFO
```

### 3. Dispositivo Online sem Dados de Consumo
```
connectionStatus === "online" && lastConsumptionValue === null → POWER_ON
```

### 4. Dispositivo Online com Dados de Consumo

#### Standby (Baixo Consumo)
```
0 ≤ consumption ≤ limitOfPowerOnStandByWatts → STANDBY
```

#### Power On (Operação Normal)
```
limitOfPowerOnStandByWatts < consumption ≤ limitOfPowerOnAlertWatts → POWER_ON
```

#### Warning (Alerta - Consumo Elevado)
```
limitOfPowerOnAlertWatts < consumption ≤ limitOfPowerOnFailureWatts → WARNING
```

#### Failure (Falha - Consumo Crítico)
```
consumption > limitOfPowerOnFailureWatts → FAILURE
```

### 5. Estado Inválido
```
Qualquer outro caso → MAINTENANCE
```

## Exemplos de Uso

### Exemplo 1: Dispositivo Aguardando Instalação

```javascript
const status = calculateDeviceStatus({
  connectionStatus: "waiting",
  lastConsumptionValue: null,
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});

console.log(status); // "not_installed"
```

### Exemplo 2: Dispositivo Offline

```javascript
const status = calculateDeviceStatus({
  connectionStatus: "offline",
  lastConsumptionValue: null,
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});

console.log(status); // "no_info"
```

### Exemplo 3: Dispositivo Online sem Dados de Consumo

```javascript
const status = calculateDeviceStatus({
  connectionStatus: "online",
  lastConsumptionValue: null,
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});

console.log(status); // "power_on"
```

### Exemplo 4: Dispositivo em Standby

```javascript
const status = calculateDeviceStatus({
  connectionStatus: "online",
  lastConsumptionValue: 50, // 50W
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});

console.log(status); // "standby"
```

### Exemplo 5: Dispositivo em Operação Normal

```javascript
const status = calculateDeviceStatus({
  connectionStatus: "online",
  lastConsumptionValue: 500, // 500W
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});

console.log(status); // "power_on"
```

### Exemplo 6: Dispositivo em Estado de Alerta

```javascript
const status = calculateDeviceStatus({
  connectionStatus: "online",
  lastConsumptionValue: 1500, // 1500W
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});

console.log(status); // "warning"
```

### Exemplo 7: Dispositivo em Estado de Falha

```javascript
const status = calculateDeviceStatus({
  connectionStatus: "online",
  lastConsumptionValue: 2500, // 2500W
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});

console.log(status); // "failure"
```

## Uso Avançado

### Integração com Componentes de Card

```javascript
import {
  calculateDeviceStatus,
  DeviceStatusType,
  getDeviceStatusInfo
} from 'myio-js-library';

// Calcular status do dispositivo
const deviceStatus = calculateDeviceStatus({
  connectionStatus: device.connectionStatus,
  lastConsumptionValue: device.powerWatts,
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});

// Obter informações completas do status
const statusInfo = getDeviceStatusInfo(deviceStatus);

console.log(statusInfo);
/*
{
  deviceStatus: "warning",
  connectionStatus: "connected",
  cardStatus: "alert",
  deviceIcon: "⚠️",
  connectionIcon: "🟢",
  shouldFlash: true,
  isOffline: false,
  isValid: true
}
*/
```

### Monitoramento em Tempo Real

```javascript
function monitorDevice(device) {
  // Atualizar status a cada 5 segundos
  setInterval(() => {
    const currentStatus = calculateDeviceStatus({
      connectionStatus: device.getConnectionStatus(),
      lastConsumptionValue: device.getCurrentPowerWatts(),
      limitOfPowerOnStandByWatts: device.standbyLimit,
      limitOfPowerOnAlertWatts: device.alertLimit,
      limitOfPowerOnFailureWatts: device.failureLimit
    });

    if (currentStatus === DeviceStatusType.FAILURE) {
      console.warn(`ALERTA: Dispositivo ${device.id} em estado crítico!`);
      sendAlert(device.id, currentStatus);
    }

    updateDeviceUI(device.id, currentStatus);
  }, 5000);
}
```

### Validação de Limites

```javascript
function validateDeviceLimits(device, consumption) {
  const status = calculateDeviceStatus({
    connectionStatus: "online",
    lastConsumptionValue: consumption,
    limitOfPowerOnStandByWatts: device.standbyLimit,
    limitOfPowerOnAlertWatts: device.alertLimit,
    limitOfPowerOnFailureWatts: device.failureLimit
  });

  return {
    isNormal: status === DeviceStatusType.POWER_ON || status === DeviceStatusType.STANDBY,
    needsAttention: status === DeviceStatusType.WARNING,
    critical: status === DeviceStatusType.FAILURE,
    status
  };
}
```

## Tabela de Decisão Completa

| connectionStatus | lastConsumptionValue | Condição | Resultado |
|-----------------|---------------------|----------|-----------|
| `"waiting"` | qualquer | - | `NOT_INSTALLED` |
| `"offline"` | qualquer | - | `NO_INFO` |
| `"online"` | `null` ou `undefined` | - | `POWER_ON` |
| `"online"` | número | `0 ≤ val ≤ standbyLimit` | `STANDBY` |
| `"online"` | número | `standbyLimit < val ≤ alertLimit` | `POWER_ON` |
| `"online"` | número | `alertLimit < val ≤ failureLimit` | `WARNING` |
| `"online"` | número | `val > failureLimit` | `FAILURE` |
| outro | qualquer | - | `MAINTENANCE` |

## Ícones Associados

Cada status possui um ícone visual associado:

| Status | Ícone | Descrição |
|--------|-------|-----------|
| `NOT_INSTALLED` | 📦 | Aguardando instalação |
| `NO_INFO` | ❓️ | Sem informações |
| `POWER_ON` | ⚡ | Operação Normal |
| `STANDBY` | 🔌 | Standby |
| `WARNING` | ⚠️ | Alerta |
| `FAILURE` | 🚨 | Falha |
| `MAINTENANCE` | 🛠️ | Manutenção |

## Funções Relacionadas

- `getDeviceStatusInfo()` - Obtém informações completas sobre um status
- `mapDeviceStatusToCardStatus()` - Mapeia para status de card (ok/alert/fail/unknown)
- `shouldFlashIcon()` - Verifica se ícone deve piscar
- `isDeviceOffline()` - Verifica se dispositivo está offline
- `getDeviceStatusIcon()` - Obtém ícone do status

## Notas Importantes

1. **Unidades de Medida**: Todos os valores de consumo e limites devem estar em **watts (W)**
2. **Validação**: A função valida o `connectionStatus` e retorna `MAINTENANCE` para valores inválidos
3. **Valores Nulos**: `null` e `undefined` são tratados como ausência de dados de consumo
4. **NaN**: Valores de consumo que não podem ser convertidos para número resultam em `MAINTENANCE`
5. **Limites**: Os limites devem ser configurados de acordo com as características de cada dispositivo

## Casos de Erro

### connectionStatus Inválido
```javascript
calculateDeviceStatus({
  connectionStatus: "invalid_status",
  lastConsumptionValue: 100,
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});
// Retorna: "maintenance"
```

### Consumo Inválido (NaN)
```javascript
calculateDeviceStatus({
  connectionStatus: "online",
  lastConsumptionValue: "não é número",
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});
// Retorna: "maintenance"
```

## Versionamento

- **v1.0.0**: Implementação inicial com suporte a todos os status
