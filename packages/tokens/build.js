// Token build. Runs Style Dictionary and additionally emits a tier manifest.
//
// The manifest exists so the lint rules can tell a primitive from a semantic
// token WITHOUT re-implementing the ADR-0003 naming grammar. Deriving tier from
// the token source means the tokens stay the single source of truth; pattern
// matching names would put the grammar in a second place, where it can drift.
//
// config.json remains the one place the `--ig-` prefix is configured (ADR-0002).
// This file only adds a platform to it.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import StyleDictionary from 'style-dictionary';

import { sourceHashes } from '../../tooling/token-manifest/hash-sources.js';
import config from './config.json' with { type: 'json' };

const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url));
const SRC_DIR = join(PACKAGE_DIR, 'src');

/** Tier directories under src/. A token outside one of these has no tier. */
const TIERS = ['primitive', 'semantic', 'component'];

/** Which tier directory a token was authored in. */
function tierOf(token) {
  const parts = String(token.filePath).split(/[\\/]/);
  const srcIndex = parts.lastIndexOf('src');
  const tier = srcIndex === -1 ? undefined : parts[srcIndex + 1];

  if (!TIERS.includes(tier)) {
    throw new Error(
      `Token "${token.path.join('.')}" is not in a tier directory.\n` +
        `  file      ${token.filePath}\n` +
        `  expected  src/${TIERS.join('/, src/')}/\n\n` +
        `Every token belongs to exactly one tier (ADR-0003). The lint rules read\n` +
        `the tier from the manifest, so a token without one cannot be checked.`,
    );
  }
  return tier;
}

/** CSS custom property names this token's value references, if any. */
function referencesOf(token, byPath) {
  const original = token.original?.$value ?? token.original?.value;
  if (typeof original !== 'string') return [];

  return [...original.matchAll(/\{([^}]+)\}/g)]
    .map((match) => byPath.get(match[1]))
    .filter(Boolean)
    .map((referenced) => `--${referenced.name}`);
}

StyleDictionary.registerFormat({
  name: 'ingot/manifest',
  format({ dictionary, options }) {
    const byPath = new Map(dictionary.allTokens.map((t) => [t.path.join('.'), t]));

    // Sorted, so identical inputs produce identical bytes.
    const sorted = [...dictionary.allTokens].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    const tokens = {};
    for (const token of sorted) {
      const entry = { tier: tierOf(token), type: token.$type ?? token.type };
      const references = referencesOf(token, byPath);
      if (references.length > 0) entry.references = references;
      tokens[`--${token.name}`] = entry;
    }

    return `${JSON.stringify(
      {
        version: 1,
        prefix: options.prefix ?? '',
        sources: options.sources,
        tokens,
      },
      null,
      2,
    )}\n`;
  },
});

const sources = sourceHashes(SRC_DIR, PACKAGE_DIR);

const sd = new StyleDictionary({
  ...config,
  platforms: {
    ...config.platforms,
    manifest: {
      transformGroup: 'css', // same name transform as the CSS custom properties
      prefix: config.platforms.css.prefix,
      buildPath: 'dist/',
      files: [
        {
          destination: 'manifest.json',
          format: 'ingot/manifest',
          // Passed at file level: platform-level `prefix` is applied to token
          // names by the transform, but is not merged into format options.
          options: { sources, prefix: config.platforms.css.prefix },
        },
      ],
    },
  },
});

await sd.buildAllPlatforms();
