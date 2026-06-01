import { defineConfig } from 'vitest/config';
import { houndexAliases } from '../../vitest.houndex-aliases';

export default defineConfig({
  resolve: {
    alias: houndexAliases,
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
