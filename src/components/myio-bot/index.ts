/**
 * RFC-0242 — MYIO Bot SDK, protocol side: the transport-only client of the
 * GCDR company bot (gcdr RFC-0087). The floating widget lives in `./widget`.
 */
export { createMyIOBotClient, formatBotContextLine, applyBotContextPrefix, stripBotContextPrefix } from './client';
export type {
  MyIOBotClient,
  MyIOBotClientOptions,
  MyIOBotHostInfo,
  MyIOBotConversationDetail,
  MyIOBotSendInput,
} from './client';
export { MyIOBotError, isMyIOBotError } from './errors';
export { createBotAuthStrategy } from './authStrategies';
export type { MyIOBotAuth, MyIOBotAuthStrategy } from './authStrategies';
export { consumeSseBuffer, readBotEvents } from './sse';
export type { MyIOBotStreamEvent } from './sse';
export { MYIO_BOT_PROTOCOL_VERSION } from './contract';
export type {
  MyIOBotTurn,
  MyIOBotPendingAction,
  MyIOBotConversation,
  MyIOBotMessage,
  MyIOBotProposal,
  MyIOBotStatus,
  MyIOBotPermissions,
  MyIOBotContext,
  MyIOBotMemory,
  MyIOBotMemoryProposal,
  MyIOBotProposeResult,
  MyIOBotActionResult,
  MyIOBotTier,
} from './contract';
export type { MyIOBotWidgetOptions, MyIOBotWidgetHandle } from './widget/types';
