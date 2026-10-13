# RFC-0239 — Feedback v1: Reports Hub como componente da biblioteca

- **RFC revisada:** [RFC-0239-Reports-Hub-Library-Component.md](./RFC-0239-Reports-Hub-Library-Component.md)
- **Data:** 2026-10-13
- **Base conferida:** código local em `cd73015e`, a mesma revisão citada na RFC.
- **Parecer:** direção arquitetural favorável; revisar os contratos e a integração abaixo antes de implementar a migração dos widgets.
- **Escopo desta revisão:** análise estática da RFC e dos consumidores existentes. Não houve execução de showcase, dashboard, testes ou chamadas a serviços externos.

## 1. Avaliação geral

A extração faz sentido: concentra catálogo, renderização e roteamento em um componente testável, mantém a adaptação do ThingsBoard separada e reduz a responsabilidade do MENU. Também é correto impedir que os cartões de alarmes caiam no relatório de consumo e preservar a configuração `enabledReportItems` já utilizada pelos clientes.

O principal ajuste necessário é transformar as intenções de reutilização e paridade em contratos completos. Hoje, o chrome compartilhado consulta globais, o adaptador proposto omite dependências do MENU e há ambiguidades entre catálogo extensível, habilitação e disponibilidade dos handlers. São pontos que podem produzir regressões mesmo com os testes felizes propostos passando.

## 2. Achados prioritários

### F-01 — A substituição em MAIN_VIEW precisa respeitar a ordem de inicialização

**Prioridade: alta. Seções: 6, 8 e 9.**

A seção 6 propõe substituir a tabela local por `MyIO.resolveEnabledReportItems(settings.enabledReportItems)`. No código atual, a tabela está em `MAIN_VIEW/controller.js:2348`, dentro de `self.onInit`, mas o `const MyIO` desse mesmo escopo só é inicializado em `:2655`. Uma substituição literal nesse ponto causa `ReferenceError` por acesso antes da inicialização. A leitura atual da configuração também é `self.ctx.settings?.enabledReportItems`, não a variável ilustrativa `settings`.

**Recomendação:** indicar o ponto exato de inicialização da biblioteca e usar uma referência já disponível, validada antes da chamada. A checagem de compatibilidade deve incluir MAIN_VIEW: a proteção mostrada no MENU não evita que MAIN_VIEW falhe antes de terminar seu `onInit` quando o bundle antigo não exporta o resolver.

Não é necessário manter o picker antigo como fallback. É necessário definir o comportamento de MAIN_VIEW diante de versão incompatível sem interromper recursos não relacionados do dashboard.

**Aceite:** inicialização com bundle compatível e incompatível; nenhum acesso a `MyIO` antes da declaração; configuração lida da fonte real; erro de compatibilidade controlado.

### F-02 — O chrome atual não satisfaz a independência de globais prometida

**Prioridade: alta. Seções: 4/G-3, 5.2 e 5.6.**

Em `PremiumModalChrome.ts`, `applyDashboardPalette(el)` recebe apenas o elemento e busca a paleta em `window.MyIOUtils.theme`. `createPremiumModalChrome` chama esse helper automaticamente e também usa globais como fallback do nome do cliente e da versão.

Portanto, dizer que o `theme` recebido pelo hub será aplicado por `applyDashboardPalette` não corresponde à API existente. Um showcase sem `MyIOUtils` não receberá a paleta por essa chamada; um host com outro tema global poderá contaminar a apresentação. Embora G-3 proíba leituras dentro do componente, a independência funcional também depende dessas chamadas indiretas.

**Recomendação:** prever uma extensão compatível do chrome/helper para receber paleta e metadados explícitos, incluindo uma forma de dispensar os fallbacks globais no hub. Outros consumidores podem manter o comportamento atual. Alternativamente, explicitar uma fronteira menos estrita para G-3, sem prometer isolamento que a implementação compartilhada não oferece.

**Aceite:** abrir com tema A e nome A enquanto os globais contêm tema B e nome B; o hub deve usar A. Repetir sem globais de dashboard.

### F-03 — O adaptador precisa preservar as fontes de contexto existentes

**Prioridade: alta. Seções: 5.2, 5.5 e 8.**

Há duas dependências atuais que não aparecem de forma suficiente no contrato proposto:

- `_openDemandPanel` usa `settings.customerTB_ID || window.__myioCustomerTB_ID || ''` (`MENU/controller.js:3086`). As opções do adaptador não incluem o ID de fallback. Omiti-lo pode construir um store ThingsBoard com cliente vazio quando o MENU depende do ID publicado por MAIN_VIEW.
- `_ensureDomainLoaded` consulta `window.MyIOOrchestratorData[domain].items.length` (`:3112`). O adaptador recebe orquestrador e utils, mas a RFC não define se continuará lendo esse global, receberá um getter ou inferirá a presença de dados pelos grupos.

**Recomendação:** documentar todas as leituras de ambiente permitidas no adaptador e escolher uma fonte explícita para cada uma. Preferir passar o `tbCustomerId` já resolvido e uma consulta de disponibilidade dos dados, ou documentar a inferência por `getGroups`. Manter separados `CUSTOMER_ING_ID`, `tbCustomerId` e `gcdrCustomerId`; nenhum deles deve substituir outro.

Também convém substituir `orchestrator: unknown` e `utils: unknown` por interfaces mínimas das capacidades consumidas, ou descrever a validação feita ao receber esses objetos. Evitar casts amplos que apenas ocultem dependências ausentes.

**Aceite:** ausência do ID nas settings do MENU com fallback válido; IDs distintos nos três sistemas; orquestrador parcial; domínio ainda não carregado; configuração de demandas indisponível sem bloquear relatórios de grupo.

### F-04 — Paleta, modo visual e nome precisam de precedência única

**Prioridade: alta. Seções: 5.2, 5.3, 5.6 e 8.**

`OpenReportsHubParams` recebe `themeMode`, mas `ReportsHubHandler` não o recebe. O handler de grupo não define como atualizar `allReportBase.ui.theme`; o de demandas apenas espalha `context.demandPanel`, sem encaminhar o tema e o nome recebidos pelo hub. Assim, o contrato permite um hub escuro abrir um relatório claro ou um painel com outro cliente no rodapé.

O código existente oferece os destinos necessários: `OpenAllReportParams.ui.theme`, `DemandPanelV2Params.themeMode` e `DemandPanelV2Params.customer.name`. `MyIOThemePalette` também tem `mode`. O exemplo do MENU passa `U.theme`, mas não passa `themeMode`, tornando a regra de inferência relevante.

**Recomendação:** resolver o modo como `params.themeMode ?? params.theme?.mode ?? 'light'`, documentar a precedência dos demais valores e encaminhar o contexto visual resolvido aos handlers. No relatório de grupo, preservar outros campos de `ui` ao atualizar `theme`; no painel, preservar os IDs de `customer` ao atualizar `name`. Evitar sobrescrever valores válidos do contexto com `undefined`.

**Aceite:** tema escuro herdado da paleta; modo explícito; overrides por host; ambos os destinos com paleta, modo e nome coerentes.

### F-05 — Catálogo extensível precisa combinar habilitação, capacidade e domínio

**Prioridade: alta. Seções: 5.2, 5.3, 7 e 10.**

O contrato oferece itens e handlers personalizados, mas o teste do resolver exige ignorar chaves desconhecidas. Se o mesmo resolver for aplicado ao hub, um item personalizado poderá nunca ser habilitado. É preciso distinguir chaves inválidas das settings legadas de chaves válidas no catálogo recebido.

Há ainda dois casos indefinidos: um override de `handlers['demand-panel']` consegue mostrar seu cartão sem `context.demandPanel`? Um catálogo pode atribuir `kind: 'group-report'` ao domínio `alarms`? O tipo atual permite este último caso, embora `getGroups` e `OpenAllReportParams.domain` não aceitem alarmes. Isso reintroduz D-1 por outra entrada.

**Recomendação:** definir a precedência `handler do host > handler padrão`, separar disponibilidade de habilitação e restringir os domínios suportados pelos handlers padrão, em tipos e em runtime. Um handler customizado deve declarar ou ter definida sua própria condição de disponibilidade.

| Situação | Comportamento recomendado |
|---|---|
| Handler ausente ou padrão incompatível com o domínio | Item oculto; remover aba se não restarem itens visíveis |
| Handler disponível e flag falsa | Item visível e bloqueado |
| Handler disponível e flag verdadeira | Item acionável |
| Item customizado sem flag | Bloqueado por padrão; permitir habilitação explícita pela chave do catálogo |

`resolveEnabledReportItems` pode continuar restrito às 15 chaves das settings atuais, desde que a resolução do catálogo customizado seja separada e documentada. Validar IDs duplicados por domínio e preservar as chaves legadas, incluindo `energy_area_comum`.

**Aceite:** item e kind customizados, override de demanda sem contexto padrão, alarmes com handler próprio e rejeição de alarmes pelo handler padrão de grupos.

### F-06 — Ícone como SVG string deixa D-2 parcialmente aberto

**Prioridade: alta. Seções: 3/D-2, 5.2, 5.6 e 10.**

Escapar labels e descrições é correto, mas `icon: string` aceita tanto emoji quanto SVG. Renderizar essa propriedade como markup reabre a superfície que a RFC pretende corrigir. `id`, atributos e `tint` também não devem ser concatenados em HTML sem uma política explícita.

**Recomendação:** para v1, usar texto/emoji via `textContent` ou nomes de ícones de um registro controlado. Se SVG arbitrário for indispensável, especificar a sanitização antes de aceitá-lo. Atribuir cores pelas propriedades de estilo e IDs/datasets pela API do DOM.

**Aceite:** conteúdo com markup em label, descrição, ícone e ID é tratado como texto ou rejeitado; não executa código nem cria atributos inesperados. O catálogo padrão pode continuar sendo definido em código.

## 3. Contratos operacionais a completar

### F-07 — Fechamento precisa liberar recursos e coordenar foco

**Prioridade: média. Seções: 5.2, 5.3, 5.6 e 8.**

O picker atual remove o elemento no segundo clique. Após adotar o chrome premium, essa remoção isolada é insuficiente: `PremiumModalChromeInstance.destroy()` libera o footer, cujo `destroy()` também libera relógio e verificador de versão.

Definir um único caminho de fechamento, idempotente, para botão, Esc, backdrop, toggle, API e destruição do widget. Ele deve remover listeners e timers, destruir o chrome, atualizar `isOpen` e liberar o registro da instância. Recomenda-se singleton por `Document`; explicitar se `toggle: false` reutiliza a instância ou a substitui e qual handle é retornado no segundo clique.

O exemplo do MENU também deve guardar o handle e fechá-lo em `onDestroy`. Para acessibilidade, complementar a RFC com foco inicial, contenção de Tab/Shift+Tab e comportamento das abas ocultas. `aria-disabled` sozinho não bloqueia acionamento por teclado.

A restituição de foco exige cuidado ao abrir o relatório seguinte: um callback tardio de fechamento do hub não pode retirar o foco da nova modal. Usar o documento efetivo para eventos e considerar o elemento que abriu o hub no iframe de origem. A opção `document` deve deixar claro se controla apenas o picker, pois os destinos atuais não oferecem o mesmo parâmetro.

**Aceite:** repetidas aberturas sem recursos órfãos; duas chamadas no mesmo documento; documentos distintos; fechamento durante navegação; teclado; foco no relatório aberto; fallback quando o documento superior é inacessível.

### F-08 — Hidratação, falhas e credenciais precisam de semântica temporal

**Prioridade: média. Seções: 5.2, 5.3, 5.5 e 10.**

Hoje `_ensureDomainLoaded` captura falhas e continua, podendo abrir um relatório vazio. A RFC promete toast para falha de handler, mas não informa se o adaptador continuará absorvendo o erro ou passará a rejeitar. As duas opções têm comportamentos diferentes.

**Recomendação:** explicitar a política; preferir interromper a abertura quando a carga necessária falha, com mensagem de erro, e registrar essa decisão como correção deliberada. Distinguir ausência de período, ausência da capacidade de hidratar e um domínio carregado legitimamente sem dispositivos. Relatório vazio deve continuar recebendo `itemsList: []`: `AllReportModal` distingue esse caso da ausência de `itemsList`, que usa diretamente a resposta da API.

Definir também como evitar abertura duplicada durante hidratação e o que ocorre se o usuário navegar para outro cliente ou destruir o widget antes da resolução. O fechamento normal por seleção inicia o relatório; a destruição do host deve poder invalidar uma abertura ainda pendente.

“Credenciais lidas no momento da chamada” precisa nomear a chamada: criação do contexto, seleção do cartão ou requisição. `allReportBase` é um snapshot, enquanto os headers GCDR já usam um getter. O `jwt` passado ao adaptador deve ter relação documentada com `createTbEnvelopeStore.getToken`, para a identidade exibida e a credencial de acesso não virem inadvertidamente de fontes diferentes.

**Aceite:** rejeição de hidratação com feedback único, domínio vazio, ausência de período, seleção concorrente e navegação durante espera. Registrar erros sem serializar o contexto que contém credenciais.

### F-09 — Paridade e correções deliberadas precisam ser separadas

**Prioridade: média. Seções: 5.4, 7 e 10.**

A extração não é totalmente “moved verbatim”:

- O `GROUP_LABELS` atual tem `area_comum`, mas não `areacomum`. No relatório `todos`, a chave real pode aparecer como `areacomum`. A seção 5.4 propõe corrigir esse label; é uma melhoria válida que merece registro e teste.
- P-2 fala em primeira aba ativa; a API propõe a primeira com item habilitado. Se apenas água estiver habilitada, os resultados diferem. Definir também fallback para `initialDomain` oculto/inexistente, todos os itens bloqueados e catálogo sem itens visíveis.
- Ocultar alarmes, adotar chrome premium e adicionar modo escuro são mudanças intencionais de apresentação, não paridade literal.

Há ainda um ajuste de tipos: `ReportsHubDevice.excludeGroupsTotals` é `unknown`, mas `StoreItem.excludeGroupsTotals` aceita `string | Record<string, unknown> | null`. Definir o refinamento ou usar um tipo compatível na origem. Documentar os fallbacks com `||`, como no código atual: trocá-los por `??` altera o tratamento de strings vazias e não resolve `NaN` no offset.

**Recomendação:** manter P-1…P-12 para os contratos preservados e listar separadamente as correções aprovadas. Incluir casos de IDs vazios, offset inválido, `excludeGroupsTotals` em string/objeto e garantia de que os objetos originais não são mutados. No fluxo de demanda, preservar os objetos completos até `demandDevicesFromItems`, que já trata duplicatas por `tbId` e mantém os namespaces dos IDs separados.

### F-10 — Plano de entrega precisa tornar compatibilidade verificável

**Prioridade: média. Seções: 6, 9 e 10.**

A opção de não carregar o picker antigo como fallback é razoável, desde que a versão da biblioteca seja requisito verificável da publicação. A expressão “publish the lib, update the TB widgets” precisa incluir a atualização e confirmação da referência ao bundle realmente carregado pelo dashboard.

**Recomendação:** registrar a versão mínima quando existir, publicar e conferir o bundle em homologação, atualizar sua referência, verificar os três exports usados pelo bridge e só então promover MAIN_VIEW/MENU. Testar bundle novo com widgets antigos e a falha controlada de widgets novos com bundle antigo. O rollback dos widgets pressupõe manter disponível o bundle compatível.

Além dos testes unitários e do showcase, incluir verificação dos exports ESM/CJS/UMD e declarações públicas. Para tamanho, indicar o comando e o critério usados: o repositório oferece `size-check` e `bundle-size`, mas a RFC ainda não define a comparação ou o orçamento aplicável.

Não usar apenas handlers substituídos pelo log para demonstrar P-8…P-11: eles podem contornar justamente os handlers padrão e o adaptador que precisam ser validados. Manter testes com mocks nas fronteiras dos modais reais e cenários de integração com o adaptador.

## 4. Respostas sugeridas às questões abertas

| Questão da RFC | Recomendação |
|---|---|
| Nome | Manter `openReportsHub`; acomoda relatórios de grupo, demandas e extensões sem expor o detalhe visual do picker. |
| Aba de alarmes | Ocultar enquanto não houver handler aplicável; com handler, respeitar as flags existentes e manter cartões bloqueados quando desabilitados. |
| Fallback inline | Dispensar, com controle de compatibilidade em MAIN_VIEW e MENU e ordem de publicação verificada. |
| Toggle de tema | Seguir o modo do dashboard na v1; resolver e encaminhar esse modo explicitamente. |
| Catálogo nas settings | Manter em código na v1; preservar apenas `enabledReportItems` nas settings e definir o contrato para catálogos customizados pela API. |

## 5. Condições recomendadas para aprovação técnica

1. Corrigir a referência e a ordem de inicialização do resolver em MAIN_VIEW.
2. Resolver a dependência indireta de globais no chrome e a precedência de tema/modo/nome.
3. Completar o contrato do adaptador, especialmente ID ThingsBoard, disponibilidade dos dados e autenticação.
4. Definir habilitação e disponibilidade para catálogos personalizados e bloquear combinações inválidas de domínio/handler.
5. Fechar a política de ícones e renderização segura.
6. Especificar ciclo de vida, foco, falhas de hidratação e invalidação de aberturas pendentes.
7. Atualizar a matriz de paridade, os testes de integração e a sequência de publicação.

Esses ajustes preservam o escopo proposto. Não exigem implementar alarmes, migrar HEADER/Head Office nem alterar o schema de settings dos clientes.

## 6. Referências locais conferidas

- [MENU/controller.js](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js): `openReportsPickerModal`, `_renderReportsPicker`, `_buildItemsList`, `_openDemandPanel`, `_ensureDomainLoaded` e `_openGroupReport`.
- [MAIN_VIEW/controller.js](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js): `LIB_SYMBOLS`, `self.onInit`, `REPORT_ITEM_DEFAULTS`, tema e getters dos grupos.
- [PremiumModalChrome.ts](../../src/components/premium-modals/internal/PremiumModalChrome.ts): aplicação de paleta, fallbacks e destruição.
- [ModalFooter.ts](../../src/components/premium-modals/footer-modal/ModalFooter.ts): recursos e limpeza do footer.
- [Tipos dos premium modals](../../src/components/premium-modals/types.ts): `StoreItem` e `OpenAllReportParams`.
- [AllReportModal.ts](../../src/components/premium-modals/report-all/AllReportModal.ts): distinção entre lista vazia e lista ausente.
- [openDemandPanelV2.ts](../../src/components/demand-panel-v2/openDemandPanelV2.ts) e [adapters.ts](../../src/components/demand-panel-v2/adapters.ts): parâmetros, IDs, autenticação e adaptação de dispositivos.
- [Tipos de tema](../../src/components/theme/types.ts) e [package.json](../../package.json).
