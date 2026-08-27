// Colour maths for palette generation. sRGB <-> OKLab <-> OKLCH, plus the
// perceptual distance the collision check uses.
//
// OKLab is used because it is perceptually near-uniform: equal numeric steps
// look like equal steps, which is what makes both the chroma damping curve and
// the collision distance meaningful.

/** @param {number} c @returns {number} */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** @param {number} c @returns {number} */
const fromLinear = (c) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

/**
 * @typedef {{ L: number, C: number, H: number }} Oklch
 * @typedef {{ L: number, a: number, b: number }} Oklab
 * @typedef {{ r: number, g: number, b: number }} Rgb linear-light, may be out of [0,1]
 */

/** @param {Rgb} rgb @returns {Oklab} */
export function linearRgbToOklab({ r, g, b }) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** @param {Oklab} lab @returns {Rgb} */
export function oklabToLinearRgb({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

/** @param {Oklch} c @returns {Oklab} */
export const lchToLab = ({ L, C, H }) => ({
  L,
  a: C * Math.cos((H * Math.PI) / 180),
  b: C * Math.sin((H * Math.PI) / 180),
});

/** @param {Oklab} lab @returns {Oklch} */
export function labToLch({ L, a, b }) {
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C: Math.hypot(a, b), H };
}

/** @param {string} hex @returns {Oklch} */
export function hexToOklch(hex) {
  const n = hex.replace('#', '');
  return labToLch(
    linearRgbToOklab({
      r: toLinear(parseInt(n.slice(0, 2), 16) / 255),
      g: toLinear(parseInt(n.slice(2, 4), 16) / 255),
      b: toLinear(parseInt(n.slice(4, 6), 16) / 255),
    }),
  );
}

/** @param {Rgb} rgb @returns {boolean} */
const inGamut = ({ r, g, b }) =>
  r >= -1e-4 &&
  r <= 1 + 1e-4 &&
  g >= -1e-4 &&
  g <= 1 + 1e-4 &&
  b >= -1e-4 &&
  b <= 1 + 1e-4;

/**
 * Reduce chroma until the colour fits inside sRGB, keeping L and H.
 *
 * Out-of-gamut colours would otherwise be clipped per channel, which shifts hue
 * unpredictably. Losing saturation is visible and even; losing hue is neither.
 *
 * @param {Oklch} colour
 * @returns {Oklch}
 */
export function clampToGamut(colour) {
  if (inGamut(oklabToLinearRgb(lchToLab(colour)))) return colour;

  let low = 0;
  let high = colour.C;
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    if (inGamut(oklabToLinearRgb(lchToLab({ ...colour, C: mid })))) low = mid;
    else high = mid;
  }
  return { ...colour, C: low };
}

/** @param {Oklch} colour @returns {string} */
export function oklchToHex(colour) {
  const { r, g, b } = oklabToLinearRgb(lchToLab(clampToGamut(colour)));
  /** @param {number} v @returns {string} */
  const channel = (v) =>
    Math.round(Math.min(1, Math.max(0, fromLinear(v))) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * Perceptual distance between two colours, in OKLab.
 *
 * This is what the collision check measures, and it is measured between
 * RESOLVED FILLS rather than between seeds (ADR-0007). Euclidean distance in
 * OKLab accounts for lightness and chroma as well as hue, which is why an
 * achromatic fill sits far from every saturated one without needing a chroma
 * floor: a grey and a green differ in the a/b plane regardless of what hue
 * angle the grey nominally reports.
 *
 * @param {Oklch} x
 * @param {Oklch} y
 * @returns {number}
 */
export function perceptualDistance(x, y) {
  const p = lchToLab(x);
  const q = lchToLab(y);
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

/**
 * Circular hue difference in degrees. Reported for information only — it is NOT
 * what the collision check uses, and it is meaningless for a near-grey.
 *
 * @param {Oklch} x
 * @param {Oklch} y
 * @returns {number}
 */
export function hueDistance(x, y) {
  const d = Math.abs(x.H - y.H) % 360;
  return d > 180 ? 360 - d : d;
}
