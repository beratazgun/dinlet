import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['test/e2e/**/*.e2e-spec.ts'],
    setupFiles: ['test/e2e/support/setup-env.ts'],
    globalSetup: ['test/e2e/support/global-setup.ts'],
    // Spec'ler aynı Postgres/Redis'i paylaşır; sırayla çalışırlar.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
