# RFC-0239 — Feedback v2: validação técnica final da rev. 3

- **Documento revisado:** [RFC-0239-Reports-Hub-Library-Component.md](./RFC-0239-Reports-Hub-Library-Component.md), identificado como **Draft rev. 3**.
- **Data:** 2026-10-13.
- **Base do código:** `cd73015e`.
- **Rodada:** última rodada de revisão documental; sucede o [feedback v1](./RFC-0239-Reports-Hub-Library-Component-feedback-v1.md).
- **Parecer:** **arquitetura favorável, mas o contrato ainda não está pronto para aprovação técnica integral.** Restam seis ajustes objetivos abaixo, com solução e evidência de aceite. Não recomendo outra rodada exploratória: corrigir esses pontos no documento e verificá-los na implementação.
- **Limites da validação:** leitura integral da rev. 3, comparação com o parecer anterior e inspeção dos caminhos reais do código. Medição dos arquivos `dist` existentes e execução direta de `check-bundle-size.mjs`; sem rebuild, suíte de testes, dashboard, publicação ou consulta ao Jira. O tamanho medido não é apresentado como build reproduzível da revisão.

## 1. O que considero resolvido

| Tema do feedback v1 | Resultado desta rodada |
|---|---|
| F-01 — resolver antes da declaração de `MyIO` | **Resolvido.** MAIN_VIEW passa a encaminhar settings brutas, e o hub aplica defaults. A ausência do novo resolver deixa de afetar `onInit`. |
| F-02 — dependência de globais no chrome | **Solução direta adequada**, com `useGlobals: false`; falta cobrir o verificador de versão chamado pelo footer, conforme R-3. |
| F-03 — fontes do adaptador | **Fontes principais explicitadas.** Fallback do cliente TB, separação dos IDs e getter de JWT estão corretos. Restam os contratos de hidratação e o momento de criação dos parâmetros, R-2 e R-4. |
| F-04 — tema/modo/nome | **Recorte aceito.** O modo do hub é resolvido explicitamente; destinos continuam com os parâmetros atuais. Não reabrir C-8 nesta RFC. Ajustar somente a precedência que o exemplo de handler ainda contradiz, R-4. |
| F-05 — catálogo e handlers | **Regra funcional resolvida.** Disponibilidade antecede habilitação, overrides do host vencem, chaves customizadas funcionam e o handler padrão restringe domínios. |
| F-06 — SVG arbitrário | **Resolvido.** Texto/emoji, `textContent`, atributos via DOM e ícones decorativos ocultos da árvore acessível. |
| F-07 — ciclo de vida e foco | **Critérios adequados**, mas o protocolo de seleção ainda contradiz fechamento/cancelamento, R-1. |
| F-08 — falhas e credenciais | **Intenção definida.** Mensagem inline, retry e aborto cooperativo são escolhas válidas; o contrato real ainda não sustenta todas elas, R-1/R-2/R-4. |
| F-09 — paridade versus correções | **Separação adequada em §7.** Falta harmonizar o escopo normativo com as decisões ainda abertas em §14, R-6. |
| F-10 — entrega e testes | **Sequência e matriz melhoradas.** O orçamento e a execução dos guards precisam ser corrigidos, R-5. |

Não considero necessários novos componentes, migração de outros dashboards, relatórios de alarmes ou modo escuro nos destinos para concluir este trabalho.

## 2. Ajustes necessários antes de congelar o contrato

### R-1 — Separar preparação, fechamento por sucesso e cancelamento

**Prioridade: alta. Referências: §5.2, §5.3, §5.7 e §5.10.**

Há três regras que, juntas, não formam um protocolo executável:

1. `ReportsHubHandlerDef.run()` hidrata e abre o destino, retornando apenas `void | Promise<void>`.
2. O hub deve permanecer aberto durante a hidratação e fechar **antes** de abrir o destino.
3. O caminho único de fechamento também é usado pela seleção e **aborta** o controller; uma seleção abortada nunca pode abrir o destino.

Com a assinatura atual, o hub não recebe o ponto intermediário “preparação terminou, destino ainda não abriu”. Aguardar `run()` fecha tarde demais; fechar antes de `run()` elimina a UI inline; fechar no sucesso abortando o mesmo sinal conflita com a regra de invalidação. O problema também vale para handlers customizados, não apenas para água/temperatura.

**Correção recomendada:** tornar a preparação explícita. Por exemplo, `prepare(args)` retorna, de forma síncrona ou assíncrona, uma função `open()` síncrona que apenas monta o destino. O hub executa:

```text
validar seleção → preparar com o hub aberto → verificar sinal/identidade da seleção
→ liberar recursos do hub por sucesso, sem cancelar a seleção concluída → open()
```

Manter um único mecanismo de limpeza, com motivo interno de fechamento. Cancelamento por usuário, toggle, API ou teardown aborta a preparação; transição por sucesso não representa cancelamento. O `close()` público continua sendo cancelamento.

Falha de preparação mantém a mensagem inline e permite retry. Uma exceção durante `open()`, quando o hub já foi removido, precisa de tratamento próprio: `onError` e uma notificação visível controlada, sem prometer mensagem em um cartão inexistente. Essa distinção deve substituir a promessa de inline “sempre” em `onError`.

**Aceite mínimo:** sucesso respeita a ordem preparar/fechar/abrir; falha de preparação mantém o hub; fechar durante espera impede abertura; dois cliques não duplicam destino; handler customizado usa o mesmo protocolo; erro de abertura não vira rejeição não tratada.

### R-2 — O orquestrador atual não permite distinguir falha de vazio legítimo

**Prioridade: alta. Referências: §5.5, §5.10, C-3 e testes do adaptador.**

A RFC exige que `ensureDomainLoaded` rejeite em falhas, mas sua única operação de carga é `orchestrator.hydrateDomain(domain, period)`. No código real:

- `fetchAndEnrich`, em `MAIN_VIEW/controller.js:8378`, captura erros e retorna `[]`; um erro HTTP pode resolver a hidratação como lista vazia.
- No timeout de `ctx.data` de temperatura (`:7538`), chama `reportLoadError` e também retorna `[]`.
- A ausência legítima de sensores de temperatura também retorna `[]` (`:7550`). Verificar apenas o tamanho não distingue os casos.
- `emitProvide` publica itens provisórios com chave `:loading` e pode publicar itens `:failed`. O predicado `!!items.length` proposto em §5.5/§8 considera ambos “carregados”.
- A hidratação normal pode emitir toasts e acionar o tratamento global de retry. Capturar a Promise no adaptador não garante a experiência exclusivamente inline descrita na RFC.

Portanto, mocks que apenas resolvem ou rejeitam não demonstram C-3 no dashboard real. Um `try/catch` no adaptador é insuficiente, e tratar todo `[]` como falha quebraria o caso legítimo explicitamente preservado.

**Correção recomendada:** incluir no escopo uma capacidade de carga com resultado inequívoco — sucesso, inclusive vazio, ou falha — e uma consulta de prontidão que não aceite placeholders/estado de erro como sucesso. Pode ser uma extensão compatível do orquestrador, mantendo o comportamento dos consumidores antigos. Documentar a política de notificação para esse caminho; `silent` sozinho não recupera erros já convertidos em `[]`, e chamadas coalescidas também precisam respeitar o contrato.

Se C-3 for adiada por decisão do responsável, remover suas promessas e testes obrigatórios desta entrega e registrar a dependência para a entrega seguinte. Não declarar a correção implementável somente com as interfaces atuais.

**Aceite mínimo:** erro HTTP, timeout de metadados, estado `:loading`, estado `:failed` e sucesso vazio produzem resultados distintos e corretos; falha não abre relatório nem dispara uma notificação global concorrente; retry consegue abrir após sucesso. Cobrir o comportamento real de carga, além do mock de `hydrateDomain` que rejeita.

### R-3 — `useGlobals: false` não alcança o verificador de versão do footer

**Prioridade: alta para G-3 e limpeza. Referências: §5.7, §5.9 e §10.**

A extensão do chrome resolve seus próprios fallbacks. Porém, `createModalFooter` instancia `createLibraryVersionChecker` quando `libVersion !== false`, inclusive com `current` explícito (`ModalFooter.ts:98`). O checker:

- consulta `window.MyIOLibrary?.MyIOToast` ao avisar sobre versão antiga (`library-version-checker/index.js:728`);
- repete a consulta ao atualizar manualmente (`:934`);
- inicia a verificação assíncrona imediatamente (`:1000`);
- não invalida essa verificação em `destroy()` (`:1006`). Uma resposta de versão antiga depois do fechamento pode iniciar novamente o intervalo de avisos.

Assim, fornecer `customerName` e `libVersion` explicitamente não basta para garantir ausência de leituras indiretas nem ausência de recursos após fechamento. Um teste que abre/fecha com a requisição pendente e verifica timers apenas naquele instante pode passar sem detectar o problema.

**Correção recomendada para manter o escopo pequeno:** usar no hub uma versão **estática** no footer, vinda de metadados do build, sem instanciar o checker. Acrescentar um modo compatível ao footer para esse uso; os consumidores existentes mantêm o modo atual. Isso preserva “cliente · relógio · versão” e evita levar avisos de atualização para o novo picker.

Se a verificação ativa for requisito, incluir explicitamente sua injeção de notificações e invalidação após `destroy()`; não atribuir essas garantias apenas ao chrome. Montar header/footer diretamente, alternativa de §14 D-5, também não resolve este ponto enquanto usar o mesmo checker.

**Aceite mínimo:** o teste G-3 cobre interações e trabalho assíncrono, não só montagem. Fechar antes de uma resposta pendente e depois resolver essa resposta não cria timers, listeners ou avisos. No modo estático, comprovar que o checker não é instanciado.

### R-4 — Alinhar o contrato do adaptador e os exemplos de parâmetros

**Prioridade: média; corrigir antes de implementar a API. Referências: §5.2, §5.3, §5.5, §5.6 e §8.**

Quatro inconsistências permanecem:

1. **JWT por seleção versus parâmetros prontos.** `context.demandPanel` é um objeto pronto, e `DemandPanelV2Params.user` também é um objeto. Se `tbUserFromJwt` for chamado na criação do contexto, a identidade não será lida na seleção como promete §5.10. Passar `getToken` ao store resolve o token por requisição, mas não atualiza a identidade exibida.
2. **Precedência visual.** O handler de grupo em §5.3 espalha `getAllReportBase()` e depois atribui `theme: visual.palette` e `customerName: visual.customerName`. Com `undefined`/`''`, sobrescreve valores válidos, contrariando §5.6. O handler de demanda já ilustra os fallbacks corretamente.
3. **Dependências do bridge versus imports.** §5.3 manda importar os destinos da biblioteca; `ReportsHubUtils` ainda lista esses destinos e os factories como `unknown`, e “missing Demand Panel capability” não identifica quais capacidades são realmente verificadas. Isso torna incerto se o adaptador depende de um bridge completo mesmo com as funções disponíveis no pacote.
4. **Erro na criação do contexto.** §5.5 exige `getEnergyGroups` e lança se ausente, alegando que nada funciona. Isso não é verdade para relatórios apenas de água/temperatura. MAIN_VIEW também expõe um stub transitório sem esse método (`:2503`). O exemplo de §8 não captura a exceção e cria contexto antes de chegar ao toggle: um segundo clique pode falhar em fechar uma instância já aberta.

**Correções recomendadas:**

- Expor um getter/factory de parâmetros de demanda, avaliado na preparação da seleção, e manter `createTbEnvelopeStore.getToken` para cada requisição. Os IDs do cliente devem permanecer vinculados ao contexto validado.
- Guardar o resultado de `getAllReportBase()` uma vez e aplicar `visual.palette ?? base.theme` e `visual.customerName || base.customerName`, preservando `base.ui`. Não reintroduzir mudança de modo nos destinos.
- Importar factories/adaptadores internos diretamente e remover do contrato `utils` as funções que não são dependências do host. Definir disponibilidade por dados/capacidades necessários, incluindo o cliente TB, sem exigir grupo de energia para todos os relatórios.
- No MENU, fechar o handle aberto antes de tentar criar outro contexto; tratar inicialização indisponível com mensagem controlada. Preservar a cadeia existente de `onDestroy`.

**Aceite mínimo:** JWT muda entre abertura do picker e seleção; base contém nome/paleta e parâmetros do hub os omitem; host oferece apenas água; orquestrador ainda é stub; segundo clique fecha mesmo se o contexto deixou de estar pronto; ausência de configuração de demanda não impede relatórios de grupo.

### R-5 — O orçamento declarado não corresponde aos artefatos nem aos guards

**Prioridade: alta para o aceite da Fase 1. Referências: §9 e §10.**

§10 exige passar ambos os scripts e manter o bundle dentro de 26 KB gzip. A inspeção mostrou que são critérios diferentes:

| Verificação | O que realmente verifica |
|---|---|
| `scripts/size-check.js` | Limites de arquivos **sem compressão**: 50 KiB ESM/CJS, 60 KiB UMD, 25 KiB UMD minificado e 10 KiB de declarações. Também dispara um build próprio. |
| `scripts/check-bundle-size.mjs` | Limite de 26 KiB gzip sobre **`myio-js-library.umd.js`**, não o `.umd.min.js`. |
| Critério da RFC | Mistura o delta do UMD minificado comprimido com o limite aplicado pelo segundo script a outro arquivo. |

Medição somente dos artefatos locais existentes, sem rebuild:

| Arquivo | Bytes sem compressão | Bytes gzip |
|---|---:|---:|
| `dist/myio-js-library.umd.js` | 7.764.911 | 1.618.883 |
| `dist/myio-js-library.umd.min.js` | 6.259.492 | 1.392.719 |

Isso não mede o incremento do hub, que ainda não existe. Mostra que o limite histórico não pode ser tratado como baseline verde sem validação.

Há outro problema verificável neste ambiente Windows: `node scripts/check-bundle-size.mjs` terminou com código 0 **sem emitir relatório**. Seu guard compara `import.meta.url` com ``file://${process.argv[1]}``, que não representa corretamente o caminho Windows. Portanto, um exit code 0 pode não significar que a checagem rodou.

**Correção recomendada:** medir base e candidato com a mesma cadeia de build; escolher o artefato e a unidade; registrar tamanho absoluto e delta; fixar um teto incremental explícito antes do aceite da Fase 1. Atualizar ou substituir os guards aplicáveis, sem simplesmente ampliar limites para acomodar o candidato. Corrigir a detecção de execução direta, por exemplo usando `pathToFileURL` com caminho absoluto, e exigir que o relatório de medição tenha sido produzido.

**Aceite mínimo:** baseline reproduzível registrado; limite incremental numérico aprovado; comando realmente executa a checagem no ambiente usado e falha quando o limite é ultrapassado. A estimativa “+4–6 KB minificados antes de gzip” não substitui esse critério.

### R-6 — O corpo normativo e as decisões abertas precisam descrever a mesma entrega

**Prioridade: média, obrigatória para fechar a RFC. Referências: §5, §7, §9, §10 e §14.**

§5 já especifica C-1, C-3, C-7 e a extensão do chrome como o comportamento a implementar; §9 inclui aviso sobre alarmes e smoke de falha inline. Entretanto, §14 mantém em aberto se essas correções entram na entrega e se o chrome será usado. O implementador recebe contratos e critérios de saída para alternativas que ainda podem ser retiradas.

**Recomendação de fechamento:** registrar as decisões do responsável em uma tabela final e marcar a discussão como histórico. Esta revisão recomenda:

| Ponto de §14 | Encaminhamento recomendado |
|---|---|
| D-1 — faseamento | Incluir C-1, C-2, C-4, C-5, C-6 e C-7. A API pública não deve expor alarmes que o handler não atende. Separar commits de extração e correção para facilitar diagnóstico, sem manter um roteamento inválido. |
| D-2 — C-3 | Incluir somente com o contrato real de carga resolvido em R-2. Se isso não couber, criar dependência/entrega separada e retirar as promessas de C-3 desta versão. Não afirmar incidência em produção sem evidência. |
| D-3 — sprint/publicação | Tratar prazo, ED-1337 e janela de release como decisões do responsável. Não foram verificadas nesta revisão. Fase 1/2 validadas podem ser uma entrega distinta de publicação, se o ticket declarar essa fronteira. |
| D-4 — texto de bloqueio | Usar o texto neutro já proposto, sem “plano” nem CTA comercial até existir contrato para isso. Não bloqueia a implementação. |
| D-5 — chrome | Manter a extensão compatível com `useGlobals`; resolver também o footer conforme R-3. Evitar duplicar a moldura. |
| D-6 — evidência e responsabilidade | Unitários/integração/exports/tamanho em CI; showcase e smoke no dashboard como evidência complementar. Nomear responsável pela matriz no bundle publicado. O call-log não conta como validação funcional. |
| D-7 — definição de pronto | Usar comportamento, testes e orçamento corrigido como critérios. “MENU ≤ 30 linhas” pode ser meta de simplificação, não motivo para omitir tratamento de erro ou teardown. |

Essas recomendações não representam aprovação de produto, alteração de ticket ou autorização para publicação.

## 3. Ajustes editoriais e de testes, sem nova discussão arquitetural

1. **§5.3:** recolocar `alarm-report` dentro da tabela; a linha ficou separada dela por um parágrafo.
2. **§5.4:** dizer se a ordem fixa vale apenas para o catálogo padrão ou também reordena catálogos customizados. Recomendo respeitar a ordem do catálogo customizado e fixar a ordem documentada no padrão. Validar também domínios duplicados, além de IDs de itens duplicados.
3. **§5.4:** “enabled” significa habilitado por configuração de interface, não autorização. Substituir “is the customer allowed?” por redação de configuração; os handlers/APIs mantêm suas próprias regras de acesso.
4. **P-7:** restaurar o `|| ''` final de `identifier` e `label`, presente em `toItem` atual e necessário para cumprir `StoreItem`. Fixar essa saída nos casos de dispositivo sem nome/identificador.
5. **§7.2:** registrar que aceitar somente booleanos é uma normalização deliberada. O código antigo usa `rawItems[k] ?? def` e não faz a mesma validação; a paridade de P-4 vale para settings válidas. Registrar também o modo escuro do próprio picker entre as mudanças visuais, sem confundi-lo com o modo dos destinos adiado.
6. **§10:** caracterização deve primeiro passar contra o comportamento antigo. Depois, rodar as mesmas asserções contra o código extraído; só as correções deliberadas alteram expectativas. “Contra uma cópia, red until extracted” não prova a caracterização anterior.
7. **§10:** igualdade bruta de contagens de `addEventListener`/`removeEventListener` não prova limpeza. Observar identidade do alvo/evento/callback/capture e efeitos após fechamento; listeners `once` e nós descartáveis não exigem necessariamente chamadas simétricas. Verificar timers em fixture isolada, inclusive após resolver Promises pendentes, conforme R-3.
8. **§3/D-1:** trocar “nobody has hit it in production” por “disabled by default; production incidence not verified”. Configuração padrão não demonstra ausência de ocorrências.

## 4. Critério final de liberação técnica

O parecer passa a favorável para implementação integral quando houver no documento:

- protocolo de preparação/abertura que não se cancela no sucesso — **R-1**;
- fonte confiável para sucesso/vazio/falha, ou adiamento explícito e coerente de C-3 — **R-2**;
- footer sem leituras indiretas proibidas e sem reativação após fechamento — **R-3**;
- parâmetros de demanda e precedência visual coerentes, com erro de contexto tratado — **R-4**;
- orçamento mensurável e guard que efetivamente executa — **R-5**;
- uma única definição de escopo e aceite, com decisões pendentes identificadas — **R-6**.

O restante do desenho pode ser preservado. A próxima validação deve ser feita sobre código e evidências desses critérios, sem exigir uma terceira rodada de opiniões sobre a arquitetura.

## 5. Evidências locais principais

- [RFC rev. 3](./RFC-0239-Reports-Hub-Library-Component.md).
- [MAIN_VIEW/controller.js](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js): stub do orquestrador, `fetchAndEnrich`, `hydrateDomain`, `emitProvide` e tratamento de erro.
- [MENU/controller.js](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js): mapeamento atual, demanda e encadeamento de `onDestroy`.
- [PremiumModalChrome.ts](../../src/components/premium-modals/internal/PremiumModalChrome.ts), [ModalFooter.ts](../../src/components/premium-modals/footer-modal/ModalFooter.ts) e [library-version-checker/index.js](../../src/components/library-version-checker/index.js): dependências indiretas e ciclo de vida.
- [openDemandPanelV2.ts](../../src/components/demand-panel-v2/openDemandPanelV2.ts), [adapters.ts](../../src/components/demand-panel-v2/adapters.ts) e [tipos dos relatórios](../../src/components/premium-modals/types.ts): parâmetros, JWT e tipos de saída.
- [size-check.js](../../scripts/size-check.js) e [check-bundle-size.mjs](../../scripts/check-bundle-size.mjs): artefatos, limites e execução dos guards.
