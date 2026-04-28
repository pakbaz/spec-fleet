import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      exclude: ['node_modules', 'dist', 'e2e', 'playwright-report'],
      reporters: ['default'],
      css: false,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/**/__tests__/**',
          'src/test/**',
          'src/main.tsx',
          'src/**/*.d.ts',
          'src/lib/telemetry/**',
          'src/lib/auth/msalConfig.ts',
          'src/app/AuthProvider.tsx',
          'src/app/routes.tsx',
        ],
        thresholds: {
          lines: 90,
          branches: 80,
          functions: 90,
          statements: 90,
        },
      },
    },
  }),
);
