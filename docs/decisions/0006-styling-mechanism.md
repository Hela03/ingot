# 0006. Styling mechanism

- **Status:** Accepted
- **Date:** 2026-08-22
- **Deciders:** Laura España

## Context

Nothing had been decided about how components are styled. The gap surfaced while
planning the lint rule that enforces token usage
([#4](https://github.com/Hela03/ingot/issues/4)), because that rule cannot be
designed without knowing where appearance values live: styles in CSS files are
stylelint's territory, styles in TypeScript are ESLint's, and styles in class
name strings are neither's. The enforcement mechanism is downstream of the
styling mechanism, so the styling mechanism had to be settled first.

The binding constraint comes from [ADR-0001](0001-distribution-model.md): Ingot
ships as a versioned package, consumers cannot edit component internals, and the
theming API is therefore their **only** escape hatch. Whatever carries that API
cannot depend on our toolchain, because a consumer is not obliged to adopt it.

## Decision

**CSS Modules, with all appearance values expressed as CSS custom properties.**

The reasoning, in order of weight:

### 1. It is the only option where theming works without our build

A consumer overrides `--ig-color-bg-brand` in their own stylesheet and every
component responds. No rebuild, no configuration, no compile step of ours in
their pipeline. Runtime theming, multi-tenant theming and per-page switching all
come free, because the mechanism is the browser's rather than ours.

ADR-0001 states the theming API is the only escape hatch available to consumers.
An escape hatch that requires adopting our build tooling is not one.

### 2. Values live in CSS, where the mature tooling is

`stylelint-declaration-strict-value` covers most of the "no literal appearance
values" rule as **configuration rather than custom code**. Fewer custom rules to
write, and fewer to maintain against upstream API changes.

### 3. Zero runtime, no styling library in the dependency tree

Every dependency we ship is a liability imposed on consumers.

## Consequences

**Positive**

- Theming works at runtime, without our build, by overriding custom properties.
- stylelint is the right tool, and mostly off the shelf.
- No runtime cost and no styling dependency shipped to consumers.

**Negative**

- Less ergonomic than the alternatives: no type safety on class names by
  default, styles are not co-located with logic, and there is more hand-written
  CSS.
- We need a CSS build step **in the package** — for bundling, not for theming.
  The distinction matters: consumers need our build for nothing.

**On enforcement tooling**

Tier enforcement — components may reference semantic and component tokens, never
primitives ([ADR-0003](0003-token-architecture.md)) — cannot be configuration.
It depends on Ingot's own token tiers, so it will be a small custom rule. To
avoid encoding the naming grammar in a second place where it can drift, that
rule should derive its tier lists from the **token build output** rather than
pattern-matching token names.

That has a CI consequence worth stating in advance: **lint will depend on the
token build**, so tokens must be built before linting, and a token build failure
will surface as a lint failure. The failure message must make that legible, or
the next person loses an hour to a lint error that is really a build error.

## Alternatives considered

- **Tailwind.** Rejected. Shipping utility classes means every consumer must
  configure Tailwind compatibly with ours — build-time coupling, which is wrong
  for a distributed package. Good for applications; poor for libraries.
- **vanilla-extract.** Rejected, though genuinely good. It puts styles behind a
  build step the consumer inherits, and its type safety is largely duplicated by
  the lint rules we are about to build.
- **CSS-in-JS (emotion, styled-components).** Rejected. Runtime cost, a
  dependency imposed on consumers, and values live in TypeScript where the
  tooling is weaker.
- **Plain CSS files.** Rejected. No scoping; class name collisions with consumer
  styles are a matter of time.

## Revisit when

A component genuinely cannot be built or themed this way.

**The test:** name the specific style that cannot be expressed as a custom
property. If it is possible but awkward, that is ergonomics, not a distribution
problem — and ergonomics was the accepted cost of this decision, not an
unforeseen consequence of it.
