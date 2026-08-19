# Changesets

This folder holds **changesets** — small Markdown files describing changes that
have been made but not yet released.

## Writing one

After making a change worth releasing, run:

```bash
pnpm changeset
```

It asks which packages changed, whether each change is a patch, minor or major,
and for a one-line summary. It then writes a file into this folder. Commit that
file with your work.

If a change affects nothing users can observe — a test, a comment, a CI tweak —
no changeset is needed.

## What happens to them

Changesets accumulate here as pull requests merge. When it is time to release,
`pnpm changeset version` consumes every file in this folder, works out the new
version number for each package, writes the entries into each `CHANGELOG.md`,
and deletes the changeset files. The changelog is therefore assembled from notes
written at the moment of the change, not reconstructed from memory afterwards.

See `CONTRIBUTING.md` for what counts as a breaking change in this project.
