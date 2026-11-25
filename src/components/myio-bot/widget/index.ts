/**
 * RFC-0242 — `createMyIOBotWidget()` / `openMyIOBotPanel()`: the floating
 * "MYIO Bot" chat, vanilla TS in a Shadow DOM, built on `createMyIOBotClient`.
 *
 * Behavioural reference: gcdr-frontend `BotWidget.tsx` + `useBotChat.ts`
 * (status on first open → access states 403/404/503; SSE with JSON fallback;
 * optimistic user turn removed on failure; tier/provider/model footer;
 * proposals card; notice of the data policy).
 *
 * Nothing of the host page is read: only `context` (host-given) is sent.
 * Storage: `myio:bot:launcherHidden` (or `launcher.hiddenKey`) and, unless
 * `thread.persist === false`, `myio:bot:thread:<key>` → conversation id
 * (GCDR does not list API-key conversations, so the id is what resumes them).
 */
import { createMyIOBotClient, stripBotContextPrefix, type MyIOBotClient } from '../client';
import type { MyIOBotContext, MyIOBotConversation, MyIOBotMessage, MyIOBotPendingAction, MyIOBotProposal, MyIOBotStatus, MyIOBotTurn } from '../contract';
import { MyIOBotError, isMyIOBotError } from '../errors';
import { h, clear, safeStorage } from './dom';
import { createTranslator } from './i18n';
import { createLauncher, DEFAULT_LAUNCHER_HIDDEN_KEY } from './launcher';
import { createPanel, renderState, type AccessPhase } from './panel';
import { createComposer } from './composer';
import { renderMessage, renderStreaming, renderAlert, renderProposals, type ViewMessage } from './thread';
import { renderActionCard, type ActionCardView } from './actionCard';
import { WIDGET_CSS, NUNITO_HREF } from './styles';
import {
  enablePanelDrag,
  enableLauncherSnap,
  placePanelNearAnchor,
  PANEL_POS_PREFIX,
  LAUNCHER_POS_PREFIX,
  type PanelDrag,
  type LauncherSnap,
} from './drag';
import type { MyIOBotWidgetEvent, MyIOBotWidgetHandle, MyIOBotWidgetOptions } from './types';

export { loadBotWidget, resolveBotWidgetUrl } from './loader';
export type { LoadBotWidgetOptions, MyIOBotWidgetGlobal } from './loader';
export type { MyIOBotWidgetOptions, MyIOBotWidgetHandle, MyIOBotWidgetEvent, MyIOBotThreadOption, MyIOBotLocale } from './types';

type Phase = 'idle' | 'loading' | 'ready' | AccessPhase;

const THREAD_STORE_PREFIX = 'myio:bot:thread:';
let fontRefs = 0;
let fontLinkEl: HTMLLinkElement | null = null;

function acquireFont(): void {
  fontRefs++;
  if (fontLinkEl || typeof document === 'undefined') return;
  if (document.querySelector('link[data-myio-bot-font]')) return;
  const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((l) => /family=Nunito/i.test((l as HTMLLinkElement).href));
  if (existing) return;
  fontLinkEl = document.createElement('link');
  fontLinkEl.rel = 'stylesheet';
  fontLinkEl.href = NUNITO_HREF;
  fontLinkEl.setAttribute('data-myio-bot-font', '');
  document.head.appendChild(fontLinkEl);
}

function releaseFont(): void {
  fontRefs = Math.max(0, fontRefs - 1);
  if (fontRefs === 0 && fontLinkEl) {
    fontLinkEl.parentNode?.removeChild(fontLinkEl);
    fontLinkEl = null;
  }
}

/** Status/transport error → access phase (gcdr-frontend `accessOf`, plus offline). */
function phaseOf(e: unknown): AccessPhase {
  const err = isMyIOBotError(e) ? e : null;
  const code = err?.code || '';
  const st = err?.status || 0;
  if (code === 'FORBIDDEN' || code === 'UNAUTHORIZED' || st === 401 || st === 403) return 'restricted';
  if (code === 'NOT_FOUND' || st === 404) return 'disabled';
  if (code === 'BOT_DISABLED' || code === 'BOT_NO_ELIGIBLE_PROVIDER' || st === 503) return 'off';
  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') return 'offline';
  return 'error';
}

function toView(m: MyIOBotMessage): ViewMessage | null {
  if (m.role !== 'user' && m.role !== 'assistant') return null;
  return {
    id: m.id,
    role: m.role,
    content: m.role === 'user' ? stripBotContextPrefix(String(m.content ?? '')) : String(m.content ?? ''),
    tier: m.tier,
    provider: m.provider,
    model: m.model,
    tokensIn: m.tokensIn,
    tokensOut: m.tokensOut,
    memoryIds: m.memoryIds || [],
  };
}

function turnView(turn: MyIOBotTurn): ViewMessage {
  return {
    id: turn.messageId ?? `a${Date.now()}`,
    role: 'assistant',
    content: String(turn.answer ?? ''),
    tier: turn.tier,
    provider: turn.provider,
    model: turn.model,
    tokensIn: turn.usage?.tokensIn ?? null,
    tokensOut: turn.usage?.tokensOut ?? null,
    memoryIds: turn.memoryIds || [],
    degradedFrom: turn.degradedFrom ?? null,
    cappedFrom: turn.cappedFrom ?? null,
  };
}

function titleOf(q: string): string {
  return q.replace(/^\/(think|tools)\b\s*/i, '').slice(0, 60);
}

export function createMyIOBotWidget(options: MyIOBotWidgetOptions): MyIOBotWidgetHandle {
  if (typeof document === 'undefined') throw new MyIOBotError('CONFIG_ERROR', 'MyIO Bot widget needs a browser document.');
  const o = options || ({} as MyIOBotWidgetOptions);
  const client: MyIOBotClient =
    o.client ||
    createMyIOBotClient({
      ...o,
      gcdrApiBaseUrl: o.gcdrApiBaseUrl as string,
      auth: o.auth as NonNullable<MyIOBotWidgetOptions['auth']>,
    });
  const t = createTranslator(o.locale);
  const side: 'right' | 'left' = o.position === 'bottom-left' ? 'left' : 'right';
  const launcherOpt = o.launcher === false ? null : o.launcher || {};
  const hiddenKey = (launcherOpt && launcherOpt.hiddenKey) || DEFAULT_LAUNCHER_HIDDEN_KEY;
  const listeners = new Map<string, Set<(p: unknown) => void>>();
  let context: MyIOBotContext | undefined = o.context ? { ...o.context } : undefined;

  // ── state ──────────────────────────────────────────────────────────────
  let destroyed = false;
  let isOpen = false;
  let hidden = !!launcherOpt && safeStorage.get(hiddenKey) === '1';
  let phase: Phase = 'idle';
  let phaseMessage: string | null = null;
  let status: MyIOBotStatus | null = null;
  let conversation: MyIOBotConversation | null = null;
  let messages: ViewMessage[] = [];
  let streaming: string | null = null;
  let busy = false;
  let error: { code: string; message: string } | null = null;
  let notice: string | null = null;
  let proposals: MyIOBotProposal[] = [];
  const decidingProposals = new Set<string>();
  let pendingAction: MyIOBotPendingAction | null = null;
  let actionBusy = false;
  let actionView: ActionCardView | null = null;
  let actionTimer: ReturnType<typeof setInterval> | null = null;
  let abort: AbortController | null = null;
  let initPromise: Promise<void> | null = null;
  let streamView: ReturnType<typeof renderStreaming> | null = null;
  let tempId = -1;
  /** A newConversation() is in flight (guards the `+` against repeated activation). */
  let creatingThread = false;
  let maximized = false;

  const emit = (ev: MyIOBotWidgetEvent, payload: unknown) => {
    listeners.get(ev)?.forEach((cb) => { try { cb(payload); } catch { /* host callback errors never break the widget */ } });
  };

  // ── DOM ────────────────────────────────────────────────────────────────
  const hostEl = h('div', { 'data-myio-bot-widget': '' });
  const shadow = hostEl.attachShadow ? hostEl.attachShadow({ mode: 'open' }) : (hostEl as unknown as ShadowRoot);
  const root = h('div', { class: `mb${o.theme?.dark ? ' dark' : ''}` });
  if (o.theme?.accent) root.style.setProperty('--mb-accent', o.theme.accent);
  shadow.appendChild(h('style', null, WIDGET_CSS));
  shadow.appendChild(root);
  if (o.theme?.fontLink !== false) acquireFont();

  const launcher = launcherOpt ? createLauncher(launcherOpt.label || t('title'), side, () => toggle()) : null;
  const panel = createPanel(t, { side, solo: !launcher, canHide: !!launcher }, {
    onNew: () => { void newConversation(); },
    onHide: () => { hidden = true; safeStorage.set(hiddenKey, '1'); close(); },
    onClose: () => close(),
    onMaximize: () => (maximized ? restore() : maximize()),
  });
  const composer = createComposer(t, (text) => { void sendText(text).catch(() => undefined); }, () => abort?.abort());
  panel.el.appendChild(composer.el);
  panel.el.style.display = 'none';
  root.appendChild(panel.el);
  if (launcher) root.appendChild(launcher.el);
  (o.container || document.body).appendChild(hostEl);

  const snap: LauncherSnap | null = launcher && o.draggable !== false
    ? enableLauncherSnap(
        launcher.el,
        o.panelPositionKey === null ? null : `${LAUNCHER_POS_PREFIX}${o.host?.app || 'default'}`,
        side === 'left' ? 'bl' : 'br',
        // a panel without a custom position follows the pill (drag may be undefined while constructing)
        () => { if (isOpen) drag?.apply(); },
      )
    : null;
  const defaultAnchor = side === 'left' ? 'bl' : 'br';
  // pill in its default corner → the CSS corner placement already fits; otherwise sit next to the pill
  const placeNearLauncher = snap && launcher
    ? () => { if (snap.anchor() !== defaultAnchor) placePanelNearAnchor(panel.el, launcher.el, snap.anchor()); }
    : undefined;
  const drag: PanelDrag | null = o.draggable === false
    ? null
    : enablePanelDrag(panel.el, panel.head, o.panelPositionKey === null ? null : o.panelPositionKey || `${PANEL_POS_PREFIX}${o.host?.app || 'default'}`, () => maximized, placeNearLauncher);

  function maximize() {
    if (destroyed || maximized) return;
    maximized = true;
    panel.setMaximized(true);
    emit('maximize', null);
  }
  function restore() {
    if (destroyed || !maximized) return;
    maximized = false;
    panel.setMaximized(false);
    drag?.apply(); // re-clamp the previous position to the current viewport
    emit('restore', null);
  }

  /** Focus is "ours to take" when it is inside the widget, or nowhere in particular (body). Never steal it from the host page. */
  const focusIsFree = () => {
    const a = document.activeElement;
    return !a || a === document.body || a === document.documentElement || a === hostEl;
  };
  /** Puts the caret back in the composer (after a turn, a new thread, a decision…). */
  const refocus = () => {
    if (destroyed || !isOpen || !composer.editable() || !focusIsFree()) return;
    if (shadow.activeElement === composer.input) return;
    composer.focus();
  };

  const onKey = (e: Event) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Escape' && isOpen) { close(); return; }
    // Type-to-composer: a printable key (Space included) pressed while focus is on any
    // other control of the widget goes to the composer instead of activating that
    // control — typing must never "click" `+` (new thread) or `–` (hide). RFC-0242 bugfix.
    if (!isOpen || ke.ctrlKey || ke.metaKey || ke.altKey || ke.isComposing || ke.key.length !== 1) return;
    const target = ke.composedPath ? (ke.composedPath()[0] as Element) : (ke.target as Element);
    if (target === composer.input || !composer.editable()) return;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    ke.preventDefault();
    composer.focus();
    composer.insertText(ke.key);
  };
  // keyup of Space is where browsers activate a focused button: swallow it outside the composer.
  const onKeyUp = (e: Event) => {
    const ke = e as KeyboardEvent;
    if (!isOpen || ke.key !== ' ') return;
    const target = ke.composedPath ? (ke.composedPath()[0] as Element) : (ke.target as Element);
    if (target && target !== composer.input && target.tagName === 'BUTTON' && panel.head.contains(target)) ke.preventDefault();
  };
  root.addEventListener('keydown', onKey);
  root.addEventListener('keyup', onKeyUp);

  const canUse = () => phase === 'ready' && !!status?.permissions.use;
  const readOnly = () => !!conversation && (conversation.isOwner === false || conversation.status === 'CLOSED');
  const threadKey = (): string | null => {
    const th = o.thread;
    if (th && 'conversationId' in th) return null;
    if (th && 'key' in th && th.key) return String(th.key).slice(0, 120);
    const app = o.host?.app || 'myio-bot-widget';
    return `${app}:${o.host?.customerId ?? '-'}:${(status?.kind || 'user').toLowerCase()}`.slice(0, 120);
  };
  const persist = () => !(o.thread && 'key' in o.thread && o.thread.persist === false);
  const remember = (id: string | null) => {
    const k = threadKey();
    if (!k || !persist()) return;
    if (id) safeStorage.set(THREAD_STORE_PREFIX + k, id);
    else safeStorage.remove(THREAD_STORE_PREFIX + k);
  };

  function stopActionTimer() {
    if (actionTimer) clearInterval(actionTimer);
    actionTimer = null;
  }

  function updateChrome() {
    const muted = phase === 'restricted' || phase === 'disabled' || phase === 'off' || phase === 'offline' || phase === 'error';
    launcher?.update({ open: isOpen, muted, streaming: busy, badge: pendingAction ? t('actionBadge') : null, hidden: hidden && !isOpen });
    snap?.apply(); // the pill width changes with the badge; keep it on its anchor
    panel.el.style.display = isOpen ? '' : 'none';
    panel.setSubtitle(conversation ? conversation.title || t('untitled') : t('subtitle'));
    const web = o.gcdrWebUrl ? String(o.gcdrWebUrl).replace(/\/+$/, '') : null;
    panel.setGcdrHref(web ? (conversation ? `${web}/bot#chat?c=${encodeURIComponent(conversation.id)}` : `${web}/bot`) : null);
    panel.setNewEnabled(canUse() && !!conversation, busy || creatingThread);
    composer.setMode(!canUse() ? 'none' : readOnly() ? 'readonly' : 'edit');
    composer.setBusy(busy);
  }

  function render() {
    if (destroyed) return;
    updateChrome();
    const body = panel.body;
    clear(body);
    streamView = null;
    actionView = null;
    stopActionTimer();
    if (phase === 'idle' || phase === 'loading') {
      body.appendChild(h('div', { class: 'state', 'data-state': 'loading' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), t('loading')));
      return;
    }
    if (phase !== 'ready') {
      body.appendChild(renderState(t, phase, phaseMessage, () => { void retry(); }));
      return;
    }
    if (!messages.length && streaming === null) {
      body.appendChild(conversation
        ? h('p', { class: 'muted', 'data-part': 'thread-empty' }, t('threadEmpty'))
        : h('div', { class: 'empty', 'data-part': 'empty' }, h('h3', null, t('emptyTitle')), h('p', null, t('emptyHint'))));
    }
    for (const m of messages) body.appendChild(renderMessage(t, m));
    if (streaming !== null) {
      streamView = renderStreaming(t, streaming);
      body.appendChild(streamView.el);
    }
    if (notice) body.appendChild(renderAlert('info', notice));
    if (proposals.length) {
      const perms = status?.permissions;
      const canDecide = (p: MyIOBotProposal) =>
        !!perms && (perms.curate || perms.curateAll || p.scopeType === 'USER' || p.scopeType === 'CONVERSATION');
      body.appendChild(renderProposals(t, proposals, canDecide, (id, d) => { void decide(id, d); }, (id) => {
        proposals = proposals.filter((p) => p.id !== id);
        render();
      }, decidingProposals));
    }
    if (pendingAction) {
      const a = pendingAction;
      actionView = renderActionCard(t, a, actionBusy, () => { void decideAction(a, 'confirm'); }, () => { void decideAction(a, 'cancel'); });
      body.appendChild(actionView.el);
      if (a.expiresAt) {
        actionTimer = setInterval(() => { if (actionView && !actionView.tick()) stopActionTimer(); }, 1000);
      }
    }
    if (error) body.appendChild(renderAlert('error', t.error(error.code, error.message), () => { error = null; render(); }, t('dismiss')));
    try { body.scrollTop = body.scrollHeight; } catch { /* jsdom */ }
  }

  // ── data flow ──────────────────────────────────────────────────────────
  function setFailure(e: unknown) {
    phase = phaseOf(e);
    phaseMessage = isMyIOBotError(e) ? e.message : e instanceof Error ? e.message : String(e);
    emit('error', e);
  }

  async function loadConversation(id: string): Promise<boolean> {
    try {
      const d = await client.conversations.get(id);
      conversation = d.conversation;
      messages = d.messages.map(toView).filter((m): m is ViewMessage => !!m);
      return true;
    } catch (e) {
      if (isMyIOBotError(e) && (e.status === 404 || e.status === 403 || e.code === 'NOT_FOUND')) return false;
      throw e;
    }
  }

  async function init(): Promise<void> {
    phase = 'loading';
    phaseMessage = null;
    render();
    try {
      status = await client.status();
      if (!status.permissions.use) { phase = 'restricted'; render(); return; }
      if (!status.master) { phase = 'off'; render(); return; }
      const th = o.thread;
      if (th && 'conversationId' in th && th.conversationId) {
        await loadConversation(th.conversationId);
      } else {
        const key = threadKey();
        const stored = key && persist() ? safeStorage.get(THREAD_STORE_PREFIX + key) : null;
        let ok = false;
        if (stored) {
          ok = await loadConversation(stored);
          if (!ok) remember(null);
        }
        if (!ok && key) {
          const found = await client.conversations.find(key);
          if (found) { ok = await loadConversation(found.id); if (ok) remember(found.id); }
        }
      }
      phase = 'ready';
    } catch (e) {
      setFailure(e);
    }
    render();
  }

  function ensureInit(): Promise<void> {
    if (!initPromise) initPromise = init();
    return initPromise;
  }

  async function retry() {
    initPromise = null;
    status = null;
    await ensureInit();
  }

  async function ensureConversation(firstMessage: string): Promise<MyIOBotConversation> {
    if (conversation) return conversation;
    const key = threadKey();
    let conv: MyIOBotConversation;
    if (key) {
      try {
        conv = await client.conversations.resolve(key, { title: titleOf(firstMessage) });
      } catch (e) {
        // The key may already belong to a CLOSED thread (unique per owner+key): start a keyless one.
        if (isMyIOBotError(e) && (e.status === 409 || e.code === 'CONFLICT')) conv = await client.conversations.create({ title: titleOf(firstMessage) });
        else throw e;
      }
    } else {
      conv = await client.conversations.create({ title: titleOf(firstMessage) });
    }
    conversation = conv;
    remember(conv.id);
    return conv;
  }

  async function sendText(text: string): Promise<MyIOBotTurn> {
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new MyIOBotError('VALIDATION_ERROR', 'Mensagem vazia.', 400);
    await ensureInit();
    if (!canUse()) throw new MyIOBotError(phase === 'ready' ? 'FORBIDDEN' : 'UNAVAILABLE', phaseMessage || t('restrictedTitle'));
    if (busy) throw new MyIOBotError('BUSY', 'Uma resposta já está em andamento.');
    if (readOnly()) throw new MyIOBotError('FORBIDDEN', t('readOnly'), 403);
    busy = true;
    error = null;
    notice = null;
    const userMsg: ViewMessage = { id: tempId--, role: 'user', content: trimmed };
    messages = [...messages, userMsg];
    streaming = '';
    render();
    const ctrl = new AbortController();
    abort = ctrl;
    let turn: MyIOBotTurn | null = null;
    let failure: MyIOBotError | null = null;
    try {
      const conv = await ensureConversation(trimmed);
      for await (const ev of client.conversations.stream(conv.id, { message: trimmed, context }, ctrl.signal)) {
        if (destroyed) break;
        if (ev.type === 'delta') {
          streaming = (streaming || '') + ev.text;
          streamView?.set(streaming);
        } else if (ev.type === 'done') {
          turn = ev.turn;
        } else {
          failure = ev.error;
        }
      }
    } catch (e) {
      failure = isMyIOBotError(e) ? e : new MyIOBotError('ERROR', e instanceof Error ? e.message : String(e));
    } finally {
      if (abort === ctrl) abort = null;
    }
    busy = false;
    streaming = null;
    if (destroyed) throw new MyIOBotError('ABORTED', 'Widget destroyed.');
    if (turn) {
      messages = [...messages, turnView(turn)];
      proposals = Array.isArray(turn.proposals) ? turn.proposals.slice() : [];
      pendingAction = turn.pendingAction && turn.pendingAction.id ? turn.pendingAction : null;
      notice = turn.notice || null;
      if (conversation) conversation = { ...conversation, lastTier: turn.tier, lastProvider: turn.provider };
      render();
      refocus();
      emit('turn', turn);
      return turn;
    }
    const err = failure || new MyIOBotError('STREAM_INCOMPLETE', 'O stream terminou sem resultado.', 502);
    messages = messages.filter((m) => m.id !== userMsg.id);
    if (!composer.value()) composer.setValue(trimmed);
    if (err.code !== 'ABORTED') {
      error = { code: err.code, message: err.message };
      emit('error', err);
    }
    render();
    refocus();
    throw err;
  }

  async function decide(id: string, d: 'approve' | 'reject') {
    decidingProposals.add(id);
    render();
    try {
      await client.memories.decide(id, d);
      proposals = proposals.filter((p) => p.id !== id);
    } catch (e) {
      const err = isMyIOBotError(e) ? e : new MyIOBotError('ERROR', String(e));
      error = { code: err.code, message: err.message };
      emit('error', err);
    } finally {
      decidingProposals.delete(id);
      render();
      refocus();
    }
  }

  async function decideAction(a: MyIOBotPendingAction, kind: 'confirm' | 'cancel') {
    if (actionBusy) return;
    actionBusy = true;
    render();
    try {
      const result = kind === 'confirm' ? await client.actions.confirm(a.id) : (await client.actions.cancel(a.id), null);
      pendingAction = null;
      messages = [...messages, { id: `act${tempId--}`, role: 'assistant', content: kind === 'confirm' ? (result && typeof result.summary === 'string' ? result.summary : t('actionConfirmed')) : t('actionCancelled') }];
      emit('action', { type: kind === 'confirm' ? 'confirmed' : 'cancelled', action: a, result });
    } catch (e) {
      const err = isMyIOBotError(e) ? e : new MyIOBotError('ERROR', String(e));
      error = { code: err.code, message: err.message };
      emit('error', err);
    } finally {
      actionBusy = false;
      render();
      refocus();
    }
  }

  async function newConversation(): Promise<void> {
    if (busy || creatingThread) return;
    creatingThread = true;
    conversation = null;
    messages = [];
    proposals = [];
    pendingAction = null;
    notice = null;
    error = null;
    render();
    try {
      await ensureInit();
      if (!canUse()) return;
      // A fresh thread has no key (the key is unique per owner); its id takes the key's place in storage.
      conversation = await client.conversations.create({});
      remember(conversation.id);
    } catch (e) {
      const err = isMyIOBotError(e) ? e : new MyIOBotError('ERROR', String(e));
      error = { code: err.code, message: err.message };
      emit('error', err);
    } finally {
      creatingThread = false;
      render();
      refocus();
    }
  }

  // ── handle ─────────────────────────────────────────────────────────────
  function open() {
    if (destroyed) return;
    if (hidden && launcher) { hidden = false; safeStorage.remove(hiddenKey); }
    if (!isOpen) {
      isOpen = true;
      render();
      drag?.apply();
      emit('open', null);
    }
    void ensureInit().then(() => { if (isOpen) composer.focus(); });
  }

  function close() {
    if (destroyed || !isOpen) return;
    isOpen = false;
    updateChrome();
    emit('close', null);
    if (!launcher) destroy();
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    abort?.abort();
    stopActionTimer();
    drag?.destroy();
    snap?.destroy();
    root.removeEventListener('keydown', onKey);
    root.removeEventListener('keyup', onKeyUp);
    hostEl.parentNode?.removeChild(hostEl);
    if (o.theme?.fontLink !== false) releaseFont();
    listeners.clear();
  }

  updateChrome();
  if (!launcher || launcherOpt?.startOpen) open();

  return {
    open,
    close,
    toggle,
    destroy,
    async ask(message, opts = {}) {
      open();
      await ensureInit();
      if (opts.newThread && conversation) await newConversation();
      return sendText(message);
    },
    setContext(ctx) {
      context = ctx ? { ...ctx } : undefined;
    },
    resetPosition() {
      snap?.reset();
      drag?.reset();
    },
    maximize,
    restore,
    get isMaximized() {
      return maximized;
    },
    on(event, cb) {
      let set = listeners.get(event);
      if (!set) { set = new Set(); listeners.set(event, set); }
      set.add(cb);
      return () => { set?.delete(cb); };
    },
    get client() {
      return client;
    },
  };
}

/** Opens the panel without a floating pill (`open*(options) → handle` convention); closing it destroys the widget. */
export function openMyIOBotPanel(options: MyIOBotWidgetOptions): MyIOBotWidgetHandle {
  return createMyIOBotWidget({ ...options, launcher: false });
}
