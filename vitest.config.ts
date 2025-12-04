import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts', 
      'tests/unit/**/*.spec.ts',
      'tests/integration/**/*.test.ts',
      'tests/integration/**/*.spec.ts',
    ],
    exclude: ['node_modules', 'dist', 'build', 'tests/e2e'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'build/',
        '**/*.config.*',
        '**/*.d.ts',
        'client/index.html',
        'server/index-dev.ts',
        'server/index-prod.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
        // Critical paths require higher coverage
        // These will be enforced per-file as we add tests
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});

