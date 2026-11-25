/**
 * RFC-0242 — public types of the floating MYIO Bot widget.
 */
import type { MyIOBotClient, MyIOBotClientOptions } from '../client';
import type { MyIOBotAuth } from '../authStrategies';
import type { MyIOBotContext, MyIOBotTurn } from '../contract';

export type MyIOBotLocale = 'pt-BR' | 'en';

export type MyIOBotThreadOption =
  /** Resume by host key (find-or-create). `persist` (default true) remembers the conversation id in localStorage. */
  | { key: string; persist?: boolean }
  | { conversationId: string };

export interface MyIOBotWidgetOptions extends Omit<MyIOBotClientOptions, 'gcdrApiBaseUrl' | 'auth'> {
  /** Required unless `client` is given. */
  gcdrApiBaseUrl?: string;
  /** Required unless `client` is given. */
  auth?: MyIOBotAuth;
  /** Reuse an existing client instead of building one from the options above. */
  client?: MyIOBotClient;
  /** Default key: `${host.app}:${host.customerId ?? '-'}:${status.kind}`. */
  thread?: MyIOBotThreadOption;
  /** Sent with every turn; never scraped from the page. */
  context?: MyIOBotContext;
  position?: 'bottom-right' | 'bottom-left';
  locale?: MyIOBotLocale;
  theme?: { accent?: string; dark?: boolean; fontLink?: false };
  /** Enables "Abrir no GCDR" → `${gcdrWebUrl}/bot#chat?c=<id>`. */
  gcdrWebUrl?: string;
  /** `false` = no floating pill (panel only, as `openMyIOBotPanel`). */
  launcher?: false | { label?: string; hiddenKey?: string; startOpen?: boolean };
  /** Default `document.body`. */
  container?: HTMLElement;
  /**
   * Drag the panel by its header, and the launcher pill, which snaps to the nearest
   * corner / edge midpoint (stored in `myio:bot:launcherPos:<host.app>`). Default true.
   */
  draggable?: boolean;
  /** localStorage key of the dragged position; default `myio:bot:panelPos:<host.app>`; `null` = do not persist. */
  panelPositionKey?: string | null;
}

export type MyIOBotWidgetEvent = 'open' | 'close' | 'turn' | 'error' | 'action' | 'maximize' | 'restore';

export interface MyIOBotWidgetHandle {
  open(): void;
  close(): void;
  toggle(): void;
  destroy(): void;
  /** Programmatic entry point ("ask about this OS"): opens the panel and sends. Rejects with the MyIOBotError of a failed turn. */
  ask(message: string, opts?: { newThread?: boolean }): Promise<MyIOBotTurn>;
  setContext(ctx: import('../contract').MyIOBotContext): void;
  /** Returns a dragged panel to its corner and forgets the stored position. */
  resetPosition(): void;
  /** Near-full-viewport panel (20px margin); dragging is disabled while maximized. */
  maximize(): void;
  /** Back to the previous size and position. */
  restore(): void;
  readonly isMaximized: boolean;
  on(event: MyIOBotWidgetEvent, cb: (payload: unknown) => void): () => void;
  readonly client: MyIOBotClient;
}
