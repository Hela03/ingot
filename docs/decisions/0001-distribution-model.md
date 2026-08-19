# ADR-0001: Distribution model

Date: 2026-08-18
Status: Accepted

## Context

Ingot must work as a whitelabel foundation — third parties download it and
re-skin it for their own products — while supporting semantic versioning,
a release process, and external contributions.

Two dominant models exist in the ecosystem:

1. Versioned npm package (MUI, Mantine, Radix Themes). Consumers install a
   dependency and theme it through a public API.
2. Copy-in registry / CLI (shadcn/ui). A CLI copies source files into the
   consumer's repository. They own and edit the code directly.

## Decision

Ship Ingot as a versioned npm package. Theming happens through CSS custom
properties, not forking.

A copy-in channel may be added later as a secondary distribution, but the
package remains the source of truth.

## Alternatives considered

**Copy-in registry (shadcn model).** Rejected. It offers maximum consumer
flexibility, but it is deliberately incompatible with the requirements above:
once files are copied into a consumer's repository, upstream updates cannot
reach them, semantic versioning describes nothing meaningful, and there is no
coherent contribution model. shadcn works precisely because it refuses to be
a versioned dependency. That is the opposite of what Ingot is for.

**Both channels from the start.** Rejected as premature. Two distribution
paths must be kept in sync, and the second has no value until the first is
stable.

## Consequences

Positive:

- Semantic versioning, changelogs and upgrades reach consumers.
- A contribution model is possible: one canonical source, one review process.
- Breaking changes are visible and deliberate rather than silently absorbed.

Negative:

- Consumers cannot edit component internals. Their only escape hatch is the
  theming API, so that API must be genuinely complete.
- Component props are a public contract. Renaming one is a breaking change.
- Any hardcoded value inside a component is a value a consumer cannot theme,
  and is therefore a defect, not a detail.

## Notes

The last consequence is the operative one. Consumer flexibility is exactly
equal to token coverage. This turns an aspiration ("make it themeable") into
a testable rule: a hardcoded colour, spacing or size in a component is a bug,
and should be caught by lint rather than review.

This is the reason ADR-0003 (token architecture) is the highest-stakes
decision in the project.

## Revisit when

A concrete consumer need appears that the theming API demonstrably cannot
serve — i.e. someone must fork to achieve something reasonable.

The test: identify the specific override that is impossible through CSS
custom properties. If it is possible but awkward, that is a token coverage
gap, not a distribution problem, and the fix belongs in the token layer.
