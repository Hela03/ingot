// Collision detection between a brand's resolved fill and each status fill.
//
// ADR-0007: the comparison is between RESOLVED SOLID FILLS, not seeds. What
// renders is what can collide. This is why no chroma floor is needed — an
// achromatic brand produces a grey fill, which is far from every saturated
// status fill in the a/b plane regardless of what hue angle the grey reports.

import { hueDistance, perceptualDistance } from './oklch.js';
import { generateScale, resolvedFill } from './scale.js';

/**
 * PROVISIONAL — NOT A DECISION.
 *
 * This number is arbitrary. It was chosen so the calibration report shows a
 * readable spread of warning and non-warning pairs, and for no other reason.
 * It has not been validated against anything.
 *
 * The real value is chosen by looking at the swatch pairs in the theme report
 * and deciding where "confusable" begins. See issue #11.
 *
 * Note the unit: this is a PERCEPTUAL DISTANCE in OKLab, not a hue angle. Any
 * number from the earlier seed-hue analysis is in a different quantity and does
 * not transfer.
 */
export const PROVISIONAL_THRESHOLD = 0.15;

/**
 * @param {Record<string, string>} brandSeeds role -> hex
 * @param {Record<string, string>} statusSeeds role -> hex
 * @param {number} [threshold]
 */
export function collisionMatrix(
  brandSeeds,
  statusSeeds,
  threshold = PROVISIONAL_THRESHOLD,
) {
  const pairs = [];

  for (const [brandRole, brandHex] of Object.entries(brandSeeds)) {
    const brandScale = generateScale(brandHex);
    const brandFill = resolvedFill(brandScale);

    for (const [statusRole, statusHex] of Object.entries(statusSeeds)) {
      const statusScale = generateScale(statusHex);
      const statusFill = resolvedFill(statusScale);

      const distance = perceptualDistance(brandFill.colour, statusFill.colour);

      pairs.push({
        brandRole,
        statusRole,
        brandFill,
        statusFill,
        brandStep: brandScale.resolvedStep,
        statusStep: statusScale.resolvedStep,
        distance,
        // Reported for information only. It is NOT what the check uses, and for
        // an achromatic fill it is meaningless — which is the point.
        seedHueDistance: hueDistance(brandScale.seed, statusScale.seed),
        collides: distance < threshold,
      });
    }
  }

  return { threshold, pairs };
}
