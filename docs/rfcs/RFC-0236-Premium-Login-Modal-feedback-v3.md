# RFC-0236 — Parecer técnico v3: revisão final

- **Data:** 2026-10-01
- **RFC:** [RFC-0236-Premium-Login-Modal.md](./RFC-0236-Premium-Login-Modal.md)
- **Histórico:** [feedback v1](./RFC-0236-Premium-Login-Modal-feedback-v1.md) e [feedback v2](./RFC-0236-Premium-Login-Modal-feedback-v2.md).
- **Origem do retorno:** conteúdo local de `logs/000-toCheck.log`, resumido abaixo, sem depender de sua publicação.
- **Parecer:** favorável à consolidação da RFC, com as duas correções normativas deste documento. Não é necessário abrir outra rodada de pareceres antes de consolidar.

## 1. Resumo do retorno recebido

O retorno concorda com o v2 sobre `solid` como default, coordenação de autenticação no host, diagnóstico restrito de `INTEGRATION_ERROR`, reserva síncrona da instância e aviso persistente de sessão expirada.

Pede dois ajustes: separar o aviso informativo em `notice`/`setNotice`, inicializável na abertura; e impedir que a ação secundária remova a cobertura antes de o host concluir a saída. Também observa que `logs/` está no `.gitignore` e que links para esse arquivo não serão utilizáveis no repositório publicado. Por fim, propõe consolidar o corpo da RFC e registrar as decisões aceitas, adiadas e rejeitadas.

**Concordo com os ajustes e com a consolidação.** Corrijo abaixo as regras do meu v2 que seriam incompatíveis com eles. O pedido de parecer v3 não é interpretado como pedido para reescrever a RFC nesta etapa.

## 2. Aviso informativo separado do erro

Aceito `notice` na abertura e `setNotice()` no handle. A exceção que propus em `setError` economizava um método, mas misturava dois estados que precisam permanecer independentes.

Contrato recomendado:

```ts
export interface LoginNotice {
  code: 'SESSION_EXPIRED';
}

// Adições às interfaces existentes:
// OpenLoginModalParams:
//   notice?: LoginNotice;
// LoginModalHandle:
//   setNotice(notice: LoginNotice | null): void;
```

Uso inicial:

```ts
const login = openLoginModal({
  notice: { code: 'SESSION_EXPIRED' },
  onSubmit,
});
```

Regras finais:

- Aplicar o aviso antes de tornar o modal visível e antes de `onOpen`.
- `setNotice(null)` limpa apenas o aviso; `setError(null)` limpa apenas o erro.
- Editar campos, iniciar submit ou receber credenciais inválidas não remove o aviso.
- Aviso não bloqueia submit. Renderizar como informação traduzida, com anúncio acessível sem roubar foco.
- Sucesso e fechamento limpam aviso, erro e dados transitórios conforme o ciclo de vida.
- Não criar tratamento especial de `SESSION_EXPIRED` dentro de `setError` ou de `LoginSubmitResult`.

Como a API ainda é proposta, recomendo retirar `SESSION_EXPIRED` da lista explícita de erros e dos exemplos de `setError`, mantendo-o em `LoginNotice`. A união aberta de códigos desconhecidos continua permitindo receber essa string; nesse canal, ela deve seguir o fallback genérico de erro, sem alterar o aviso. O host que identifica a expiração usa o canal de notice.

**Precisão sobre o “piscar”:** abrir e chamar um setter imediatamente na mesma execução síncrona não implica necessariamente um frame intermediário. O risco existe quando a atualização acontece depois, em outra etapa. O ganho principal do parâmetro inicial é garantir um estado inicial completo e uma API semanticamente coerente, sem depender do momento em que o consumidor chama o setter.

Isso substitui a seção 5 e o complemento correspondente do AC-07 no v2. Não exige um modo completo de reautenticação.

## 3. Saída secundária: preparar o destino antes de remover a cobertura

A crítica procede: minha ordem anterior — fechar, emitir `onClose`, depois chamar `onClick` — permite expor o conteúdo anterior. Ela deve ser substituída.

Também não considero suficiente exigir que o host “navegue de forma síncrona”. Chamar `location.assign()` ou uma função de roteamento não garante que o destino já tenha sido carregado e apresentado. A regra precisa tratar a conclusão da transição.

Recomendo uma saída em duas etapas: **cancelar a tentativa de login e preparar o destino mantendo a cobertura; fechar somente quando o destino estiver pronto.**

Proposta de contrato:

```ts
export interface LoginSecondaryAction {
  label: string;
  onClick: (context: { signal: AbortSignal }) => void | Promise<void>;
  /** Default: true. false mantém a cobertura até handle.close(). */
  closeOnComplete?: boolean;
  /** Default: 30000. Limita a espera pelo callback. */
  timeoutMs?: number;
}
```

`secondaryAction` continua opcional. O contexto não contém credenciais. Esse contrato é uma recomendação final para a revisão, não uma funcionalidade já implementada.

### Sequência e recuperação

1. A ação permanece disponível durante `submitting` e em erros de conta, inclusive com `dismissible: false`.
2. Ao ativar, invalidar a tentativa de login, abortar seu sinal e limpar senha/token. Entrar em `leaving`, mantendo o overlay, o foco e a reserva da instância.
3. Chamar `onClick` uma vez por ativação aceita. Durante a execução, ignorar cliques duplicados e impedir novo submit. O sinal da saída pertence a uma operação diferente do submit abortado.
4. Se o callback concluir e `closeOnComplete` for `true`, fechar com cleanup completo e então emitir `onClose('secondary')` uma única vez. Resolver o callback significa que o host já preparou um destino que pode ser revelado.
5. Se `closeOnComplete` for `false`, manter `leaving` e a cobertura até o host chamar `close()` ou até a página ser descarregada. O timeout limita a execução do callback, não esse período posterior de cobertura deliberada.
6. Se houver exceção, rejeição ou timeout durante o callback, abortar/inativar a operação de saída e retornar a um formulário utilizável, com senha vazia, aviso contextual preservado e captcha novamente preparado quando necessário. Exibir mensagem genérica de falha na saída, sem classificá-la como senha incorreta. Permitir nova tentativa explícita de saída.
7. `close()`/`destroy()` continuam disponíveis durante `leaving`, abortam qualquer callback pendente e tornam seu resultado tardio irrelevante. Nesse fluxo, o motivo de fechamento é `'secondary'`; fora dele, permanece `'api'`.

Erros de conta que já bloqueavam submit não são apagados apenas porque a saída falhou. A mensagem de falha da saída não pode eliminar esse bloqueio. Assim, “formulário utilizável” inclui as restrições anteriores e a possibilidade de tentar sair novamente.

No estado `success`, manter a ação secundária indisponível: a sessão já foi estabelecida, e sua eventual revogação pertence ao host. `isLoginModalOpen()` retorna `true` durante `leaving`, inclusive quando aguarda fechamento explícito.

Exemplo para navegação de documento, cuja conclusão não é representada pelo retorno de `location.assign`:

```ts
secondaryAction: {
  label: 'Voltar ao início',
  closeOnComplete: false,
  onClick: () => location.assign('/'),
}
```

Nesse exemplo o overlay acompanha a página antiga até ela ser substituída. Em navegação SPA, o callback pode aguardar o destino estar pronto e usar fechamento automático. A conclusão da requisição de dados, sozinha, não prova que a nova tela já foi apresentada.

Para uma transição que precise abrir outro modal, o host pode optar pelo fechamento explícito e abrir o próximo no callback de fechamento, após a liberação da reserva. Não deve tentar abrir outro login enquanto a instância em `leaving` ainda estiver ativa.

Essa solução adiciona estado e recuperação porque a ação pode ser assíncrona; não seria correto prometer cobertura contínua apenas trocando a ordem de dois callbacks. O host continua responsável por respeitar o cancelamento e por tratar falhas de navegação após optar pela cobertura manual.

**Substitui a seção 4 do v2:** `onClick` ocorre antes do fechamento; `onClose` é notificação posterior ao cleanup. Exceções de `onClose` não desfazem a saída nem interrompem o cleanup. Não se deve copiar a ordem antiga para a RFC consolidada.

## 4. Referências que sobrevivem à publicação

Confirmei com `git check-ignore -v logs/000-toCheck.log` que a regra `logs/`, na linha 15 de `.gitignore`, ignora o arquivo.

Este v3 registra o nome do arquivo apenas como procedência e inclui o resumo necessário na seção 1. Não exige publicar logs ou alterar `.gitignore`.

Na consolidação, as referências normativas devem apontar para a RFC e os pareceres versionáveis. Os links históricos dos pareceres anteriores não precisam ser usados para compreender este documento. Se esses documentos forem preparados para publicação, pode-se substituir seus links para o log por notas de procedência, preservando seu conteúdo histórico.

## 5. Decisões finais para consolidar

| Tema | Recomendação final |
| --- | --- |
| Contratos B1–B6 | Manter, com aviso independente e a nova sequência de saída. |
| Backdrop | `solid` como default; `blur` é escolha explícita do consumidor. |
| Instância | Única por documento, reserva síncrona, consulta consistente e conflito explícito. |
| Coordenação de widgets | Responsabilidade do host; não adicionar sessão global à biblioteca visual. |
| Sessão expirada | `notice` inicial e `setNotice`, independentes de `setError`. |
| Saída secundária | Opcional na v1, com preparação do destino antes de fechar e recuperação de falha. |
| Logo | Recomendo fallback textual “MYIO” quando ausente ou indisponível; URL customizável. |
| Diagnóstico | `INTEGRATION_ERROR` para resultado inválido, com mensagem fixa e sem dados do host. |
| Expansões | Adiar MFA, modo completo de reautenticação, helper GCDR obrigatório e eventos globais de sessão. |

Primeiro sistema, responsável e data continuam não confirmados. O log cita a organização dos orquestradores na MAIN_VIEW v5.2.0 como argumento a favor do coordenador; isso não equivale à escolha formal de um primeiro consumidor nem à comprovação de que o fluxo de autenticação já existe.

Fallback textual e ação secundária são recomendações técnicas deste parecer. Não há necessidade de interromper a redação de uma proposta consolidada por essas escolhas: basta identificá-las como propostas, sem atribuir aprovação ao proprietário. A identificação do consumidor deve estar preenchida antes da validação da integração real.

## 6. Ajustes finais nos 14 critérios de aceite

Preservar a numeração da v1, incorporando os complementos do v2 e substituindo os trechos conflitantes pelos seguintes:

| Critério | Verificação final |
| --- | --- |
| AC-03 / AC-04 | Saída invalida submit; `leaving` ignora duplicatas; timeout, fechamento e respostas tardias de ambas as operações respeitam seus sinais e identificadores. |
| AC-05 | Cobertura permanece até destino pronto ou fechamento explícito; `onClose('secondary')` só ocorre após cleanup; falha da saída permite recuperação sem reenviar senha automaticamente. |
| AC-06 | `leaving` mantém a instância reservada; liberação ocorre antes de `onClose`; abertura posterior funciona. |
| AC-07 | Notice já existe na primeira apresentação; edição e erro de senha o preservam; `setError(null)` e `setNotice(null)` limpam apenas seus próprios estados. |
| AC-09 | Callback secundário recebe apenas contexto de cancelamento; diagnósticos não incluem senha/token ou objetos arbitrários. |
| AC-10 / AC-11 | Saída funciona durante submit e com `dismissible: false`; foco permanece válido durante transição, timeout e recuperação. |
| AC-12 | Showcase demonstra saída SPA aguardável, navegação com cobertura mantida, saída rejeitada e timeout; fallback do logo e notice continuam cobertos. |

A continuidade visual da cobertura deve ser conferida em navegador. Teste de sequência de callbacks no jsdom não demonstra ausência de um frame expondo a página anterior.

## 7. Encerramento da revisão

**O próximo passo recomendado é consolidar o corpo da RFC.** Usar a v1 como base, incorporar o v2 e aplicar este v3 como correção dos contratos de notice e saída. Tipos, exemplos, diagrama e critérios de aceite devem expressar a mesma sequência de execução.

Ao final, uma tabela curta de decisões aceitas, adiadas e rejeitadas é suficiente. A rodada BMAD pode permanecer identificada como registro histórico, sem competir com o corpo normativo. Este parecer encerra a revisão técnica proposta; aprovação de produto e validação da implementação continuam sendo etapas distintas.
