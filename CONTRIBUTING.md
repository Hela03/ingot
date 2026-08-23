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
there with the reasoning. A literal is caught wherever it sits in the value —
functional notation (`rgb(37 99 235)`), inside a legitimate function
(`light-dark(#fff, #000)`), and as a `var()` **fallback**
(`var(--ig-color-bg-brand, #2563eb)`), which is the one that most looks like
correct code.

**Do not assume the rule is complete.** Configuration can only pattern-match
strings, so a named colour used as a function argument —
`color-mix(in srgb, red, blue)` — is still invisible to it. Closing that needs
argument-level parsing, which is the custom rule in #4. If you are relying on
lint to catch a hardcoded value, check that the form you have in mind is
actually covered.

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

## Write guards against the well-formed violation

When you write a rule, ask: **what does the well-formed version of this
violation look like?**

That is the one that reaches production. An ugly violation — a raw `#2563eb`
dropped into a component — gets caught by anyone reading the diff, and often by
the author before they commit. The dangerous case is the one that reads as
someone doing the right thing: correct-looking, plausible, and wrong.

Three have turned up so far, and all three read as good practice:

- **A primitive reference.** `var(--ig-color-brand-9)` looks like proper token
  usage. It passes review, typechecks, and renders correctly — and is silently
  unthemeable, because a consumer's theme operates on the semantic layer.
- **A composed text style, set atomically.** Setting `font-size` from a token
  looks correct, but ADR-0003 makes typography composite: size, line-height,
  weight and tracking travel together, and setting one alone permits exactly the
  combinations the composite token exists to prevent.
- **A `var()` fallback.** `var(--ig-color-bg-brand, #2563eb)` looks defensive
  and careful. It is a hardcoded colour, and it is worse than a bare one — see
  below.

A rule that only catches the ugly form gives false confidence: it reports
success on the cases that were never going to ship, and stays quiet on the ones
that will.

### The `var()` fallback defeats two guards at once

Worth stating separately, because it is the sharpest example.

```css
color: var(--ig-color-bg-brand, #2563eb);
```

1. **It hides a literal**, which the no-hardcoded-values rule exists to catch.
2. **The fallback fires precisely when the token is missing** — which is the
   exact condition the token-existence check exists to detect. The fallback
   makes the page look fine, so the missing token produces no visual symptom and
   no error. The guard is not merely bypassed; it is actively masked.

A rule handling this incidentally is not enough. It has to be handled
deliberately, and tested for.

## Guards fail closed, never open

A rule that cannot establish ground truth **errors**. It never skips, never
warns-and-continues, never assumes the missing thing was probably fine.

The reason is not purity. A rule that disables itself still shows a green tick,
and **the tick is what gets trusted** — nobody reads the log of a passing build.
A guard that quietly stops guarding is worse than no guard, because it
manufactures confidence.

This project has met the same failure three times in different costumes:

- **The `.d.ts` that promised an export that did not exist.** TypeScript
  accepted the import and handed back `undefined` at runtime, which renders as a
  missing colour rather than an error.
- **The `var()` fallback that masks a missing token.**
  `var(--ig-color-bg-brand, #2563eb)` renders correctly precisely when the token
  is absent, so the failure the existence check exists to catch produces no
  symptom.
- **A token manifest that is missing, stale or malformed.** The rules that read
  it refuse to run rather than pass silently.

**The recurring enemy of this project is silence that reads as success.** When
you are unsure whether a guard should error or warn, that is the tiebreaker.

## Generated artifacts must be reproducible

Identical inputs must produce identical bytes. No timestamps, no run-specific
values, no unordered iteration written out in whatever order it came.

"Rebuild and compare" is one of the cheapest diagnostics available — it answers
"is this output actually derived from this input?" — and it only works if
regeneration is deterministic. A single timestamp in a generated file destroys
it, and also adds diff noise that carries no information.

## When a check can fail in two directions, ask which one is silent

A check that can be wrong in more than one way is rarely equally wrong in both,
and the visible direction will train you to distrust it while the dangerous one
runs unchecked.

The token manifest is the worked example. If it goes stale:

- A **renamed** token leaves the old name in the manifest, so a reference to a
  token that no longer exists **passes**. Silent, and it renders as nothing at
  runtime.
- A **newly added** token is absent from the manifest, so a valid reference
  **fails**. Visible, and merely annoying.

Only the second one ever gets noticed — and noticing only that one teaches you
the tool is flaky, while the direction that actually matters goes unobserved.
This is why manifest staleness is an error in its own right rather than
something the rules discover case by case.

Ask this of any new check: what does it look like when it is wrong in the
direction nobody complains about?

## Error legibility is a separate axis from failure detection

Whether a failure is **detected** and whether the resulting error **names the
right cause** are different questions. Do not merge them with the previous
heuristic — that one is about which failure direction is silent; this one
applies when nothing is silent at all.

The worked example is the empty token manifest. Both available options failed
loudly. The question was only what the person reads:

- **Treat empty as valid.** Every `var(--ig-*)` reference then reports as
  non-existent. One broken build is misdiagnosed as a thousand broken
  references, and the person goes looking at their CSS instead of their build.
- **Treat empty as an error.** Someone with genuinely no tokens reads a message
  saying their manifest has no tokens — which is true, and names where to look.

**The test: when this fires and the diagnosis is wrong, how long does the wrong
path cost?** Seconds of confusion beats an afternoon in the wrong file. Choose
the option whose failure mode is cheap to recover from, not the one that is
technically more permissive.

## Tooling gets the same standards it enforces

The lint rules, the token build and everything else under `tooling/` are held to
the standards they exist to impose. `tooling/tsconfig.json` typechecks them with
`checkJs`, even though they are plain JavaScript, and they are tested like
anything else.

This is not symmetry for its own sake. Within a minute of being switched on,
`checkJs` found three real gaps in the manifest loader — `@types/node` was never
installed, several functions were implicitly `any`, and `cause` in a `catch`
block is `unknown`, so `cause.message` would have printed `undefined` **into the
malformed-manifest error message**. A broken error message about a broken file.

That last one is worth dwelling on, because it is the one bug with nothing
underneath it. Everything else in this project degrades into an error message:
a bad token reference, a stale manifest, a failing test. **When the error
message itself degrades, there is no fallback layer** — the person is left with
`undefined` and no way to work out what happened. Diagnostics are load-bearing,
and they are the last thing standing.

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
