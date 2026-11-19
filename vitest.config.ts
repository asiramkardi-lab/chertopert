import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/cardinalRules.test.ts'],
    environment: 'node'
  }
});
