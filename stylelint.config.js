// stylelint checks CSS. ESLint cannot read CSS, and under ADR-0006 all
// appearance values live in CSS custom properties — so this file, not
// eslint.config.js, carries the rule from ADR-0001: no hardcoded values in
// components.
//
// THE ORGANISING PRINCIPLE
//
// A property is listed here when a token scale exists that could satisfy it.
// A rule demanding a token where no token could go is not strictness, it is a
// trap: the first person to hit it disables the rule rather than fixing the
// code. See CONTRIBUTING.md, "Enforceability".
//
// This list is therefore a mirror of the token system. Where it has gaps, the
// token system has gaps — tracked as an ADR-0003 addendum, not as six
// unrelated tickets.

/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],

  rules: {
    'scale-unlimited/declaration-strict-value': [
      [
        // --- Colour. 12-step scale, ADR-0003. -----------------------------
        // Matches color, background-color, border-*-color, outline-color,
        // text-decoration-color, caret-color, accent-color.
        '/color$/',
        'background',
        'fill',
        'stroke',

        // --- Space. 8-step scale, ADR-0003. -------------------------------
        '/^padding/',
        '/^margin/',
        '/gap$/',

        // --- Radius. 5-step scale, ADR-0003. ------------------------------
        '/radius$/',

        // --- Typeface. Swappable per ADR-0003. ----------------------------
        // Only the family. font-size, line-height, font-weight and
        // letter-spacing are deliberately absent: ADR-0003 makes typography
        // composite, and how a composite token is consumed in CSS is not yet
        // settled. See the `composes` proposal on issue #4.
        'font-family',

        // --- Border width. No scale yet. ----------------------------------
        // Listed deliberately without a scale to satisfy it. The set of
        // sensible border widths is small and enumerable, so the second one
        // needed (a 2px focus ring, most likely) becomes a prompt to create
        // the scale rather than a dead end. `1px` is allowed below, with an
        // expiry.
        '/border(-(top|right|bottom|left))?-width$/',

        // --- Layer order. Here for a DIFFERENT REASON than everything else.
        //
        // z-index is NOT theming surface. Nobody rethemes layer order. It is
        // here for internal consistency: unmanaged z-index is a classic
        // design-system failure, and forcing named layers before the first
        // modal is far cheaper than untangling them after the fifth.
        //
        // Do not remove this on the grounds that it is not theming surface.
        // That is correct, and it is not why it is here.
        //
        // The tokens are named layers, not a numeric scale: layer.base,
        // layer.dropdown, layer.sticky, layer.overlay, layer.modal,
        // layer.popover, layer.toast, layer.tooltip — ordinal values with
        // gaps, so consumers can slot their own layers between ours.
        'z-index',

        // --- Shorthands ---------------------------------------------------
        // Caught so a literal cannot hide inside `border: 1px solid #ccc`.
        // Known gap: a shorthand containing at least one var() may mask a
        // literal in another position. Documented in CONTRIBUTING.md.
        '/^border(-(top|right|bottom|left))?$/',
      ],

      {
        ignoreValues: {
          // Default for every property above. Values with no design intent —
          // structural CSS that would be meaningless to theme.
          '': ['0', 'auto', 'none', 'inherit', 'initial', 'unset', 'revert'],

          // Colour keywords. `currentcolor` is actively good practice: it
          // inherits the themed colour rather than fixing one.
          //
          // Matching here is CASE-SENSITIVE. stylelint-config-standard
          // normalises keywords to lowercase, so the lowercase spelling is the
          // one that matters; both are listed because `currentColor` is what
          // most people type.
          '/color$/': [
            'currentcolor',
            'currentColor',
            'transparent',
            'inherit',
            'initial',
            'unset',
            'revert',
          ],
          fill: ['currentcolor', 'currentColor', 'none', 'inherit'],
          stroke: ['currentcolor', 'currentColor', 'none', 'inherit'],

          // TEMPORARY — REMOVE WHEN A BORDER-WIDTH SCALE EXISTS.
          //
          // `1px` is permitted only because no border-width scale exists yet.
          // ADR-0003 lists border width as theming surface, so this is an
          // exception to a decided rule, not an exemption from it.
          //
          // This is not a dated expiry, it is a triggered one: removing it is
          // a checklist item on the issue that creates the scale.
          '/border(-(top|right|bottom|left))?-width$/': ['0', '1px'],

          // No literal layer values. Every z-index must name a layer token.
          'z-index': [],
        },

        // Report only. There is no safe automatic fix: choosing the right
        // token is a design decision, and a tool guessing it would produce
        // confident, wrong, invisible changes.
        disableFix: true,
      },
    ],

    // COMPANION RULE — closes a hole in the one above.
    //
    // declaration-strict-value accepts any *function* as a valid value, by
    // design: calc(), clamp(), min(), max() and color-mix() are all legitimate
    // ways to use tokens. But that also lets a hardcoded colour through in
    // functional notation — `rgb(37 99 235)` is every bit as unthemeable as
    // `#2563eb`, and the rule above does not flag it.
    //
    // This bans the colour-notation functions specifically, leaving calc() and
    // color-mix() working. `color-mix(in oklch, ...)` is unaffected because the
    // hue name there is not followed by an opening parenthesis.
    'declaration-property-value-disallowed-list': [
      {
        '/color$/': ['/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/'],
        background: ['/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/'],
        fill: ['/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/'],
        stroke: ['/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/'],
        '/^border(-(top|right|bottom|left))?$/': [
          '/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/',
        ],
      },
      {
        message:
          'Colour written in functional notation is still hardcoded. Use a token: var(--ig-color-...).',
      },
    ],

    // Our custom properties are all --ig-* prefixed (ADR-0002). The default
    // pattern in stylelint-config-standard would reject the prefix.
    'custom-property-pattern': '^ig-[a-z0-9]+(-[a-z0-9]+)*$',
  },
};
