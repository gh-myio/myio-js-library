/**
 * RFC-0236 rev. 5 — MYIO GCDR shell and login view.
 * Layer 1 createMyioGcdrShell (@experimental) · Layer 2 createMyioGcdrLoginView /
 * openMyioGcdrLoginModal · Layer 3 createMyioGcdrLoginSubmit.
 * Not yet in this version: Turnstile captcha (PR 2), overlay.secondaryAction (PR 4).
 */
export { createMyioGcdrShell } from './shell';
export { createMyioGcdrLoginView } from './loginView';
export { openMyioGcdrLoginModal, isMyioGcdrLoginModalOpen } from './modal';
export { createMyioGcdrLoginSubmit, mapGcdrResponse } from './gcdrClient';
export type {
  Localized as MyioGcdrLocalized,
  MyioGcdrLocale,
  MyioGcdrTheme,
  MyioGcdrThemeSetting,
  MyioGcdrShellOptions,
  MyioGcdrShellHandle,
  MyioGcdrShellSize,
  MyioGcdrShellWidth,
  MyioGcdrSlotName,
  MyioGcdrSlotContext,
  MyioGcdrSlotRenderer,
  MyioGcdrBuiltInSlot,
  MyioGcdrSetSlotOptions,
  MyioGcdrPanelOptions,
  MyioGcdrRestrictedShell,
  MyioGcdrCredentials,
  MyioGcdrLoginSubmitContext,
  MyioGcdrLoginErrorCode,
  MyioGcdrLoginResult,
  MyioGcdrLoginSubmitFn,
  MyioGcdrAuth,
  MyioGcdrClientOptions,
  MyioGcdrLoginNotice,
  MyioGcdrAside,
  MyioGcdrLoginLinks,
  MyioGcdrLoginViewOptions,
  MyioGcdrLoginState,
  MyioGcdrLoginViewHandle,
  MyioGcdrLoginModalOptions,
  MyioGcdrLoginModalHandle,
  MyioGcdrWallpaper,
} from './types';
