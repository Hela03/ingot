# Contributing to Ingot

Thanks for considering it. This document assumes you can use a terminal but not
that you already know this project's tools.

## Setup

```bash
corepack enable          # lets Node fetch the exact pnpm version this repo pins
pnpm install
```

Node 22.14.0 or later. The pnpm version is pinned with a checksum in
`package.json`, so everyone — including CI — runs an identical one.

You will also need the GitHub CLI to open pull requests:

```bash
brew install gh          # or see https://github.com/cli/cli#installation
gh auth login
```

Pushing a change to `.github/workflows/` additionally requires the `workflow`
scope on your token — `gh auth refresh -h github.com -s workflow`. GitHub keeps
that separate from ordinary push access because a workflow file is code it will
execute automatically.

## The workflow

**Never commit to `main`.** It is protected, and direct pushes are rejected.

```bash
git switch -c short-descriptive-branch-name
# ...make your change...
pnpm lint && pnpm typecheck && pnpm test && pnpm format:check
git add -A
git commit -m "Describe the change"
git push -u origin short-descriptive-branch-name
gh pr create --fill
```

These are exactly what CI runs. Running them locally first saves a round trip —
CI is the backstop, not the first line of defence.

`pnpm lint` runs two tools: ESLint over JS/TS, and **stylelint** over CSS. Since
ADR-0006 puts every appearance value in CSS, stylelint is what enforces the
no-hardcoded-values rule. Run them individually as `pnpm lint:js` and
`pnpm lint:css` when you want to know which one is unhappy.

## Recording your change for release

If your change is one a user of the library would notice, record it:

```bash
pnpm changeset
```

It asks which packages changed, how significant the change is, and for a
one-line summary, then writes a small Markdown file into `.changeset/`. Commit
that file alongside your work.

No changeset is needed for changes nobody outside the repository can observe —
a test, a comment, a CI tweak, a docs typo.

Changelogs are assembled from these files at release time, so write the summary
for someone deciding whether to upgrade, not for someone reviewing the diff.

## Choosing patch, minor or major

Changesets cannot work this out for you. Nothing can — no tool can tell from a
diff whether a colour change is cosmetic or catastrophic.

The standard meanings:

- **patch** — a fix. Nothing added, nothing removed.
- **minor** — something added. Existing usage keeps working.
- **major** — something broke. Consumers must change their code.

### What counts as breaking in a design system

Wider than in a normal library, because our public surface is not only code.

**1. The code API.** Removing or renaming a component or prop. Making an
optional prop required. Narrowing the values a prop accepts. Raising the React
version we require.

**2. The token API.** Every shipped token name is public API. Someone will write
`background: var(--ig-color-bg-brand)` in their own stylesheet, and renaming or
removing that token breaks them as surely as deleting a function would. Nothing
in our test suite will notice.

**3. Visual output.** The one semver has no vocabulary for. Change a token's
_value_ and no code breaks — every import resolves, every type checks, CI is
green — but every consumer's product looks different.

Judge these by **perceptual impact, not code impact**:

- a barely visible contrast tweak — patch
- a palette change consumers would notice — minor at least, with a loud
  changelog entry
- a wholesale visual redesign — major, even though nobody's code needs editing

**4. DOM structure and class names.** Consumers write CSS overrides against our
markup — they do, whatever the docs say. Changing nesting or class names breaks
them with the public API untouched.

**5. Accessibility semantics.** Changing an ARIA role or how a label is wired can
break assistive technology and consumers' tests. Invisible to sighted users;
genuinely breaking for others.

**6. Default values.** Changing a prop's default changes appearance for every
consumer who did not set it explicitly — which is most of them.

**The one-sentence test:** would someone who upgrades without reading the
changelog be surprised? Surprised in code means major. Surprised visually means
it must be loud, even when the code is compatible.

## Tokens

Everything visual resolves back to a token. A hardcoded appearance value inside a
component is a defect, not a detail — it is a value a consumer cannot theme, and
consumer flexibility is exactly equal to token coverage. See
[ADR-0001](docs/decisions/0001-distribution-model.md) and
[ADR-0003](docs/decisions/0003-token-architecture.md).

`stylelint.config.js` enforces this, and the properties it covers are listed
there with the reasoning. A colour in functional notation — `rgb(37 99 235)` —
is exactly as hardcoded as a hex, and is caught too.

Tokens are authored in [W3C DTCG](https://tr.designtokens.org/) JSON under
`packages/tokens/src/` and compiled by Style Dictionary. Never edit anything in
`packages/tokens/dist/` — it is generated and will be overwritten.

## Storybook or docs?

- **Storybook** — component states, variants, accessibility, visual regression.
- **Docs site** — concepts, tokens, guidelines, ADRs, theming, getting started.

## Architectural decisions

Read [`docs/decisions/`](docs/decisions/) before making an architectural choice.
Those decisions are deliberate and their reasoning is recorded.

If you need to make a new one, copy `docs/decisions/0000-template.md`, take the
next free number, and open it as part of your pull request so the decision is
reviewed alongside the code. Do not reverse an existing ADR without writing one
that supersedes it.

## Enforceability

A general rule, not specific to any one tool:

> **A constraint is enforceable exactly when a legal path through it exists.**

A guard that blocks someone with no way to comply does not produce compliance.
It produces disabled guards — and then the rule is gone for everyone, including
the cases it was written for. Before adding a rule, check that someone hitting
it has something correct to do instead.

This is why `stylelint.config.js` lists the properties it does and not others.
A property is enforced when a token scale exists that could satisfy it. Where
the list has gaps, the token system has gaps.

**One deliberate exception.** A small number of properties are enforced _without_
a scale, where the set of sensible values is small and enumerable — border width
and z-index. There the violation is a useful prompt: the right response is to
create the scale, which is a decision worth forcing early rather than
discovering after the fifth modal. That is a considered trade, not an oversight,
and it is only safe because the answer is obvious. Do not generalise it to
open-ended properties like `width`.

## Error messages are tested for content

Any error message a person meets when they are **blocked** must be tested for
what it says, not merely that it throws.

The message someone reads at their most confused moment is part of the
interface. A test asserting only that an error occurred will happily pass while
the message says `Cannot read properties of undefined`.

Example: when the token manifest is missing, the lint rule must say so and name
the command that fixes it. A test asserts that string. If the message changes,
the test fails and someone decides whether the new wording is better — rather
than it degrading unnoticed.

## Things that look like friction and are not

Several constraints here are deliberate guards. If one is in your way, that is
usually it working. Read the linked reasoning before removing it.

- Strict TypeScript options beyond the `strict` default —
  [ADR-0004](docs/decisions/0004-typescript-version.md)
- The pinned TypeScript major version — same ADR
- pnpm refusing very recently published packages — wait rather than override,
  and never opt out wholesale
