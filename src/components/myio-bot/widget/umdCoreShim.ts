/**
 * RFC-0242 — what the UMD **core** exposes as `MyIOLibrary.createMyIOBotWidget`
 * / `openMyIOBotPanel`: the core does not bundle the widget UI (see
 * `src/umd-core.ts`), so these delegate to `window.MyIOBotWidget` once
 * `await MyIOLibrary.loadBotWidget()` has injected it, and fail loudly otherwise.
 * ESM/CJS consumers never see this file: they get the real widget.
 */
import { MyIOBotError } from '../errors';
import type { MyIOBotWidgetHandle, MyIOBotWidgetOptions } from './types';

type WidgetGlobal = {
  createMyIOBotWidget(o: MyIOBotWidgetOptions): MyIOBotWidgetHandle;
  openMyIOBotPanel(o: MyIOBotWidgetOptions): MyIOBotWidgetHandle;
};

function widgetGlobal(): WidgetGlobal {
  const g = typeof window !== 'undefined' ? (window as unknown as { MyIOBotWidget?: WidgetGlobal }).MyIOBotWidget : undefined;
  if (g && typeof g.createMyIOBotWidget === 'function') return g;
  throw new MyIOBotError('WIDGET_NOT_LOADED', 'MyIO Bot: call `await MyIOLibrary.loadBotWidget()` first (the UMD core does not bundle the widget UI).');
}

export function createMyIOBotWidget(options: MyIOBotWidgetOptions): MyIOBotWidgetHandle {
  return widgetGlobal().createMyIOBotWidget(options);
}

export function openMyIOBotPanel(options: MyIOBotWidgetOptions): MyIOBotWidgetHandle {
  return widgetGlobal().openMyIOBotPanel(options);
}
