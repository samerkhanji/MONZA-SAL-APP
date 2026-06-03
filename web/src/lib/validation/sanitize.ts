/**
 * Strip HTML/markup from a free-text value before it is persisted.
 *
 * React escapes interpolated strings on render, so a stored `<script>` tag is
 * shown as text rather than executed in the browser. But the payload still
 * reaches the database, where another consumer (PDF export, email, a future
 * `dangerouslySetInnerHTML`, a native mobile shell) might render it without
 * escaping. Sanitising on input keeps the stored value clean at the source.
 *
 * This is intentionally conservative: it removes anything that looks like an
 * HTML tag (`<...>`), then collapses the leftover whitespace. It is meant for
 * short labels (job titles, names) — not for prose fields where a literal `<`
 * may be legitimate (e.g. "tread < 2mm").
 */
export function sanitizeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
