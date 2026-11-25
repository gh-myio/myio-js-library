/**
 * RFC-0242 — widget strings. pt-BR (default) mirrors gcdr-frontend's `bot`
 * namespace (widget/states/errors/chat), adapted to an embedded host.
 */
import type { MyIOBotLocale } from './types';

const ptBR = {
  title: 'MYIO Bot',
  subtitle: 'Pergunte sobre clientes, dispositivos, alarmes e OS',
  close: 'Fechar',
  newConversation: 'Nova conversa',
  openInGcdr: 'Abrir no GCDR',
  hideLauncher: 'Ocultar botão flutuante',
  maximize: 'Maximizar',
  restore: 'Restaurar',
  loading: 'Carregando…',
  emptyTitle: 'Como posso ajudar?',
  emptyHint: 'Pergunte sobre clientes, dispositivos, alarmes, manutenções e desempenho. A conversa fica salva no Bot da MYIO.',
  threadEmpty: 'Conversa vazia. Escreva a primeira pergunta.',
  placeholder: 'Pergunte algo…',
  send: 'Enviar',
  cancel: 'Cancelar resposta',
  thinking: 'Pensando…',
  hints: '/think força raciocínio · /tools força ferramentas',
  readOnly: 'Somente leitura',
  retry: 'Tentar de novo',
  dismiss: 'Fechar aviso',
  untitled: 'Sem título',
  restrictedTitle: 'Acesso restrito',
  restrictedText: 'Esta credencial não tem acesso ao MYIO Bot (permissão bot.chat.use ou API key com escopo bot:use).',
  disabledTitle: 'Bot não disponível neste ambiente',
  disabledText: 'A API do GCDR não expõe /bot neste ambiente (BOT_ENABLED desligado).',
  offTitle: 'Bot desligado',
  offText: 'O interruptor MASTER do bot está desligado. Um operador liga na aba Operação do GCDR.',
  offlineTitle: 'Sem conexão com o GCDR',
  offlineText: 'Não foi possível falar com a API (rede ou origem não autorizada em ALLOWED_ORIGINS).',
  errorTitle: 'Erro ao carregar',
  errorText: 'Não foi possível falar com a API.',
  memoriesUsed: '{count} memórias usadas',
  tokens: '{in} in / {out} out',
  degraded: 'Degradado de {from} para {to}',
  capped: 'Nível limitado de {from} para {to}',
  proposalsTitle: 'O bot propôs {count} memórias',
  proposalsHint: 'Rascunhos já criados na Memória. Aprove o que vale ou descarte.',
  proposalsReadOnly: 'Rascunhos criados na Memória; a curadoria é feita no GCDR.',
  approve: 'Aprovar',
  discard: 'Descartar',
  ok: 'OK',
  actionBadge: '1 ação aguardando',
  actionTitle: 'Ação aguardando confirmação',
  affected: '{count} itens afetados',
  expiresIn: 'Expira em {time}',
  expired: 'Expirada — peça de novo ao bot',
  confirm: 'Confirmar',
  cancelAction: 'Cancelar',
  actionConfirmed: 'Ação confirmada.',
  actionCancelled: 'Ação cancelada.',
  errors: {
    BOT_DISABLED: 'O bot está desligado (interruptor MASTER).',
    BOT_NO_ELIGIBLE_PROVIDER: 'Nenhum provedor elegível para este canal (política de dados).',
    BOT_PROVIDER_EXHAUSTED: 'Todos os provedores falharam ou estão indisponíveis. Tente de novo em instantes.',
    BOT_BUDGET_EXCEEDED: 'Orçamento diário excedido para este nível; a pergunta não foi enviada.',
    BOT_MEMORY_REJECTED: 'A memória foi recusada pelo filtro de escrita.',
    FORBIDDEN: 'Sem permissão para esta operação do bot.',
    NOT_FOUND: 'Não encontrado (ou fora do seu alcance).',
    TIMEOUT: 'A API demorou demais para responder.',
    NETWORK_ERROR: 'Sem conexão com o GCDR.',
    STREAM_INCOMPLETE: 'A resposta foi interrompida.',
  } as Record<string, string>,
};

type Strings = typeof ptBR;

const en: Strings = {
  title: 'MYIO Bot',
  subtitle: 'Ask about customers, devices, alarms and work orders',
  close: 'Close',
  newConversation: 'New conversation',
  openInGcdr: 'Open in GCDR',
  hideLauncher: 'Hide floating button',
  maximize: 'Maximize',
  restore: 'Restore',
  loading: 'Loading…',
  emptyTitle: 'How can I help?',
  emptyHint: 'Ask about customers, devices, alarms, maintenance and performance. The conversation is saved in the MYIO Bot.',
  threadEmpty: 'Empty conversation. Write the first question.',
  placeholder: 'Ask something…',
  send: 'Send',
  cancel: 'Cancel answer',
  thinking: 'Thinking…',
  hints: '/think forces reasoning · /tools forces tools',
  readOnly: 'Read only',
  retry: 'Try again',
  dismiss: 'Dismiss',
  untitled: 'Untitled',
  restrictedTitle: 'Restricted access',
  restrictedText: 'This credential has no access to the MYIO Bot (bot.chat.use permission or an API key with scope bot:use).',
  disabledTitle: 'Bot not available in this environment',
  disabledText: 'The GCDR API does not expose /bot here (BOT_ENABLED is off).',
  offTitle: 'Bot switched off',
  offText: 'The bot MASTER switch is off. An operator turns it on in the GCDR Operation tab.',
  offlineTitle: 'No connection to GCDR',
  offlineText: 'Could not reach the API (network, or origin not in ALLOWED_ORIGINS).',
  errorTitle: 'Failed to load',
  errorText: 'Could not talk to the API.',
  memoriesUsed: '{count} memories used',
  tokens: '{in} in / {out} out',
  degraded: 'Degraded from {from} to {to}',
  capped: 'Tier capped from {from} to {to}',
  proposalsTitle: 'The bot proposed {count} memories',
  proposalsHint: 'Drafts already created in Memory. Approve what is worth keeping or discard.',
  proposalsReadOnly: 'Drafts created in Memory; curation happens in GCDR.',
  approve: 'Approve',
  discard: 'Discard',
  ok: 'OK',
  actionBadge: '1 action waiting',
  actionTitle: 'Action waiting for confirmation',
  affected: '{count} items affected',
  expiresIn: 'Expires in {time}',
  expired: 'Expired — ask the bot again',
  confirm: 'Confirm',
  cancelAction: 'Cancel',
  actionConfirmed: 'Action confirmed.',
  actionCancelled: 'Action cancelled.',
  errors: {
    BOT_DISABLED: 'The bot is switched off (MASTER switch).',
    BOT_NO_ELIGIBLE_PROVIDER: 'No eligible provider for this channel (data policy).',
    BOT_PROVIDER_EXHAUSTED: 'Every provider failed or is unavailable. Try again shortly.',
    BOT_BUDGET_EXCEEDED: 'Daily budget exceeded for this tier; the question was not sent.',
    BOT_MEMORY_REJECTED: 'The memory was refused by the write filter.',
    FORBIDDEN: 'No permission for this bot operation.',
    NOT_FOUND: 'Not found (or out of your reach).',
    TIMEOUT: 'The API took too long to answer.',
    NETWORK_ERROR: 'No connection to GCDR.',
    STREAM_INCOMPLETE: 'The answer was interrupted.',
  },
};

export type MyIOBotStringKey = Exclude<keyof Strings, 'errors'>;

export interface Translator {
  (key: MyIOBotStringKey, vars?: Record<string, string | number>): string;
  error(code: string | null | undefined, fallback: string): string;
}

export function createTranslator(locale: MyIOBotLocale | undefined): Translator {
  const s = locale === 'en' ? en : ptBR;
  const t = ((key: MyIOBotStringKey, vars?: Record<string, string | number>) =>
    String(s[key]).replace(/\{(\w+)\}/g, (_m, k: string) => (vars && vars[k] !== undefined ? String(vars[k]) : ''))) as Translator;
  t.error = (code, fallback) => (code && s.errors[code]) || fallback;
  return t;
}
