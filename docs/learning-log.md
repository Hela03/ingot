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

### Still open after this session

- **A lint rule for hardcoded values.** ADR-0001 turns "make it themeable" into
  a testable rule: consumer flexibility is exactly equal to token coverage, so a
  hardcoded colour, spacing or size inside a component is a defect, not a
  detail, and should be caught by lint rather than by review. No such rule
  exists yet — there are no components to police. It needs writing before the
  first component lands, otherwise the first violation sets the precedent.
- ADR-0003 (token architecture: primitive / semantic / component tiers) — not
  yet written. The sample token is deliberately a primitive only, so this
  decision is not made implicitly.
- Whether `@ingot/tokens` and `@ingot/react` version independently or together.
  Currently independent (the Changesets default). Affects whether a token-only
  change forces a React release.
- Whether Ingot goes to `1.0.0` early or stays on `0.x`. Below 1.0, semver
  signals "this may change under you", and Changesets treats major bumps
  differently. Worth deciding before the first publish, not at it.
