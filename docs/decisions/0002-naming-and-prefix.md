# 0002. Package naming and CSS custom property prefix

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** Laura España

## Context

Ingot publishes more than one artefact. At minimum there is a set of design
tokens and a React implementation of them, and the project is intended to be
whitelabel — consumed and rethemed by people who did not build it.

Two naming choices had to be made before anything shipped, because both are
effectively permanent once published:

1. What the React package is called on npm.
2. What prefix the generated CSS custom properties carry.

Both are public API. A package name cannot be changed without orphaning
everyone who installed it, and a custom property name cannot be changed without
breaking every consumer stylesheet that references it.

## Decision

**The React implementation is published as `@ingot/react`, not `@ingot/ui`.**

`ui` names a layer, not a technology. It implies there is only ever one
implementation, and it gives no room for a second target — a web component
build, a React Native package, a Vue port — without the original name becoming
a lie. `@ingot/react` states what the package actually is and leaves the
namespace open.

**The folder is `packages/react`, matching the published name.** An earlier
draft used `packages/ui`. Keeping a folder name that differs from the package
name means every contributor has to learn a mapping that carries no
information, and it undermines this ADR by leaving the rejected name in place.

**Generated CSS custom properties are prefixed `--ig-`**, producing names like
`--ig-color-blue-500`.

`--in-` was rejected deliberately. `in` is a real CSS length unit (inches).
Names that collide with CSS keywords invite ambiguity when reading a stylesheet
and when searching a codebase, and the cost of the collision is paid forever by
people who did not choose it. `--ig-` is short, unambiguous, and unclaimed.

## Consequences

- The npm namespace stays open for additional implementations without
  renaming anything.
- `--ig-` is now a namespace commitment. Every token name shipped under it is
  public API: renaming or removing one is a breaking change, regardless of
  whether any TypeScript would fail to compile.
- The prefix is configured in exactly one place, `packages/tokens/config.json`.
  It is not repeated anywhere, and it must not be.
- Slightly more typing than an unprefixed variable, and the reason for the
  specific letters is not self-evident — which is why it is written down here.

## Alternatives considered

- **`@ingot/ui`** — shorter and a common convention. Rejected: describes a
  layer rather than an implementation, and forecloses other targets.
- **`@ingot/components`** — accurate but long, and equally silent about which
  framework it is for.
- **`--in-`** — the obvious abbreviation of "ingot". Rejected: `in` is a CSS
  length unit.
- **`--ingot-`** — unambiguous but verbose, and repeated on every line of every
  themed stylesheet a consumer writes.
- **No prefix** — rejected outright. Guarantees collisions in any application
  that consumes more than one design system, which is the normal case during a
  migration.

## Revisit when

Never, for the published names. Both are permanent from the first publish.

If a second implementation is added, it takes a new package name under the same
scope (`@ingot/vue`, `@ingot/web-components`) and shares the `--ig-` prefix.
That is the outcome this decision was designed to allow, not a reason to
reconsider it.

## Note for ADR-0003

The sample token currently in `packages/tokens/src/color.json` is
`color.blue.500` = `#2563eb`, which is Tailwind's default blue-500. It is
scaffolding used to prove the build pipeline runs, and a placeholder only. It
must not survive into the real palette by accident. See
`docs/learning-log.md`.
