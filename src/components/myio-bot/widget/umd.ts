/**
 * RFC-0242 — entry of the on-demand UMD bundle `dist/myio-bot-widget.umd.min.js`
 * (global `window.MyIOBotWidget`). Self-contained: it re-bundles the client
 * (≈3 KB duplicated with the core, accepted to keep the two files independent).
 */
export { createMyIOBotWidget, openMyIOBotPanel } from './index';
export { createMyIOBotClient } from '../client';
export { MyIOBotError, isMyIOBotError } from '../errors';
export { MYIO_BOT_PROTOCOL_VERSION } from '../contract';
