// In-repo ESLint rule. Private tooling, never published.
//
// ADR-0006 puts every appearance value in CSS, but nothing stops a component
// writing style={{ padding: 16 }}. This is the ONLY guard on the
// TypeScript/CSS boundary — the stylelint rules cannot see into .tsx at all.
// If it is removed or weakened, that boundary is unguarded and nothing else
// will notice.
//
// The rule inverts the obvious approach. Rather than inspecting inline values
// and judging them, inline `style` may set CSS custom properties and nothing
// else. No judgement, and it names the one correct pattern for a dynamic value:
//
//   <div className={s.bar} style={{ '--ig-progress-value': `${pct}%` }} />

/** @type {import('eslint').Rule.RuleModule} */
const inlineStyleCustomPropertiesOnly = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Inline styles may only set CSS custom properties; everything else belongs in a CSS Module',
    },
    schema: [],
    messages: {
      // NOTE: the literal sequence "{{" cannot appear in this string. ESLint
      // parses it as a message placeholder, so an inline code example showing
      // a JSX style object would be read as a variable name to substitute.
      // Same class of failure as braces inside a Style Dictionary $description:
      // prose in a field the tool parses is still parsed.
      onlyCustomProperties:
        'Inline styles may only set CSS custom properties. "{{property}}" belongs in a CSS Module class (ADR-0006). To make a value dynamic, set a CSS custom property inline and consume it from the class — that keeps it themeable.',
    },
  },

  create(context) {
    return {
      /**
       * ESLint's own types do not describe JSX nodes, so the shape this rule
       * touches is declared narrowly here rather than widened to `any` —
       * keeping tooling typechecked is the point of checkJs.
       *
       * @param {{
       *   name?: { type: string, name?: string },
       *   value?: {
       *     type: string,
       *     expression?: {
       *       type: string,
       *       properties?: {
       *         type: string,
       *         computed?: boolean,
       *         key?: { type: string, name?: string, value?: unknown },
       *       }[],
       *     },
       *   } | null,
       * }} node
       */
      JSXAttribute(node) {
        if (node.name?.type !== 'JSXIdentifier' || node.name.name !== 'style') return;

        const value = node.value;
        if (!value || value.type !== 'JSXExpressionContainer') return;

        const expression = value.expression;
        if (!expression || expression.type !== 'ObjectExpression') return;

        for (const property of expression.properties ?? []) {
          // Spread cannot be inspected statically. Deliberately not reported:
          // see the known gaps in CONTRIBUTING.
          if (property.type !== 'Property') continue;

          const propertyKey = property.key;
          if (!propertyKey) continue;

          const key =
            propertyKey.type === 'Identifier' && !property.computed
              ? propertyKey.name
              : propertyKey.type === 'Literal'
                ? String(propertyKey.value)
                : undefined;

          if (key === undefined || key.startsWith('--')) continue;

          context.report({
            // Cast at the boundary: ESLint's report() wants its own node type,
            // which does not include JSX. The shape above is what we rely on.
            node: /** @type {import('eslint').Rule.Node} */ (
              /** @type {unknown} */ (property)
            ),
            messageId: 'onlyCustomProperties',
            data: { property: key },
          });
        }
      },
    };
  },
};

export const rules = {
  'inline-style-custom-properties-only': inlineStyleCustomPropertiesOnly,
};

export default { rules };
