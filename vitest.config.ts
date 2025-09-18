import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use 'node' environment for tests (switch to 'jsdom' if DOM APIs are needed)
    environment: 'node',
    coverage: {
      reporter: ['text', 'lcov', 'html'],
    },
  },
  resolve: {
    alias: {
      // Map the problematic import to our test stub
      // This key must match exactly what's used in src/index.ts
      './thingsboard/entity': 'C:/Projetos/GitHub/myio/myio-js-library.git/tests/stubs/thingsboard-entity.ts',
    },
  },
});
