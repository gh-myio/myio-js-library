# RFC-0242 — Action Plan: MYIO Bot nos painéis Shopping v-5.2.0 e Head Office v5.4.0_UNIQUE (com GCDR RFC-0092)

- **Status:** proposta — **aguardando aprovação** (2026-11-25)
- **RFC base:** `docs/rfcs/RFC-0242-MYIO-Bot-Embeddable-Widget-SDK.md` (fases 0+1 ✅ mergeadas em `desenv` via PR #176; addendum §GCDR integration = fase 1b, não construída)
- **GCDR:** RFC-0092 fase 1 em produção (gcdr#273, migration 0140): entitlement por empresa + escopo por usuário na frente de todo `/bot/*`
- **Alvos:**
  - **S** — `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/` (orquestrado pelo `MAIN_VIEW`)
  - **U** — `src/thingsboard/MYIO-SIM/v5.4.0_UNIQUE/` (widget único, Head Office multi-shopping)

---

## 1. O que a novidade (RFC-0092) muda para os painéis

| Antes (widget 0.1.598, como mergeado) | Depois (RFC-0092 em produção) | Efeito no painel se nada mudar |
|---|---|---|
| `GET /bot/status` só no 1º open; lê `enabled` / `permissions.use` | `status` traz `access { available, reason, customer, permissions{read,write}, quota }` e responde **200** sempre | o operador vê a pill, digita, e só então leva **403** (`BOT_CUSTOMER_DISABLED` / `BOT_PERMISSION_MISSING`) — UX ruim em todo shopping sem bot contratado |
| Empresa = a da credencial | Empresa resolvida por linha 3 (key → própria; pessoa → `customerId` explícito → conversa → `users.customer_id` → …) | no Head Office, a conversa não sabe de qual shopping se trata sem `customerId` |
| Thread key `app:customerId:kind` | Conversa pertence a **uma** empresa; key = `app:customerId:userKey` | trocar de shopping no HO reutilizaria a thread de outra empresa |
| `X-MyIO-Bot-Client` (desligado por padrão) | GCDR lê **`X-Bot-Client`** (sessão por cliente, `bot_sessions.client_key`) | sessões do dashboard misturadas com as do gcdr-web |
| Deep link `/bot#chat?c=<id>` | Canônico `/bot?c=<id>#chat` | funciona (gcdr-web aceita os dois), mas fora do padrão |
| Admin MYIO passa direto | **Decisão do owner:** MYIO é empresa; admin precisa de `role:bot-reader` explícito; sem bypass | SuperAdmin MYIO sem a role não verá o bot (correto, mas precisa estar provisionado antes) |
| — | Canal: empresa precisa do canal em `capabilities.channels` (`WEB`/`API`/`THINGSBOARD`) | dashboard com API key cai no canal `API` (a confirmar, §6) → empresa sem esse canal = `BOT_CHANNEL_NOT_ALLOWED` |
| — | Fase 2 RFC-0092: troca do JWT do ThingsBoard por token GCDR (`POST /bot/auth/thingsboard`), **bloqueada no O-8** | "pessoa no dashboard nunca usa API key no browser" é o alvo; hoje só existe API key |

**Conclusão:** antes de plugar o bot em S e U, a **lib precisa da fase 1b**. Plugar com a 0.1.598 entregaria pill visível + 403 para a maioria dos shoppings.

---

## 2. Decisões que preciso de você (bloqueiam o desenho do host)

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| **D-1** | **Credencial do bot no dashboard** | (a) **API key do cliente** (`integration_setup.gcdr.gcdrApiKey`, já carregada) — disponível hoje; todo viewer fala "como o cliente"; linha 5 = escopo `bot:use` da key, não da pessoa. (b) **JWT GCDR da pessoa** via `myio-gcdr-login` / `initMyIOAuthContext` (já existe na lib, ninguém usa nos painéis) — linhas 4–6 reais, mas exige login GCDR no dashboard. (c) **Token exchange TB→GCDR** (RFC-0092 fase 2) — o alvo, bloqueado no O-8. | **Piloto com (a) atrás de flag OFF + audiência restrita (D-3); host já escrito com um `resolveBotAuth()` que troca para (c) quando existir.** (b) só se o owner quiser escopo por pessoa já no piloto. |
| **D-2** | **Qual key no Head Office (U)** | (a) key do customer HO (holding) + `customerId` do shopping selecionado (depende do alcance da key da holding sobre os filhos — §6 G-4). (b) key **do shopping** selecionado (`resolveShoppingGcdrCreds`), trocando o client ao mudar o filtro. (c) só bot no contexto "holding" (sem shopping). | **(b)** quando exatamente 1 shopping está selecionado; **(a)/(c)** no contexto holding. **Nunca** a key mestra de Alarms do HO (`GCDR_API_KEY`) se ela for master key (bypass das linhas 4/6, O-11). |
| **D-3** | **Quem vê a pill no piloto** | todos · só `SuperAdmin` (@myio.com.br) · `SuperAdmin` + `UserAdmin` | **só `SuperAdmin`** na 1ª semana (flag `myioBotAudience: 'superadmin'`), depois `all`. Observação: com D-1(a) o SuperAdmin conversa **como o shopping**, não como MYIO — aceitável no piloto, resolvido por D-1(c). |
| **D-4** | `visibility` | `'auto'` (some sem acesso) · `'always'` (pill muda explicando) | **`'auto'`** nos dois painéis (O-12); `'always'` só via setting para suporte. |
| **D-5** | Banner de cota (O-13) | 80% p/ todos · 80% só p/ quem administra · nunca | **100% para todos, 80% só `UserAdmin`/`SuperAdmin`** (default do RFC). |

---

## 3. Fase L — Lib, RFC-0242 fase 1b (pré-requisito de S e U)

Branch: `feat/rfc-0242-1b-gcdr-access` (de `desenv`) → 1 PR → `desenv`. Sem mudança de host.

| ID | Tarefa | Arquivos | Testes |
|---|---|---|---|
| L-1 | `contract.ts`: `MyIOBotAccess` (`available`, `reason`, `customer{id,name,status,statusReason}`, `permissions{read,write}`, `quota{tokens,usd,messages}`), `kind`, `permissions.execute`; novos códigos (`BOT_PLATFORM_OFF`, `BOT_CUSTOMER_NOT_FOUND/DISABLED/SUSPENDED`, `BOT_CHANNEL_NOT_ALLOWED`, `BOT_PERMISSION_MISSING`, `BOT_WRITE_NOT_ALLOWED`, `BOT_LIMIT_REACHED`, `BOT_MESSAGE_TOO_LONG`, `BOT_SESSION_ENDED`, `BOT_USER_NOT_PROVISIONED`); `error.details`. Atualizar snapshot OpenAPI (`scripts/snapshot-gcdr-bot-openapi.mjs`). | `contract.ts`, `errors.ts`, `tests/myio-bot/gcdr-bot-openapi.snapshot.json` | contract.snapshot |
| L-2 | Client: `status({ customerId })` → `?customerId=`; `create/resolve` levam `customerId` no body; **nunca** em `POST …/messages`; header **`X-Bot-Client: <host.app>`** sempre (`X-MyIO-Bot-*` seguem atrás de `sendClientHeaders`). | `client.ts` | client.test: customerId em status/create, ausente em messages; X-Bot-Client em toda chamada |
| L-3 | Widget: **`status()` no mount** (hoje é no 1º open, `widget/index.ts:361`); `visibility: 'auto' \| 'always'`; tabela de estados §5 do RFC (pill oculta/mutada, textos, sem composer, suspenso = **sem request de histórico**); evento `'access'`; `statusRefreshMs` (300 000) e re-check após 403/429 de um turno. Tolerância: servidor sem `access` → comportamento 0.1.598. | `widget/index.ts`, `panel.ts`, `launcher.ts`, `i18n.ts` | 1 fixture por `access.reason`; servidor sem `access`; 403 no meio da conversa re-avalia status |
| L-4 | Por turno: `BOT_WRITE_NOT_ALLOWED` → sem action card; `BOT_MESSAGE_TOO_LONG` → erro inline, texto fica no composer; `BOT_SESSION_ENDED` → 1 re-resolve silencioso + reenvio; `BOT_LIMIT_REACHED` → composer desabilitado com `details.resetAt`. Mostrar `error.message` do servidor + `details`, nunca palpite. | `widget/index.ts`, `thread.ts`, `composer.ts` | widget.interaction |
| L-5 | Cabeçalho "MYIO Bot · `customer.name`"; banner de cota (D-5); `access.permissions.write=false` → action card nunca renderiza. | `panel.ts`, `thread.ts`, `styles.ts` | cota 79/80/100% |
| L-6 | **Thread key** `${host.app}:${customerId ?? '-'}:${userKey}` (nova opção `userKey`, ex.: e-mail TB); **`setContext` com outro `customerId`** → re-`status()` + nova thread (hoje `setContext` só guarda o contexto). | `widget/index.ts`, `types.ts` | troca de empresa → novo status + nova conversa |
| L-7 | Deep link canônico `${gcdrWebUrl}/bot?c=<id>#chat` (hoje `widget/index.ts:283`). | `widget/index.ts` | formato |
| L-8 | **Necessidades de host descobertas no mapeamento** (não estão no RFC): (a) `insets: { bottom, top, left, right }` — âncoras da pill e posição padrão do painel respeitam o footer fixo (S: 88 px; U: 46 px); (b) `handle.setTheme({ dark, accent })` em runtime (os dois painéis trocam tema sem reload); (c) o `–` (ocultar) deixa de ser persistente sem caminho de volta: vira **minimizar** (fecha painel, mantém pill) — problema achado na validação de 2026-11-24. | `widget/index.ts`, `drag.ts`, `panel.ts`, `styles.ts`, `types.ts` | insets nas 8 âncoras; setTheme; `–` não grava `launcherHidden` |
| L-9 | Auth (preparação D-1c): tipo `auth: { thingsboard: { tbBaseUrl, tbToken } }` declarado e **rejeitado com `MyIOBotError('AUTH_UNSUPPORTED')`** até o GCDR expor `/bot/auth/thingsboard` — o host já pode escrever o código final atrás de um `if`. | `authStrategies.ts` | strategy |
| L-10 | Doc do RFC (status 1b), showcase `showcase/myio-bot/` com o mock respondendo cada `access.reason` (seletor), release `npm version patch` + publish **somente com OK**. | RFC, `showcase/myio-bot/mock-bot-api.js` | smoke-test |

**Estimativa:** 2–3 dias. **Saída:** `tests/myio-bot` verde com as fixtures acima; showcase mostra os 8 estados.

---

## 4. Fase S — Shopping v-5.2.0 (MAIN_VIEW orquestra)

Branch: `feat/rfc-0242-s-shopping-v520` (de `desenv`, após L mergeada e lib publicada).

| ID | Tarefa | Onde |
|---|---|---|
| S-1 | Settings novos no `MAIN_VIEW/settingsSchema.json` (+ `form`): `enableMyIOBot` (bool, **default false**), `myioBotAudience` (`superadmin` \| `admins` \| `all`, default `superadmin`), `myioBotVisibility` (`auto` \| `always`), `gcdrWebUrl` (default `https://gcdr-web.a.myio-bas.com`), `myioBotWidgetUrl` (opcional, override do bundle). Leitura no padrão existente (`widgetSettings.x = self.ctx.settings?.x ?? default` + espelho em `MyIOUtils`, como `enableReportButton` em `MV:4036`). | `MAIN_VIEW/settingsSchema.json`, `MAIN_VIEW/controller.js` |
| S-2 | `_mountMyIOBot()` no MAIN_VIEW, chamado **depois** do bloco de credenciais (`MV:~4530`, onde `MyIOOrchestrator.gcdr*` já está preenchido) e aguardando `myio:user-info-ready` (e-mail + SuperAdmin/UserAdmin; listener registrado **no escopo do módulo, antes de qualquer `await`** — padrão RFC-0126), com timeout de 15 s. Gates: flag ON · audiência (D-3) · `gcdrApiKey` presente. Credencial **somente** de `integration_setup.gcdr` do cliente — **nunca** `MANUAL_PROV_GCDR_API_KEY` (`MV:2245`) nem o fallback `_pickCred` legado. | `MAIN_VIEW/controller.js` |
| S-3 | Opções do widget: `gcdrApiBaseUrl` normalizado com `/api/v1` (a setting aparece com e sem — mesma normalização de `MV:3183/1217`); `auth: { apiKey, tenantId }` (D-1a, via `resolveBotAuth()`); `host: { app: 'tb-main-dashboard-shopping', version: MyIOUtils.version, customerId: gcdrCustomerId }`; `userKey: currentUserEmail`; `context: { customerId: gcdrCustomerId, customerName, page }`; `visibility`; `insets: { bottom: 88 + 12 }` (footer fixo `FOOTER/styles.css:29-35`, z-index 10000 — pill já usa 2147483000); `theme.dark` de `MyIOUtils.currentTheme`; `theme.fontLink: false` (TB já carrega Nunito); `locale: 'pt-BR'`. | idem |
| S-4 | Contexto vivo: `myio:dashboard-state` `{tab}` (MENU `:644`) → `setContext({ page: tab })`; `customerName` chega atrasado (`MV:4072-4091`, fire-and-forget) → `setContext` quando resolver; `myio:theme-changed` `{theme}` (`MV:556`) → `setTheme`. | idem |
| S-5 | Ciclo de vida: handle em `window.MyIOOrchestrator.bot` (para uso futuro por cards: "perguntar ao bot sobre este device"); `destroy()` no `self.onDestroy` (`MV:4896`) **antes** de `MyIOOrchestrator.destroy()`; guarda contra duplo mount (re-init do TB). Erros só via `LogHelper`, **sem logar key/tenant**. | idem |
| S-6 | Bundle: `loadBotWidget({ src: settings.myioBotWidgetUrl })` quando a setting existir; senão derivação pelo `<script>` do core. **Validar no TB real** que o core entra como `<script src=…myio-js-library…umd…>` (resource do widget) — se o TB injetar de outra forma, a derivação falha e a setting vira obrigatória. | idem |
| S-7 | Showcase `showcase/main-view-shopping/` passa a montar pelo **mesmo** `_mountMyIOBot()` do controller (hoje a showcase monta por conta própria) + seletor de `access.reason` do mock. | showcase |

**Não muda:** MENU, HEADER, TELEMETRY, FOOTER (a pill é do MAIN; `LIB_SYMBOLS` só ganha `loadBotWidget` se algum filho precisar — não nesta fase).

---

## 5. Fase U — Head Office v5.4.0_UNIQUE

Branch: `feat/rfc-0242-u-unique-v540` (de `desenv`, após L; pode rodar em paralelo com S).

| ID | Tarefa | Onde |
|---|---|---|
| U-1 | Settings em `v5.4.0_UNIQUE/settingsSchema.json`: os mesmos de S-1. Leitura em `settings.*` **e** repetida dentro da reatribuição `window.MyIOUtils = {…}` (`C:1295/1301`) — senão é apagada. | `settingsSchema.json`, `controller.js` |
| U-2 | Mount **depois** de `C:1295` (reatribuição do `MyIOUtils`) e **depois** do `fetchCurrentUserInfo()` (`C:1484`, e-mail/SuperAdmin); atenção ao `return` antecipado de init duplicado (`C:1476-1478`) — o mount precisa ser idempotente e não pode ficar atrás desse return na 2ª passada. | `controller.js` |
| U-3 | **Credencial por contexto (D-2):** contexto holding → key do customer HO (`fetchCredentialsFromThingsBoard`, `C:371-401`) **se** for key de cliente; filtro com **exatamente 1** shopping (`myio:filter-applied`, `detail.selection[]`, `C:2338`) → `resolveShoppingGcdrCreds(customerTbId)` (`C:3182-3220`) e o widget é **recriado** com a key do shopping (key diferente = client diferente; `setContext` não troca credencial); 0 ou N shoppings → volta ao holding. Debounce de 500 ms na troca. | `controller.js` |
| U-4 | Contexto: `myio:dashboard-state` aqui é `{ domain, stateId }` (`C:8104`) — **formato diferente do S** → mapear para `page`; tema por `myio:theme-change` `{ themeMode }` (`C:2670`) → `setTheme`; `insets.bottom` = altura do footer (`#footerContainer` 46 px, `template.html:24`) + 12. | `controller.js` |
| U-5 | `self.onDestroy` (`C:12098`, hoje vazio) → `destroy()`. | `controller.js` |
| U-6 | Os dois `GCDR_API_KEY` do HO: confirmar (sem imprimir valor) se a key do HO é **key de cliente** (`gcdr_cust_…`) ou **master** — se master, o bot **não monta** no contexto holding (O-11) e só aparece com 1 shopping selecionado. | verificação |
| U-7 | Validação no showcase do UNIQUE (simulador) com o mock trocando de empresa ao filtrar. | showcase |

---

## 6. Pré-requisitos fora deste repo (GCDR / operação) — precisam estar prontos antes do piloto

| ID | Item | Dono |
|---|---|---|
| G-1 | `ALLOWED_ORIGINS` da API GCDR inclui `https://dashboard.myio-bas.com` (e demais origens TB usadas) | ops GCDR |
| G-2 | Entitlement `ACTIVE` dos shoppings do piloto (aba **Bot** do customer no gcdr-web) com o canal certo em `capabilities.channels` | ops GCDR |
| G-3 | **Confirmar qual canal uma request com API key vinda do browser recebe** (`API`? `WEB`?) — define o que habilitar em G-2 | gcdr.git |
| G-4 | Confirmar se a key do customer **holding** alcança os filhos (`applies_to_descendants`) para `status?customerId=<filho>` — define D-2(a) | gcdr.git |
| G-5 | Keys dos shoppings do piloto com escopo `bot:use` (rotacionar a do Moxuara já cobre isso — pendência de exposição anterior) | ops GCDR |
| G-6 | RFC-0092 §3 (MYIO como empresa): `role:bot-reader` atribuído aos usuários MYIO antes do deploy do "sem bypass" | gcdr.git |
| G-7 | Fase 2 RFC-0092 (token exchange TB) — destrava D-1(c) | gcdr.git (O-8) |

---

## 7. Ordem e entregas

```
L (lib 1b) ──► publish 0.1.6xx ──┬──► S (v-5.2.0)  ──► piloto SuperAdmin 1 semana ──► audiência 'all'
                                  └──► U (UNIQUE)   ──►        idem
G-1…G-5 em paralelo com L          G-7 ──► troca resolveBotAuth() para thingsboard (1 linha por host)
```

- 3 branches/PRs (L, S, U), cada um para `desenv`, validados em showcase (padrão: 1 RFC-fase = 1 branch + PR).
- Cada passo git (checkout, commit, push, merge, `npm version`, publish) só com OK explícito.
- Deploy dos controllers no TB (S e U) é manual, fora deste plano.

## 8. Validação e critérios de aceite

- **L:** 8 fixtures `access.reason` + servidor sem `access` + cota 79/80/100 + troca de empresa + `customerId` nunca em messages + `X-Bot-Client` em todas + deep link + insets/setTheme/minimizar — `npx vitest run tests/myio-bot` verde; showcase mostra cada estado.
- **S/U em showcase:** pill acima do footer; muda de tema junto com o painel; troca de aba atualiza `context.page`; (U) filtrar 1 shopping troca a empresa (header "MYIO Bot · <shopping>"), limpar filtro volta ao holding.
- **S/U no TB real** (injeção via CDP, sem publicar — `reference-cdp-injection-validation`): flag OFF = nada muda; flag ON + shopping sem entitlement = **pill não aparece** (auto); shopping com entitlement = conversa responde; nenhuma key em console/log.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Viewer do dashboard fala "como o cliente" (API key) | audiência `superadmin` no piloto; D-1(c) como destino; server limita alcance da key |
| Key ausente/legada em `integration_setup` → bot some sem explicação | log de diagnóstico (sem valor) + `visibility: 'always'` via setting para suporte |
| Derivação da URL do bundle falha no TB | setting `myioBotWidgetUrl` (S-6) |
| UNIQUE reatribui `MyIOUtils` / init duplicado | mount idempotente após `C:1295` (U-2) |
| Pill sobre o footer / modais | `insets` (L-8a); z-index já acima de 10000 |
| Master key usada por engano | gate explícito: só key de cliente (U-6); nunca `MANUAL_PROV_*` (S-2) |

## 10. Fora de escopo

Ações D-20 executando de verdade (fase 3 do RFC-0242, depende do GCDR fase 2 do RFC-0087), v-5.4.0 shopping (single-controller), presetup, BAS, gcdr-web (fase 4), chips de prompts rápidos.

---

**Aguardando aprovação** deste plano e das decisões D-1…D-5 (§2). Com o OK, começo pela Fase L.
