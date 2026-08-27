// The theme report (ADR-0007 section 12): the artifact a designer reviews
// instead of terminal output.
//
// Two deliberate presentation rules, because this is a calibration surface:
//
//   1. Collision pairs are rendered as swatches TOUCHING, side by side. Adjacent
//      is how they appear in a real interface, and it is the only arrangement
//      where "are these confusable" is answerable by looking. The distance is
//      present but small — it is evidence, not the finding.
//   2. Nothing that carries meaning is colour-coded. A report about judging
//      colour must not put its own colours next to the colours being judged.

import { generateScale } from './scale.js';

/** @param {unknown} s @returns {string} */
const escape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** @param {{ name: string, hex: string, note?: string }} entry */
function scaleRow(entry) {
  const scale = generateScale(entry.hex);
  const swatches = scale.steps
    .map((s) => {
      const seed = s.isSeed ? ' step--seed' : '';
      return `<div class="step${seed}">
        <div class="chip" style="background:${s.hex}"></div>
        <div class="n">${s.step}</div>
        <div class="hx">${s.hex.replace('#', '')}</div>
      </div>`;
    })
    .join('');

  return `<section class="scale">
    <h3>${escape(entry.name)}
      <span class="meta">seed ${scale.seedHex} &middot; L ${scale.seed.L.toFixed(2)} &middot; C ${scale.seed.C.toFixed(3)} &middot; H ${scale.seed.H.toFixed(0)}&deg; &middot; <strong>resolved to step ${scale.resolvedStep}</strong></span>
    </h3>
    ${entry.note ? `<p class="note">${escape(entry.note)}</p>` : ''}
    <div class="steps">${swatches}</div>
  </section>`;
}

/** @param {ReturnType<import('./collision.js').collisionMatrix>} matrix */
function collisionSection(matrix) {
  const sorted = [...matrix.pairs].sort((a, b) => a.distance - b.distance);

  const cards = sorted
    .map(
      (p) => `<figure class="pair${p.collides ? ' pair--flagged' : ''}">
      <div class="duo">
        <div class="half" style="background:${p.brandFill.hex}"></div>
        <div class="half" style="background:${p.statusFill.hex}"></div>
      </div>
      <figcaption>
        <span class="who">${escape(p.brandRole)} <span class="vs">/</span> ${escape(p.statusRole)}</span>
        <span class="d">${p.distance.toFixed(3)}${p.collides ? ' &middot; flagged' : ''}</span>
        <span class="d">step ${p.brandStep} / ${p.statusStep} &middot; seed hue &Delta; ${p.seedHueDistance.toFixed(0)}&deg;</span>
      </figcaption>
    </figure>`,
    )
    .join('');

  return `<section>
    <h2>Collision pairs</h2>
    <p class="lede">Each pair is the brand's <strong>resolved solid fill</strong> beside a status
    <strong>resolved solid fill</strong>, touching, at the size they would meet at in an interface.
    Sorted closest first. The question is whether the two read as different colours &mdash; not
    whether the number looks small.</p>
    <p class="warnbox"><strong>Provisional threshold ${matrix.threshold} &mdash; arbitrary.</strong>
    Chosen so this page shows a readable spread of flagged and unflagged pairs, and for no other
    reason. It has not been validated against anything. The real value is what you decide by looking
    at these pairs. Note the unit: this is a perceptual distance in OKLab, not a hue angle, so no
    number from the earlier seed-hue analysis carries over. (Issue #11.)</p>
    <div class="pairs">${cards}</div>
  </section>`;
}

/**
 * @param {{ name: string, hex: string, note?: string }[]} brands
 * @param {Record<string,string>} statuses
 * @param {ReturnType<import('./collision.js').collisionMatrix>} matrix
 * @returns {string}
 */
export function renderReport(brands, statuses, matrix) {
  const statusEntries = Object.entries(statuses).map(([name, hex]) => ({ name, hex }));

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ingot theme report</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; padding:32px 28px 80px; background:#e9e9e9; color:#1a1a1a;
         font:14px/1.55 ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif; }
  h1 { font-size:22px; margin:0 0 4px; }
  h2 { font-size:17px; margin:44px 0 6px; }
  h3 { font-size:14px; margin:26px 0 4px; font-weight:650; }
  .lede, .note, .sub { color:#4a4a4a; max-width:76ch; }
  .sub { margin:0 0 8px; }
  .note { font-size:12.5px; margin:2px 0 8px; }
  .meta { font-weight:400; color:#5a5a5a; font-size:12px; margin-left:8px; }
  .warnbox { max-width:76ch; background:#fff; border:1px solid #c9c9c9; padding:12px 14px;
             border-radius:6px; font-size:12.5px; color:#333; }

  .steps { display:flex; gap:0; flex-wrap:nowrap; overflow-x:auto; padding-bottom:4px; }
  .step { flex:1 1 0; min-width:56px; text-align:center; }
  .chip { height:56px; border:0; }
  .step:first-child .chip { border-radius:4px 0 0 4px; }
  .step:last-child .chip { border-radius:0 4px 4px 0; }
  .step--seed .chip { outline:2px solid #111; outline-offset:-2px; position:relative; z-index:1; }
  .step--seed .n::after { content:" seed"; font-weight:700; }
  .n { font-size:11px; margin-top:3px; color:#333; }
  .hx { font-size:10px; color:#777; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }

  .pairs { display:grid; grid-template-columns:repeat(auto-fill,minmax(232px,1fr)); gap:18px; margin-top:14px; }
  .pair { margin:0; }
  .duo { display:flex; height:92px; border:1px solid rgba(0,0,0,.22); border-radius:4px; overflow:hidden; }
  .half { flex:1 1 50%; }
  .pair--flagged .duo { border-color:#111; border-width:2px; }
  figcaption { display:flex; flex-direction:column; gap:1px; margin-top:5px; }
  .who { font-size:12.5px; font-weight:600; }
  .vs { color:#888; font-weight:400; }
  .d { font-size:10.5px; color:#6a6a6a; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
</style></head><body>

<h1>Ingot theme report</h1>
<p class="sub">Calibration run for issue #11 &mdash; the minimum perceptual separation between
resolved fills. Generated from the same config as the build. Page background is neutral grey so it
does not bias colour judgement.</p>

<h2>Scales</h2>
<p class="lede">Twelve steps per seed. The outlined step is where the seed resolved &mdash; ADR-0007
derives that from the seed's lightness rather than fixing it at step 9, so it differs per brand.
The thing to judge here is whether the steps <em>above and below</em> the seed remain useful, or
whether the scale compresses into mush at one end.</p>
${brands.map(scaleRow).join('')}

<h3 style="margin-top:34px">Status scales</h3>
<p class="note">Hues per ADR-0007: danger 25&deg;, warning 84&deg;, success 147&deg;, info 252&deg;.
Chosen for recognition rather than fit.</p>
${statusEntries.map(scaleRow).join('')}

${collisionSection(matrix)}

</body></html>`;
}
