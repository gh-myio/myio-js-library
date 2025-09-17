// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';

export default [
  // ignore de pastas geradas
  { ignores: ['dist/**', 'node_modules/**'] },

  // regras recomendadas "oficiais"
  js.configs.recommended,

  // regras gerais do projeto
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node e ES globals
        ...globals.node,
        ...globals.es2021,

        // APIs usadas no projeto (Node 18+ e browser)
        fetch: 'readonly',
        atob: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        AbortController: 'readonly',
        Response: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },

  // overrides para testes (Vitest)
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },

  // overrides para arquivos que rodam no browser (PRE_SETUP, MAIN_WATER, TO_CHECK)
  {
    files: ['src/PRE_SETUP/**/*.js', 'src/MAIN_WATER/**/*.js', 'src/TO_CHECK/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // APIs específicas do browser
        fetch: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        AbortController: 'readonly',
        Response: 'readonly',
        // Bibliotecas externas usadas
        QRious: 'readonly',
        jsPDF: 'readonly',
        // Widget context (ThingsBoard specific)
        self: 'readonly',
      },
    },
  },
];
