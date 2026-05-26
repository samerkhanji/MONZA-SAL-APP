# Adversarial code review — 2026-05-26 — 04d8911

Scope: `web/src/` only. Read-only static analysis. No code changes.

## Severity legend
- Critical (security, data loss, crash)
- High (broken feature, severe UX)
- Medium (bug under specific conditions)
- Low (cleanup, nit, minor smell)

## Findings (grouped by severity)

### Critical

- **No rate limit on `/api/auth/reset-password` (Resend mail-bomb)** — `web/src/app/api/auth/reset-password/route.ts:24-100`
  - Why: POST is reachable by anyone, accepts an email, and unconditionally calls Resend. No auth, no captcha, no IP/email throttling. An attacker can burn through the Resend daily quota and send unlimited "reset password" emails to any address harvested elsewhere (email-bomb harassment + DoS of the password-reset feature for legitimate users). `/api/auth/request-password-reset/route.ts` has the same gap.
  - Fix: Add a per-IP + per-email window check backed by `api_rate_limit_events` (same pattern as `/api/chat/route.ts:checkChatRateLimit`); cap to, e.g., 3 per email per hour and 30 per IP per hour. Add a hidden honeypot field or hCaptcha on the forgot-password form.

- **Open-redirect risk in `/api/send-push` notification link** — `web/src/app/api/send-push/route.ts:106`
  - Why: `link.startsWith("/")` accepts `//attacker.com/path` (protocol-relative URL). A `garage_manager`-or-above caller can broadcast a push whose payload's `link` opens `//attacker.com/...` when the recipient clicks the notification — the in-browser handler at `NotificationBell.tsx:131` and the SW just assign it to `window.location.href`, leaving the origin.
  - Fix: Reject when `link[1] === "/"` or `link[1] === "\\"` (mirror `safeRedirectTo` in `lib/auth-utils.ts`).

- **Open-redirect / phishing via AI assistant markdown links** — `web/src/components/ai-chat-widget.tsx:668`
  - Why: The "safe" regex `/^(https?:\/\/|\/)/` accepts `//attacker.com`. Combined with the freshly-streamed assistant message rendering, an attacker who can prompt-inject through tool-result content (e.g. customer name in the DB) could trigger a clickable link that navigates the trusted user off-origin, with `rel="noopener noreferrer"` but on the same tab.
  - Fix: Reject `url.startsWith("//")` and `url.startsWith("/\\")`; require `https://` or single-leading-slash (no second).

### High

- **Storage orphan when DB delete fails after storage delete** — `web/src/app/api/documents/car/[id]/route.ts:37-46` (and `documents/customer/[id]`, `documents/job/[id]`)
  - Why: Storage object is `remove()`d FIRST, then the DB row deleted. If the DB delete fails (e.g. RLS or 42501), the user sees a 500 but the file is already gone — the row still references a non-existent storage path. Subsequent views/downloads error out.
  - Fix: Delete the DB row first, then the storage object; orphaning a storage object is recoverable, but a row pointing at a missing object is not.

- **`app/error.tsx` wraps content in `<html>`/`<body>`** — `web/src/app/error.tsx:22-60`
  - Why: A route-level `error.tsx` renders INSIDE the root layout, which already provides `<html>/<body>`. Wrapping again produces invalid nested DOM, hydration warnings, and a broken fallback at the very moment the user already saw an error. Only `app/global-error.tsx` may render its own `<html>/<body>`.
  - Fix: Remove the outer `<html><body>...</body></html>` — return just the inner content block (mirror `app/(dashboard)/error.tsx`).

- **Client-side warranty notifier writes from every signed-in user's browser** — `web/src/components/WarrantyNotificationChecker.tsx:23-185`
  - Why: This runs in every user's browser on dashboard load (gated only by sessionStorage). With N users opening the app on the same day, you get N concurrent races: each fetches the dedupe ledger, checks for missing rows, then INSERTs — they'll insert duplicates because the in-memory `sentSet` is stale relative to other tabs/users. It also unconditionally fans out notifications to every assistant/hybrid recipient — duplicated push spam likely.
  - Fix: Move to a server cron / Supabase Edge Function with a unique constraint on `(car_id, warranty_type, threshold_days)` and `INSERT … ON CONFLICT DO NOTHING`.

- **Stale-closure cleanup leaks Object URLs in share-inbox** — `web/src/app/(dashboard)/share-inbox/page.tsx:68-81`
  - Why: The effect closes over `previewUrls` at mount (empty `[]`), so the cleanup `previewUrls.forEach(...revokeObjectURL)` never sees the URLs that were created inside the effect. Object URLs accumulate per session, holding the blobs in memory.
  - Fix: Capture the URLs in a local variable inside the effect and revoke those in cleanup. Drop the `eslint-disable-next-line react-hooks/exhaustive-deps`.

- **`UserContext` value object recreated every render** — `web/src/lib/contexts/UserContext.tsx:373-414`
  - Why: 69 components consume `useUser()`. The provider's `value={{ ... }}` is a fresh object literal every render of `UserProvider` (e.g. on auth state change, every TOKEN_REFRESHED), forcing every consumer to re-render even when their slice of state hasn't changed. Compounding factor on a CRM with large tables.
  - Fix: Wrap the object in `useMemo` keyed on the underlying state (`profile`, `loading`, `connectionError`, derived booleans).

- **Timing-attack window in recovery-link secret comparison** — `web/src/app/api/auth/generate-recovery-link/route.ts:18`
  - Why: `request.headers.get("x-recovery-link-secret") !== secret` is a non-constant-time compare. `force-reset-password` uses `timingSafeEqual` — this one should too, especially because it returns 404 vs 400 differently from a missing secret.
  - Fix: Reuse the `constantTimeEqualSecret` helper from `app/api/admin/force-reset-password/route.ts:7`.

- **Hidden file input lacks accessible label** — `web/src/components/ImportExcelDialog.tsx:361-367`
  - Why: `<input type="file" className="hidden">` has no `id`, `name`, `aria-label`, or `title`. Screen-reader users land on an unlabeled input even though the trigger button is what they actually click.
  - Fix: Add `aria-label="Excel file"` and a stable `id`/`name`.

- **`window.confirm` blocks event loop and looks unprofessional** — `web/src/components/car-day-detail-dialog.tsx:178`, `web/src/components/car-documents.tsx:253`, `web/src/components/customers/CustomerDocuments.tsx:180`, `web/src/components/test-drive/TestDriveFormSheet.tsx:511`
  - Why: Native `confirm()` is synchronous, focus-stealing, blocked in iframes / PWAs in standalone mode, and inconsistent with the AlertDialog UI used elsewhere in the app (see comment at `sales-orders/[id]/page.tsx:883` noting the replacement).
  - Fix: Replace with the existing `AlertDialog` confirm component.

### Medium

- **`new Promise(async (resolve) => ...)` antipattern** — `web/src/app/(dashboard)/share-inbox/page.tsx:35-53`
  - Why: Async executor swallows thrown errors silently (they vanish before `reject` is called). The function already opens IndexedDB and reads — any thrown error after the `try` block in `loadLatest` is lost.
  - Fix: Make the function plain `async`, `await` inside, and `try/catch`/`return null` on error.

- **N+1 supabase queries in Excel import** — `web/src/components/ImportExcelDialog.tsx:206-303`
  - Why: For every car/customer row in the spreadsheet, a separate `select … eq` round-trip is made (cars by VIN, customers by phone, sales_orders by car_id). A 500-row import is 1500+ sequential round-trips that can run for many minutes. Browser tab will appear hung.
  - Fix: Batch-fetch existing VINs/phones with `in()` upfront, build maps, then iterate in memory.

- **Sequential `use_part_on_job` RPC per part** — `web/src/components/garage/NewJobDialog.tsx:278-290`
  - Why: Each part is an awaited RPC call in a loop. A job with 10 parts → 10 round-trips. Either expose a batch RPC or fire concurrently with `Promise.allSettled` (already used elsewhere in `lib/notifications.ts`).
  - Fix: Add a batch RPC or `Promise.allSettled` the array.

- **`mousemove` event handler writes to sessionStorage on every move** — `web/src/components/auth/SessionEnforcer.tsx:125-136`
  - Why: `mousemove` fires dozens of times per second and each invocation does a sessionStorage write via `markActivity` → `updateLastActivity`. This is a real CPU/IO cost on lower-end devices the warehouse/garage staff use.
  - Fix: Throttle `markActivity` to once every 5-10s (a leading-edge throttle is enough — idle timeout granularity is in minutes).

- **Realtime channel effect deps include `load` (re-subscribes on every render)** — `web/src/app/(dashboard)/notifications/page.tsx:131-151`
  - Why: `load` is recreated on every render (because `supabase` is a fresh instance every render — see next item). The effect tears down and re-subscribes the realtime channel constantly, leaking subscriptions and racing inbound rows.
  - Fix: Don't depend on `load` (use a ref) or memoize `supabase` properly.

- **`createClient()` called inside every render** — pervasive: `web/src/components/NotificationBell.tsx:80`, `web/src/components/pdi-status-dialog.tsx:47`, `web/src/components/edit-car-dialog.tsx:88`, `web/src/components/status-customer-dialog.tsx:82`, and ~40 more files
  - Why: Each render allocates a new Supabase client and (in the SSR variant) reads cookies. When this client is then used in `useCallback`/`useEffect` deps it forces effects to re-run unnecessarily.
  - Fix: `const supabase = useMemo(() => createClient(), [])` or hoist to a module-level singleton (browser client is already cached internally, but the React reference changes anyway).

- **`InstallContext.Provider` value also unmemoized** — `web/src/lib/contexts/InstallContext.tsx:44-50`
  - Same issue as `UserContext`. Fewer consumers but still re-renders subtree.
  - Fix: `useMemo` the object.

- **VAPID public key never validated for length / format** — `web/src/app/api/send-push/route.ts:21-36`
  - Why: A malformed key just causes `setVapidDetails` to throw on every request, returning 500 instead of pre-flighting a clearer 503. Easy to miss for ops.
  - Fix: Validate base64 + length (87 chars URL-safe for P-256) at boot once.

- **`push_subscriptions` insert with no upsert / unique-conflict handling** — `web/src/lib/push-subscription.ts:115-122`
  - Why: A user with multiple devices that all "first-subscribe-ish" can hit duplicate inserts; depending on schema, that throws and the user gets a misleading "could not save subscription" error.
  - Fix: Use `upsert({ ... }, { onConflict: "user_id,endpoint" })` (or whatever the unique key is).

- **`useEffect` cleanup not running setTimeout fallback** — `web/src/app/(dashboard)/accessories/page.tsx:118`
  - Why: `setTimeout(() => setSaveState("idle"), 1500)` inside the autosave callback has no cleanup. Unmounting within 1.5s after save → React warning about updating state on unmounted component.
  - Fix: Track the timeout id in a ref and clear it in the outer effect cleanup.

- **`getDocumentUrl` `useCallback` deps missing `supabase`** — `web/src/components/car-day-detail-dialog.tsx:148-157`, `web/src/components/garage/JobDocuments.tsx:173-186`
  - Why: Both pass `[]` as deps even though they close over `supabase`. With supabase recreated per render (above), the closure may keep a stale reference if anything changes — minor, but exhaustive-deps is off by mistake.
  - Fix: Either include `supabase` (after fixing the upstream issue) or hoist.

- **`<input type="file"` in share-inbox with no max size** — `web/src/app/share-target/route.ts:28-49`
  - Why: Multipart POST has no `content-length` cap; an OS share of a huge file is base64-inlined into HTML response — large memory blow-up server-side.
  - Fix: Read `request.headers.get("content-length")` and reject > a reasonable cap (e.g. 25 MB); also limit per-file count.

- **Force-reset admin page accessible to any signed-in user** — `web/src/app/admin/force-reset/page.tsx`
  - Why: The API enforces owner + secret, but the page itself has no route gate — anyone who is signed in can navigate to it and probe the secret box. Doesn't grant access, but shouldn't be reachable.
  - Fix: Wrap the page with `PageAccessGuard` (already used elsewhere) or check `appRole === "owner"` and 404 otherwise.

- **`useEffect` deps include `messages` which the callback also reads — re-creates `send` on every keystroke** — `web/src/components/ai-chat-widget.tsx:95-277`
  - Why: `send` is in a `useCallback` that depends on `messages`. Every assistant `setMessages` update during streaming retriggers `send`'s identity. While not breaking, it causes form/textarea `onKeyDown` (which captures `send` via closure) to be rebuilt many times per second during streaming.
  - Fix: Use a ref for the message history when reading inside `send`, keep deps minimal.

- **`Math.random` used to generate message IDs as fallback** — `web/src/components/ai-chat-widget.tsx:46-50`
  - Why: Collision chance is tiny here so not a real bug, but the comment-free fallback can spread to other callers thinking it's "safe". 
  - Fix: Use `crypto.randomUUID()` (gated by the feature check) and a deterministic counter as fallback rather than `Math.random`.

- **Server log leaks email (redacted, but combined with non-OK GoTrue text)** — `web/src/app/api/auth/request-password-reset/route.ts:64-92`
  - Why: When debug mode is on (`NEXT_PUBLIC_DEBUG_PASSWORD_RESET=1` is *public* and can be flipped on by anyone who controls the env), the route logs the redacted email AND the response body from GoTrue, which often contains the full email back. The "NEXT_PUBLIC_" prefix means the flag is observable in client bundles, but the server reads `process.env.NEXT_PUBLIC_DEBUG_PASSWORD_RESET` server-side.
  - Fix: Use a server-only env var (`DEBUG_PASSWORD_RESET`) and remove the `NEXT_PUBLIC_` fallback from the server check.

- **Sales/customer/installments use `as unknown as <Type>` to bypass Supabase typing** — `web/src/app/(dashboard)/sales-orders/page.tsx:124`, `web/src/app/(dashboard)/installments/page.tsx:491`, `web/src/app/(dashboard)/customers/page.tsx:163`, `web/src/app/(dashboard)/cars/[id]/page.tsx:510`, etc.
  - Why: Repeated escapes from the generated types defeat compile-time guarantees and any future schema migration that silently changes a column will be discovered at runtime, not in CI.
  - Fix: Regenerate Supabase types and lean on `Database["public"]["Tables"]["..."]["Row"]` where possible. Add a lint rule banning `as unknown as` in feature code.

### Low

- **Inline `style={{ overscrollBehaviorX: "none" }}` on `<html>` is fine but produces a new object per render** — `web/src/app/layout.tsx:42` (server component, so no re-render, but the cast `as React.CSSProperties` shouldn't be needed).
  - Fix: Move to a static CSS class in `globals.css`.

- **`onAuthStateChange` re-runs `loadProfile` on every `TOKEN_REFRESHED`** — `web/src/lib/contexts/UserContext.tsx:250-254`
  - Why: Tokens refresh every ~60 min; a full profile pull on each is fine, but it's wired to `USER_UPDATED || TOKEN_REFRESHED` — `TOKEN_REFRESHED` doesn't change `must_change_password`. Extra network call per hour per tab.
  - Fix: Skip `TOKEN_REFRESHED` unless the user object's id/email changed.

- **`<a rel="noreferrer">` (missing `noopener`)** — `web/src/app/(dashboard)/sales-orders/[id]/page.tsx:716`
  - Why: Modern browsers default to `noopener` for `target=_blank`, but explicit `noopener noreferrer` is safer for older Safari / WebViews.
  - Fix: Add `noopener` alongside `noreferrer`.

- **`router.push("/")` from an error boundary's "Go to dashboard" button** — `web/src/app/error.tsx:47`
  - Why: After an error inside the root layout, `router.push` can throw too because Next's router context may be torn. Use `window.location.href = "/dashboard"`.
  - Fix: Hard nav.

- **`as any` in tests that also leak into production via shared types** — `web/src/lib/__tests__/permissions.test.ts` (many) and `web/src/app/login/page.tsx:123` (`getAppRoleFromProfile(profile as any)`)
  - Why: The production call site at login `page.tsx:123` casts profile to `any` to bypass typing.
  - Fix: Use the proper `UserProfile | null` cast (matches `data-health/count/route.ts`).

- **Hard-coded "Houssam" name in role check** — `web/src/lib/contexts/UserContext.tsx:295-301`
  - Why: Role identification by full name is brittle (`profile?.full_name === "Houssam"`). One typo or spelling change breaks approval flow.
  - Fix: Phase out to a capability flag (e.g. `approve_houssam_workflow`) or settle on the env-id-only path.

- **`runtime = "nodejs"` + base64 of arbitrary blob inlined into HTML** — `web/src/app/share-target/route.ts:42-72`
  - Why: Beyond the size issue above, base64 doubles the memory footprint of every shared file. For large images, this matters on cold serverless invocations.
  - Fix: Save the binary to Supabase storage first (`/share-target` bucket with per-user folder + 1 hr expiry) and pass only the path to the share-inbox page.

- **`limit(15)` notifications with no pagination control** — `web/src/components/NotificationBell.tsx:94`
  - Why: Power users with > 15 unread will only ever see 15; the "mark all as read" call still works but the bell display is silently truncated.
  - Fix: Show "+N more" badge or link to the full notifications page.

- **`webpush.setVapidDetails` called inside POST handler** — `web/src/app/api/send-push/route.ts:39`
  - Why: Re-runs config validation on every push send. Cheap but redundant.
  - Fix: Call once at module top with try/catch and cache the result.

- **Two different xlsx libraries bundled (`@e965/xlsx` for import, `xlsx-js-style` for export)** — `web/src/components/ImportExcelDialog.tsx:7`, `web/src/lib/exportToExcel.ts:1`
  - Why: ~600 KB of bundle for the import + export combo. Could share one library.
  - Fix: Standardize on `xlsx-js-style` (covers both) and drop the import one.

- **`globals.css` 9 KB on critical path** — implied by `app/layout.tsx` import.
  - Fix: Audit Tailwind purge / mark explicit critical-only CSS in layout if you've split.

- **`requestAnimationFrame` inside `useEffect` with no cleanup** — `web/src/components/ai-chat-widget.tsx:71-73, 79`
  - Why: Pending RAFs run after unmount (calling setState on an unmounted component if the message changes again).
  - Fix: Store the RAF id and `cancelAnimationFrame` in cleanup.

- **`escapeHtmlAttr` only escapes `&`, `"`, `<`** — `web/src/app/api/auth/reset-password/route.ts:20`
  - Why: For an `href` attribute, missing `'` is OK because the attribute is double-quoted. Listing it for completeness if anyone later switches to single-quoted attrs.
  - Fix: Add `'` → `&#39;`.

- **`sortedEvents.map((ev) =>` without explicit dep on `ev.id` uniqueness** — `web/src/components/car-day-detail-dialog.tsx:314`
  - Status: Looks OK at a glance but worth a smoke-test if `event_date` is the only ordering key.

- **`console.warn`/`console.error` left intact across many routes** — fine for server logs, but `LogRocketInit.tsx:116` does `console.info("[LogRocket] session", ...)` on every prod load. Mildly noisy.
  - Fix: Gate behind a debug flag.

- **`globalThis`-style monkey-patch for unhandledrejection** — `web/src/app/layout.tsx:65-72`
  - Why: Inline `<script dangerouslySetInnerHTML>` registers a global `unhandledrejection` listener that silently swallows AbortErrors. Mixed with `AbortErrorHandler` component does the same job. Two handlers for one purpose.
  - Fix: Drop the inline script; the `AbortErrorHandler` covers it.

- **`<img>` instead of `next/image` for the sidebar logo** — `web/src/components/dashboard-shell.tsx:491`
  - Why: No automatic sizing / lazy-load / AVIF. Logo is small so impact is low.
  - Fix: `next/image` or a CSS background-image with `aspect-ratio`.

- **`new Notification("...")` permission denied path is silently swallowed** in `WarrantyNotificationChecker` and `notifications.ts` — see `lib/notifications.ts:39-41`.
  - Fix: Surface a one-time toast asking user to enable notifications when persistent denial is detected.

- **`encodeURIComponent(redirectTo)` correctness in `/` → `/mfa`** — `web/src/app/page.tsx:93`
  - Looks correct. Listing only to note that `redirectTo` is already `safeRedirectTo`'d earlier — defense in depth.

## Summary
- Total findings: 41 (Critical 3, High 8, Medium 17, Low 13)
- Recommended next actions (top 3 to fix first):
  1. **Add rate limiting + captcha to `/api/auth/reset-password` and `/api/auth/request-password-reset`** — current state is mail-bomb-ready and DoS-able.
  2. **Patch the two open-redirect surfaces**: `send-push` payload `link` and the AI assistant's `InlineMarkdown` URL regex. Both let `//attacker.com` escape origin via a trusted in-app click.
  3. **Memoize `UserContext` value + drop the wrapping `<html>/<body>` in `app/error.tsx`** — both have outsized blast radius: the unmemoized context cascades re-renders across 69 consumers, and the broken error page is what users see when something is *already* wrong.
