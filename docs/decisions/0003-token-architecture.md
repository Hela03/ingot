# 0003. Token architecture and naming

- **Status:** Accepted
- **Date:** 2026-08-22
- **Deciders:** Laura España

## Context

Ingot ships as a versioned npm package and is rethemed through CSS custom
properties rather than by forking ([ADR-0001](0001-distribution-model.md)).
Consumer flexibility is therefore exactly equal to token coverage, which makes
the token layer the highest-stakes structure in the project.

Two things had to be settled before any token beyond a scaffolding sample was
written: how tokens are layered, and how they are named. Both are effectively
permanent — a semantic token name is public API from the moment it is published,
and renaming one breaks every consumer stylesheet referencing it, with nothing
in our test suite noticing.

This ADR was deliberately left unwritten during scaffolding so that the
structure would not be decided by implication.

## Decision

### Three tiers, references pointing only upward

```
primitives  →  semantic  →  component
```

Components consume **semantic** tokens, and component tokens once those exist.

**A component referencing a primitive directly is a defect** — it is immune to
theming, because the consumer's theme operates on the semantic layer. This is
lint-enforceable and should be enforced by lint rather than by review.

### Naming grammar at the semantic layer: property-first

```
color.{property}.{role}.{state?}

color.bg.danger
color.text.muted
color.bg.brand.hover
```

Role-first (`color.danger.bg`) is rejected. Property-first optimises for
authoring and autocomplete, which happens constantly. Role-first optimises for
theming, which happens once per brand — and theming targets the palette, not the
semantic names.

### No appearance words, at any tier

A name describing how something looks becomes a lie the moment a consumer
rethemes it.

```
brand-9    not  blue-9
space-4    not  space-16px
```

The rationale differs by scale, and the distinction is deliberate:

- **`brand` and `neutral` are abstract**, because they must change per consumer.
- **`danger` / `success` / `warning` / `info` are role-named**, because they may
  change — a consumer may shift their error red toward crimson — but the role
  they play does not.

### Scales

**Colour — 12 steps**, using the Radix band model:

| Steps | Purpose               |
| ----- | --------------------- |
| 1–2   | backgrounds           |
| 3–5   | component backgrounds |
| 6–8   | borders               |
| 9–10  | solid fills           |
| 11–12 | text                  |

**Space — 8 steps.** Base unit `0.25rem`. Progression 4 / 8 / 12 / 16 / 24 / 32
/ 48 / 64 in px equivalent.

**Token values are rem, never px.** Pixel figures in documentation are
illustrative only.

**Radius — 5 steps:** `none`, `sm`, `md`, `lg`, `full`. Radius has its own
scale and is not derived from space: it is the most brand-expressive non-colour
token, and tying it to spacing would remove that expression.

**Type — composite tokens.** See below.

### Typography is composite, not atomic

A text style bundles size, line-height, weight and tracking, because they always
travel together.

```
text.body
text.body-sm
text.heading-1 … text.heading-n
```

Two reasons:

1. It makes pairing a display size with a body line-height impossible.
2. It maps 1:1 onto Figma text styles. Atomic type tokens have no Figma
   equivalent and drift immediately.

**Swappable:** font family — sans, mono, and an optional display face.
**Fixed:** the roles and their relationships.

Ingot's line-heights are tuned to a stated x-height ratio. Consumers swapping to
a typeface far outside that range should expect to adjust. This must be stated
in the theming guide.

### Accessibility floor — all testable

- Sizes in `rem`, never `px` (WCAG 1.4.4).
- Body text minimum `1rem`.
- Layout must survive user spacing overrides (WCAG 1.4.12): line-height 1.5×,
  letter-spacing 0.12em, word-spacing 0.16em.

### Tier 3: convention defined, deliberately empty

Component tokens have a defined shape and no members.

```css
--ig-button-padding-x: var(--ig-space-3);
```

**The bar for adding one:** a consumer would plausibly want this property to
differ from the global scale, and the only alternative is changing the global
scale for everything.

- Padding, height, radius — yes.
- Icon-to-label gap — no.

**Trigger:** the first "can I change X on just this component" request. Do not
populate speculatively.

## Consequences

- The semantic layer is a public contract. Its names are permanent from first
  publish, in the same way package names and the `--ig-` prefix are
  ([ADR-0002](0002-naming-and-prefix.md)).
- Two rules become lint-enforceable and are currently enforced by nothing: no
  literal appearance values in components, and no primitive references from
  components. This must land before the first component.
- Composite type tokens are less flexible than atomic ones by design. Someone
  will eventually want a one-off size with a different line-height, and the
  answer is a new text style rather than an override.
- An empty tier 3 means the first legitimate request for one arrives as a change
  rather than as a lookup. That is the intended trade: no speculative surface.

### Versioning consequences

- **Changing an existing step's value is a breaking change**, even though
  nothing errors. `space-4` moving from 16px to 20px shifts every consumer's
  layout.
- **Extending a scale at either end is additive** — a minor version.
- **Mid-scale insertion has no free number.** Prefer designing generously now;
  fall back to fractional steps (`space-4.5`, as Tailwind does) only if forced.

## Alternatives considered

- **Role-first semantic naming** (`color.danger.bg`). Rejected: optimises for
  theming, which happens once per brand, at the cost of authoring and
  autocomplete, which happen constantly.
- **Appearance-based primitive names** (`blue-9`, `space-16px`). Rejected: the
  name becomes false as soon as a consumer rethemes, and px in a token name
  contradicts rem values.
- **Atomic typography tokens** (separate size, line-height, weight, tracking).
  Rejected: permits invalid combinations, and has no Figma equivalent, so code
  and design drift immediately.
- **Deriving radius from the space scale.** Rejected: radius is the most
  brand-expressive non-colour token and needs independent movement.
- **Populating component tokens up front.** Rejected: speculative API surface
  that must then be supported forever.
- **Two tiers (primitive → semantic only).** Rejected implicitly: the component
  tier is needed as a defined convention even while empty, so the first request
  has somewhere to go that is not the global scale.

## Revisit when

A naming pattern proves unworkable in practice.

Note the asymmetry: the `--ig-` prefix, the package names and the **semantic
token names** are permanent from first publish — they are a public contract.
What can be revisited is the grammar for names not yet shipped, the scales'
extents, and the contents of tier 3.

## Unspecified, to be set before implementation

- **The x-height ratio** that line-heights are tuned to. The policy is decided;
  the number is not yet stated and must be, since the theming guide has to
  publish it for consumers to judge their own typeface against.
- **How many heading steps** `text.heading-1 … n` runs to.
