import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';

import { rules } from './index.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
  },
});

ruleTester.run(
  'inline-style-custom-properties-only',
  rules['inline-style-custom-properties-only'],
  {
    valid: [
      // The supported pattern for a dynamic value.
      { code: 'const a = <div style={{ "--ig-progress-value": pct }} />;' },
      { code: 'const a = <div className={s.bar} />;' },
      // Not an object literal — cannot be inspected, deliberately not reported.
      { code: 'const a = <div style={fromProps} />;' },
      // Spread cannot be inspected statically.
      { code: 'const a = <div style={{ ...rest }} />;' },
      // A `style` attribute on nothing in particular is still only checked as
      // an object literal.
      { code: 'const a = <div data-style={{ padding: 16 }} />;' },
    ],
    invalid: [
      {
        code: 'const a = <div style={{ padding: 16 }} />;',
        errors: [{ messageId: 'onlyCustomProperties', data: { property: 'padding' } }],
      },
      {
        code: 'const a = <div style={{ color: "#2563eb" }} />;',
        errors: [{ messageId: 'onlyCustomProperties', data: { property: 'color' } }],
      },
      {
        code: 'const a = <div style={{ "--ig-x": v, zIndex: 10 }} />;',
        errors: [{ messageId: 'onlyCustomProperties', data: { property: 'zIndex' } }],
      },
      {
        code: 'const a = <div style={{ padding: 16, margin: 8 }} />;',
        errors: [
          { messageId: 'onlyCustomProperties' },
          { messageId: 'onlyCustomProperties' },
        ],
      },
    ],
  },
);
