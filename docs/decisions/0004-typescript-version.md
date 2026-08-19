# 0004. Pin TypeScript to 6.x, and keep three non-default strict options

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** Laura España

## Context

At the time of scaffolding, `typescript@latest` was **7.0.2** — the rewritten,
much faster compiler. The obvious move was to take the newest version.

Checking the ecosystem first showed that `typescript-eslint`, the package that
lets ESLint understand TypeScript, declares a peer range of
`typescript >=4.8.4 <6.1.0`. No published version supported TypeScript 7,
including canary builds.

Installing TypeScript 7 would therefore have meant either dropping
type-aware linting entirely, or running an unsupported combination whose
failure mode is silent.

Type-aware lint rules are not a nice-to-have here. They are rules that read the
actual types rather than just the syntax, which is how a forgotten `await` or a
value that might be `undefined` gets caught. For a repository maintained by a
product designer rather than a frontend engineer, the tooling catching these is
the point.

## Decision

**Pin TypeScript to 6.0.3.** This is deliberate, not neglect. The constraint is
`typescript-eslint` support, not any deficiency in TypeScript 7.

**Keep three strictness options that are not part of `"strict": true`:**

- **`noUncheckedIndexedAccess`** — indexing into an array or record yields a
  possibly-`undefined` value that must be handled. A design system is full of
  lookups of the form "give me the value for this token name". A missing token
  that silently returns `undefined` does not throw; it renders as a missing
  colour or a collapsed space. That is precisely the failure mode this project
  should be paranoid about, and it is the reason this option is on despite
  being stricter than most projects run.
- **`noUnusedLocals`** and **`noUnusedParameters`** — unused code is an error.
  Component libraries accumulate dead props and orphaned helpers through
  refactoring; this stops that quietly.

These three are recorded here specifically so a future session does not relax
them for being noisy. Friction from them is the intended behaviour.

## Consequences

- Type-aware linting works today, across the whole repository.
- We are one major version behind on the compiler, and forgo TypeScript 7's
  speed improvements. On a codebase this size that cost is currently invisible.
- `noUncheckedIndexedAccess` will occasionally require a check that a human can
  see is unnecessary. That is the accepted price.
- `CLAUDE.md` carries a matching rule: do not raise the TypeScript major
  version without checking `typescript-eslint` compatibility first.

## Alternatives considered

- **TypeScript 7 with type-aware linting disabled** — keeps ESLint for
  syntactic rules only. Rejected: it removes the class of check that motivated
  using TypeScript here in the first place.
- **TypeScript 7 with typescript-eslint installed anyway**, outside its
  supported range. Rejected: unsupported combinations fail unpredictably, and
  the failure would surface as lint rules quietly not running rather than as an
  error.
- **Turning off the three extra options** to reduce friction. Rejected for the
  reasons above.

## Revisit when

`typescript-eslint` publishes a version declaring support for TypeScript 7.

**The test for revisiting is not that the install succeeds.** It is that
type-aware lint rules still run. Verify by introducing a deliberate error that
only a type-aware rule can catch — an unhandled floating promise is the easiest
— and confirming `pnpm lint` fails. If it passes, the rules are not running and
the upgrade has silently removed the safety net.
