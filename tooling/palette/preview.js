// Generates the calibration theme report for the candidate seeds.
//
// Temporary in the sense that it exists to answer #11; the report itself is a
// permanent deliverable per ADR-0007 section 12.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { collisionMatrix } from './collision.js';
import { renderReport } from './report.js';
import { BRAND_CANDIDATES, STATUS_SEEDS } from './seeds.js';

const out = resolve(process.argv[2] ?? 'theme-report.html');

const brandSeeds = Object.fromEntries(BRAND_CANDIDATES.map((b) => [b.name, b.hex]));
const matrix = collisionMatrix(brandSeeds, STATUS_SEEDS);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, renderReport(BRAND_CANDIDATES, STATUS_SEEDS, matrix));

const flagged = matrix.pairs.filter((p) => p.collides).length;
console.log(`Theme report written to ${out}`);
console.log(
  `${matrix.pairs.length} pairs, ${flagged} flagged at provisional threshold ${matrix.threshold}`,
);
