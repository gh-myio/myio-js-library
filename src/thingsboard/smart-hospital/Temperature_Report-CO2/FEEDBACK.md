# Feedback - Temperature_Report-CO2

Este documento resume os possíveis problemas encontrados nos Function nodes do Node-RED e na query do Postgres em:
`src/thingsboard/smart-hospital/Temperature_Report-CO2`.

## Pontos críticos/altos

1. Inconsistência de timezone entre SQL e Node-RED pode gerar "SEM DADOS" falsos
   - O SQL calcula `time_interval` em `America/Sao_Paulo` (horário local). O controller cria slots e chaves usando `toISOString()` (UTC). Se o Node-RED estiver em UTC ou outro fuso, o `new Date(...)` pode deslocar horas, quebrando o `createSlotKey` e a comparação com `resultsMap`.
   - Arquivos: `v2/query.sql`, `v2/nodered.controller.v2.js` (`toSaoPauloTime`, `generateExpectedSlots`, `createSlotKey`).
   - Sintoma: leituras existentes aparecem como "SEM DADOS".

2. `dateEnd` normalizado para início do dia pode remover o dia final
   - Em `generateExpectedSlots`, `end` é ajustado para 00:00 do dia. Se `dateEnd` vier com hora durante o dia, o loop `while (currentDate < end)` não gera slots daquele dia.
   - Arquivo: `v2/nodered.controller.v2.js` (`generateExpectedSlots`).
   - Sintoma: relatório vazio ou faltando o último dia quando `dateEnd` não for meia-noite.

## Pontos médios

3. Regex de acentos possivelmente corrompida (`Ã€-Ã¿`)
   - A classe `[wÃ€-Ã¿\s\d-]` sugere bytes UTF-8 interpretados como Latin-1. Isso pode falhar com acentos reais e comprometer `parseDeviceName`.
   - Arquivo: `v2/nodered.controller.v2.js` (`parseDeviceName`).
   - Sintoma: `deviceName` errado ou ajuste não aplicado.

4. `Get-slave-ids.v2.js` assume `flow.get('slave_data')` sempre válido
   - Se `slave_data` estiver `null/undefined`, `storeDevices.find` lança exceção.
   - Arquivo: `v2/Get-slave-ids.v2.js`.
   - Sintoma: erro no Function node e fluxo interrompido.

5. `dateStart/dateEnd` inválidos resultam em slots vazios sem aviso
   - `new Date(undefined)` gera `Invalid Date`. O loop não roda e retorna payload vazio sem warning.
   - Arquivo: `v2/nodered.controller.v2.js`.
   - Sintoma: payload final vazio silenciosamente.

## Pontos baixos

6. Ajuste multiplica somente com `x` minúsculo
   - Se o operador for `X`, não aplica o ajuste.
   - Arquivo: `v2/nodered.controller.v2.js` (`applyAdjustment`).

7. `slave_id IN ({{{ msg.payload.slaveIds }}})` sem sanitização
   - Se `slaveIds` vier como string malformada, a query quebra (ou pior). Provável que o fluxo controle, mas é frágil.
   - Arquivo: `v2/query.sql`.

## Observação sobre o original

- No original (`original/nodered.controller.js`) a regex está como `[\wÀ-ÿ\s\d-]`, que é a forma correta para incluir acentos. Na v2 essa faixa aparece corrompida (`Ã€-Ã¿`).

