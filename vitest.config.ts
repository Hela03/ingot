import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test files live next to the code they test, inside each package's src/.
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'tooling/**/*.test.{ts,tsx}'],

    // Plain Node for now. When real components arrive this becomes 'jsdom',
    // which simulates a browser so components can be rendered and queried.
    environment: 'node',
  },
});
