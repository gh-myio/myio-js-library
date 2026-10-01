# RFC-0236 — Parecer técnico v1

- **RFC analisada:** [RFC-0236-Premium-Login-Modal.md](./RFC-0236-Premium-Login-Modal.md)
- **Data:** 2026-10-01
- **Parecer:** favorável à proposta, com revisão do contrato antes da implementação pública.
- **Abrangência:** corpo da RFC, revisão BMAD anexada e conferência pontual das referências locais. Este documento não altera a RFC nem implementa o componente.

## 1. Avaliação geral

A proposta tem bom encaixe na biblioteca: um modal injetado, sem dependência de framework, com autenticação delegada ao consumidor. A separação entre View, Controller e tipos públicos é adequada; os três backdrops, os tokens visuais e o showcase tornam o resultado esperado relativamente concreto.

O principal problema não é visual. A API ainda permite interpretações diferentes sobre quem controla a submissão, quando o modal fecha e o que acontece com operações pendentes. Publicar esses contratos sem resolver as ambiguidades tende a exigir mudanças incompatíveis depois.

**Recomendo aprovar a direção e revisar os itens bloqueadores abaixo antes de estabilizar a API.** Não recomendo transformar todas as sugestões BMAD em requisitos da v1: isso ampliaria um componente de apresentação para um framework de autenticação.

## 2. Evidências conferidas

| Referência | Constatação | Consequência |
| --- | --- | --- |
| `src/index.ts` | Exporta os modais de `contract-devices` e os diálogos premium. | `openLoginModal` segue uma convenção existente. |
| `src/components/premium-modals/dialog/styles.ts` | Usa Nunito via Google Fonts e roxo `#7C3AED`. | O padrão da família não é idêntico ao roxo `#6B4ABF` da RFC. A diferença deve ser intencional. |
| `package.json` | Declara `sideEffects: false`, builds ESM/CJS/UMD e subpaths apenas para a raiz e `./tooltips`. | Evitar efeitos no import; um subpath `./login` exigiria alteração explícita dos exports e do build. |
| `scripts/size-check.js` e `scripts/check-bundle-size.mjs` | Usam limites e métricas diferentes: tamanho bruto por artefato e gzip do UMD, respectivamente. | “Enforced bundle limits” precisa identificar comando, artefato, baseline e métrica. Não foi validada a execução desses checks no CI. |
| `gcdr-frontend.git/src/pages/auth/Login.tsx` | Contém o mapeamento de erros, aviso de tentativas, captcha e checkbox de lembrar sem vínculo com o payload do formulário. | A referência visual existe, mas não convém copiar suas lacunas funcionais. |
| `gcdr-frontend.git/src/components/auth/AuthCard.tsx` | Define `#6B4ABF`, faixa de 68 px e logo relativo `/brand/myio-logo.png`. | Tokens têm correspondência local; o caminho relativo do logo não é um default portátil entre aplicações. |

A leitura do GCDR foi feita no checkout local disponível. Não houve validação visual em navegador, medição de contraste, auditoria de backend ou medição do custo de uma implementação ainda inexistente. As observações BMAD sobre esses aspectos não devem ser tratadas como medições confirmadas.

## 3. Correções bloqueadoras do contrato

### B1. Submissão, timeout e respostas atrasadas

**Referências:** `Public API`, `State machine` e BMAD C1/C4.

Uma Promise que nunca termina mantém o formulário desabilitado indefinidamente. Adicionar timeout resolve a espera da interface, mas não cancela automaticamente a autenticação do host. Se o usuário tentar novamente, a primeira requisição pode terminar depois e ainda produzir efeitos externos.

Recomendação:

- Definir `submitTimeoutMs`, com default documentado; 30 segundos é um ponto de partida razoável.
- Passar um contexto de execução separado das credenciais, por exemplo `onSubmit(credentials, { signal })`, e abortar no timeout ou fechamento.
- Invalidar cada tentativa por identificador; resultados antigos não podem alterar a UI nem disparar callbacks de sucesso.
- Explicitar que o host precisa respeitar o sinal e evitar aplicar efeitos de uma tentativa obsoleta; a biblioteca não desfaz sessões criadas pelo host.
- Ignorar submit duplicado e definir o comportamento de exceção síncrona, rejeição e resultado inválido.

Não classificaria automaticamente um resultado malformado como falha de rede. Pode haver mensagem genérica para o usuário, mas o contrato deve distinguir erro de integração de `NETWORK_ERROR`, sem registrar credenciais.

### B2. Sucesso precisa ter um único responsável

**Referências:** exemplo com `location.reload()`, descrição de `{ ok: true }`, `onSuccess` e BMAD C2.

Fechar primeiro e preparar a aplicação depois pode revelar uma página ainda sem estado autenticado. A revisão BMAD também diverge internamente: C2 pede aguardar a preparação, enquanto a sequência sugerida em AC-05 fecha antes de `onSuccess`.

Minha preferência para v1 é preservar um contrato simples: **o host só retorna `{ ok: true }` depois de concluir a autenticação e preparar o estado necessário**. `onSuccess` fica como notificação; sua exceção não transforma sucesso em credenciais inválidas.

Para navegação/reload ou transição visual que exija manter a cobertura, adicionar `closeOnSuccess: false`: o modal entra em `success`, limpa senha/token e permanece sem aceitar novo submit até `close()`. Documentar como o host recupera uma falha na etapa posterior ao login, sem reenviar a senha automaticamente.

Uma alternativa válida é `onSuccess` aguardável, mas nesse caso precisam existir estado próprio, política de timeout e tratamento da rejeição. Não adotaria simultaneamente vários mecanismos de sucesso sem uma regra de precedência.

### B3. Ciclo de vida e singleton não podem ser silenciosos

**Referências:** `LoginModalHandle`, `Injection model`, seta `closed → reopen` e BMAD C3/C4.

Retornar uma instância existente descarta os callbacks e parâmetros da segunda chamada. Dois consumidores podem acreditar que controlam o mesmo login com políticas diferentes. Um marcador DOM identifica que há outro modal; sozinho, não recupera o handle de outra cópia da biblioteca.

Recomendo para v1:

- Handle descartável; `close()` realiza o cleanup completo e é idempotente. `destroy()` pode ser alias documentado, caso se deseje manter a convenção.
- Remover `reopen` do diagrama; abrir novamente cria outro handle.
- Uma segunda abertura ativa produz erro explícito de conflito, sem substituir callbacks nem retornar silenciosamente outro fluxo.
- Definir que `onClose` ocorre uma única vez, inclusive se um callback lançar exceção; cleanup deve concluir independentemente dos callbacks.
- Setters após fechamento são no-op documentado; resultados e eventos atrasados são ignorados.

Se for necessário compartilhar a instância entre bundles, especificar um registro versionado e sua compatibilidade. Não adicionaria eventos globais de autenticação como solução padrão: eles ampliam a superfície pública e não resolvem a propriedade do fluxo.

### B4. A máquina de estados mistura dimensões independentes

**Referências:** tabela de estados, `setLoading`, `setError` e regras de captcha.

`captchaPending` pode coexistir com erro de credenciais, e `externalLoading` pode coexistir com qualquer estado. Hoje não está definido se `setLoading(false)` libera um submit ainda pendente ou se editar um campo remove um bloqueio de conta.

Separar fase (`idle`, `submitting`, `success`, `closed`), erro apresentado, loading externo e disponibilidade do captcha. Derivar a habilitação do submit dessas condições, com precedência explícita para bloqueios.

Também é necessário:

- Normalizar aliases de erro antes de decidir sobre o aviso de tentativas.
- Usar `remainingAttempts` apenas para erros de credenciais; não converter `NETWORK_ERROR` com contador em mensagem de senha incorreta.
- Definir comportamento para zero e ignorar valores negativos, fracionários ou não finitos. Zero não deve virar “última tentativa”; tampouco deve inferir sozinho uma política de bloqueio não informada pelo host.
- Definir se `ACCOUNT_LOCKED`, `ACCOUNT_PENDING` e `ACCOUNT_SUSPENDED` bloqueiam submit, e como o usuário muda de conta ou sai desse estado.
- Não remover bloqueio apenas por editar a senha. Se a troca de e-mail o remove, documentar que o bloqueio pertence à identidade anterior.
- Limpar o token local antes de chamar `captcha.reset()`; o adapter não pode ser responsável exclusivo por invalidar o token consumido.
- Definir falha de `mount/reset`, callbacks tardios e liberação de recursos do captcha. Se houver recursos externos, o cleanup deve ser obrigatório no contrato do adapter.

### B5. Exibição opcional e callbacks têm regras conflitantes

**Referências:** “Every interactive element has a callback”, flags `show*` e opções de idioma/tema.

Tema e idioma já têm comportamento interno, mas o texto sugere que sem callback não são renderizados. Ambos também têm `show*` com default `true`. A exceção “show flag forced” pode autorizar controles sem ação.

Especificar duas categorias:

- Tema, idioma, mostrar senha e lembrar: comportamento local; callbacks de tema/idioma são notificações opcionais.
- Recuperação de senha, criar conta e login social: renderização depende do respectivo callback; a flag visual não deve criar link inoperante.

Setters programáticos de tema/idioma não devem redisparar notificações por padrão, evitando loops. Sem `onForgotPassword`, o aviso de tentativas deve continuar útil e omitir apenas o link. Não tornaria recuperação de senha obrigatória em um componente reutilizável.

### B6. Cleanup, foco e área coberta precisam ser verificáveis

**Referências:** `Accessibility and interaction`, `container` e regras de scroll.

O corpo do card e o overlay são descritos como áreas de scroll. É necessário escolher a estratégia, especialmente em tela baixa, zoom e teclado virtual. O contrato de `container` também precisa dizer se ele muda apenas o local de montagem ou a área coberta.

Recomendo montagem em `document.body` como caminho suportado para cobertura de viewport. Se `container` continuar público, documentar restrições de ancestrais com `transform/filter`, documentos diferentes e Shadow DOM; não prometer cobertura universal.

Definir restauração dos valores prévios de scroll e interatividade, convivência com outros modais, foco quando todos os controles estiverem desabilitados e fallback quando o elemento originalmente focado for removido. Aplicar `inert` exige preservar o estado anterior e não tornar inerte um ancestral do próprio modal.

## 4. Ajustes relevantes para a v1

### Identidade visual, fontes e assets

Trocar “pixel-faithful” por fidelidade aos tokens e à composição, com screenshots de referência, revisão/commit do GCDR e viewports definidos. Se fidelidade pixel a pixel for exigência real, fonte, métricas e ambiente de comparação também precisam ser iguais.

Manter `#6B4ABF` como token deste componente não exige alterar toda a família premium. Também não tentaria corrigir unidades `rem` alterando apenas o font-size do overlay: `rem` continua relativo à raiz do documento.

“Zero host dependencies” deve significar ausência de framework/CSS obrigatório, não ausência de rede. Recomendo fonte externa opcional, fallback funcional e suporte a nonce no estilo injetado. As políticas de estilo, fontes e imagens aceitas pelo componente precisam ser documentadas e testadas na integração.

O logo deve ter URL pública definida ou fallback textual MYIO com tamanho estável; wallpapers ausentes já podem cair no gradiente. A ausência de CDN definida não precisa bloquear o componente se o fallback fizer parte do contrato.

### Credenciais e mensagens

Manter a exigência já existente de que a senha só seja entregue ao `onSubmit`. Ajustar `onSuccess` para payload explícito, por exemplo `{ email, rememberMe }`: `Omit<LoginCredentials, 'password'>` ainda inclui `captchaToken`, que não tem utilidade após consumo.

No showcase, construir o registro por lista permitida de campos. Não copiar o payload completo para depois mascarar a senha; omitir senha e token desde a origem.

Definir quando limpar a senha. Preservá-la em falha transitória pode reduzir atrito; limpar no sucesso e fechamento é necessário. O importante é ter uma política única e testável. A exigência BMAD de nunca existir senha em closure é absoluta demais para um callback assíncrono; preferir não persistir, não emitir e reduzir sua retenção ao necessário.

O fallback atual permite que `message` de código desconhecido apareça. Portanto, “raw backend text never leaks by default” não é garantido pela API. Preferir mensagem genérica por padrão e override explicitamente destinado à exibição, sempre via texto.

A RFC já reconhece que o modal não é uma barreira de segurança. Promover essa observação ao guia de integração: o host controla sessão, acesso aos dados e quando apresenta conteúdo protegido, independentemente do backdrop ou de `dismissible`.

### Defaults e escopo

Manteria `openLoginModal`, pasta `premium-modals/login/`, `solid` como default, três backdrops, light/dark e pt-BR/en. São decisões coerentes com a proposta original.

Recomendo `showRememberMe: false` por padrão, habilitado quando o host realmente aplica a opção. Tipar as chaves de tradução e permitir overrides por locale também traz benefício concreto sem ampliar muito o escopo.

Não exigiria MFA, modo `reauth`, helper GCDR, eventos globais, suporte a espanhol ou pasta `auth/` antecipadamente. Um primeiro consumidor e um exemplo de integração real ajudam a validar a API, mas o componente não precisa assumir o backend desse consumidor.

## 5. Parecer sobre a revisão BMAD

| Proposta | Parecer |
| --- | --- |
| Timeout, respostas tardias e cleanup | Concordo; acrescentar cancelamento cooperativo e propriedade dos efeitos externos. |
| Sucesso aguardável | Problema válido; escolher um contrato, conciliando C2 e a ordem conflitante do AC-05. |
| Singleton via DOM + eventos globais | Parcial: detecção é útil; compartilhamento de handle exige mais contrato, e eventos globais são dispensáveis. |
| Bloqueio só sai por `setError(null)` | Incompleto: precisa permitir uma recuperação definida e considerar troca de identidade. |
| “Token-faithful”, i18n tipado e tamanho medido | Concordo. |
| `createGcdrLoginSubmit()` obrigatório | Discordo como requisito geral: acopla uma biblioteca de apresentação ao backend. Pode existir separadamente se houver demanda concreta. |
| Cortar captcha, social, criar conta e imagem | Não é necessário em bloco. Callbacks opcionais preservam o escopo; captcha exige um ciclo de vida bem definido. |
| Antecipar MFA com `status: challenge` | Adiaria; sem um fluxo especificado, o discriminante sozinho não resolve MFA. |
| Fixar nomes de todos os testes e dividir em três PRs | São escolhas de execução, não pré-condições arquiteturais. Os critérios de comportamento são mais importantes. |

## 6. Critérios de aceite recomendados

| ID | Comportamento verificável | Validação sugerida |
| --- | --- | --- |
| AC-01 | Importar não acessa DOM nem injeta estilos; abrir cria a estrutura e os exports públicos funcionam. | Smoke de import/build ESM/CJS e showcase UMD. |
| AC-02 | E-mail é normalizado conforme contrato, senha não é aparada, formulário inválido não chama o host. | Testes de validação. |
| AC-03 | Submit duplicado é ignorado; loading externo não libera tentativa pendente. | Testes com Promise controlada. |
| AC-04 | Timeout/fechamento abortam o sinal; resposta antiga não altera UI nem chama sucesso. | Timers controlados e resolução tardia. |
| AC-05 | Sucesso segue a ordem definida; modal permanece coberto quando configurado; callbacks ocorrem uma vez. | Testes de sequência e integração visual. |
| AC-06 | Segunda abertura tem comportamento explícito; fechamento repetido não repete cleanup ou callbacks. | Testes de lifecycle e cenário com duas cópias do bundle. |
| AC-07 | Aliases, contadores inválidos e estados de conta respeitam a tabela final de transições. | Testes tabelados do controller. |
| AC-08 | Captcha expirado/consumido não habilita submit; reset e cleanup não deixam callbacks ativos. | Adapter fake com expiração e falhas. |
| AC-09 | Senha/token não aparecem no sucesso ou log do showcase; strings externas não viram HTML. | Inspeção dos payloads e testes de renderização. |
| AC-10 | Flags e callbacks seguem as regras de exibição; setters não geram loops de notificação. | Matriz de opções essenciais. |
| AC-11 | Foco, Esc, restauração, scroll e sobreposição funcionam com outro modal e elementos removidos. | DOM para lógica; navegador para interação real. |
| AC-12 | Três backdrops, dois temas, dois idiomas e falhas de assets mantêm layout utilizável. | Showcase com checklist e capturas. |
| AC-13 | Layout funciona em largura de 320 px, zoom de 200%, tela baixa e teclado virtual; contraste e foco são conferidos. | Navegador desktop/mobile e verificação visual. |
| AC-14 | Custo incremental minificado/gzip é registrado contra a mesma base; comandos de orçamento estão identificados. | Build antes/depois e relatório na PR. |

Vitest/jsdom cobre regras e DOM, mas não comprova fidelidade visual, cobertura do backdrop ou comportamento real do teclado virtual. A validação em navegador pode começar manualmente no showcase, sem introduzir obrigatoriamente outra dependência de testes.

## 7. Próxima revisão sugerida

Consolidar primeiro B1–B6 no corpo normativo da RFC, atualizar tipos/exemplos/diagrama para expressarem as mesmas regras e adotar os critérios de aceite. Registrar decisões explícitas para os pontos BMAD aceitos, adiados ou rejeitados.

Com isso, a RFC fica pronta para implementação mantendo o objetivo original: um modal MYIO reutilizável, com apresentação consistente e autenticação sob responsabilidade do host.
