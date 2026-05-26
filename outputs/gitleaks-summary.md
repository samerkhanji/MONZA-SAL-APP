# Gitleaks Scan Summary

**Tool:** gitleaks v8.21.2
**Date:** 2026-05-26
**Repository:** `/home/user/MONZA-SAL-APP` (full git history)
**HEAD:** `ec600a9fcbfe45f287c9caec592cdfde750f734b`
**Commits scanned:** 51

## Counts

| Total findings | Verified-active | Suspected real (unverified) | Test/example/tooling false positives |
|----------------|-----------------|------------------------------|---------------------------------------|
| 5              | **0**           | 0                            | 5                                     |

Scan was run with `--redact`, so no raw secrets appear in the JSON report or in this summary.

## Triage

### Findings 1-4: `curl-auth-header` matches in `.claude/settings.local.json`

| # | Rule              | File                          | Line | Commit      | Classification |
|---|-------------------|-------------------------------|------|-------------|----------------|
| 1 | curl-auth-header  | `.claude/settings.local.json` | 47   | `9741941...`| **Tooling artifact — literal "REDACTED" placeholder** |
| 2 | curl-auth-header  | `.claude/settings.local.json` | 50   | `9741941...`| **Tooling artifact — literal "REDACTED" placeholder** |
| 3 | curl-auth-header  | `.claude/settings.local.json` | 52   | `9741941...`| **Tooling artifact — literal "REDACTED" placeholder** |
| 4 | curl-auth-header  | `.claude/settings.local.json` | 53   | `9741941...`| **Non-secret URL only — no bearer token present** |

Context: this file is Claude Code's per-machine permission allowlist. Each entry is a Bash command pattern the user previously approved. The committed strings already contain the literal word `sbp_REDACTED` (the actual token value was redacted prior to the file ever being committed). Findings 1-3 match the literal pattern `Authorization: Bearer sbp_REDACTED`; finding 4 is a plain curl to the Supabase project hostname with no auth header at all (rule false-trigger).

Verified by reading the actual committed file at commit `9741941`:
```
"Bash(curl ... -H 'Authorization: Bearer sbp_REDACTED' https://api.supabase.com/...)"
```

Note: `.claude/settings.local.json` is listed in `.gitignore` but was tracked before the ignore rule was added. The committed content is harmless (already-redacted placeholders), but the user may want to `git rm --cached .claude/settings.local.json` to prevent future accidental commits with real tokens. **This is a hygiene improvement, not a security fix.**

### Finding 5: `generic-api-key` in documentation

| # | Rule            | File                                                       | Line | Commit      | Classification |
|---|-----------------|------------------------------------------------------------|------|-------------|----------------|
| 5 | generic-api-key | `_bmad/tea/testarch/knowledge/api-testing-patterns.md`     | 681  | `9741941...`| **Doc example — fake JWT for test pattern** |

Context: a markdown code block illustrating how to test rejection of an expired JWT:
```js
const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Expired token
```
The "token" is the public JWT header `{"alg":"HS256","typ":"JWT"}` base64-encoded (same in every JWT ever issued) followed by `...`. No payload or signature, no value.

## Conclusion

No real credentials in the repo's history. The five gitleaks hits are:
- 4 entries in a Claude Code permission allowlist whose token values were already replaced with the literal placeholder `sbp_REDACTED` before any commit,
- 1 documentation example with a generic JWT header.

No rotation, no history rewrite, no further action required from a security standpoint.

**Optional hygiene improvement:** untrack `.claude/settings.local.json` with `git rm --cached` so future per-machine settings (which may contain real tokens) aren't accidentally committed. (The file is already gitignored.)
