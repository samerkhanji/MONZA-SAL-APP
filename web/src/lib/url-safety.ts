/**
 * Shared URL-safety helpers used to guard against open-redirect attacks.
 *
 * The naive check `link.startsWith("/")` accepts `//attacker.com` because
 * protocol-relative URLs technically start with `/`. Browsers will then treat
 * the link as `https://attacker.com`, which lets an attacker redirect a logged-in
 * user off-site (or steal a session via a controlled origin).
 */

/**
 * Returns true only for safe internal paths. Rejects:
 *   - protocol-relative URLs (`//host`)
 *   - backslash-prefixed paths (`/\host`) — some old browsers normalize these
 *   - percent-encoded slash sneakery near the start (`/%2fattacker.com`)
 *   - absolute URLs (`https://…`)
 *   - any non-string / empty input
 */
export function isSafeInternalLink(link: string | undefined | null): boolean {
  if (!link || typeof link !== "string") return false;
  if (!link.startsWith("/")) return false;
  if (link.startsWith("//")) return false;
  if (link.startsWith("/\\")) return false;
  // `//%2fevil.com` would be normalized by some browsers; the leading 4 chars
  // are enough to catch this kind of bypass without affecting legitimate
  // query/fragment encoding deeper into the path.
  if (/%2f/i.test(link.slice(0, 4))) return false;
  return true;
}

/**
 * Allowed markdown link prefixes for AI chat rendering:
 *   - absolute http(s) URLs whose host segment does not begin with `/`
 *   - root-relative paths that begin with a single `/` (not `//`)
 *   - the bare path `/`
 *
 * Examples — pass:  `https://example.com/foo`, `/dashboard`, `/`
 * Examples — fail:  `//attacker.com`, `javascript:alert(1)`, `data:…`, `ftp://…`
 */
export const SAFE_MARKDOWN_URL_REGEX = /^(https?:\/\/[^/]|\/(?!\/)|\/$)/;

export function isSafeMarkdownUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return false;
  // Defense-in-depth: explicitly reject protocol-relative URLs before regex.
  if (url.startsWith("//")) return false;
  return SAFE_MARKDOWN_URL_REGEX.test(url);
}
