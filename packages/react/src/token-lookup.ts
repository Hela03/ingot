// DELIBERATE ERROR — this file exists to prove CI blocks a broken merge.
// It must not be merged. See PR 2.
//
// The mistake is the realistic one this project is paranoid about: looking up a
// token by name and assuming it is there. A missing token does not throw, it
// resolves to nothing, and the result is a component that renders wrong rather
// than a component that fails.

const spacingScale: Record<string, string> = {
  'space.1': 'var(--ig-space-1)',
  'space.2': 'var(--ig-space-2)',
};

/** Resolve a spacing token name to the CSS custom property holding its value. */
export function resolveSpacing(name: string): string {
  return spacingScale[name].trim();
}
