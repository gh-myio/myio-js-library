# RFC-0236 — Parecer técnico v2: resposta ao retorno sobre a v1

- **Data:** 2026-10-01
- **RFC:** [RFC-0236-Premium-Login-Modal.md](./RFC-0236-Premium-Login-Modal.md)
- **Parecer anterior:** [feedback-v1](./RFC-0236-Premium-Login-Modal-feedback-v1.md)
- **Retorno respondido:** [logs/000-toCheck.log](../../logs/000-toCheck.log), conteúdo consultado nesta data.
- **Escopo:** responder às quatro ressalvas, ao código de erro proposto e às decisões pendentes. As recomendações abaixo complementam a v1; não representam aprovação do proprietário nem alteração do corpo da RFC.

## 1. Posição geral

Concordo com a orientação do retorno: usar B1–B6 e os 14 critérios de aceite como base da próxima revisão. As ressalvas sobre saída do fluxo e sessão expirada corrigem lacunas reais do meu primeiro parecer.

Aceito também uma consulta de instância aberta e o código `INTEGRATION_ERROR`, com limites explícitos. Já a afirmação de que reautenticação torna `blur` o default correto precisa ser relativizada: isso depende do conteúdo e da experiência do consumidor, não apenas de a sessão ter expirado.

## 2. Segunda abertura e vários widgets recebendo 401

**Resposta à ressalva 1: concordo parcialmente.**

Uma consulta `isLoginModalOpen()` é útil para inspeção e para evitar uma abertura desnecessária. Manteria o erro explícito na segunda abertura e acrescentaria a consulta, desde que ambas usem o mesmo escopo e a mesma fonte de verdade.

Contrato recomendado:

- Instância única por `Document`, inclusive quando `container` variar dentro desse documento. Iframes pertencem a documentos distintos.
- `isLoginModalOpen(): boolean` consulta o documento corrente e não cria DOM, estilos ou listeners.
- Considerar aberto também o modal em `submitting` ou em `success` com `closeOnSuccess: false`.
- `openLoginModal` reserva a instância de forma síncrona antes de disparar callbacks do host; falha na criação desfaz a reserva.
- Abertura conflitante lança erro identificável por `code: 'LOGIN_MODAL_ALREADY_OPEN'`, sem alterar a instância ativa.
- Cleanup libera a reserva antes de `onClose`, permitindo que o host abra outro fluxo nesse callback.
- Duas cópias do bundle precisam consultar o mesmo mecanismo de presença; uma variável privada por módulo não atende a essa promessa.

A consulta é uma fotografia do estado. Em uma sequência síncrona no mesmo contexto JavaScript, sem `await` entre consultar e abrir, não é necessário inventar uma corrida entre tarefas. Ainda assim, a consulta não reserva a instância, não substitui a verificação interna de conflito e não garante exclusividade após uma espera assíncrona.

O problema dos widgets vai além de evitar dois modais. Quando um widget encontra o login já aberto, ele ainda precisa saber quando retomar sua operação ou quando desistir. Um booleano não entrega esse resultado.

**Para o cenário ThingsBoard descrito no log, recomendo um coordenador de autenticação do host:** os widgets solicitam reautenticação a esse coordenador, que mantém uma única Promise em andamento, abre o modal e comunica conclusão ou cancelamento aos interessados. Isso é uma recomendação de integração, não uma afirmação de que esse coordenador já existe no projeto.

Não incluiria uma Promise global de sessão ou eventos globais na biblioteca visual. Também não trataria todo 401 como ordem irrestrita de reabrir login: o host deve decidir quais falhas pertencem à sessão coordenada e limitar novas tentativas para evitar um ciclo de reautenticação.

## 3. Primeiro consumidor e backdrop padrão

**Resposta à ressalva 2: concordo em registrar o consumidor; não concordo em condicionar o default global a ele.**

O log apresenta ThingsBoard com múltiplos widgets como cenário concreto de discussão, mas não confirma sistema/dashboard, responsável ou data de adoção. Não há base para preencher esses dados como decisão tomada.

A próxima revisão deve incluir uma seção curta de integração inicial com:

| Campo | Situação nesta revisão |
| --- | --- |
| Primeiro sistema/dashboard | Não confirmado; ThingsBoard é candidato citado no retorno. |
| Sessão autenticada | Confirmar qual backend/sessão está sendo renovado. |
| Responsável pelo fluxo | Definir quem abre o modal e coordena os demais consumidores. |
| Depois do sucesso | Definir atualização da sessão, navegação e retomada das operações. |
| Saída ou cancelamento | Definir destino permitido e conclusão das operações em espera. |

Manteria `solid` como default da biblioteca, coerente com o corpo atual da RFC. Um consumidor de reautenticação pode passar `backdrop: { mode: 'blur' }` explicitamente quando preservar o contexto visual for adequado. Se o conteúdo não deve continuar visível, `solid` também faz sentido na reautenticação.

Portanto, o primeiro consumidor deve ser identificado para validar a integração antes da entrega, mas sua identificação não precisa impedir o fechamento dos contratos independentes da API.

## 4. Ação secundária de saída

**Resposta à ressalva 3: concordo e incorporaria na v1.**

O feedback anterior não deu destaque suficiente à saída deliberada do usuário. `dismissible: false` pode impedir fechamento acidental sem eliminar uma ação explícita, como “Voltar ao início” ou “Usar outra conta”.

Proposta de contrato, a ser incorporada aos tipos existentes:

```ts
secondaryAction?: {
  label: string;
  onClick: () => void;
};
```

Regras recomendadas:

- Ausente: não renderizar controle nem espaço vazio. Presente: exigir label não vazio e callback válido.
- Renderizar como `button type="button"`, alcançável por teclado, com o rótulo tratado como texto.
- Continuar disponível com `dismissible: false`, em erros de conta e durante `submitting`; ela oferece saída inclusive quando o host demora a responder.
- Ao ativar: invalidar a tentativa, abortar seu sinal, limpar senha/token, concluir cleanup, emitir `onClose('secondary')` uma vez e chamar `onClick` uma vez.
- Acrescentar `'secondary'` à união de motivos de fechamento. Uma exceção de `onClose` não deve impedir a ação secundária nem o cleanup.
- O host assume a navegação ou a troca de fluxo após o fechamento. Não aguardar Promise de `onClick` e não converter falha desse callback em erro de credenciais.

Essa proposta define a ação como **saída**, não como um botão genérico que pode manter o formulário ativo. Uma transição interna sem fechar exigiria outro contrato e pode ficar para depois.

No estado `success`, desabilitar essa saída: autenticação já concluída não deve ser apresentada como cancelável. Quando `closeOnSuccess: false`, o host continua responsável pela conclusão ou recuperação da transição posterior ao login, conforme B2.

Com ação secundária configurada, o host precisa preparar um destino válido e tratar os consumidores em espera. Fechar a UI não revoga uma sessão já criada pelo backend; permanece a regra de cancelamento cooperativo de B1.

## 5. Sessão expirada sem criar um modo completo de reautenticação

**Resposta à ressalva 4: concordo com o aviso informativo persistente.**

`SESSION_EXPIRED` descreve por que o usuário está vendo o formulário. Não deve se comportar como “senha incorreta” nem desaparecer ao editar o primeiro campo.

Para manter a mudança pequena, preservaria a entrada já prevista:

```ts
login.setError({ code: 'SESSION_EXPIRED' });
```

Apesar do nome `setError`, documentaria que esse código é normalizado para um aviso contextual separado do erro de submissão. Não é necessário adicionar agora `mode: 'reauth'`, e-mail travado ou novo fluxo de autenticação.

Contrato mínimo:

- Renderizar aviso informativo, por exemplo “Sua sessão expirou. Entre novamente para continuar.”, traduzido em pt-BR/en.
- Anunciar como status informativo, sem roubar foco e sem usar o alerta vermelho de credenciais inválidas.
- Manter durante edição, submissão e falhas posteriores; um erro de senha pode aparecer em área distinta sem apagar o contexto.
- Permitir remoção explícita com `setError(null)`, que limpa tanto o erro apresentado quanto esse aviso. Erros não nulos posteriores atualizam a área de erro e preservam o aviso.
- Limpar no sucesso e no fechamento. Não desabilitar submit apenas porque o aviso está presente.
- Se o host retornar `SESSION_EXPIRED` como resultado de submit, encerrar a tentativa sem sucesso e mostrar o mesmo aviso; não disparar retry automático.

Assim, a separação de dimensões de B4 passa a incluir também o aviso contextual. Adiar um modo completo de reautenticação não impede tratar corretamente esse caso na v1.

## 6. `INTEGRATION_ERROR` e diagnóstico

**Resposta ao detalhe adicional: concordo com o nome; restringiria o conteúdo do log.**

Adicionar `INTEGRATION_ERROR` ao conjunto documentado de códigos resolve a lacuna do primeiro parecer. Resultado inválido de `onSubmit`, como `undefined` ou objeto sem discriminante booleano válido, deve produzir mensagem genérica e diagnóstico de integração.

Não aplicar esse código indistintamente a qualquer exceção: uma rejeição pode representar transporte ou outra falha do host. A RFC precisa manter uma tabela explícita para resultado inválido, rejeição, timeout e cancelamento. Timeout gerado pelo componente continua `TIMEOUT`; fechamento não gera um novo alerta.

Aceito `console.error` com mensagem fixa e metadados permitidos, por exemplo código e nome da etapa. **Não registrar o resultado bruto, credenciais, token, objeto de erro arbitrário, stack ou resposta HTTP por padrão.** Um erro do host pode carregar dados que a biblioteca não conhece.

Exemplo de diagnóstico suficiente:

```ts
console.error('[MYIO Login] INTEGRATION_ERROR: invalid onSubmit result');
```

Falhas de callbacks de notificação após sucesso devem ser isoladas e diagnosticadas; não podem reverter a autenticação nem reapresentar a tela como se a senha estivesse errada.

## 7. Respostas às três decisões pendentes

| Decisão pedida no log | Meu parecer v2 | Status |
| --- | --- | --- |
| Primeiro sistema consumidor | Registrar a integração concreta; ThingsBoard é candidato, não escolha confirmada. | Informação de produto ainda pendente. |
| Logo padrão ou fallback textual | Recomendo `logoUrl` opcional e fallback textual “MYIO”, inclusive em falha de carregamento, com área visual estável. Não inventar URL pública. | Recomendação técnica pronta para adoção. |
| Ação secundária de saída | Recomendo incluir na v1 com o contrato da seção 4. | Recomendação técnica pronta para adoção. |

O pedido de criar este parecer não equivale a uma decisão do proprietário sobre esses pontos. A revisão da RFC pode registrar as recomendações como propostas, mantendo a identificação do consumidor explicitamente em aberto.

## 8. Atualizações nos critérios de aceite da v1

Manteria os 14 critérios e ampliaria os casos dentro deles:

| Critério | Complemento proposto |
| --- | --- |
| AC-03 / AC-04 | Ação secundária durante submit aborta/invalida a tentativa; resultado tardio não gera sucesso. |
| AC-05 | `onSuccess` e falhas de notificações respeitam o contrato; ação secundária não cancela um sucesso já concluído. |
| AC-06 | Consulta e abertura compartilham o escopo por documento; conflito tem código identificável; cleanup permite abertura posterior, inclusive em `onClose`. |
| AC-07 | `SESSION_EXPIRED` persiste durante edição e erro de credenciais; `setError(null)` o limpa; resultado inválido produz `INTEGRATION_ERROR`. |
| AC-09 | Diagnóstico não inclui resultado bruto, senha, token ou exceção arbitrária. |
| AC-10 / AC-11 | Ação secundária é opcional, funciona com `dismissible: false`, tem label acessível e callbacks executados uma vez mesmo se `onClose` lançar. |
| AC-12 | Ausência ou falha de `logoUrl` mostra “MYIO” sem quebrar o layout. |

O showcase deve demonstrar sessão expirada seguida de erro de credenciais, saída durante uma resposta lenta e conflito de abertura. A integração inicial deve demonstrar separadamente que vários pedidos de reautenticação compartilham o fluxo do host e que todos os interessados recebem uma conclusão.

## 9. Encaminhamento

Aplicar B1–B6 da v1 com estes complementos no corpo da RFC e revisar tipos, exemplos, diagrama e critérios de aceite em conjunto. Manter adiados MFA, framework de reautenticação, helper GCDR obrigatório e eventos globais de sessão.

O parecer continua favorável à implementação após essa consolidação. As ressalvas do log melhoram a proposta, sobretudo ao tornar explícitas a saída do usuário e a persistência do aviso de sessão expirada.
