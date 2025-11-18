import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'test/**',
        'src/plugin.ts',
        'node_modules/**',
        '*.config.ts'
      ],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 90
      }
    }
  }
});
