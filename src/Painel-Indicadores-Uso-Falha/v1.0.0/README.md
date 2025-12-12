# Painel de Indicadores Operacionais v1.0.0

Widget ThingsBoard para monitoramento de escadas rolantes e elevadores com KPIs operacionais.

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `controller.js` | Controlador principal com toda a lógica e dados mock |
| `template.html` | Template HTML para teste standalone |
| `styles.css` | Estilos CSS completos |
| `settings.json` | Schema de configurações para ThingsBoard |
| `widget-bundle.json` | Bundle para importação no ThingsBoard |

## Teste Local (Standalone)

1. Abra `template.html` em um navegador moderno
2. O painel será carregado com dados mock automaticamente

```bash
# Ou use um servidor local
npx serve .
```

## Funcionalidades

### KPIs Calculados

- **Disponibilidade (%)**: `MTBF / (MTBF + MTTR) × 100`
- **MTBF (h)**: `(Tempo Operação - Tempo Manutenção) / Nº Paradas`
- **MTTR (h)**: `Tempo Manutenção / Nº Paradas`

### Cards de Equipamento

- Status Online/Offline
- Gauge de disponibilidade
- Métricas MTBF/MTTR
- Indicadores elétricos (frequência, potência, tensão)
- Alerta de inversão de fase
- Contador de alertas ativos

### Visão Consolidada

- Total de equipamentos
- Online/Offline
- Médias de disponibilidade, MTBF, MTTR
- Total de alertas ativos

### Sistema de Alertas

- Equipamento offline
- Inversão de fase
- Anomalia de frequência
- Histórico com acknowledge

### Exportação

- CSV (download direto)
- PDF (impressão via navegador)

## Dados Mock

O arquivo `controller.js` inclui 8 equipamentos mockados:

| ID | Nome | Tipo | Status |
|----|------|------|--------|
| esc-001 | Escada Rolante 01 | Escalator | Online |
| esc-002 | Escada Rolante 02 | Escalator | Online |
| esc-003 | Escada Rolante 03 | Escalator | **Offline** |
| esc-004 | Escada Rolante 04 | Escalator | Online |
| elev-001 | Elevador 01 | Elevator | Online |
| elev-002 | Elevador 02 | Elevator | Online |
| elev-003 | Elevador 03 | Elevator | Online |
| elev-004 | Elevador 04 | Elevator | **Offline** |

## Importação no ThingsBoard

### Método 1: Widget Bundle

1. Acesse ThingsBoard > Widgets Library
2. Clique em "+" > "Import widgets bundle"
3. Selecione `widget-bundle.json`
4. Após importar, edite o widget e cole:
   - `controller.js` na aba JavaScript
   - `styles.css` na aba CSS
   - HTML básico: `<div id="widget-container"></div>`

### Método 2: Manual

1. Crie um novo widget do tipo "Latest values"
2. Cole o conteúdo de `controller.js` na aba JavaScript
3. Cole o conteúdo de `styles.css` na aba CSS
4. Na aba HTML, adicione: `<div id="widget-container"></div>`
5. Configure as datasources com as telemetry keys necessárias

## Telemetry Keys Necessárias

```
status              - boolean
operationTime       - number (minutos)
maintenanceTime     - number (minutos)
stopCount           - number
phaseReversal       - boolean
gridFrequency       - number (Hz)
powerDemand         - number (kW)
currentR            - number (A)
currentS            - number (A)
currentT            - number (A)
voltageRS           - number (V)
voltageST           - number (V)
voltageTR           - number (V)
energyConsumption   - number (kWh)
```

## Configurações Disponíveis

| Categoria | Configuração | Padrão |
|-----------|-------------|--------|
| Geral | Título | "Painel de Indicadores Operacionais" |
| Geral | Intervalo de atualização | 60000ms |
| Geral | Mostrar visão consolidada | true |
| Inatividade | Ativar detecção | true |
| Inatividade | Hora início | 22:00 |
| Inatividade | Hora fim | 05:00 |
| Alertas | Ativar alertas | true |
| Alertas | Threshold frequência | 5% |
| Display | Cards por linha | 4 |
| Display | Mostrar indicadores elétricos | true |

## Próximos Passos (Produção)

1. Remover dados mock do `controller.js`
2. Implementar `self.onDataUpdated` para receber telemetria real
3. Configurar Rule Chain para alertas por e-mail
4. Ajustar device profiles no ThingsBoard
