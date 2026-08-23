import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

// These tests read the real token manifest, so they depend on the token build
// having run — which is the dependency the rules themselves have. If it has
// not, the loader throws with a message naming the build command.
const CONFIG = {
  plugins: ['./tooling/stylelint-ingot/index.js'],
  rules: {
    'ingot/no-primitive-tokens': true,
    'ingot/token-exists': true,
  },
};

async function warningsFor(css: string) {
  const { results } = await stylelint.lint({
    code: css,
    codeFilename: 'packages/react/src/demo.module.css',
    config: CONFIG,
    configBasedir: process.cwd(),
  });
  return results[0]?.warnings ?? [];
}

const messages = (warnings: Awaited<ReturnType<typeof warningsFor>>) =>
  warnings.map((w) => w.text).join('\n');

describe('ingot/no-primitive-tokens', () => {
  it('rejects a primitive token referenced from a component', async () => {
    const warnings = await warningsFor('.a { color: var(--ig-color-brand-9); }');

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.rule).toBe('ingot/no-primitive-tokens');
    expect(messages(warnings)).toContain('is a primitive token');
    expect(messages(warnings)).toContain('silently unthemeable');
  });

  it('allows a semantic token', async () => {
    expect(await warningsFor('.a { color: var(--ig-color-bg-brand); }')).toHaveLength(
      0,
    );
  });

  it('finds a primitive nested inside another function', async () => {
    const warnings = await warningsFor(
      '.a { background: color-mix(in oklch, var(--ig-color-brand-9), transparent); }',
    );

    expect(messages(warnings)).toContain('is a primitive token');
  });
});

describe('ingot/token-exists', () => {
  it('rejects a token that does not exist', async () => {
    const warnings = await warningsFor('.a { color: var(--ig-color-bg-danger); }');

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.rule).toBe('ingot/token-exists');
    expect(messages(warnings)).toContain('is not a token');
    expect(messages(warnings)).toContain('renders as a missing style');
  });

  it('rejects a literal fallback, and says why it is worse than a bare literal', async () => {
    const warnings = await warningsFor(
      '.a { color: var(--ig-color-bg-brand, #2563eb); }',
    );

    expect(messages(warnings)).toContain('has a literal fallback');
    expect(messages(warnings)).toContain('hides the failure this rule exists to catch');
  });

  it('allows a fallback to another token', async () => {
    const warnings = await warningsFor(
      '.a { color: var(--ig-color-bg-brand, var(--ig-color-bg-brand)); }',
    );

    expect(warnings).toHaveLength(0);
  });

  it('ignores custom properties that are not ours', async () => {
    expect(await warningsFor('.a { color: var(--their-brand, #fff); }')).toHaveLength(
      0,
    );
  });
});
