import { describe, it, expect } from "vitest";
import {
  isSafeInternalLink,
  isSafeMarkdownUrl,
  SAFE_MARKDOWN_URL_REGEX,
} from "@/lib/url-safety";

describe("isSafeInternalLink (fix 2: send-push open-redirect)", () => {
  it("accepts a normal root-relative path", () => {
    expect(isSafeInternalLink("/dashboard")).toBe(true);
  });

  it("accepts the bare root path", () => {
    expect(isSafeInternalLink("/")).toBe(true);
  });

  it("accepts paths with query and fragment", () => {
    expect(isSafeInternalLink("/cars/123?tab=parts#section")).toBe(true);
  });

  it("rejects protocol-relative URLs that browsers treat as off-site", () => {
    expect(isSafeInternalLink("//attacker.com")).toBe(false);
    expect(isSafeInternalLink("//attacker.com/path")).toBe(false);
  });

  it("rejects absolute URLs even if https", () => {
    expect(isSafeInternalLink("https://evil.com")).toBe(false);
    expect(isSafeInternalLink("http://evil.com")).toBe(false);
  });

  it("rejects javascript: and data: URLs", () => {
    expect(isSafeInternalLink("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalLink("data:text/html,<script>alert(1)</script>")).toBe(
      false
    );
  });

  it("rejects backslash-prefixed paths (`/\\evil`)", () => {
    expect(isSafeInternalLink("/\\evil")).toBe(false);
    expect(isSafeInternalLink("/\\evil.com")).toBe(false);
  });

  it("rejects percent-encoded slash sneakery near the start", () => {
    expect(isSafeInternalLink("/%2fattacker.com")).toBe(false);
    expect(isSafeInternalLink("/%2Fattacker.com")).toBe(false);
  });

  it("rejects nullish and empty input", () => {
    expect(isSafeInternalLink(undefined)).toBe(false);
    expect(isSafeInternalLink(null)).toBe(false);
    expect(isSafeInternalLink("")).toBe(false);
  });
});

describe("isSafeMarkdownUrl (fix 3: AI chat open-redirect)", () => {
  it("accepts https URLs with a real hostname", () => {
    expect(isSafeMarkdownUrl("https://example.com")).toBe(true);
    expect(isSafeMarkdownUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("accepts http URLs with a real hostname", () => {
    expect(isSafeMarkdownUrl("http://example.com")).toBe(true);
  });

  it("accepts root-relative paths starting with a single slash", () => {
    expect(isSafeMarkdownUrl("/dashboard")).toBe(true);
    expect(isSafeMarkdownUrl("/")).toBe(true);
  });

  it("rejects protocol-relative URLs", () => {
    expect(isSafeMarkdownUrl("//attacker.com")).toBe(false);
    expect(isSafeMarkdownUrl("//attacker.com/path")).toBe(false);
  });

  it("rejects javascript:, data:, ftp:, file: schemes", () => {
    expect(isSafeMarkdownUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMarkdownUrl("data:text/html,abc")).toBe(false);
    expect(isSafeMarkdownUrl("ftp://example.com")).toBe(false);
    expect(isSafeMarkdownUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects malformed http(s) without a host", () => {
    expect(isSafeMarkdownUrl("https:///nohost")).toBe(false);
    expect(isSafeMarkdownUrl("http:///nohost")).toBe(false);
  });

  it("rejects nullish and empty input", () => {
    expect(isSafeMarkdownUrl(undefined)).toBe(false);
    expect(isSafeMarkdownUrl(null)).toBe(false);
    expect(isSafeMarkdownUrl("")).toBe(false);
  });

  it("matches expected cases via the exported regex", () => {
    // Direct check on the regex itself for documentation/traceability.
    expect(SAFE_MARKDOWN_URL_REGEX.test("/dashboard")).toBe(true);
    expect(SAFE_MARKDOWN_URL_REGEX.test("https://example.com")).toBe(true);
    // The regex permits this string in isolation, which is why the wrapper
    // also explicitly rejects `//` prefixes before applying it.
    expect(SAFE_MARKDOWN_URL_REGEX.test("//attacker.com")).toBe(false);
  });
});
