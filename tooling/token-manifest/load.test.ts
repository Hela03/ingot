import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { sourceHashes } from './hash-sources.js';
import { loadTokenManifest, TokenManifestError } from './load.js';

const created: string[] = [];

afterEach(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
  created.length = 0;
});

const A_TOKEN = JSON.stringify({
  color: { brand: { 9: { $type: 'color', $value: '#2563eb' } } },
});

/** A throwaway packages/tokens-shaped directory. */
function createPackage(
  sources: Record<string, string> = { 'primitive/color.json': A_TOKEN },
) {
  const dir = mkdtempSync(join(tmpdir(), 'ingot-manifest-'));
  created.push(dir);
  for (const [relative, contents] of Object.entries(sources)) {
    const full = join(dir, 'src', relative);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return dir;
}

/** Write a manifest whose source hashes match what is on disk. */
function writeManifest(dir: string, overrides: Record<string, unknown> = {}) {
  const manifest = {
    version: 1,
    prefix: 'ig',
    sources: sourceHashes(join(dir, 'src'), dir),
    tokens: { '--ig-color-brand-9': { tier: 'primitive', type: 'color' } },
    ...overrides,
  };
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(join(dir, 'dist', 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

/** Assert the load fails, and hand back the error so its wording can be checked. */
function failure(dir: string): TokenManifestError {
  try {
    loadTokenManifest(dir);
  } catch (error) {
    return error as TokenManifestError;
  }
  expect.fail('expected loadTokenManifest to throw, but it returned');
}

describe('loadTokenManifest', () => {
  it('returns the manifest when everything is in order', () => {
    const dir = createPackage();
    writeManifest(dir);

    const manifest = loadTokenManifest(dir);

    expect(manifest.version).toBe(1);
    expect(manifest.tokens['--ig-color-brand-9']).toEqual({
      tier: 'primitive',
      type: 'color',
    });
  });

  // Each case below asserts the MESSAGE, not merely that it threw. The message
  // is what someone reads at the moment they are blocked, so it is part of the
  // interface. See CONTRIBUTING.md, "Error messages are tested for content".

  describe('missing', () => {
    it('names the expected path and the command that fixes it', () => {
      const error = failure(createPackage());

      expect(error.code).toBe('MISSING');
      expect(error.message).toContain('token manifest not found');
      expect(error.message).toContain('manifest.json');
      expect(error.message).toContain('pnpm --filter @ingot/tokens build');
    });

    it('explains that the rules refuse to run rather than pass silently', () => {
      expect(failure(createPackage()).message).toContain('rather than pass');
    });
  });

  describe('malformed', () => {
    it('reports invalid JSON and says the file is generated', () => {
      const dir = createPackage();
      mkdirSync(join(dir, 'dist'), { recursive: true });
      writeFileSync(join(dir, 'dist', 'manifest.json'), '{ "version": 1, ');

      const error = failure(dir);

      expect(error.code).toBe('MALFORMED');
      expect(error.message).toContain('not valid JSON');
      expect(error.message).toContain('rebuild instead');
    });

    it('rejects JSON that parses but is not a manifest', () => {
      const dir = createPackage();
      writeManifest(dir, { tokens: undefined });

      const error = failure(dir);

      expect(error.code).toBe('MALFORMED');
      expect(error.message).toContain('no "tokens" object');
    });
  });

  describe('unsupported version', () => {
    it('names both versions rather than guessing at the shape', () => {
      const dir = createPackage();
      writeManifest(dir, { version: 2 });

      const error = failure(dir);

      expect(error.code).toBe('UNSUPPORTED_VERSION');
      expect(error.message).toContain('unsupported format version');
      expect(error.message).toContain('manifest format      2');
      expect(error.message).toContain('this tool reads      1');
      expect(error.message).toContain('refused rather than guessed at');
    });
  });

  describe('stale', () => {
    it('names the source file that changed', () => {
      const dir = createPackage();
      writeManifest(dir);
      writeFileSync(
        join(dir, 'src', 'primitive', 'color.json'),
        JSON.stringify({
          color: { brand: { 9: { $type: 'color', $value: '#000000' } } },
        }),
      );

      const error = failure(dir);

      expect(error.code).toBe('STALE');
      expect(error.message).toContain('STALE');
      expect(error.message).toContain('changed since build');
      expect(error.message).toContain('src/primitive/color.json');
    });

    it('names a source file added since the build', () => {
      const dir = createPackage();
      writeManifest(dir);
      mkdirSync(join(dir, 'src', 'semantic'), { recursive: true });
      writeFileSync(join(dir, 'src', 'semantic', 'color.json'), '{}');

      const error = failure(dir);

      expect(error.code).toBe('STALE');
      expect(error.message).toContain('added since build');
      expect(error.message).toContain('src/semantic/color.json');
    });

    it('names a source file removed since the build', () => {
      const dir = createPackage();
      writeManifest(dir);
      rmSync(join(dir, 'src', 'primitive', 'color.json'));

      const error = failure(dir);

      expect(error.code).toBe('STALE');
      expect(error.message).toContain('removed since build');
      expect(error.message).toContain('src/primitive/color.json');
    });

    it('explains that the dangerous direction is the silent one', () => {
      const dir = createPackage();
      writeManifest(dir);
      writeFileSync(join(dir, 'src', 'primitive', 'color.json'), '{}');

      const message = failure(dir).message;

      expect(message).toContain('answers confidently and wrongly');
      expect(message).toContain('renders as nothing at runtime');
    });
  });

  describe('empty', () => {
    it('is an error, and says why rather than reporting a thousand bad references', () => {
      const dir = createPackage();
      writeManifest(dir, { tokens: {} });

      const error = failure(dir);

      expect(error.code).toBe('EMPTY');
      expect(error.message).toContain('contains no tokens');
      expect(error.message).toContain('silently produced');
      expect(error.message).toContain('thousand broken references');
    });

    it('is reported as EMPTY rather than STALE when the build is otherwise current', () => {
      const dir = createPackage();
      writeManifest(dir, { tokens: {} });

      expect(failure(dir).code).toBe('EMPTY');
    });
  });
});
