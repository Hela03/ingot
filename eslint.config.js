// ESLint checks code CORRECTNESS. It does not check formatting — Prettier owns
// that, and eslint-config-prettier (last in this list) switches off every
// ESLint rule that would argue with it.
//
// See docs/decisions/0004-typescript-version.md for why TypeScript is pinned:
// the type-aware rules below are the reason.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // Generated output and dependencies are never linted. They are not ours.
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.astro/**',
      '**/storybook-static/**',
      '**/coverage/**',
    ],
  },

  // Baseline rules for all JavaScript and TypeScript.
  js.configs.recommended,

  // Everything here runs in Node: config files, the token build, and the
  // in-repo tooling. Browser globals arrive with the first component.
  {
    languageOptions: {
      globals: globals.node,
    },
  },

  // Type-aware rules for TypeScript source. These read the actual types via
  // tsconfig, which is how ESLint can catch things like a forgotten `await`.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Config files are plain JS and are not part of any tsconfig, so the
  // type-aware rules cannot apply to them.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // MUST be last: disables all formatting-related ESLint rules.
  prettier,
);
