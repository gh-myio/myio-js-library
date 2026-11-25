/**
 * RFC-0242 — input of the UMD core bundle (`dist/myio-js-library.umd.js`).
 *
 * Same public surface as `src/index.ts`, except that the MYIO Bot widget UI is
 * NOT bundled: the explicit exports below shadow the `export *` ones (ES module
 * semantics), so esbuild tree-shakes the real widget out of the UMD core and
 * keeps it in the on-demand `myio-bot-widget.umd.min.js` (see
 * `MyIOLibrary.loadBotWidget()`). ESM/CJS builds keep using `src/index.ts`.
 */
export * from './index';
export { createMyIOBotWidget, openMyIOBotPanel } from './components/myio-bot/widget/umdCoreShim';
