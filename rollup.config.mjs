import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'dist/index.js',
  output: {
    file: 'dist/myio-js-library.umd.js',
    format: 'umd',
    name: 'MyIOLibrary'
  },
  plugins: [resolve(), commonjs()]
};
