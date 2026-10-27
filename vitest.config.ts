import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Random order: a test that depends on another test's state fails.
    sequence: {
      shuffle: true,
    },
  },
});
