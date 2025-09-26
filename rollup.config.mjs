import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { visualizer } from 'rollup-plugin-visualizer';

const plugins = [resolve(), commonjs()];

// Add visualizer plugin when ANALYZE environment variable is set
if (process.env.ANALYZE) {
  plugins.push(
    visualizer({
      filename: 'dist/bundle-analysis.html',
      open: true,
      gzipSize: true,
      brotliSize: true
    })
  );
}

export default {
  input: 'dist/index.js',
  output: {
    file: 'dist/myio-js-library.umd.js',
    format: 'umd',
    name: 'MyIOLibrary'
  },
  plugins
};
