// Scale generation: one seed in, twelve steps out (ADR-0003, ADR-0007).
//
// Three properties matter, and all three are ADR-0007 decisions:
//
//   1. The seed's POSITION is derived from its lightness, not fixed at step 9.
//   2. Chroma is DAMPED toward zero at both extremes, on a bell curve.
//   3. SNAP-TO-SEED: the step nearest the seed is replaced by the seed exactly,
//      so the consumer's hex IS a step rather than an approximation of one.

import { clampToGamut, hexToOklch, oklchToHex } from './oklch.js';

/**
 * Target lightness per step, light theme.
 *
 * Steps 1-2 backgrounds, 3-5 component backgrounds, 6-8 borders, 9-10 solid
 * fills, 11-12 text — but see ADR-0003's addendum: that mapping describes the
 * common case and is not a guarantee once the seed's position moves.
 */
const LIGHTNESS = [
  0.985, 0.97, 0.945, 0.915, 0.88, 0.84, 0.79, 0.72, 0.65, 0.58, 0.5, 0.34,
];

/**
 * Chroma envelope: peaks at the solid-fill band, falls to near zero at BOTH ends.
 *
 * A symmetric gaussian centred on the fill band does not do this — it leaves the
 * darkest steps at most of peak chroma, and only sRGB gamut clamping pulls them
 * down, which is clamping doing the work of design. ADR-0007 requires damping at
 * the light AND dark extremes, so the curve is skewed: it rises slowly from
 * step 1, peaks between 9 and 10, and falls away again by step 12.
 *
 * A small floor keeps a whisper of tint at the ends rather than pure grey.
 *
 * @param {number} stepIndex zero-based
 * @returns {number} 0..1
 */
function envelope(stepIndex) {
  const FLOOR = 0.05;
  const a = 4.09; // peak sits at a/(a+b) of the way along, i.e. ~step 9.5
  const b = 1.2;

  const t = stepIndex / 11;
  /** @param {number} x @returns {number} */
  const shape = (x) => x ** a * (1 - x) ** b;
  const peak = shape(a / (a + b));

  return FLOOR + (1 - FLOOR) * (shape(t) / peak);
}

/**
 * Generate a 12-step scale from a seed colour.
 *
 * @param {string} seedHex
 * @returns {{
 *   seed: import('./oklch.js').Oklch,
 *   seedHex: string,
 *   resolvedStep: number,
 *   steps: { step: number, hex: string, colour: import('./oklch.js').Oklch, isSeed: boolean }[],
 * }}
 */
export function generateScale(seedHex) {
  const seed = hexToOklch(seedHex);

  // 1. Where does this seed belong? Nearest step by lightness — not step 9.
  let resolvedIndex = 0;
  let closest = Infinity;
  LIGHTNESS.forEach((L, i) => {
    const delta = Math.abs(L - seed.L);
    if (delta < closest) {
      closest = delta;
      resolvedIndex = i;
    }
  });

  // 2. Scale the chroma envelope so it passes through the seed at its own step.
  //
  //    The divisor is floored. A seed landing at step 1 or 12 sits where the
  //    envelope is near zero, and dividing by that amplifies any chroma at all
  //    into an enormous peak — a near-grey seed would generate a visibly tinted
  //    scale, and a dark muted seed a neon one. The floor caps amplification at
  //    roughly 3x, which keeps an achromatic seed grey without a special case
  //    for it.
  const MIN_RESPONSE = 0.35;
  const peakChroma = seed.C / Math.max(envelope(resolvedIndex), MIN_RESPONSE);

  const steps = LIGHTNESS.map((L, i) => {
    // 3. Snap-to-seed: the seed is placed verbatim, not approximated.
    if (i === resolvedIndex) {
      return { step: i + 1, hex: seedHex.toLowerCase(), colour: seed, isSeed: true };
    }
    const colour = clampToGamut({ L, C: peakChroma * envelope(i), H: seed.H });
    return { step: i + 1, hex: oklchToHex(colour), colour, isSeed: false };
  });

  return {
    seed,
    seedHex: seedHex.toLowerCase(),
    resolvedStep: resolvedIndex + 1,
    steps,
  };
}

/**
 * The resolved solid fill for a role — the step the seed landed on.
 *
 * This is what `color.bg.{role}` maps to for this theme, and it is what the
 * collision check compares. ADR-0007: what renders is what can collide.
 *
 * @param {ReturnType<typeof generateScale>} scale
 */
export function resolvedFill(scale) {
  const step = scale.steps[scale.resolvedStep - 1];
  if (!step) throw new Error(`Scale has no step ${scale.resolvedStep}`);
  return step;
}
