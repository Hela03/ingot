// Candidate seeds used to calibrate the collision threshold (#11).
//
// STATUS SEEDS are real reference values (Radix scale 9). Their hues are the
// defaults ADR-0007 specifies: danger 25, warning 84, success 147, info 252.
//
// BRAND SEEDS are the real candidate hexes. Lightness is what determines the
// resolved step (ADR-0007), so these must be the actual values — an earlier run
// reconstructed them from hue angles alone and every number in it described
// colours that do not exist.
//
// NOTE ON ROLE. cream and neo lime were supplied as BACKGROUND candidates, not
// as brand seeds. They are run through brand generation here as a deliberate
// stress test — a background colour is exactly the kind of very light seed that
// exposes how the scale behaves far from the fill band. The correct output for
// them may well be a warning rather than a smoothed scale.

export const STATUS_SEEDS = {
  danger: '#e5484d', // Radix red-9    — hue 23
  warning: '#ffc53d', // Radix amber-9  — hue 84
  success: '#46a758', // Radix grass-9  — hue 147
  info: '#0090ff', // Radix blue-9   — hue 252
};

/** @type {{ name: string, hex: string, role: 'brand' | 'background', note: string }[]} */
export const BRAND_CANDIDATES = [
  { name: 'indigo', hex: '#41386B', role: 'brand', note: 'L 0.376 · C 0.085 · H 290' },
  {
    name: 'cream',
    hex: '#f7f4d5',
    role: 'background',
    note: 'L 0.961 · C 0.041 · H 103 — supplied as a background, run as a brand to stress the light end',
  },
  {
    name: 'coal',
    hex: '#222222',
    role: 'background',
    note: 'L 0.252 · C 0.000 — achromatic; the case that broke seed-hue comparison',
  },
  { name: 'matcha', hex: '#C2D8C4', role: 'brand', note: 'L 0.860 · C 0.036 · H 148' },
  {
    name: 'ink void',
    hex: '#23212C',
    role: 'background',
    note: 'L 0.255 · C 0.021 · H 293',
  },
  {
    name: 'neo lime',
    hex: '#F1FEC8',
    role: 'background',
    note: 'L 0.974 · C 0.071 · H 119 — supplied as a background, run as a brand to stress the light end',
  },
];
