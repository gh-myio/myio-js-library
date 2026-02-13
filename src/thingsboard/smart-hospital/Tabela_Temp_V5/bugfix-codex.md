# Bugfix: Normalização UTC no frontend (Tabela_Temp_V5)

## Resumo
O backend `Temperature_Report-CO2 v3.1` já retorna timestamps em **UTC** (sem conversão). O frontend `Tabela_Temp_V5\controller.js` ainda aplica um ajuste fixo de **-6 horas** em `time_interval`, o que desloca os dados para o dia/horário errado e pode causar gaps/interpolações indevidas. Além disso, a função `brDatetime()` está formatando usando getters UTC e **não** converte para horário Brasil, deixando a exibição desalinhada em relação ao esperado.

## Evidências
- Backend v3.1: `src/thingsboard/smart-hospital/Temperature_Report-CO2/v3.1/nodered.controller.v3.1.js`
  - Comentário: "All timestamps in UTC (no timezone conversion)".
  - `time_interval` é usado e gerado em UTC.
- Frontend: `src/thingsboard/smart-hospital/Tabela_Temp_V5/controller.js`
  - Normalização fixa de `-6h` aplicada em cada leitura:
    - bloco com comentário `NORMALIZAÇÃO DE TIMEZONE: -6h no time_interval`.
  - `brDatetime()` usa `getUTC*()` e não aplica `America/Sao_Paulo`.

## Impacto
- Dados deslocados 6 horas para trás no relatório.
- Possível perda/inversão de registros de fronteira de dia.
- Interpolação e agrupamentos por dia ficam inconsistentes.

## Correção sugerida
1. **Remover** a subtração fixa de 6 horas no `time_interval`.
2. **Ajustar** `brDatetime()` para converter UTC -> Brasil (UTC-3) usando `toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', ... })`.
3. Revisar qualquer outro cálculo de datas para garantir que o input do backend (UTC) permaneça em UTC até o momento de exibição.

## Referência de comparação
A versão `src/thingsboard/smart-hospital/Tabela_Temp_V5/v2/controller.v2.js` já mostra a estratégia correta:
- Removeu o "-6h hack".
- `brDatetime()` converte para `America/Sao_Paulo`.
