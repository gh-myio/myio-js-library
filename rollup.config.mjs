import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { visualizer } from 'rollup-plugin-visualizer';

// Add visualizer plugin when ANALYZE environment variable is set
function pluginsFor(name) {
  const plugins = [resolve(), commonjs()];
  if (process.env.ANALYZE) {
    plugins.push(
      visualizer({
        filename: `dist/bundle-analysis${name ? `-${name}` : ''}.html`,
        open: true,
        gzipSize: true,
        brotliSize: true
      })
    );
  }
  return plugins;
}

// Inputs are ESM files emitted by `npm run build:umd-entries` (tsup → .build/umd/):
// - umd-core.js        = src/umd-core.ts: the whole public API of src/index.ts, except
//                        that the MYIO Bot widget UI is replaced by a delegating shim
//                        (RFC-0242 — the core does not bundle the widget).
// - myio-bot-widget.js = src/components/myio-bot/widget/umd.ts (RFC-0242), loaded on
//                        demand by MyIOLibrary.loadBotWidget().
export default [
  {
    input: '.build/umd/umd-core.js',
    output: {
      file: 'dist/myio-js-library.umd.js',
      format: 'umd',
      name: 'MyIOLibrary',
      // jspdf contains dynamic import() calls internally; inlining prevents
      // rollup from attempting code-splitting (incompatible with UMD format).
      inlineDynamicImports: true,
    },
    plugins: pluginsFor('')
  },
  {
    input: '.build/umd/myio-bot-widget.js',
    output: {
      file: 'dist/myio-bot-widget.umd.js',
      format: 'umd',
      name: 'MyIOBotWidget',
      inlineDynamicImports: true,
    },
    plugins: pluginsFor('bot-widget')
  }
];
