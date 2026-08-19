import { describe, expect, it } from 'vitest';

// Scaffolding smoke test. It asserts nothing about Ingot — it exists only to
// prove the test runner is wired up and actually reports results. Delete it
// once real component tests exist.
describe('test runner', () => {
  it('reports a passing assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
