# 0005. Palette generation and accessibility policy

- **Status:** Accepted
- **Date:** 2026-08-22
- **Deciders:** Laura España

## Context

Ingot is whitelabel: consumers arrive with their own brand colour and expect a
complete, accessible system out of it. Hand-authoring primitives cannot deliver
that, because the palette must be correct for brand colours nobody has seen yet.

[ADR-0003](0003-token-architecture.md) settled the token architecture and
naming. This ADR settles where the primitive values come from, and what
accessibility guarantee the system makes.

## Decision

### Primitives are generated, not authored

The source of truth is a **seed config**. Primitives are build output with the
same status as anything in `dist/`: never hand-edited.

### Colour space: OKLCH

- **Chroma is damped toward zero at the light and dark extremes** — a bell
  curve. Tints near white and shades near black cannot carry mid-tone chroma
  without leaving sRGB and looking muddy.
- **Snap-to-seed:** the generated step nearest the seed's lightness is replaced
  by the seed itself, so a consumer's brand hex **is** step 9, not an
  approximation of it.

### Seeds — one required, six optional

**Required:** `brand-primary`.

**Optional, each with a derivation default:**

| Seed                                   | Default if not supplied                    |
| -------------------------------------- | ------------------------------------------ |
| `neutral`                              | brand hue at very low chroma (tinted grey) |
| `brand-secondary`                      | derived from primary, reduced chroma       |
| `danger`, `success`, `warning`, `info` | Ingot's own tuned scales                   |

One hex in gives a complete accessible system. Seven gives full control.

### Computed, never seeded

- **`text-on-solid`, per scale.** Not every hue takes white text at step 9 —
  yellow, amber, lime, mint and sky need black. This must be computed, not
  assumed.
- **Alpha variants of every scale**, for overlays on tinted surfaces.
- **Wide-gamut definitions**, since alpha blending differs in P3 versus sRGB.

### Hue collision detection

Check hue distance across the **full brand × status matrix**, not just `info`. A
red brand collides with `danger`, green with `success`, amber with `warning`,
blue with `info`.

**Warn at build time, never error.** Collision is sometimes acceptable.

The warning must point at the real remedy rather than merely reporting
similarity:

1. Differentiate on **chroma and lightness** within the scale.
2. Ensure status components carry **non-colour signals**. WCAG 1.4.1: colour
   must never be the sole carrier of meaning.

Related consequence: status components should carry icons **by default**,
opt-out rather than opt-in.

### Harmonisation: optional, off by default

Harmonisation shifts a status hue toward the brand so it feels native to the
theme.

**It is clamped by the collision threshold.** Harmonisation may pull toward the
brand but never past the minimum separation, and is skipped entirely for pairs
that already collide. Without this clamp the two features contradict each other:
one exists to reduce hue distance, the other to preserve it.

### Accessibility policy — the operative principle

> **Accessibility is the default state, not a checked state.** Deviating must be
> possible, explicit, and recorded — never silent, and never the path of least
> resistance.

The reasoning is that enforcement is impossible anyway: consumers can override
CSS custom properties downstream. Pretending to enforce is theatre, and it
teaches people to disable the mechanism wholesale. Default-plus-override puts
the friction only on the person doing the unusual thing.

**Mechanism:**

- **CI gate:** WCAG 2.1 AA on every text/background pair in the semantic layer.
  Failure names the specific pair and the measured ratio.
- **APCA reported alongside**, as the better perceptual measure — but **not
  gating**. WCAG 2.1 AA is what audits and procurement check; APCA is the
  quality signal. Gating on APCA alone risks failing an audit against a palette
  our own build called green.
- **Override:** a per-pair allow list with a **required reason string**. The
  model is `eslint-disable-next-line` — specific, deliberate, self-documenting.
- **An allowed pair warns on every build** and appears in a generated
  accessibility report. Silent exceptions become permanent.
- **There is no global off switch.** An escape hatch that can be widened to
  cover everything is a mute button, not an escape hatch.

### Config-driven

Contrast requirements live in **one config file**, from which the generator, the
tests and the documentation all derive. Documentation cannot drift from
implementation, because it is not a separate statement of the same fact.

### Ingot's own theme

Generated from a seed, with per-step hand adjustment permitted. Our own theme
should demonstrate that the escape hatch works — a system whose authors never
use their own override mechanism has not tested it.

## Consequences

- A consumer supplying one hex gets a full, accessible, wide-gamut system. That
  is the headline capability of the whole project.
- Primitives cannot be hand-tuned. Wanting a specific step to be "a bit less
  green" means changing the seed or the generator, not editing a value.
- The generator becomes load-bearing infrastructure: a bug in it is a bug in
  every consumer's palette simultaneously.
- Accessibility failures surface in CI as named pairs with measured ratios, so
  they are actionable rather than a general warning.
- Every override is visible on every build, forever. This is intentional
  friction and will occasionally be annoying; that is the mechanism working.
- Reporting APCA without gating on it means the build can be green while the
  perceptual signal is poor. Accepted deliberately, because the alternative
  fails audits.

## Alternatives considered

- **HCT as the colour space.** Rejected: heavier, harder to inspect, and results
  are indistinguishable from OKLCH at this scale.
- **Hand-authored primitives.** Rejected: cannot guarantee accessibility for
  arbitrary consumer brands, which is the entire point of a whitelabel system.
- **Gating CI on APCA.** Rejected: risks failing a real audit against a palette
  our own build passed, because audits check WCAG 2.1 AA.
- **Hard-failing on hue collision.** Rejected: collision is sometimes acceptable,
  and a hard failure would block legitimate brands whose colour genuinely sits
  near a status hue.
- **Harmonisation on by default.** Rejected: it moves status hues toward the
  brand, which is precisely the direction collision detection exists to
  prevent. Off by default, and clamped when on.
- **A global accessibility off switch.** Rejected explicitly: it converts a
  deliberate per-pair exception into a mute button.

## Revisit when

Either of:

1. **The generator produces palettes that are accessible but aesthetically poor
   for a real brand.** That is a signal the generation model is wrong, not that
   the policy is.
2. **WCAG 3 / APCA becomes normative.** The test for this is specific: **APCA is
   cited by an accessibility audit standard rather than as guidance.** Until
   then it stays reported and non-gating.

## Unspecified, to be set before implementation

- **Ingot's own brand seed colour.** To be chosen by the maintainer.
- **The minimum hue separation** used as the collision threshold, which is also
  the clamp for harmonisation. The policy depends on this number; the number is
  not yet set.
