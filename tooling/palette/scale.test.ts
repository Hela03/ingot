import { describe, expect, it } from 'vitest';

import { hexToOklch, oklchToHex, perceptualDistance } from './oklch.js';
import { generateScale, resolvedFill } from './scale.js';

describe('oklch', () => {
  it('round-trips a hex through OKLCH', () => {
    for (const hex of ['#2563eb', '#46a758', '#ffc53d', '#ffffff', '#000000']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it('measures distance in a way that separates grey from saturated colour', () => {
    // The whole reason no chroma floor is needed (ADR-0007): a grey sits far
    // from a saturated colour even when their hue angles happen to be close.
    const grey = hexToOklch('#6b6b6b');
    const green = { L: grey.L, C: 0.15, H: grey.H };

    expect(perceptualDistance(grey, green)).toBeGreaterThan(0.14);
  });
});

describe('generateScale', () => {
  it('produces twelve steps', () => {
    expect(generateScale('#46a758').steps).toHaveLength(12);
  });

  it('places the seed verbatim — snap-to-seed, not an approximation', () => {
    const scale = generateScale('#46a758');
    const seedStep = scale.steps.find((s) => s.isSeed);

    expect(seedStep?.hex).toBe('#46a758');
    expect(scale.steps.filter((s) => s.isSeed)).toHaveLength(1);
  });

  it('derives the seed position from lightness rather than fixing it at 9', () => {
    // A pale seed and a dark seed must not both land on step 9.
    const pale = generateScale(oklchToHex({ L: 0.9, C: 0.19, H: 119 }));
    const dark = generateScale(oklchToHex({ L: 0.22, C: 0.07, H: 293 }));

    expect(pale.resolvedStep).toBeLessThan(6);
    expect(dark.resolvedStep).toBeGreaterThan(9);
    expect(pale.resolvedStep).not.toBe(dark.resolvedStep);
  });

  it('descends in lightness across the scale', () => {
    const scale = generateScale('#0090ff');
    for (let i = 1; i < scale.steps.length; i += 1) {
      expect(scale.steps[i]!.colour.L).toBeLessThan(scale.steps[i - 1]!.colour.L);
    }
  });

  it('damps chroma toward both ends', () => {
    const scale = generateScale('#0090ff');
    const peak = Math.max(...scale.steps.map((s) => s.colour.C));

    expect(scale.steps[0]!.colour.C).toBeLessThan(peak / 4);
    expect(scale.steps[11]!.colour.C).toBeLessThan(peak / 2);
  });

  it('produces a grey scale from an achromatic seed, with no special case', () => {
    const scale = generateScale(oklchToHex({ L: 0.3, C: 0.002, H: 0 }));

    for (const step of scale.steps) expect(step.colour.C).toBeLessThan(0.01);
  });

  it('resolves the fill to the step the seed landed on', () => {
    const scale = generateScale('#46a758');
    expect(resolvedFill(scale).step).toBe(scale.resolvedStep);
    expect(resolvedFill(scale).isSeed).toBe(true);
  });
});
