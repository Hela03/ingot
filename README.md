# Ingot

An open-source, whitelabel design system. Built in the open by a product
designer, with the tooling and decisions documented as they are made.

> **Status: scaffolding.** There are no components yet — deliberately. The
> safety net is being built before the thing it catches. See
> [`docs/learning-log.md`](docs/learning-log.md) for the running narrative.

## Packages

| Package                            | What it is                                                  |
| ---------------------------------- | ----------------------------------------------------------- |
| [`@ingot/tokens`](packages/tokens) | Design tokens in W3C DTCG format, built by Style Dictionary |
| [`@ingot/react`](packages/react)   | React implementation of the system                          |
| [`apps/storybook`](apps/storybook) | Component workshop — states, variants, a11y                 |
| [`apps/docs`](apps/docs)           | Documentation site — concepts, guidelines, ADRs             |

Tokens are the source of truth. Everything visual resolves back to them: a
hardcoded colour, spacing or size inside a component is a defect, because it is
a value a consumer cannot theme. See
[ADR-0001](docs/decisions/0001-distribution-model.md).

## Requirements

- Node 22.14.0 or later
- pnpm — no separate install needed, run `corepack enable` and the pinned
  version is fetched automatically

## Getting started

```bash
pnpm install
pnpm --filter @ingot/tokens build   # generate CSS variables and TS constants
```

## Commands

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `pnpm lint`         | ESLint — correctness                         |
| `pnpm typecheck`    | TypeScript, strict                           |
| `pnpm test`         | Vitest, once                                 |
| `pnpm test:watch`   | Vitest, re-running as you edit               |
| `pnpm format`       | Prettier — rewrite files to the agreed style |
| `pnpm format:check` | Prettier — report without changing anything  |
| `pnpm changeset`    | Record a change for the next release         |

The first four are exactly what CI runs on every pull request.

## Theming

Tokens compile to CSS custom properties prefixed `--ig-`, for example
`--ig-color-bg-brand`. Consumers retheme Ingot by overriding those properties,
not by forking the components.

The prefix is `--ig-` rather than `--in-` because `in` is a CSS length unit.
See [ADR-0002](docs/decisions/0002-naming-and-prefix.md).

## Documentation

- [Architecture decision records](docs/decisions/) — what was decided and why
- [Learning log](docs/learning-log.md) — what was built, what broke
- [Contributing](CONTRIBUTING.md)

## Licence

[MIT](LICENSE) © Laura España
