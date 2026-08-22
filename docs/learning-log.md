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

### Still open after the scaffolding session

Tracked as issues rather than here, so they have a done state:

- **#4 — lint rule: no literal appearance values, no primitive references in
  components.** Blocks the first component.
- **#5 — version the packages independently or together.** Currently
  independent, which is the Changesets default rather than a choice.
- **#6 — publish as `0.x` or go to `1.0.0`.**
- **#7 — use `@changesets/changelog-github`** for PR-linked changelogs.

Resolved since: ADR-0003 and ADR-0005 are written. The Tailwind placeholder
(`#2563eb`) is superseded in principle by ADR-0005 — primitives are generated
from a seed — but the sample token is still in the repository and still a
placeholder until the generator exists and a brand seed is chosen.

Not yet built at all: components, Storybook, the docs site, React as a
dependency, the palette generator, any release workflow.
