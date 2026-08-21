/**
 * A minimal Blade-equivalent renderer for mail templates. Supports:
 *
 *   {{ name }}            — escaped output
 *   {!! html !!}          — raw output
 *   @if (condition) ... @endif
 *   @each (item in items) ... @endeach   (item available as a local)
 *
 * Templates live in resources/views/mail/*.html. This is intentionally small;
 * a full Blade port is out of scope for mail.
 */

type TemplateVars = Record<string, unknown>;

export function renderTemplate(source: string, vars: TemplateVars): string {
  return renderBlock(source, vars).trim();
}

/** Recursively render a template section with a scope of variables. */
function renderBlock(source: string, vars: TemplateVars): string {
  let output = source;

  // Control structures first — their bodies are rendered recursively, so
  // variable expressions inside them see the local scope (e.g. @each items).
  output = output.replace(
    /@if\s*\(([\s\S]*?)\)([\s\S]*?)@endif/g,
    (_match, cond: string, body: string) => {
      return truthy(evaluate(cond.trim(), vars)) ? renderBlock(body, vars) : '';
    },
  );

  output = output.replace(
    /@each\s*\(\s*(\w+)\s+in\s+([\s\S]*?)\)([\s\S]*?)@endeach/g,
    (_match, itemName: string, listExpr: string, body: string) => {
      const list = evaluate(listExpr.trim(), vars);
      if (!Array.isArray(list)) return '';
      return list
        .map((item) => renderBlock(body, { ...vars, [itemName]: item }))
        .join('');
    },
  );

  // Then {{ }} (escaped) and {!! !!} (raw) expressions.
  output = output.replace(/\{\{([\s\S]*?)\}\}/g, (_match, expr: string) => {
    return escapeHtml(String(evaluate(expr.trim(), vars)));
  });
  output = output.replace(/\{!!([\s\S]*?)!!\}/g, (_match, expr: string) => {
    return String(evaluate(expr.trim(), vars));
  });

  return output;
}

/** Evaluate a simple expression: property paths and literals only. */
function evaluate(expr: string, vars: TemplateVars): unknown {
  const trimmed = expr.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^['"`]/.test(trimmed)) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  // Property path: user.name → vars.user.name
  const parts = trimmed.split('.');
  let value: unknown = vars;
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function truthy(value: unknown): boolean {
  return Boolean(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
