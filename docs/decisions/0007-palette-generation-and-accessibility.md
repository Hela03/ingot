# 0007. Palette generation and accessibility policy

- **Status:** Accepted
- **Date:** 2026-08-27
- **Deciders:** Laura España
- **Supersedes:** [ADR-0005](0005-palette-generation-and-accessibility.md)

## Context

ADR-0005 set out how Ingot generates a palette from a consumer's brand colour and
how accessibility is enforced. Its foundations held. Its model of where a brand
colour _sits_ did not.

0005 assumed the seed becomes step 9 of the generated scale. Applying that to
real brands breaks in both directions: a dark brand forced to step 9 is either
lightened away from the colour the consumer supplied, or it stays and the scale
around it collapses; a pale brand at step 9 cannot carry the text it is supposed
to carry. Brands arrive with an exact hex and a reasonable expectation that it is
the colour on the button. This comes from production experience, not from theory.

Fixing that changes enough downstream — the semantic layer becomes generated
output rather than an authored file, and the step-to-role table stops being a
guarantee — that a diff against 0005 would be harder to read than a replacement.
This ADR therefore **supersedes** 0005 and states the whole policy. It is not a
delta and should not be read as one.

## Decision

### 1. Primitives are generated, never authored

The source of truth is a **seed config**. Primitives are build output with the
same status as anything else in `dist/`: never hand-edited, regenerated on every
build.

Hand-authored primitives cannot guarantee accessibility for an arbitrary consumer
brand, because the brand is not known when they are written.

### 2. Colour space and scale construction

Generation happens in **OKLCH**.

**Chroma is damped toward zero at the light and dark extremes**, following a bell
curve across the scale. Tints near white and shades near black cannot carry
mid-tone chroma without leaving sRGB and reading as muddy.

**Snap-to-seed:** the generated step nearest the seed's lightness is replaced by
the seed itself. The consumer's brand hex _is_ a step in the scale, not an
approximation of one.

Scales are 12 steps, per [ADR-0003](0003-token-architecture.md).

### 3. Seed position is derived, not fixed

**The seed lands at whatever step its lightness places it.** It is not forced to
step 9, or to any other step.

This is the change that motivated replacing ADR-0005. Forcing a dark or pale
brand to a fixed step either distorts the colour the consumer supplied or
relegates it to a role it cannot serve.

**Semantic brand mappings are therefore computed per theme, against the position
the seed actually resolved to.** One brand's hex may resolve `color.bg.primary`
to `primary-9`; another's to `primary-11`.

**The consumer supplies a hex and never learns what a step is.** Steps are an
internal construct of the generator. They are not part of the consumer-facing
API, and no consumer-facing documentation should require understanding them.

### 4. Seeds

**Required:** `brand-primary`.

**Optional, with defined behaviour when absent:**

| Seed                                   | When absent                                           |
| -------------------------------------- | ----------------------------------------------------- |
| `neutral`                              | derived — brand hue at very low chroma, a tinted grey |
| `brand-secondary`                      | **duplicates primary** — see below                    |
| `danger`, `success`, `warning`, `info` | Ingot's own tuned scales                              |
| `background` (light)                   | **cannot be derived** — see below                     |
| `background` (dark)                    | derived from the light background's hue               |

One hex produces a complete, accessible system. Every seed given is control the
consumer has taken.

#### Status hue defaults are chosen for recognition, not for fit

| Status    | Hue      | Reference         |
| --------- | -------- | ----------------- |
| `danger`  | **25°**  | Radix red-9       |
| `warning` | **84°**  | Radix amber-9     |
| `success` | **147°** | Radix **grass**-9 |
| `info`    | **252°** | Radix blue-9      |

**Status colours are the one part of the palette whose job is recognition rather
than fit.** Every other token expresses a brand. `danger`, `success` and
`warning` must be read correctly by someone who has never seen the product,
quickly, and possibly under stress. **Optimising them for harmony with the brand
optimises the wrong variable.**

Success at 147° rather than 158° is the worked example. The cooler 158° pairs
more comfortably with a wider range of brands — it clashes less against warm
brands and reads as more contemporary. Every one of those advantages is about
**pairing with the brand**, and ADR-0007 already has a mechanism for that:
harmonisation (below), which is opt-in and per-theme.

> **A default chosen for recognisability, plus optional harmonisation, strictly
> beats a default pre-compromised toward blending in.** The pre-compromised
> default is worse on both axes at once: less recognisable than the conventional
> hue, and less well fitted than a hue actually tuned to the brand in front of
> it.

147° is also further from cyan, which matters because teal is a common brand
colour and a success state drifting toward teal loses its conventional reading.

**This reasoning applies equally to `danger` 25°, `warning` 84° and `info` 252°.**
None of the four should be relitigated on the grounds that a different value
would sit more comfortably with some brand. That is what harmonisation is for. A
future change to any of them needs an argument about **recognition** — that the
current hue is misread, or is read as the wrong status — not about aesthetics.

#### Secondary duplicates primary. It is never derived.

When no secondary seed is supplied, **secondary resolves to primary**. It is not
computed by reducing chroma or shifting hue.

A derived secondary invents brand identity that nobody approved. Duplication is
honest: one colour was given, one colour is used in both roles.

The build warns: _"No secondary seed supplied — secondary resolves to primary."_

Derivation is available as an **explicit opt-in flag**, never a default.

#### Background is a first-class seed

The light background **cannot be derived**. A neutral step 1 is near-white by
construction, and a deliberate page colour — cream, off-black, a tinted surface —
is a design choice, not a computation.

**Light and dark backgrounds are separate values.** A light background seed
cannot serve dark mode.

### 5. Dark mode is derived from the same seeds

Dark mode is generated from the same seed config, not authored separately.

A **per-seed explicit dark override** is permitted for consumers whose brand
requires a different colour in dark mode.

**Background is the exception:** it requires both values, or the dark background
derives as a near-black tinted by the light background's hue.

### 6. The semantic layer is generated output, not an authored file

This follows from section 3. If `--ig-color-bg-primary` resolves to a different
primitive step in each theme, the semantic layer cannot be a static file — the
semantic CSS is generated per theme, alongside the primitives.

**Token names remain stable.** [ADR-0003](0003-token-architecture.md)'s public
contract is unaffected: `color.bg.primary` is `color.bg.primary` in every theme.
Only the primitive it resolves to varies.

#### Consequence: the step-to-role table is a heuristic, not a guarantee

ADR-0003 describes the Radix band model — steps 1–2 backgrounds, 3–5 component
backgrounds, 6–8 borders, 9–10 solid fills, 11–12 text.

That mapping is **reliable only when the seed sits near step 9**. Once semantic
mappings move per theme, it is a useful description of the common case and
nothing stronger.

**The guarantee is the contrast assertions, not the table.** Anywhere the two
appear to conflict, the assertions are what hold. Documentation must not present
the band model as a promise about which step fills a role.

### 7. Computed, not seeded

Derived per scale, never supplied by the consumer:

- **`text-on-solid`, per scale.** Not every hue takes white text at its fill
  step — yellow, amber, lime, mint and sky need black. This must be computed, not
  assumed.
- **Alpha variants of every scale**, for overlays on tinted surfaces.
- **Wide-gamut definitions**, since alpha blending differs in P3 and sRGB.

### 8. Interaction states

#### Hover direction is derived from the text colour

**If the fill carries light text, hover goes darker. If it carries dark text,
hover goes lighter.** This is never configured.

Stated as a property rather than a procedure:

> **If the base state passes contrast, the hover state cannot fail it.**

Hover always moves the fill _away_ from the text it carries, so it is
structurally incapable of being worse than a state that already passed. This is
not a check that hover contrast is adequate; it is a construction in which
inadequate hover contrast cannot arise from an adequate base state.

**Rejected: "hover moves away from the page background."** It breaks for a light
brand on a light page — moving away from the page means going darker, which
degrades the dark text the fill is carrying.

#### Focus ring: universal, neutral, two-colour

**One focus ring for every component.** Not theme-dependent, not derived from the
brand, not varying by tone or role.

It is a **two-colour ring** — one light line and one dark line, per
[WCAG technique C40](https://www.w3.org/WAI/WCAG22/Techniques/css/C40) — so that
against any background at least one of the two lines has sufficient contrast.

This makes insufficient focus contrast **impossible rather than validated**. It
belongs to the same category as a closed TypeScript union or the tier manifest
refusing to answer: the failure is unrepresentable, not detected after the fact.

It is a **composite token** — inner colour, outer colour, both widths, offset —
which makes it the third composite alongside typography and shadow. Its parts are
not individually settable, for the same reason a text style's are not: the
guarantee lives in the combination.

Applied on **`:focus-visible`**, not `:focus`.

**Override caveat.** A consumer may override it, per the accessibility policy
below. But this is the one token where an override removes a **structural
guarantee** rather than an aesthetic default, and the warning must say so in
those terms — categorically, not as a contrast ratio. A number invites the reply
"that ratio is fine for our background", which misses that the guarantee was
never about one background.

#### Disabled states use explicit tokens, not opacity

**Rejected: opacity applied to the whole component.** Three reasons:

1. It compounds unpredictably with whatever sits behind the component, so the
   resulting contrast **cannot be asserted** — the value depends on the page.
2. It fades the focus ring along with the fill, weakening the one guarantee
   section 8 exists to make.
3. It fades icons and borders equally, which is rarely the intended design.

Instead: **explicit disabled fill and disabled text tokens per role**, generated
like everything else and testable like anything else.

### 9. Assertions

#### Text on fill — legibility

Every text/background pair in the semantic layer is checked. This is the CI gate;
see section 10.

#### Fill against page — affordance

**A separate assertion, covering a different question.** Text-on-fill asks
whether the label can be read. Fill-on-page asks whether the component is visible
_as an object_.

[WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
requires 3:1 for the boundary of a user-interface component. A pale brand on a
pale page can pass text contrast comfortably while being nearly invisible — and
section 8's hover rule moves such a fill **closer** to the page, not further from
it.

**The remedy when this fails is a border drawn from steps 6–8, not reversing the
hover direction.** Reversing hover would trade a legibility guarantee for an
affordance one; adding a border satisfies both.

#### Collision detection: compare resolved fills, not seeds

Checked across the **full brand × status matrix**, not only against `info`.

**The comparison is between resolved solid-fill colours**, not between seed
hues. For each role, take the step the derivation in section 3 assigns to
`color.bg.{role}`, and measure **perceptual distance in OKLab** between those
colours.

##### Why not seed hue

A seed's hue angle measures the wrong thing, in two independent ways:

- **Hue is meaningless at low chroma.** A near-achromatic brand — a grey "coal" —
  has a hue angle that is numerical noise. It may compute as a few degrees from
  the warning hue, and a seed-hue check will warn confidently. **No hue proximity
  makes grey look amber.**
- **Seed chroma does not survive into the fill.** A pale green seed generates a
  scale whose solid fill is saturated green. Two seeds one degree apart in hue
  can produce fills further apart perceptually than two seeds twenty-eight
  degrees apart, because the seeds' own chroma is irrelevant to what the scale
  produces.

**What renders is what can collide, and the fills are what render.** The seed is
an input to generation, not the thing anyone sees.

##### What this dissolves

Comparing seeds would have required a **chroma floor** — a second threshold,
below which hue comparison is skipped because it is noise. Comparing resolved
fills removes the need for one:

- An achromatic brand generates a grey fill, which sits far from any saturated
  status fill in the a/b plane. It falls out naturally, with a large distance and
  no warning.
- Pale and dark seeds are handled automatically, because the derivation has
  already placed them by the time the comparison happens.

**This is a question dissolved rather than a decision deferred.** There is no
chroma floor to set.

##### Consequences

- The check runs **after generation**, against output, not against the config.
- **The threshold is a perceptual distance, not an angle.** A number arrived at
  by comparing seed hue angles does not transfer to this metric — different
  quantity, different units.
- Calibration is by **looking**, not by reading a number. The theme report renders
  the matrix as **swatch pairs** (section 12), because the question "do these two
  look confusable" is not one a distance answers on its own.

##### Policy

**Warn at build time. Never error** — a collision is sometimes acceptable, and the
consumer owns that decision.

The warning must name the remedy, not merely the similarity: differentiate on
chroma and lightness within the scale, and ensure status components carry
non-colour signals. [WCAG 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
requires that colour is never the sole carrier of meaning; status components
should therefore carry **icons by default, opt-out rather than opt-in**.

#### Harmonisation

Optional, **off by default**. Shifts a status hue toward the brand so it reads as
native to the theme.

**Clamped by the collision threshold.** Harmonisation may pull a status hue toward
the brand but never past the minimum separation, and is **skipped entirely** for
pairs that already collide. Without the clamp the two features contradict each
other — one exists to reduce hue distance, the other to preserve it.

**Designed here; implementation deferred.** It is not required for a first
palette, and it must not ship before the collision threshold it depends on
exists.

### 10. Accessibility policy

The operative principle, unchanged from ADR-0005:

> **Accessibility is the default state, not a checked state.** Deviating must be
> possible, explicit, and recorded — never silent, and never the path of least
> resistance.

Enforcement is impossible in any case: a consumer can override any CSS custom
property downstream and we will never see it. Pretending to enforce is theatre,
and theatre teaches people to disable the mechanism wholesale. Default-plus-
override puts the friction only on the person doing the unusual thing.

**Mechanism:**

- **CI gate: WCAG 2.1 AA** on every text/background pair in the semantic layer,
  plus the fill-on-page assertion in section 9. Failure names the specific pair
  and the measured ratio.
- **APCA reported alongside**, as the better perceptual measure — **not gating**.
  WCAG 2.1 AA is what audits and procurement check; APCA is the quality signal.
  Gating on APCA alone risks failing an audit against a palette our own build
  called green.
- **Override: a per-pair allow list with a required reason string.** The model is
  `eslint-disable-next-line` — specific, deliberate, self-documenting.
- **An allowed pair warns on every build** and appears in the theme report.
  Silent exceptions become permanent.
- **There is no global off switch.** An escape hatch that can be widened to cover
  everything is a mute button, not an escape hatch.

### 11. Warning policy

**Principle: the consumer owns the decision, but not an uninformed one.** Warn on
inconsistency, on accessibility problems, and on unusual-but-valid choices. Never
block.

**The risk is volume.** A first theme build could plausibly emit ten or more
warnings — no secondary seed, a hue collision, an allowed contrast pair, an
unusual background. **Ten warnings is functionally zero**, because people stop
reading build output. Three requirements follow, and they are not optional:

1. **Every warning names a concrete remedy.** Not _"brand and success hues are
   close"_ but:

   > brand 119° and success 142° are 23° apart, below the 30° threshold —
   > differentiate on chroma, or ensure status components carry icons.

   (The 30° figure is illustrative. The threshold itself is not yet set; see
   _Unspecified_ below.)

2. **Every warning is individually suppressible, with a required reason.** Same
   mechanism as the contrast allow list. **No global mute.**

3. **The console shows a summary line; the detail goes to the theme report.**
   Build output is a notification surface, not a reading surface.

### 12. The theme report is a deliverable

Generated per theme, from the same config as the build and the tests, so it
cannot drift from either.

It contains:

- the full palette, as rendered swatches
- the complete contrast matrix, pass/fail per pair
- every warning, with its remedy
- **which steps the seeds resolved to** — the visible consequence of section 3

**This is the artifact a designer reviews.** Terminal output is not, and was
never going to be.

### 13. Config-driven

Contrast requirements, thresholds and policy live in **one config file**, from
which the generator, the tests and the documentation all derive. Documentation
cannot drift from implementation because it is not written twice.

## Consequences

- **One hex produces a complete, accessible theme.** Seven seeds give full
  control. Nothing in between requires understanding the generator.
- **The consumer's exact brand colour appears where they expect it**, because the
  seed is not moved to fit a fixed slot.
- **The step-to-role table is no longer a guarantee** (section 6). Anything that
  relied on "step 9 is the fill" must rely on the semantic token instead.
- **Semantic CSS is generated per theme**, so themes are build artifacts rather
  than files someone edits. Token names stay stable, so ADR-0003's contract
  holds.
- **Focus contrast cannot be inadequate**, by construction rather than by check.
  A consumer override removes that property, and the warning says so
  categorically.
- **Disabled states are assertable**, because they are tokens rather than a
  filter applied over unknown content.
- **Colour cannot carry hierarchy.** See below — this is the consequence most
  likely to be violated by accident.
- Generation is more complex than authoring a palette, and the generator is now
  load-bearing for accessibility. It needs the same standards as the lint rules:
  typechecked, tested, and honest in its failures.

### Colour cannot carry emphasis — a constraint on components and documentation

Because primary and secondary may be **the same colour** (section 4), the
distinction between them **cannot be carried by colour**.

- **Variant carries emphasis** — filled, outlined, ghost.
- **Colour carries brand voice.**
- **Only variant is guaranteed to exist** in every theme.

**Documentation must never describe hierarchy in terms of colour.** Guidance such
as _"use secondary for a less prominent action"_ is false in a one-colour theme,
and it fails silently: an agent or a developer following it produces a flat
interface where every action looks identical, with **no error anywhere** — not in
lint, not in the contrast matrix, not at runtime.

This belongs in the component ADR as well as here, and it is a documentation
rule as much as a code one.

#### Mitigation: a permanent one-colour theme in Storybook

No lint rule catches this. It is a rule about what documentation _says_ and what
a component's design _depends on_, and neither is mechanically checkable in any
way we have found.

So the mitigation is not a guard, it is **exposure**:

> **Every component's stories render under both a two-colour theme and a
> one-colour theme.**

A primary/secondary distinction that depends on colour becomes **visibly
identical** in the one-colour theme, the moment anyone looks at the story. That
converts an invisible failure — a flat interface, no error anywhere — into an
obvious one.

This is deliberately built into the Storybook setup **from the start**, not added
after the first violation. Storybook needs theme switching regardless, so the
marginal cost is a second theme in the list; the cost of adding it later is
whatever has already been built on the assumption that colour distinguishes the
two.

It is not a guarantee. Someone must look. But it makes the failure available to
be seen, which prose does not.

## Alternatives considered

- **Amending ADR-0005 in place.** Rejected: seed position changes so much
  downstream — the semantic layer's status, the step-to-role table's meaning —
  that the diff would be harder to read than a replacement.
- **Seed fixed at step 9** (ADR-0005's model). Rejected: distorts dark and pale
  brands, or relegates the brand colour to a role it cannot serve.
- **Derived secondary by default.** Rejected: invents brand identity nobody
  approved. Available as an explicit opt-in.
- **Derived background.** Rejected: a neutral step 1 is near-white by
  construction; a deliberate page colour is a choice, not a computation.
- **Hover moves away from the page background.** Rejected: breaks for a light
  brand on a light page, degrading the dark text the fill carries.
- **Reversing hover direction when fill-on-page contrast fails.** Rejected:
  trades a legibility guarantee for an affordance one. A border from steps 6–8
  satisfies both.
- **Opacity for disabled states.** Rejected: contrast cannot be asserted, and it
  fades the focus ring and icons along with the fill.
- **A brand-derived or theme-dependent focus ring.** Rejected: it makes focus
  contrast something to validate per theme rather than something that cannot
  fail.
- **HCT instead of OKLCH.** Rejected: heavier, harder to inspect, and results are
  indistinguishable at this scale.
- **Hand-authored primitives.** Rejected: cannot guarantee accessibility for an
  arbitrary consumer brand.
- **Blocking on accessibility failures.** Rejected: unenforceable downstream, so
  blocking is theatre that teaches people to disable the mechanism.

## Revisit when

The generator produces palettes that are accessible but aesthetically poor for a
real brand — or when WCAG 3 / APCA becomes normative.

**The test for the second:** APCA is cited by an accessibility audit standard
rather than as guidance. Until then it is reported and not gated, for the reason
in section 10.

**Not a reason to revisit:** a consumer wanting the brand colour at a specific
step. Steps are internal (section 3), and exposing them would make the generator's
implementation part of the public contract.

## Unspecified, to be set before implementation

- **The minimum perceptual separation between resolved fills** — the collision
  threshold, which also clamps harmonisation. Tracked as
  [#11](https://github.com/Hela03/ingot/issues/11).

  It cannot be calibrated before the generator exists, because it is measured
  against generated output rather than against the seed config. The generator is
  built with a **provisional** value, clearly marked as such and not shipped as
  decided, and the number is chosen by reviewing the swatch pairs in the theme
  report.

  Note that the 30° figure used illustratively in section 11 is an **angle**, and
  this threshold is a **distance**. The illustration predates this section and its
  unit does not carry over.

- **Ingot's own brand seed.** Ingot's default theme is generated from a seed like
  any other, with per-step hand adjustment permitted — our own theme should
  demonstrate that the escape hatch works. The seed itself is the maintainer's to
  choose.
