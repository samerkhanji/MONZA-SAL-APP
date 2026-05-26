# Trufflehog Scan Summary

**Tool:** trufflehog v3.95.3
**Date:** 2026-05-26
**Repository:** `/home/user/MONZA-SAL-APP` (full git history, all refs)
**HEAD:** `ec600a9fcbfe45f287c9caec592cdfde750f734b`

## Counts

| Mode       | Chunks | Bytes      | Verified | Unverified |
|------------|--------|------------|----------|------------|
| git        | 3,104  | 10,318,860 | **0**    | 1          |
| filesystem | 8,234  | 49,731,144 | **0**    | 4          |

Total verified-active secrets: **0**.

## Triage

### git-mode finding (1)

| # | Detector | File | Line | Commit | Verified | Classification |
|---|----------|------|------|--------|----------|----------------|
| 1 | Holistic | `_bmad/_config/files-manifest.csv` | 149 | `9741941...` | false | **False positive — SHA-256 file hash** |

Context: the matched 64-char hex string `1022a1...c0f5b` is the SHA-256 of a markdown file (`bmm/.../step-v-11-holistic-quality-validation.md`) in a manifest CSV. The detector triggered because the filename contains the word "holistic". This is a content hash, not a credential.

### filesystem-mode findings (4)

All four findings are the *same* match (the manifest CSV file hash above) duplicated because trufflehog walked into `.claude/worktrees/`, where three parallel-agent worktrees each contain their own checkout of the file:

| # | Detector | Path | Line | Verified |
|---|----------|------|------|----------|
| 1 | Holistic | `.claude/worktrees/agent-a40b996722989bb5c/_bmad/_config/files-manifest.csv` | 149 | false |
| 2 | Holistic | `.claude/worktrees/agent-a5a754b567d391e49/_bmad/_config/files-manifest.csv` | 149 | false |
| 3 | Holistic | `.claude/worktrees/agent-aa59f73e627863021/_bmad/_config/files-manifest.csv` | 149 | false |
| 4 | Holistic | `_bmad/_config/files-manifest.csv` | 149 | false |

All four are the same false positive as the git-mode finding.

## Conclusion

No verified credentials. The single unique match is a file-content hash inside a manifest CSV — a false positive. No action required.
