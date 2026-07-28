# RFC-0224: Graceful Ingestion Token-Expiry Recovery (toast → session refresh → event)

- Feature Name: `graceful_ingestion_token_expiry_recovery`
- Start Date: 2026-07-17
- RFC PR: (leave this empty)
- Tracking Issue: ED-1028
- Status: **Approved with mandatory changes — consolidated (incorporates Revisão v1, 2026-07-17)**

> **Nota de consolidação.** Este documento é a versão canônica. Ele mantém a
> investigação/evidências do rascunho inicial (§1–§5) e **substitui o sketch
> original de implementação** pela arquitetura aprovada na Revisão v1 (§6 em
> diante): distinção `401`/`403`, single-flight por escopo, invalidação por
> geração, validação no endpoint de dados, atualização atômica de credenciais,
> eventos versionados sem segredos e sem reload automático como padrão.

## Summary

Quando o usuário permanece no painel **Shopping v-5.2.0** ou nos dashboards de
**Head Office** e continua chamando os endpoints da Ingestion API, o **token de
acesso expira** e as chamadas passam a falhar. Hoje isso é tratado de forma
inconsistente: alguns call sites fazem **`window.location.reload()`**, outros
falham **silenciosamente**, e o evento que deveria coordenar a renovação
(`myio:token-expired`) é **disparado mas não tem consumidor** — é andaime morto.

Este RFC define uma recuperação **centralizada, coordenada por escopo de
autenticação, com no máximo uma repetição por operação lógica**, que:

1. classifica corretamente a falha (`401` = candidato a token inválido; `403`
   só entra no fluxo com evidência explícita de token expirado);
2. coordena a recuperação por `authScopeId` (host + clientId via hash **opaco**),
   não globalmente;
3. invalida o token com **contador de geração** (uma promise antiga de `/auth`
   nunca sobrescreve um token novo);
4. **valida a recuperação repetindo o request de DADOS** — `session-refreshed` só
   é emitido depois que a chamada de dados autenticada tem sucesso;
5. relê credenciais do ThingsBoard `SERVER_SCOPE` **apenas** se o re-auth/retry
   falhar (modo b), substituindo a instância de auth **atomicamente**;
6. informa o usuário via **toasts no adaptador de UI** e emite **eventos
   versionados, sem segredos**;
7. **nunca recarrega a página automaticamente** por padrão — na falha final,
   mantém os dados renderizados e oferece ação manual.

Toasts e `CustomEvent` pertencem ao **adaptador do dashboard**, não à primitiva da
biblioteca (que permanece testável em Node/jsdom).

## 1. Como a primitiva de autenticação funciona

**Arquivo:** `src/services/ingestion/buildMyioIngestionAuth.ts` (fonte TS, entrada
da build; existe um twin `.js` mantido à mão; `AuthClient.ts` a encapsula).

- **Token é cacheado** num `Map` de **escopo de módulo**, indexado hoje por
  `dataApiHost:clientId:clientSecret`. Instâncias com a mesma config compartilham
  `token`, `expiresAt`, `inFlight`.
- **Auto-refresh é só por tempo de relógio local** (`getToken()` re-autentica
  quando `now() >= expiresAt - renewSkew`). A primitiva **não recebe a resposta da
  chamada de dados**, então não sabe que o bearer foi revogado/recusado antes de
  `expiresAt`.
- **Single-flight** existe via `cache.inFlight`.
- `requestNewToken()` faz POST `{ client_id, client_secret }` em `/auth` com
  retry exponencial.
- **Lacuna central:** a primitiva **não reage a um `401/403` downstream** — segue
  servindo o token cacheado. O único lever atual é `clearCache()` + `getToken()`.

### Sutilezas verificadas (a corrigir na primitiva)

- `clearCache()` faz `inFlight = null` mas **não cancela** o `fetch('/auth')` já
  iniciado — a promise antiga ainda resolve e pode **sobrescrever** token novo.
- `clearAllAuthCaches()` faz `globalCache.clear()`; instâncias existentes ficam
  ligadas a **entradas órfãs** e não passam a compartilhar uma nova entrada.
- `getAuthCacheStats()` retorna as **chaves do cache** — e a chave contém
  `clientSecret` → **risco de vazamento de segredo** em diagnóstico/log.
- O twin `.js` exige **decisão explícita de compatibilidade** (não assumir
  manutenção manual dupla).

### A questão do `const` — resolvida

Os `const` de credenciais **não** são o bloqueio: o closure re-posta
`client_id`/`client_secret` no `/auth` quando precisa de token novo.

- **Modo (a)** — token expirado, creds válidas server-side: recuperável com
  invalidação + re-auth. **Caso comum.**
- **Modo (b)** — `client_id`/`client_secret` rotacionados/revogados no banco: o
  re-auth com os `const` velhos também falha em `/auth`; exige **reler creds do
  `SERVER_SCOPE`** (§5) e reconstruir a instância.

## 2. Handling atual — dois mecanismos inconsistentes e incompletos

**Arquivo:** `.../v-5.2.0/WIDGET/MAIN_VIEW/controller.js`

**Mecanismo A — `MyIOUtils.handleUnauthorizedError(context)` (~407-422):** toast +
**`window.location.reload()`** após 6s. Chamado por `fetchEnergyDayConsumption`
(~594), `fetchGoalsDayTotals` (~653), `fetchGoalsConsumptionSeries` (~726).

**Mecanismo B — `emitTokenExpired()` (~7338-7345):** debounce de 60s, dispara
`myio:token-expired`. Chamado só no hydrate do orquestrador (~6866). **`myio:token-expired`
não tem NENHUM listener** (grep em `src/`: zero). Andaime morto. Idem
`myio:orchestrator:error` e `myio:token-rotated`.

Resultado: o hydrate falha **em silêncio** (B é no-op); os três helpers Goals/Energy
fazem **reload** (A). Nenhum renova a sessão in-place. **É a causa raiz da UX
reportada.**

> `MYIO-SIM/v5.2.0/MAIN/controller.js` é um twin quase idêntico do MAIN_VIEW e
> carrega o mesmo `emitTokenExpired`. Cópias em `bkp/` fora de escopo.

### 2.1 `tokenManager` — correção factual

`tokenManager` tem **dois caminhos distintos**:

- `updateTokens(...)` atualiza tokens, **aborta requests em voo e emite
  `myio:token-rotated`**;
- `setToken(type, value)` **apenas grava o valor**.

Portanto a afirmação do rascunho inicial de que `setToken('ingestionToken', …)`
aciona a rotação está **incorreta**. A integração deve chamar uma operação com
semântica de rotação (`updateTokens`), ou unificar o contrato do `tokenManager`.

## 3. Toast + eventos disponíveis

- **`MyIOToast`** — `src/components/MyIOToast.js`, exportado em `src/index.ts:414`
  (`window.MyIOLibrary.MyIOToast`). `.error(msg, 5000)`, `.warning(msg, 3500)`,
  `.info`, `.success`; toasts **empilham** (até 6). Error `#d32f2f`, warning
  `#ff9800`. **Os toasts pertencem ao adaptador de UI, não à primitiva.**
- **Eventos** — `window.dispatchEvent(new CustomEvent('myio:…', { detail }))` com
  listeners de escopo de módulo. Reusar `myio:token-expired` (com payload
  versionado) e **adicionar** os eventos de lifecycle (§7).

## 4. Mapa de call-sites da Ingestion (handling atual)

| Arquivo | Função / área | Endpoint | Handling 401/403 hoje |
|---|---|---|---|
| MAIN_VIEW `v-5.2.0` ~6862 | hydrate (fetchAndEnrich) | `/…/{domain}/devices/totals` | `emitTokenExpired()` → **sem listener (silencioso)** + throw |
| MAIN_VIEW ~588 | `fetchEnergyDayConsumption` | `/energy/devices/totals` | `handleUnauthorizedError` → **toast + reload** |
| MAIN_VIEW ~648 | `fetchGoalsDayTotals` | `/{domain}/devices/totals` | idem reload |
| MAIN_VIEW ~723 | `fetchGoalsConsumptionSeries` | `/{domain}/` | idem reload |
| MAIN_VIEW ~748 | `fetchGoalsTemperature` | `/{domain}/` | nenhum (retorna `[]`) |
| TELEMETRY `v-5.2.0` | delega ao orquestrador | — | herda |
| **HO SIM `v5.2.0_UNIQUE`** ~10233 | enriquecimento energia | `/…/energy/devices/totals` | `console.warn` — **silencioso** |
| HO SIM `v5.2.0_UNIQUE` ~10256 | enriquecimento água | `/water/devices/totals` | `console.warn` — silencioso |
| HO SIM `v5.2.0_UNIQUE` (10 sites `buildMyioIngestionAuth`) | goals, temperatura, trends, welcome | vários | maioria `return null/[]` — silencioso |
| `v-5.4.0/controller.js` | toda ingestion | vários | **nenhum handling de 401/403** |
| Premium modals via `AuthClient` | totais de report | data-api | tem `clearCache()` mas **nenhum caller invoca no 401**; sem retry |

**Não há choke-point único hoje.** Os choke-points naturais são (1) a primitiva de
auth e (2) um executor de request autenticado compartilhado.

## 5. De onde vêm as credenciais ("reler do banco")

**MAIN_VIEW ~1962:**

```js
const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt, tbBase);
CLIENT_ID = attrs?.client_id || ''; CLIENT_SECRET = attrs?.client_secret || ''; CUSTOMER_ING_ID = attrs?.ingestionId || '';
```

Creds vivem em atributos **CUSTOMER `SERVER_SCOPE`** do ThingsBoard, lidos uma vez
no `onInit`, guardados via `MyIOOrchestrator.setCredentials(...)`. **Reler é
leitura do banco para a memória — NÃO grava/renova sessão no banco.** A cópia dos
toasts (§6) reflete isso.

## 6. Correções obrigatórias sobre a abordagem ingênua

### 6.1 `401` e `403` não são equivalentes
- **`401`** de endpoint de dados → candidato a bearer ausente/inválido/revogado/
  expirado → **recupera**.
- **`403`** → normalmente autenticado mas **sem autorização** → **não** recupera
  por padrão; só entra no fluxo se o backend fornecer **código/header documentado**
  de token inválido/expirado. Demais `403` = erro de permissão (sem clear cache,
  sem toast de token).
- **Nunca** aplicar a respostas de ThingsBoard/GCDR só pelo status — o erro tem que
  ser classificado como **pertencente à Ingestion API**.

### 6.2 Single-flight por escopo
Estado de recuperação por **`authScopeId`** (host + clientId via **hash opaco** — o
secret nunca entra em payload/log/evento/chave de diagnóstico). Recuperação do
cliente A não bloqueia nem contamina o cliente B.

### 6.3 Debounce ≠ resultado técnico
No sketch ingênuo, uma segunda falha em 60s retornava `false`, que um call site
poderia ler como "recuperação falhou" e recarregar. **Debounce controla só
notificação/toasts**; o coordenador guarda `generation` e o último resultado por
escopo — requests de geração antiga **reusam** a recuperação atual/último sucesso e
repetem uma vez.

### 6.4 Limpar `inFlight` não cancela `/auth` em curso
Invalidação por **contador de geração**: toda autenticação captura a geração
inicial e **só publica o resultado se ainda for a atual**. `AbortController`
opcional; a proteção por geração é **obrigatória**.

### 6.5 `clearAllAuthCaches()` fora do fluxo normal
Invalidar **apenas o escopo afetado**. Em mudança de credenciais, construir **nova
instância** e substituir atomicamente a referência. `clearAllAuthCaches()` fica
para logout/testes.

### 6.6 Cópia dos toasts
Tecnicamente, reler `SERVER_SCOPE` **não** é "atualizar a sessão no banco".

**Cópia técnica aprovada (default):**
- erro: `Token de acesso expirado ou inválido.`
- warning: `Renovando o acesso aos dados. Aguarde...`
- falha: `Não foi possível renovar o acesso aos dados. Tente novamente.`

> **DECISÃO DE PRODUTO EM ABERTO.** A cópia originalmente ditada
> ("Token de acesso expirado." + "Atualizando a sessão no banco de dados por
> validade de token de acesso expirado…") pode ser preservada **se aprovada
> conscientemente como copy de produto**, não como descrição técnica. Pendente de
> confirmação do Rodrigo.

### 6.7 Reload automático não é fallback seguro
**Nenhuma recarga automática no default.** Na falha final: manter dados
renderizados, abrir cooldown (circuit breaker), oferecer ação manual `Recarregar
página` / `Tentar novamente`. Reload automático só via opção legada temporária com
trava de 1 tentativa por carregamento.

## 7. Arquitetura revisada

### 7.1 Três camadas

| Camada | Responsabilidade |
|---|---|
| `buildMyioIngestionAuth` | cache, autenticação, invalidação segura, geração do token |
| `ingestionFetch` | executar request, **classificar** resposta e repetir **exatamente uma vez** |
| adaptador do dashboard | reler credenciais, atualizar orquestrador, mostrar toast, reagir a eventos |

O helper **não** depende de `window.MyIOLibrary` internamente — recebe callbacks
opcionais (`onLifecycleEvent`, `refreshCredentials`) e permanece testável em
Node/jsdom. O adaptador do ThingsBoard converte lifecycle em `CustomEvent` +
`MyIOToast`.

### 7.2 Evolução do contrato de auth

```ts
export interface MyIOAuthInstance {
  getToken(): Promise<string>;
  forceRefresh(): Promise<string>;
  invalidate(reason?: string): void;
  getGeneration(): number;
  getExpiryInfo(): { expiresAt: number; expiresInSeconds: number };
  isTokenValid(): boolean;
}
```
- `invalidate()` incrementa `generation`, limpa token/expiração e impede publish de
  gerações antigas;
- `forceRefresh()` invalida e obtém token novo com single-flight por escopo;
- erros de `/auth` preservam status + categoria estruturada (`invalid_client`,
  `network`, `server`, `malformed_response`), sem corpo sensível em eventos;
- cache keys internas **sem segredo em texto claro** (id opaco/estrutura não
  enumerável); `getAuthCacheStats()` retorna só contagens e ids redigidos.

### 7.3 Executor autenticado

```ts
type IngestionFetchOptions = {
  authScopeId: string;
  getAuth: () => MyIOAuthInstance;
  refreshCredentials?: () => Promise<MyIOAuthInstance | void>;
  onLifecycleEvent?: (event: IngestionAuthLifecycleEvent) => void;
};
async function ingestionFetch(input: RequestInfo | URL, init: RequestInit, options: IngestionFetchOptions): Promise<Response>;
```

**Fluxo normativo:**
1. obter bearer e executar a chamada;
2. se a resposta **não** for erro autenticável, retorná-la sem intervenção;
3. coordenar recuperação pelo `authScopeId`;
4. emitir `expired` **uma vez** para a tentativa lógica;
5. `forceRefresh()` com as mesmas credenciais;
6. **repetir a chamada de dados exatamente uma vez** com o token novo;
7. se ainda indicar auth inválida, reler credenciais (lazy);
8. se as credenciais **mudaram**, substituir a instância e repetir **uma última
   vez** (estágio de rotação);
9. emitir `refreshed` **só após uma chamada de dados autenticada ter sucesso** (não
   após `/auth` só responder);
10. em falha, emitir `failed`, abrir o circuit breaker temporário e devolver/lançar
    erro estruturado.

**Limite: no máximo 3 chamadas ao endpoint de dados** por operação lógica
(original, após force refresh, após rotação **comprovada** de credenciais). Sem
mudança real de `clientId`/secret, **não** há terceira chamada — falha imediata.

### 7.4 Por que validar no endpoint de dados
Token novo de `/auth` não prova acesso ao recurso. `myio:session-refreshed` só
representa sucesso após a **repetição do request de dados** não retornar erro de
auth — o que também detecta credenciais válidas porém **sem permissão**.

### 7.5 Atualização atômica de credenciais (modo b)
O callback do dashboard: (1) relê `client_id`/`client_secret`/`ingestionId` da
fonte daquele dashboard; (2) valida campos; (3) compara **fingerprint não
reversível** com a config vigente; (4) cria nova instância; (5) substitui a
referência de `getAuth()`; (6) atualiza o orquestrador **sem logar o secret**; (7)
publica o token pelo caminho de rotação. **Não** chamar `clearAllAuthCaches()`.

### 7.6 Integração com `tokenManager`
Escolher e aplicar consistentemente:
- **preferida:** `setToken()` passa a delegar a `updateTokens({ [type]: value })`
  quando o valor muda;
- **alternativa:** o adaptador chama `updateTokens({ ingestionToken: freshToken })`
  diretamente.

O evento de rotação inclui só `{ type, at, generation }` — nunca bearer/clientId
completo/secret.

## 8. Contrato de eventos

Eventos de browser são do **adaptador**, via `CustomEvent` quando `window` existir.

| Evento | Momento | Detail mínimo |
|---|---|---|
| `myio:token-expired` | 1ª resposta autenticável da operação | `{ version:1, scopeId, context, status, at, generation }` |
| `myio:session-refresh-started` | início da recuperação coordenada | `{ version:1, scopeId, at, generation }` |
| `myio:session-refreshed` | request de dados validado após recuperação | `{ version:1, scopeId, at, generation, credentialsRotated }` |
| `myio:session-refresh-failed` | recuperação final falhou | `{ version:1, scopeId, at, generation, category, retryable }` |
| `myio:token-rotated` | token publicado no orquestrador | `{ version:1, type, at, generation }` |

`error.message`, response body, bearer e credenciais **não** entram no payload —
ficam só no logger com redação de segredos.

## 9. UX revisada

Para uma rajada concorrente do mesmo escopo: um toast de **erro** ao detectar a
perda; um **warning** ao começar a recuperação; substituir por **sucesso curto**
quando o request de dados for validado; na falha, **um único** erro com ação
manual. **Não** apagar dados antigos nem bloquear navegação; não repetir toasts
durante o cooldown. Debounce visual ~60s por escopo; circuit breaker técnico
configurável (inicial 30s para falhas não-retryable) — **mecanismos distintos**.

## 10. Plano de adoção

**Fase 1 — primitiva e testes:** evoluir `buildMyioIngestionAuth.ts` com
geração/invalidação segura; remover segredos das estatísticas; criar
`src/services/ingestion/ingestionFetch.ts` + export em `src/index.ts`; decidir o
destino do twin `.js`; **testes unitários antes** de mexer em dashboards.

**Fase 2 — Shopping 5.2.0:** migrar hydrate + helpers Energy/Goals/Temperature para
`ingestionFetch`; substituir `handleUnauthorizedError()` pelo adaptador de
lifecycle; **remover reload automático**; atualizar `tokenManager` pelo caminho de
rotação; aplicar ao twin `MYIO-SIM/v5.2.0/MAIN` só se seguir mantido/testado.

**Fase 3 — Head Office e v-5.4.0:** inventariar chamadas diretas; migrar
choke-points compartilhados primeiro; **não** converter `403` de GCDR/TB em
expiração de ingestion; remover retornos silenciosos.

**Fase 4 — premium modals:** `AuthClient` consome a nova primitiva ou recebe
`ingestionFetch` por composição; preservar `getBearer()` na migração; migrar por
domínio medindo falhas antes de remover o legado.

## 11. Critérios de aceite

- **AC-01:** um `401` de endpoint de dados causa **uma única** recuperação por
  escopo, mesmo com 20 chamadas concorrentes.
- **AC-02:** clientes/hosts diferentes recuperam de forma independente.
- **AC-03:** uma promise antiga de `/auth` **não** sobrescreve token de geração
  nova.
- **AC-04:** o request original é repetido com bearer novo e o resultado volta ao
  chamador.
- **AC-05:** `myio:session-refreshed` só é emitido após resposta de dados
  autenticada com sucesso.
- **AC-06:** `403` sem código explícito de token expirado **não** limpa cache nem
  inicia recuperação.
- **AC-07:** rotação de credenciais substitui atomicamente a instância; nenhuma
  chamada usa secret novo com cache antigo.
- **AC-08:** sem mudança nas credenciais, não há 3ª tentativa — encerra com erro
  classificado.
- **AC-09:** nenhum evento/toast/log/estatística expõe bearer ou client secret.
- **AC-10:** falha persistente **não** causa loop nem reload automático.
- **AC-11:** rajada concorrente mostra no máximo **um** conjunto de toasts por
  escopo/janela.
- **AC-12:** sucesso atualiza o `tokenManager` por caminho que aborta requests
  obsoletos e emite `myio:token-rotated`.
- **AC-13:** dados já renderizados permanecem visíveis durante e após falha.
- **AC-14:** erro de rede/`5xx` em `/auth` é distinguível de `invalid_client` e
  respeita a política de retry.

## 12. Matriz mínima de testes

| Cenário | Resultado esperado |
|---|---|
| token válido | 1 chamada de dados, nenhum evento de recovery |
| `401`, credenciais válidas | force refresh, 1 repetição, sucesso |
| 20 `401` simultâneos no mesmo escopo | 1 autenticação, resultado compartilhado |
| `401` simultâneo em dois shoppers | 2 recuperações independentes |
| auth antiga termina após invalidação | resultado antigo descartado por geração |
| `/auth` `invalid_client`, creds rotacionadas no TB | nova instância, validação no endpoint, sucesso |
| `/auth` `invalid_client`, creds inalteradas | falha final sem loop |
| novo token ainda recebe `401` | releitura 1×, depois falha controlada |
| `403` de permissão | resposta preservada, sem recovery |
| `403` com código de token expirado | mesmo fluxo do `401` |
| ThingsBoard retorna `401` | fluxo de sessão TB, não ingestion recovery |
| `/auth` `500`/timeout | retry limitado, categoria retryable, circuit breaker |
| listener de evento lança exceção | recuperação técnica continua |
| ambiente sem `window` | biblioteca funciona sem toast/evento de browser |

## 13. Observabilidade

Métricas agregadas, **sem segredos** (`scope` = id opaco/redigido):
`ingestion_auth_recovery_started_total{scope,status}`,
`…_succeeded_total{scope,rotated}`, `…_failed_total{scope,category}`, duração da
recuperação, requests coalescidos, circuit breakers abertos. Logs carregam
`context`/`generation`/estágio/status HTTP — **nunca** URL com parâmetros
sensíveis, body de `/auth`, bearer ou secret.

> **Confirmar antes de implementar:** esta é uma lib de widget de browser — validar
> se existe um **sink de métricas** (Prometheus/telemetria). Sem sink, tratar §13
> como aspiracional/opcional na Fase 1.

## 14. Compatibilidade e rollout

- manter `myio:token-expired` (payload versionado); eventos novos são **aditivos**;
- **feature flag por dashboard** durante o rollout;
- iniciar em Shopping 5.2.0 com telemetria de sucesso/falha;
- expandir para HO/5.4.0 após observar ≥1 ciclo real de expiração;
- rollback para o comportamento **sem** auto-retry, mas **não** restaurar reload
  automático como padrão.

## 15. Decisões finais

- **Auto-retry:** sim, obrigatório e encapsulado; exatamente 1 repetição após
  refresh normal e 1 adicional **só** após rotação comprovada.
- **`403`:** não é tratado genericamente como expiração.
- **Reload:** manual por padrão; automático só como compat temporária explícita.
- **Eventos:** mantêm `myio:token-expired` + lifecycle versionado.
- **Credenciais:** releitura **lazy**, só depois de refresh/retry falhar;
  substituição atômica da instância.
- **Single-flight:** por escopo de autenticação.
- **Toasts:** no adaptador de UI, não na primitiva.
- **Adoção:** incremental (primitiva → Shopping 5.2.0 → HO/5.4.0 → premium modals),
  como fases do mesmo épico.

## 16. Fora de escopo

Alterar o protocolo de auth do backend; renovar a sessão do ThingsBoard; gravar
credenciais no `SERVER_SCOPE`; corrigir permissões de um cliente autenticado;
migrar todos os fetches numa única entrega; usar service worker ou persistência de
bearer no browser.

## 17. Recomendação

Avançar após substituir qualquer sketch ingênuo por esta arquitetura e transformar
os AC-01…AC-14 em testes automatizados. **A 1ª PR deve conter apenas a primitiva
segura, o executor `ingestionFetch`, os testes e a integração do Shopping 5.2.0** —
reduzindo o risco de propagar um contrato incorreto para os vários controllers
duplicados antes de validar concorrência, rotação e classificação de erros.

## 18. Prior art / referências

- Completa o andaime dormente `emitTokenExpired` / `myio:token-expired`
  (MAIN_VIEW ~7338).
- Relacionados: **RFC-0199** (auth context GCDR / `MyIOAuthContext`), **RFC-0183**
  (AlarmServiceOrchestrator), **RFC-0198** (Tickets orchestrator).
- **Jira:** ED-1028 (story principal) — atualizar critérios de aceite para
  AC-01…AC-14; subtasks de adoção para HO `v5.2.0_UNIQUE`, `v-5.4.0` e
  premium-modals.

## 19. Histórico

- **v0 (rascunho, 2026-07-17):** investigação + sketch inicial (single helper,
  toast→toast→evento→clearCache/re-auth).
- **Revisão v1 (2026-07-17):** aprovado com mudanças obrigatórias — 401/403,
  single-flight por escopo, invalidação por geração, validação no endpoint de
  dados, atualização atômica de credenciais, sem reload automático, eventos
  versionados sem segredos. **Consolidada neste documento.**
