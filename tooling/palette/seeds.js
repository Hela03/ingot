// Candidate seeds used to calibrate the collision threshold (#11).
//
// STATUS SEEDS are real reference values (Radix scale 9). Their hues are the
// defaults ADR-0007 specifies: danger 25, warning 84, success 147, info 252.
//
// BRAND SEEDS ARE CONSTRUCTED. Only hue angles were supplied for these
// candidates, so each is defined in OKLCH with the given hue exactly, and with
// lightness and chroma chosen to span the range that matters — two very dark,
// two pale, one bright, one achromatic. If these correspond to real brand
// colours, substitute the actual values: ADR-0007 derives the seed's position
// from its lightness, so lightness changes the whole scale.

import { oklchToHex } from './oklch.js';

export const STATUS_SEEDS = {
  danger: '#e5484d', // Radix red-9    — hue 23
  warning: '#ffc53d', // Radix amber-9  — hue 84
  success: '#46a758', // Radix grass-9  — hue 147
  info: '#0090ff', // Radix blue-9   — hue 252
};

/** @type {{ name: string, L: number, C: number, H: number, note: string }[]} */
const BRAND_SPECS = [
  { name: 'indigo', L: 0.45, C: 0.18, H: 290, note: 'deep and saturated' },
  { name: 'cream', L: 0.94, C: 0.05, H: 103, note: 'pale, low chroma' },
  {
    name: 'coal',
    L: 0.3,
    C: 0.002,
    H: 0,
    note: 'achromatic — hue is noise, which is what broke seed-hue comparison',
  },
  {
    name: 'matcha',
    L: 0.85,
    C: 0.09,
    H: 148,
    note: 'pale green — 1° from success as a seed',
  },
  { name: 'ink void', L: 0.22, C: 0.07, H: 293, note: 'very dark' },
  { name: 'neo lime', L: 0.9, C: 0.19, H: 119, note: 'bright, high chroma' },
];

export const BRAND_CANDIDATES = BRAND_SPECS.map((spec) => ({
  ...spec,
  hex: oklchToHex({ L: spec.L, C: spec.C, H: spec.H }),
}));
