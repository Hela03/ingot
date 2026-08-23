// Hashing of token source files.
//
// ONE implementation, imported by both the token build (which writes the
// hashes into the manifest) and the loader (which recomputes them to detect
// staleness). Two implementations of this would be two things that must agree
// forever, which is the drift the manifest exists to avoid in the first place.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Every token source file under `dir`, absolute and sorted.
 *
 * @param {string} dir
 * @returns {string[]}
 */
export function listSourceFiles(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...listSourceFiles(full));
    else if (entry.endsWith('.json')) found.push(full);
  }
  return found.sort();
}

/**
 * Map of token source path to content hash.
 *
 * Paths are relative to `baseDir` and POSIX-separated, so the result is
 * identical on every machine — a generated artifact must be reproducible.
 *
 * Per file rather than one aggregate hash, so a staleness error can name the
 * file that changed instead of saying only that something did.
 *
 * @param {string} sourceDir
 * @param {string} baseDir
 * @returns {Record<string, string>}
 */
export function sourceHashes(sourceDir, baseDir) {
  /** @type {Record<string, string>} */
  const hashes = {};
  for (const file of listSourceFiles(sourceDir)) {
    const key = relative(baseDir, file).split(sep).join('/');
    hashes[key] =
      `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`;
  }
  return hashes;
}

/**
 * Compare two hash maps.
 *
 * @param {Record<string, string>} recorded
 * @param {Record<string, string>} actual
 * @returns {{ added: string[], removed: string[], changed: string[] }}
 */
export function diffHashes(recorded, actual) {
  const recordedKeys = Object.keys(recorded);
  const actualKeys = Object.keys(actual);

  return {
    added: actualKeys.filter((k) => !(k in recorded)).sort(),
    removed: recordedKeys.filter((k) => !(k in actual)).sort(),
    changed: actualKeys
      .filter((k) => k in recorded && recorded[k] !== actual[k])
      .sort(),
  };
}
