// Loader for the token tier manifest.
//
// Read by the stylelint rules that enforce ADR-0003: components may reference
// semantic and component tokens, never primitives; and every var(--ig-*) must
// resolve to a token that actually exists.
//
// THIS LOADER FAILS CLOSED. Every path that cannot establish ground truth
// throws. Nothing here returns a partial manifest, an empty default, or a
// "probably fine". A rule that disables itself still shows a green tick, and
// the tick is what gets trusted. See CONTRIBUTING.md, "Guards fail closed".

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { diffHashes, sourceHashes } from './hash-sources.js';

/** Manifest shape this loader understands. Bumped when the format changes. */
export const MANIFEST_FORMAT_VERSION = 1;

export const REBUILD_COMMAND = 'pnpm --filter @ingot/tokens build';

export class TokenManifestError extends Error {
  /**
   * @param {'MISSING'|'MALFORMED'|'UNSUPPORTED_VERSION'|'STALE'|'EMPTY'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'TokenManifestError';
    this.code = code;
  }
}

/**
 * @param {string} label
 * @param {string[]} files
 * @returns {string}
 */
function list(label, files) {
  return files.length > 0
    ? `\n  ${label.padEnd(20)} ${files.join('\n' + ' '.repeat(23))}`
    : '';
}

/**
 * Load and validate the token manifest.
 *
 * @param {string} tokensPackageDir absolute path to packages/tokens
 * @returns {{ version: number, prefix: string, sources: Record<string,string>,
 *            tokens: Record<string, { tier: string, type: string, references?: string[] }> }}
 * @throws {TokenManifestError} on every failure. Never returns a fallback.
 */
export function loadTokenManifest(tokensPackageDir) {
  const manifestPath = join(tokensPackageDir, 'dist', 'manifest.json');
  const sourceDir = join(tokensPackageDir, 'src');

  // --- Missing ------------------------------------------------------------
  if (!existsSync(manifestPath)) {
    throw new TokenManifestError(
      'MISSING',
      `Ingot token manifest not found.\n\n` +
        `  expected at          ${manifestPath}\n` +
        `  fix                  ${REBUILD_COMMAND}\n\n` +
        `Lint depends on the token build (ADR-0006). The tier and existence rules\n` +
        `read the manifest to know which tokens are real and which tier each belongs\n` +
        `to. Without it they cannot run — and they refuse to run rather than pass\n` +
        `silently.`,
    );
  }

  // --- Malformed ----------------------------------------------------------
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (cause) {
    // `cause` is `unknown` under useUnknownInCatchVariables — a thrown value is
    // not guaranteed to be an Error, and assuming otherwise is how a message
    // becomes "undefined" at the exact moment someone needs to read it.
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new TokenManifestError(
      'MALFORMED',
      `Ingot token manifest is not valid JSON.\n\n` +
        `  file                 ${manifestPath}\n` +
        `  error                ${detail}\n` +
        `  fix                  ${REBUILD_COMMAND}\n\n` +
        `This file is generated. If you edited it by hand, don't — rebuild instead.`,
    );
  }

  // --- Unsupported format version ----------------------------------------
  if (manifest?.version !== MANIFEST_FORMAT_VERSION) {
    throw new TokenManifestError(
      'UNSUPPORTED_VERSION',
      `Ingot token manifest has an unsupported format version.\n\n` +
        `  manifest format      ${JSON.stringify(manifest?.version)}\n` +
        `  this tool reads      ${MANIFEST_FORMAT_VERSION}\n` +
        `  fix                  pnpm install && ${REBUILD_COMMAND}\n\n` +
        `Reading a manifest of a different shape would produce confident wrong\n` +
        `answers, so it is refused rather than guessed at.`,
    );
  }

  if (manifest.tokens === null || typeof manifest.tokens !== 'object') {
    throw new TokenManifestError(
      'MALFORMED',
      `Ingot token manifest has no "tokens" object.\n\n` +
        `  file                 ${manifestPath}\n` +
        `  fix                  ${REBUILD_COMMAND}\n\n` +
        `The file parsed as JSON but is not a manifest. This file is generated —\n` +
        `rebuild rather than editing it.`,
    );
  }

  // --- Stale --------------------------------------------------------------
  const actual = sourceHashes(sourceDir, tokensPackageDir);
  const { added, removed, changed } = diffHashes(manifest.sources ?? {}, actual);

  if (added.length + removed.length + changed.length > 0) {
    throw new TokenManifestError(
      'STALE',
      `Ingot token manifest is STALE.\n` +
        list('changed since build', changed) +
        list('added since build', added) +
        list('removed since build', removed) +
        `\n  fix                  ${REBUILD_COMMAND}\n\n` +
        `A stale manifest does not fail — it answers confidently and wrongly. A token\n` +
        `renamed in source still appears in the manifest, so a reference to the old\n` +
        `name passes the existence check and renders as nothing at runtime. That\n` +
        `direction is silent, which is why staleness is an error in its own right.`,
    );
  }

  // --- Empty --------------------------------------------------------------
  // A DELIBERATE decision, not a fallthrough. See the PR for the reasoning.
  if (Object.keys(manifest.tokens).length === 0) {
    throw new TokenManifestError(
      'EMPTY',
      `Ingot token manifest contains no tokens.\n\n` +
        `  file                 ${manifestPath}\n` +
        `  check                ${sourceDir} contains token files\n` +
        `  fix                  ${REBUILD_COMMAND}\n\n` +
        `An empty manifest is indistinguishable from a build that silently produced\n` +
        `nothing. It is an error deliberately: linting against it would report every\n` +
        `token reference as non-existent, misdiagnosing one broken build as a\n` +
        `thousand broken references.`,
    );
  }

  return manifest;
}
