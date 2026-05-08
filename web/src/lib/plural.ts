/**
 * Tiny English pluralization helper. Avoids "1 cars" / "0 customer" /
 * "5 customer(s)" awkwardness across the app.
 *
 *   pluralize(1, "car")           -> "1 car"
 *   pluralize(0, "car")           -> "0 cars"
 *   pluralize(2, "customer")      -> "2 customers"
 *   pluralize(1, "child", "children") -> "1 child"
 *   pluralize(2, "child", "children") -> "2 children"
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const n = Number.isFinite(count) ? count : 0;
  const word = n === 1 ? singular : (plural ?? singular + "s");
  return `${n} ${word}`;
}
