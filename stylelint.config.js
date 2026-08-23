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
  plugins: ['stylelint-declaration-strict-value', './tooling/stylelint-ingot/index.js'],

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

    // COMPANION RULE — patches a structural hole in the one above.
    //
    // declaration-strict-value accepts any *function* as valid, WITHOUT
    // inspecting its arguments. That is sensible in general — calc(), clamp(),
    // min(), max(), color-mix() and light-dark() are all legitimate ways to use
    // tokens. But it means every literal survives simply by being wrapped in
    // parentheses:
    //
    //   color: rgb(37 99 235)            colour notation
    //   color: light-dark(#fff, #000)    literal inside a legitimate function
    //   color: var(--ig-x, #2563eb)      literal as a var() FALLBACK
    //   padding: calc(16px * 2)          literal length inside maths
    //
    // The patterns below catch the literal wherever it sits in the value.
    //
    // THIS IS A PATCH, NOT A FIX. Configuration can only pattern-match strings.
    // A literal that is a *named* colour inside a function —
    // `color-mix(in srgb, red, blue)` — is still invisible here, because
    // catching it needs argument-level inspection.
    //
    // An earlier version of this comment said the custom rules would close it.
    // They do not: those rules cover token TIER and token EXISTENCE, which is a
    // different concern. This gap is still open and still tracked on #4. Do not
    // assume this rule closes the class.
    'declaration-property-value-disallowed-list': [
      {
        // --- Colour properties -------------------------------------------
        // Colour-notation functions, any case; the CSS Color 4 `color()`
        // function (\bcolor\( does not match `color-mix(`); and a hex literal
        // anywhere in the value, which is what catches fallbacks and
        // light-dark().
        '/color$/': [
          '/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/i',
          '/\\bcolor\\(/i',
          '/#[0-9a-fA-F]{3,8}\\b/',
        ],
        background: [
          '/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/i',
          '/\\bcolor\\(/i',
          '/#[0-9a-fA-F]{3,8}\\b/',
        ],
        fill: [
          '/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/i',
          '/#[0-9a-fA-F]{3,8}\\b/',
        ],
        stroke: [
          '/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/i',
          '/#[0-9a-fA-F]{3,8}\\b/',
        ],
        '/^border(-(top|right|bottom|left))?$/': [
          '/\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/i',
          '/#[0-9a-fA-F]{3,8}\\b/',
        ],

        // --- Space and radius --------------------------------------------
        // A length with a unit, anywhere in the value. Catches calc(16px * 2),
        // clamp(1rem, ...), min(16px, ...) and var(--x, 16px).
        //
        // `%` is deliberately excluded so calc(100% - var(--ig-space-4))
        // remains legal — a percentage is structural, not a scale step.
        //
        // border-width is deliberately NOT here: `1px` is temporarily allowed
        // above, and this pattern would contradict that.
        '/^padding/': ['/\\d+(px|rem|em|ch|vw|vh|pt|cm|mm|in)\\b/i'],
        '/^margin/': ['/\\d+(px|rem|em|ch|vw|vh|pt|cm|mm|in)\\b/i'],
        '/gap$/': ['/\\d+(px|rem|em|ch|vw|vh|pt|cm|mm|in)\\b/i'],
        '/radius$/': ['/\\d+(px|rem|em|ch|vw|vh|pt|cm|mm|in)\\b/i'],

        // --- Layer order ---------------------------------------------------
        // Any digit. Catches calc(100 + 1). Safe because layer tokens are
        // NAMED, not numbered — `--ig-layer-modal`, never `--ig-layer-1`.
        // If a numbered layer token is ever introduced, this breaks, which is
        // the correct outcome: it would contradict the named-layer decision.
        'z-index': ['/\\d/'],
      },
      {
        message:
          'Hardcoded appearance value. A literal inside a function is still hardcoded — use a token: var(--ig-...).',
      },
    ],

    // Our custom properties are all --ig-* prefixed (ADR-0002). The default
    // pattern in stylelint-config-standard would reject the prefix.
    'custom-property-pattern': '^ig-[a-z0-9]+(-[a-z0-9]+)*$',
  },

  overrides: [
    {
      // The tier and existence rules apply to COMPONENT css only. They read the
      // generated token manifest, so lint depends on the token build — CI runs
      // `Build tokens` before linting for this reason.
      files: ['packages/react/**/*.css'],
      rules: {
        'ingot/no-primitive-tokens': true,
        'ingot/token-exists': true,
      },
    },
  ],
};
