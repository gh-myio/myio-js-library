👍 Pontos fortes

Contexto claro entre hoje (REST) e futuro (WebSocket)

Tem diagrama da arquitetura atual com polling a cada 8s, batches, delays, e uma tabela de problemas (latência mínima, carga, etc.).

A arquitetura proposta com um único WebSocketService também está bem ilustrada.

Explicação da API WebSocket do ThingsBoard

Mostra tanto o uso de TIMESERIES quanto de ENTITY_DATA com entityList, latestValues, etc.

Mostra estruturas reais de resposta (subscriptionId, cmdId, data, update), o que ajuda muito pra implementação.

Interface do WebSocketService bem desenhada

connect, disconnect, subscribe, unsubscribe, isConnected, callbacks de onData, onConnectionChange, onError.

Dá pra plugar direto no que você já tem de RealTimeService hoje com pouca dor.

Skeleton de implementação

A classe RealTimeWebSocketService com autenticação, subscribe via ENTITY_DATA, processDataUpdate, scheduleReconnect, etc. já é um bom esqueleto pra virar código de produção.

Estratégia de migração em fases

Fase 1: implementação paralela com feature flag.

Fase 2: A/B / subset de usuários.

Fase 3: migração total e remoção posterior do polling.

Isso casa direitinho com o que a gente vinha falando no RFC-0093B.

Análise de riscos e comparação REST x WS

Tabelas de comparação de latência, banda, requests/min, etc.

Seções de risco com mitigação (token expira, estabilidade, leaks, compatibilidade).

No geral: dá pra usar esse estudo como base direta pra você pedir pro Code Assist gerar código e um novo RFC “oficial”.

⚠️ Pontos de atenção / ajustes que eu faria

Vou separar em “conceituais” e “pra virar RFC definitivo”.

1. Escolher UMA abordagem de comando WebSocket

O estudo mostra:

Autenticação via authCmd + token

type: "TIMESERIES" para um device

type: "ENTITY_DATA" com entityList para vários devices

Isso é ótimo como catálogo de opções, mas pro RFC oficial eu fixaria:

Padrão único para Equipments Grid:

Recomendo usar ENTITY_DATA com entityList para a grid (menos mensagens, mais limpo).

Guardar TIMESERIES só como apêndice ou outro RFC (ex: para widgets mais simples).

Senão o dev que for implementar fica com “e aí, qual dos dois eu uso?”.

2. Uniformizar o endpoint e autenticação

No estudo aparecem duas ideias de URL:

wss://host/api/ws + authCmd

wss://host/api/ws/plugins/telemetry?token=JWT (implícito ali nas referências)

Eu faria o RFC “mandatório” assim:

Escolher 1 padrão (por ex.: wss://host/api/ws/plugins/telemetry?token=JWT ou wss://host/api/ws + authCmd).

Explicar em 2 linhas:

Qual URL usar em produção.

Se manda authCmd ou se o token na query string já autentica.

Pra Code Assist isso vira instrução direta, sem ambiguidade.

3. Link direto com o RFC-0093 original

Hoje o estudo se cita como “Related RFCs: RFC-0093”, mas ainda não diz explicitamente:

“Este documento substitui o módulo de REST polling definido em RFC-0093-Equipments-Grid-RealTime-Mode-FULL-IMPLEMENTATION.md.”

Eu colocaria logo no começo algo assim:

This document supersedes the REST polling real-time mode in RFC-0093 and defines WebSocket as the new default. REST remains only as a fallback engine.

E já deixar um item de migração com:

Funções que saem: fetchAllDevicesPowerAndUpdate, timers de polling, etc.

Funções novas: RealTimeWebSocketService.connect/subscribe, etc.

4. Amarrar o estudo com o estado do widget (STATE)

O estudo fala bastante do serviço de WebSocket, mas pouco da integração com o “mundo real” do EQUIPMENTS:

Como o onData(deviceId, key, value, timestamp) vai alimentar:

STATE.realTimePowerMap

STATE.cardsByDeviceId

UI de ícones, cores, badges, etc.

Como lidar com filtros / paginação:

Ao mudar filtro, chamar unsubscribe do cmdId anterior e subscribe com nova lista.

Usar debounce (por ex. 300–500ms) para evitar flood de subscribe em cada tecla do search.

Eu sugiro adicionar uma seção “Integration with Equipments Grid” com:

Fluxo: filter/pagination change → recompute visible deviceIds → websocketService.subscribe(visibleIds).

E um pseudocódigo curto mostrando essa cola.

5. Reconnect + token refresh mais normativos

O estudo cita:

autoReconnect, reconnectDelay, backoff, risco de token expirar etc.

Pra virar RFC, eu colocaria coisas tipo:

Backoff fixo: 1s, 2s, 5s, 10s, 30s, limite X tentativas antes de fallback.

Token refresh:

“If jwtProvider() changes token (e.g. via MYIO auth refresh), the next reconnect must send the new token.”

Ou seja: sair do “pode fazer assim” e virar “deve funcionar assim”.

6. Tornar explícito o modo REST como fallback

Hoje o estudo desenha bem os dois mundos (WS e polling), mas eu adicionaria:

Uma flag de engine que o RFC 0093B já sugeria:

type RealTimeEngine = 'websocket' | 'rest';

const REALTIME_ENGINE: RealTimeEngine = 'websocket'; // default

Regra de fallback:

Se WebSocket falhar X vezes seguidas → logar evento, mostrar toast, mudar RealTimeEngine para 'rest' naquela sessão.
