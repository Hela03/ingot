// In-repo stylelint rules. Private tooling, never published.
//
// Two rules, both reading the generated token manifest so that ADR-0003's
// naming grammar lives in exactly one place — the tokens themselves.
//
//   ingot/no-primitive-tokens  components reference semantic tokens, not
//                              primitives (ADR-0003)
//   ingot/token-exists         every var(--ig-*) resolves to a real token, and
//                              no literal fallbacks
//
// Deliberately no options. These are not preferences.

import { fileURLToPath } from 'node:url';

import valueParser from 'postcss-value-parser';
import stylelint from 'stylelint';

import { loadTokenManifest } from '../token-manifest/load.js';

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

const TOKENS_DIR = fileURLToPath(new URL('../../packages/tokens', import.meta.url));

/** @type {ReturnType<typeof loadTokenManifest> | null} */
let cached = null;

/**
 * The manifest, loaded once per process.
 *
 * A stylelint run is a short-lived process, so loading once still detects a
 * stale manifest at the start of every run. The loader throws on any problem —
 * missing, stale, malformed, empty — and that throw is deliberately not caught
 * here. A rule that cannot establish ground truth must not run.
 *
 * @returns {ReturnType<typeof loadTokenManifest>}
 */
function manifest() {
  cached ??= loadTokenManifest(TOKENS_DIR);
  return cached;
}

/**
 * Every var() reference in a declaration value, including nested ones.
 *
 * @param {string} value
 * @returns {{ name: string, fallback: import('postcss-value-parser').Node[] }[]}
 */
function varReferences(value) {
  /** @type {{ name: string, fallback: import('postcss-value-parser').Node[] }[]} */
  const found = [];

  valueParser(value).walk((node) => {
    if (node.type !== 'function' || node.value !== 'var') return;

    const first = node.nodes[0];
    if (!first || first.type !== 'word') return;

    found.push({
      name: first.value,
      fallback: node.nodes
        .slice(1)
        .filter((n) => n.type !== 'div' && n.type !== 'space'),
    });
  });

  return found;
}

// --- ingot/no-primitive-tokens ----------------------------------------------

const primitiveRuleName = 'ingot/no-primitive-tokens';

const primitiveMessages = ruleMessages(primitiveRuleName, {
  rejected: (token) =>
    `"${token}" is a primitive token. Components must reference semantic tokens ` +
    `(ADR-0003): a primitive is immune to theming, because a consumer's theme ` +
    `operates on the semantic layer. This renders correctly and is silently ` +
    `unthemeable.`,
});

/** @type {import('stylelint').Rule} */
const primitiveRule = (primary) => (root, result) => {
  if (
    !validateOptions(result, primitiveRuleName, { actual: primary, possible: [true] })
  ) {
    return;
  }

  root.walkDecls((decl) => {
    for (const { name } of varReferences(decl.value)) {
      if (!name.startsWith('--ig-')) continue;
      if (manifest().tokens[name]?.tier !== 'primitive') continue;

      report({
        message: primitiveMessages.rejected(name),
        node: decl,
        word: name,
        result,
        ruleName: primitiveRuleName,
      });
    }
  });
};

primitiveRule.ruleName = primitiveRuleName;
primitiveRule.messages = primitiveMessages;

// --- ingot/token-exists -----------------------------------------------------

const existsRuleName = 'ingot/token-exists';

const existsMessages = ruleMessages(existsRuleName, {
  unknown: (token) =>
    `"${token}" is not a token. An undefined custom property resolves to nothing ` +
    `and renders as a missing style, with no error at all — which is why it is ` +
    `caught here. Add the token, or correct the name.`,

  literalFallback: (token) =>
    `"${token}" has a literal fallback. The fallback fires precisely when the ` +
    `token is missing, so it hides the failure this rule exists to catch — and ` +
    `the literal itself is unthemeable. Remove it, or fall back to another token.`,
});

/** @type {import('stylelint').Rule} */
const existsRule = (primary) => (root, result) => {
  if (!validateOptions(result, existsRuleName, { actual: primary, possible: [true] })) {
    return;
  }

  root.walkDecls((decl) => {
    for (const { name, fallback } of varReferences(decl.value)) {
      if (!name.startsWith('--ig-')) continue;

      if (!manifest().tokens[name]) {
        report({
          message: existsMessages.unknown(name),
          node: decl,
          word: name,
          result,
          ruleName: existsRuleName,
        });
      }

      // A fallback to another token is legitimate — ADR-0003's tier-3
      // convention relies on it. A fallback to anything else is a literal.
      const literal = fallback.some(
        (n) => !(n.type === 'function' && n.value === 'var'),
      );

      if (fallback.length > 0 && literal) {
        report({
          message: existsMessages.literalFallback(name),
          node: decl,
          word: name,
          result,
          ruleName: existsRuleName,
        });
      }
    }
  });
};

existsRule.ruleName = existsRuleName;
existsRule.messages = existsMessages;

export default [
  createPlugin(primitiveRuleName, primitiveRule),
  createPlugin(existsRuleName, existsRule),
];
