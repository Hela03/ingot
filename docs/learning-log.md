# Learning log

A running narrative of what we did, what broke, and what we learned. Newest
entries at the bottom. This is deliberately informal — it records the reasoning
and the dead ends that ADRs are too formal to hold.

---

## 2026-08-19 — Session 1: scaffolding

Goal: build the safety net before the thing it catches. No UI components this
session, by design.

### What we built

A pnpm workspace monorepo with four packages — `@ingot/tokens`,
`@ingot/react`, and two private apps for Storybook and docs. TypeScript in
strict mode, ESLint, Prettier, Vitest, Changesets.

### Things that broke, and why that was useful

**The token pipeline generated a lie.** The first Style Dictionary config
paired the `javascript/esm` output format with `typescript/es6-declarations`.
The `.js` file exported a default object containing the whole token tree; the
`.d.ts` file alongside it declared a named export `IgColorBlue500` of type
`string`. The type declaration described an export that did not exist.

This matters more than it looks. TypeScript would have accepted
`import { IgColorBlue500 } from '@ingot/tokens'` and handed back `undefined` at
runtime — which renders as a missing colour, not an error. A designer would see
"the blue looks wrong" and go hunting in the component. Fixed by switching to
`javascript/es6`, which emits flat named constants that match the declarations.

Lesson: generated output needs looking at, not just a green tick from the build.

**TypeScript 7 was unusable.** `typescript@latest` was 7.0.2, but
`typescript-eslint` capped at `<6.1.0` with no version — not even canary —
supporting 7. Taking the newest version would have silently cost us type-aware
linting. Pinned 6.0.3 deliberately; see ADR-0004, which also records the test
for when to revisit (type-aware rules must still _run_, not merely install).

**`changeset init` hung.** It is interactive and there was no keyboard attached
to the shell, so it stalled on its first question and exited with code 13. Wrote
`.changeset/config.json` and `.changeset/README.md` by hand instead. Worth
remembering for CI: any tool that asks questions needs a non-interactive path.

**`changeset status` failed, correctly.** It could not find where `HEAD`
diverged from `main`, because `main` had no commits yet. Not a bug — a tool
honestly reporting that it has nothing to compare against. Resolves after the
first commit.

**pnpm rewrote `pnpm-workspace.yaml` without being asked.** Installing Vitest
and Changesets added `minimumReleaseAgeExclude` entries. This is a supply-chain
defence: pnpm refuses versions published very recently, on the reasoning that a
compromised release is usually caught and pulled within hours. Those two were
newer than the threshold, so pnpm recorded version-specific approvals.

Agreed policy, now in `CLAUDE.md`: if an install is refused for being too
recent, **wait**. Do not override. Version-specific exclusions only, never a
blanket opt-out. Same reasoning as the strict TypeScript options — a deliberate
guard, not friction to be tidied away.

**GitHub refused the first push, because of the CI workflow file.** The `gh`
token had scopes `gist`, `read:org` and `repo` — but not `workflow`. GitHub
separates "can push code" from "can push files that GitHub will execute
automatically", so the other 33 files were acceptable and `.github/workflows/ci.yml`
was not.

The reasoning is sound: a workflow file is code that runs on GitHub's machines
with access to repository secrets. If any token that could push code could also
add a workflow, a leaked token could exfiltrate secrets on the next commit.

This belongs in the same category as branch protection: **a boundary that
constrains the agent, not the maintainer.** The maintainer can grant the scope
in a browser in about fifteen seconds. The agent cannot grant it to itself, and
cannot proceed without asking. That asymmetry is the point — the rules that
matter are the ones an agent is unable to route around, rather than the ones it
has merely been told to respect.

Policy, now in `CLAUDE.md`: the token carries the minimum scopes needed. A task
that needs a new one asks the maintainer, and explains what the scope permits.

**The agent's environment and the maintainer's shell were not the same
environment.** `gh` is installed at `~/.local/bin/gh` — not in either Homebrew
location, and Homebrew is not installed on this machine at all. The agent's
shell had `~/.local/bin` on its `PATH`; the maintainer's Terminal runs bash and
did not, because the `PATH` line lived in `.zshrc`.

So "it works fine for the agent" and "it does not exist for me" were both true
at the same time, about the same binary, on the same machine. Fixed by adding
the path to `.bash_profile`.

Worth generalising: when an agent reports a command working, that is evidence
about the agent's environment only. Diagnose from the maintainer's shell before
concluding anything about the machine.

A related consequence: setup instructions in `CONTRIBUTING.md` must describe how
a **new contributor** installs a tool (`brew install gh`), never the path it
happens to occupy on the maintainer's machine.

**A stale keychain credential is the next thing to suspect if a push fails.**
This did not happen here — the push succeeded as soon as the `workflow` scope
was granted — but the trap is real and worth writing down. macOS git is
configured with `credential.helper = osxkeychain`, so `git push` can keep using
an older credential from the keychain even after `gh` has been given a fresh
token. The symptom is a push failing with the identical error after a scope
refresh that visibly worked. The fix is `gh auth setup-git`, which points git at
gh's token.

**We predicted a CI failure before causing it, then scored the prediction.**
This was the most useful exercise of the session and is worth repeating.

A branch was pushed containing a deliberate error of the kind this project is
most exposed to — a token lookup that assumes the token is there:

```ts
const spacingScale: Record<string, string> = {/* ... */};
export function resolveSpacing(name: string): string {
  return spacingScale[name].trim(); // spacingScale[name] may be undefined
}
```

The prediction, written before pushing: lint passes, typecheck fails, Test and
Check formatting never run, the required check fails, the merge is blocked.

The result matched on every count:

```
success   Lint
failure   Typecheck      error TS2532: Object is possibly 'undefined.'
skipped   Test
skipped   Check formatting
```

**Two things the exercise taught that a clean demonstration would not have.**

_The error code was hedged, not predicted._ The call was split 60/40 between
`TS2532` and `TS18048` rather than committed to. The hedge landed on the right
side, which is not the same as being right. The underlying rule, now known:
TypeScript picks the message by **expression shape**. Assign the lookup to a
named variable and the error is `TS18048`, naming that variable. Call a method
directly on the index expression and there is no name to report, so the message
is the anonymous `TS2532` — "Object is possibly undefined". Same rule, different
message depending on whether the value has a name.

_The exit code was 2, not 1, and that was not predicted at all._ `tsc` uses exit
status 2 for compilation errors. It changes nothing — CI treats any non-zero as
failure — but the assumption "failure means exit 1" was wrong and would have
been stated confidently if asked. Worth holding loosely: **CI does not care
which non-zero number it gets, and neither should we.**

**Skipped steps hide later failures.** Because CI steps run in sequence and a
failure aborts the job, Test and Check formatting never ran on the broken push.
They were only shown to be fine after the fix. Practical consequence: a red run
tells you about the _first_ problem, not all of them, and fixes can arrive in
waves.

**Two further details from the same demonstration.** GitHub reported the PR as
`mergeable: MERGEABLE` and `merge state: BLOCKED` at the same time. These answer
different questions: `MERGEABLE` is git's — are there conflicts? — and `BLOCKED`
is policy's — are you permitted? The code would have merged cleanly. The rules
did not allow it. And because `enforce_admins` is enabled, no admin override
link appeared, which otherwise would have.

### Decisions worth remembering

**Git identity was set locally, not globally.** Display name plus GitHub's
noreply address, via `git config --local`. The reasoning: git history is
append-only, so the email on commit one is permanent and publicly scrapeable
once the repo is public. Local rather than global means future projects require
a deliberate identity choice rather than inheriting this one. GitHub's "keep my
email private" setting is enabled as a backstop — it rejects any push
containing the real address.

**`.gitignore` was written before the first commit, not after.** Specifically so
`.env` and local secrets could never be committed even once. A secret committed
and then deleted is still in the history; the remedy is rewriting history and
rotating the key.

**Saw red before trusting green.** Wrote one trivial Vitest test, watched it
pass, then deliberately broke it to see the failure output and confirm exit code
1 — the number CI actually reads. A test that has never been seen to fail is not
proven to be watching anything.

### Open flag

The sample token `color.blue.500` = `#2563eb` is **Tailwind's default
blue-500**. It exists only to prove the build pipeline runs end to end. It is a
placeholder and must not survive into the real palette by accident. Flagged in
ADR-0002 and to be resolved in ADR-0003 (token architecture).

---

## 2026-08-22 — ADR-0003 and ADR-0005 written

The two token decisions that scaffolding deliberately refused to make are now
recorded: [ADR-0003](decisions/0003-token-architecture.md) (three tiers,
property-first semantic naming, no appearance words, composite typography,
component tier defined but empty) and
[ADR-0005](decisions/0005-palette-generation-and-accessibility.md) (primitives
generated from seeds in OKLCH, accessibility as the default state with explicit
recorded overrides rather than a global switch).

Both were transcription rather than design — the decisions were made away from
the keyboard and written up afterwards. That is worth noting as a pattern: the
scaffolding session's job was to make the absence of these decisions **visible
and enforced** (the "Stop — ADR-0003 is not written" block in `CLAUDE.md`, the
warning in the ADR index, a sample token that was deliberately a primitive only)
so they could be made deliberately later instead of accumulating by accident.
Those warnings have now been removed, because their job is done.

Two numbers are still unset and are flagged at the bottom of each ADR: the
x-height ratio the line-heights are tuned to, and the minimum hue separation
used both as the collision threshold and as the harmonisation clamp. Ingot's own
brand seed is also still to be chosen.

The remaining open items moved from this log to GitHub issues (#4–#7), on the
reasoning that a document has no done state and an issue closes. #4 — the lint
rule forbidding literal appearance values and direct primitive references —
must land before the first component.

---

## 2026-08-23 — Prose in token metadata is parsed as data

Adding the first semantic token, the build failed with:

```
{color.bg.brand} tries to reference Brand background. Property-first naming per
ADR-0003: color.{property}.{role}. …, which is not defined.
```

The `$description` explained the naming grammar and contained the literal text
`color.{property}.{role}`. **Style Dictionary parses `{...}` as a token
reference in any string field, including descriptions.** The documentation was
being read as data.

Small, quickly fixed, and worth recording because the failure mode is not
obvious: a comment cannot mention the syntax of the thing it is commenting on.
The token now says "property, then role" in prose, with a note explaining why it
cannot say it literally.

Generalises a little: in any format where a value can be a reference, the
escaping rules apply to every string, not only the ones you think of as values.

---

## 2026-08-23 — A heuristic paid out, and prose turned into data

### The no-legal-path rule caught a real sequencing error

`CONTRIBUTING.md` says a constraint is enforceable exactly when a legal path
through it exists, because a guard with no legal path produces disabled guards
rather than compliance.

Planning the tier rule — components reference semantic tokens, never primitives
— surfaced that **there was no semantic token in the repository**. Shipping the
rule first would have left the first component author with nothing legal to
reference, and the rule would have been switched off by the first person who hit
it, permanently, for everyone.

So the tokens conformed first (#14, ADR-0003) and the rule follows.

Worth recording plainly: **this is the first time one of these heuristics has
actually fired.** A heuristic that never changes a decision is decoration, and
the honest test of the set is how often one of them stops something. This one
stopped a sequencing error before it cost anything.

### Prose in a data file is still in the data file

Adding that first semantic token, the build failed with a reference error that
pointed at a sentence of English:

```
{color.bg.brand} tries to reference Brand background. Property-first naming per
ADR-0003: color.{property}.{role}. …, which is not defined.
```

The `$description` explained the naming grammar and contained the literal text
`color.{property}.{role}`. **Style Dictionary parses `{...}` as a token
reference in any string field — including `$description`.** The documentation was
read as data.

**This is a new class of failure for this project.** Every previous one was in
code or in config: a wrongly paired format, an inherited third-party default, a
missing scope. This one was in the field explicitly meant to be inert — the
comment, the part that exists to be read by humans and ignored by machines.

> **In a file a tool parses, no field is guaranteed inert. Prose in a data file
> is still in the data file.**

That generalises well beyond tokens, and this architecture is unusually exposed
to it: documentation sits next to machine-read structure in several places — DTCG
token descriptions, ADR front matter, the manifest, changeset files. The rule of
thumb is that a comment cannot safely mention the syntax of the thing it is
commenting on, unless you have checked that the field is genuinely inert.

The token now says "property, then role" in words, with a note recording why it
cannot say it literally.

---

## 2026-08-23 — A heuristic confirmed, and a refinement to how we predict

### "Prose in a data file is still in the data file" is now confirmed, not anecdotal

Recorded earlier the same day from Style Dictionary: a `$description` explaining
the naming grammar contained `color.{property}.{role}`, and the braces were
parsed as a token reference.

Hours later, in a different tool, the same failure. The ESLint rule's own error
message contained the example `style={{ "--ig-x": value }}`. **ESLint parses
`{{ … }}` as a message placeholder**, so it read `"--ig-x": value` as a variable
name to substitute — and the rule's test failed on its own error text.

Two independent tools, hours apart, same failure. That upgrades it from an
anecdote to a working rule:

> **In a file a tool parses, no field is guaranteed inert.** A comment cannot
> safely mention the syntax of the thing it is commenting on.

Worth noting _why_ the second instance counts for more. **A generalisation
confirmed on a case that did not produce it is worth more than one confirmed on
the case that did.** The Style Dictionary instance suggested the rule; the ESLint
instance tested it, in a tool with a different syntax, a different parser and a
different purpose. It held.

### Where this will bite next

This architecture is unusually exposed, because it deliberately keeps
documentation next to machine-read structure. Named in advance so the next
instance is recognised rather than rediscovered:

- **ADRs read as ground truth.** ADR prose is currently for humans. The moment
  anything parses it — a docs generator, an index, an agent instructed to treat
  decisions as authoritative — its examples become data. ADR-0003 contains
  `color.{property}.{role}` in exactly the form that already broke once.
- **`llms.txt`.** The docs site is planned to emit one for agents. That is
  documentation converted into something a machine reads as instruction, which
  is this failure mode by construction.
- **The eventual component manifest.** If components get a manifest like the
  token one, prop descriptions will sit beside machine-read structure.
- **Changeset files.** Markdown prose with a parsed YAML-ish header.

### Refining the prediction discipline: trace the blast radius

The previous entry concluded that risk concentrates in _unexamined mechanisms_,
because they generate no uncertainty to report. The demonstration of the lint
rules refines that, because the one miss was not an unexamined mechanism.

Prediction: `pnpm lint:js` would report 2 errors. It reported 3. The third was
`@typescript-eslint/no-unsafe-return`, because React is not installed so JSX has
no types.

**That limitation was known and had already been predicted — for a different
command.** The prediction said typecheck would fail for exactly this reason. What
was never asked is what _else_ React's absence touches.

> **Knowing something is broken is not the same as knowing where it surfaces.**
> A known limitation still needs its blast radius traced: which commands, which
> tools, which files does it reach?

So the prediction checklist now has three questions, not two:

1. What am I unsure about?
2. What have I not examined at all? (No uncertainty is reported for these,
   which is exactly why they are dangerous.)
3. **What do I already know is broken, and everywhere it might surface?**

The third is the cheapest of the three, and it was the one skipped.

---

## 2026-08-27 — The supersede convention gets used for the first time

`docs/decisions/README.md` has said since the first week that an ADR is never
deleted — a decision that no longer holds is marked `Superseded by ADR-NNNN`,
because the fact that it was once decided is part of the record.

Today it was used. [ADR-0005](decisions/0005-palette-generation-and-accessibility.md)
(palette generation) is superseded by
[ADR-0007](decisions/0007-palette-generation-and-accessibility.md).

### What broke, and what did not

ADR-0005 assumed the brand seed becomes **step 9** of the generated scale.
Applied to real brands, that fails in both directions: a dark brand forced to
step 9 is lightened away from the hex the consumer supplied, and a pale brand at
step 9 cannot carry the text it is supposed to carry. Brands arrive with an exact
colour and expect it on the button.

Almost everything else in 0005 held — OKLCH, chroma damping, snap-to-seed,
computed text-on-solid, collision detection, the accessibility policy. **One
assumption failed, and it was load-bearing**: fixing it makes the semantic layer
generated output rather than an authored file, and demotes the step-to-role table
from a guarantee to a heuristic.

### Amend or supersede?

The rule that emerged, worth reusing:

> **Supersede when the delta would be harder to read than the whole.**

An amendment describing "step 9 is now derived, and consequently the semantic
layer is generated, and consequently the band model is only a heuristic" leaves a
reader assembling the current policy from an original plus corrections. Nobody
does that accurately. ADR-0007 therefore restates the entire policy and is
explicitly **not** written as a delta; 0005 carries a header saying what changed
and what survived, so the history is legible without being load-bearing.

### The uncomfortable observation

This project's central bet is building the safety net before the thing it
catches. The enforcement layer went in well ahead of any component, deliberately.

**The first decision to break is one that was made in the abstract.** ADR-0005
was written without a single real brand colour having been run through anything.
The guards — lint rules, manifest loader, contrast policy — have not needed
replacing; the _design_ decision made furthest from contact with reality did.

That is not an argument against deciding early. ADR-0005 was correct to exist,
and writing it is what made the flaw findable. But it does sharpen where to
expect the next one: **not in the tooling, which meets reality on every run, but
in the decisions that have not yet met anything.** ADR-0003's scales and
ADR-0007's own generation model are both still in that category.

---

## 2026-08-27 — Measuring the wrong quantity, and a decision that dissolved

Proposed a minimum hue separation for collision detection (#11), calibrated by
computing hue angles for six candidate brand seeds against four status hues, and
tabulating which pairs would warn at thresholds from 20° to 40°.

The analysis was careful, produced a clean table, and **measured the wrong
quantity**.

### Two independent ways seed hue is the wrong variable

- **Hue is meaningless at low chroma.** One candidate brand, "coal", is
  achromatic. Its hue angle is numerical noise, and it computed as 6° from the
  warning hue — a confident warning about a collision that cannot exist. **No hue
  proximity makes grey look amber.**
- **Seed chroma does not survive into the fill.** "Matcha" sat 1° from the success
  hue and warned; "neo lime" sat 28° away. But a pale green seed generates a scale
  whose _solid fill_ is saturated green, so the distance between what actually
  renders is not the distance between the seeds. The seeds' own chroma is
  irrelevant to the output.

### The tell was there and was misread

The coal case was noticed — and answered with a **chroma floor**: skip the check
below some chroma, because hue is noise down there. That is a patch on a broken
measurement, presented as a companion decision, complete with a suggested value
and a note that it deserved its own empirical treatment.

**A second threshold introduced to compensate for the first one measuring the
wrong thing is a signal, not a subtask.** The correct response was to notice that
the metric was wrong, not to fence off the region where its wrongness was
visible.

### The fix, and what it dissolved

Compare the **resolved solid fills** — the actual step the derivation assigns to
`color.bg.{role}` — using perceptual distance in OKLab. What renders is what can
collide.

Coal then falls out on its own: a grey fill sits far from any saturated status
fill in the a/b plane, no special case required. Pale and dark seeds are handled
because the derivation has already placed them.

**The chroma floor stopped being a decision. It became a question that no longer
exists.**

> **A proposed threshold that exists to hide the failure of another measurement
> is evidence the measurement is wrong.**

Worth adding to the set: this is the second time a _proposal_ was the symptom
rather than the fix. The first was patching one colour-notation function instead
of the class of literal-inside-a-function.

### And the units changed underneath

The provisional number from the seed analysis was an **angle**. The threshold is
now a **distance**. Nothing carries over — not the value, not its calibration.
Recorded in ADR-0007 explicitly, because "30" would otherwise look like a
starting point when it is a number from a different measurement entirely.

### Still open after the scaffolding session

---

## 2026-08-22 — ADR-0006, found by planning something else

The styling mechanism was undecided, and nobody noticed until the lint rule in
#4 was planned in detail. The rule cannot be designed without knowing where
appearance values live: CSS files are stylelint's territory, TypeScript is
ESLint's, Tailwind class strings are neither's. Issue #4 had been written as
"an ESLint rule", which quietly presumed an answer that had never been given.

Decided as [ADR-0006](decisions/0006-styling-mechanism.md): CSS Modules with all
appearance values as CSS custom properties. The deciding argument is ADR-0001's
— the theming API is the consumer's only escape hatch, so it cannot depend on
our build. Overriding a custom property works in the browser, with no toolchain
of ours in the consumer's pipeline.

Worth generalising: **planning an implementation in detail is a good way to find
a missing decision.** The gap did not show up while writing ADR-0003 or ADR-0005,
which are both about tokens, because tokens are upstream of styling and nothing
forced the question. It showed up the moment something had to enforce a rule
against real files.

---

## 2026-08-23 — A different class of failure

**This is the most important entry in this log so far, and it is a different kind
of break from everything above it.**

Every previous failure was in code written in front of us: a Style Dictionary
config paired wrongly, a TypeScript version chosen badly, a test deliberately
broken. Someone typed the mistake and someone could see it.

This one was **an inherited default in a third-party tool** — sensible for the
general case, a hole in ours, and invisible unless specifically tested for.

### What happened

`stylelint-declaration-strict-value` enforces "use a variable, not a literal". It
was configured, demonstrated catching a hex, and looked finished.

It does not catch `rgb(37 99 235)`.

Its `ignoreFunctions` option defaults to `true`, so **any function counts as an
acceptable value, without its arguments being inspected**. That default is
correct in general — `calc()`, `clamp()` and `color-mix()` are all legitimate
ways to use tokens. But a hardcoded colour in functional notation is exactly as
unthemeable as a hex, and the guard just built to prevent hardcoded colours did
not see it.

### The rule worth remembering

> **A guard built on a third-party tool inherits that tool's defaults, and those
> defaults were chosen for someone else's problem.**
>
> Test the guard against the thing you actually fear, in every form it can take —
> not against one canonical example of it.

Catching one hex proved the tool was wired up. It proved nothing about coverage.

### Fixing one instance is not fixing the class

The first patch banned colour-notation functions by name — a fix for the instance
in front of us. A deliberate probe of every value form that can reach an enforced
property found **seven holes, of which that patch closed one**:

| Form                                                       | Before      | After           |
| ---------------------------------------------------------- | ----------- | --------------- |
| `#fff`, `#2563ebcc`                                        | caught      | caught          |
| `rgb() rgba() hsl() hwb() lab() lch() oklab() oklch()`     | caught      | caught          |
| `color(display-p3 …)`                                      | **slipped** | caught          |
| `light-dark(#fff, #000)`                                   | **slipped** | caught          |
| `var(--ig-x, #2563eb)` — literal as **fallback**           | **slipped** | caught          |
| `var(--ig-space-4, 16px)`                                  | **slipped** | caught          |
| `calc(16px * 2)`, `clamp()`, `min()`, `max()`              | **slipped** | caught          |
| `z-index: calc(100 + 1)`                                   | **slipped** | caught          |
| `color-mix(in srgb, red, blue)` — named colour as argument | **slipped** | **still slips** |
| `canvastext`, `red` — system and named colours             | caught      | caught          |

Controls that must keep working — `var(--ig-x)`, `calc(var(--ig-space-4) * 2)`,
`color-mix(in oklch, var(--ig-x), transparent)` — all still pass. 21 of 22
violations caught, no false positives.

The var() **fallback** case should worry us most.
`var(--ig-color-bg-brand, #2563eb)` looks like model behaviour: a hardcoded
colour hiding behind a correct token reference. It is the same shape as the
primitive-reference problem, where the wrong thing looks like the right thing.

### The remaining hole is structural, not an oversight

`color-mix(in srgb, red, blue)` cannot be caught by configuration, because
configuration can only pattern-match strings. Catching a named colour used as a
function argument requires parsing the value and inspecting its arguments — the
custom rule in PR 3 of #4.

`stylelint.config.js` says so in those terms: **this is a patch, not a fix.**
Anyone reading it should know the class is not closed. The probe's cases should
become the test corpus for that rule rather than being rewritten from memory.

### On predictions: confidence marks unexamined ground

A prediction was written before running the rule, and it missed twice.

- The case flagged in advance at **50/50** — `margin: 0 auto` possibly failing on
  whole-value matching — was **fine**.
- Both actual misses — functions accepted wholesale, and case-sensitive keyword
  matching — were in mechanisms that generated **no uncertainty at all**, because
  they were never examined.

> **Stated uncertainty marks where attention has already gone. Risk concentrates
> in whatever produced no uncertainty. High confidence often means unexamined
> rather than safe.**

The useful question for a future prediction is not "what am I unsure about?" but
"what did I not think about hard enough to be unsure about?"

### Still open

Tracked as issues rather than here, so they have a done state:

- **#4 — lint rule: no literal appearance values, no primitive references in
  components.** Blocks the first component. PR 1 of 3 has landed: stylelint
  enforces the literals rule. PRs 2 and 3 remain.
- **#5 — version the packages independently or together.** Currently
  independent, which is the Changesets default rather than a choice.
- **#6 — publish as `0.x` or go to `1.0.0`.**
- **#7 — use `@changesets/changelog-github`** for PR-linked changelogs.
- **#9 — the x-height ratio** the type scale's line-heights are tuned to.
- **#10 — how many heading steps** the type scale runs to.
- **#11 — the minimum hue separation**, which the collision warning and the
  harmonisation clamp are both defined in terms of. Blocks the generator.
- **#13 — emit a token tier manifest from the token build.** Blocks PR 2 of #4,
  and is where lint starts depending on the token build.
- **#14 — the sample token does not conform to ADR-0003.** Blocks the
  end-to-end demonstration of the tier rules, not their implementation.
- **#15 — ADR-0003 addendum: define the six missing token scales.** Border
  width, layer order, opacity/state, motion, shadow/elevation, control size.
  Surfaced by writing the stylelint property list: `CLAUDE.md` names ten
  categories of theming surface and ADR-0003 defines four scales.

Resolved since: ADR-0003, ADR-0005 and ADR-0006 are written. The Tailwind
placeholder (`#2563eb`) is superseded in principle by ADR-0005 — primitives are
generated from a seed — but the sample token is still in the repository and
still a placeholder until the generator exists and a brand seed is chosen, and
it is now tracked as #14.

Not yet built at all: components, Storybook, the docs site, React as a
dependency, the palette generator, any release workflow.
