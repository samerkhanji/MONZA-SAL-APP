import { type NextRequest, NextResponse } from "next/server";

// PWA Web Share Target endpoint.
//
// The manifest declares /share-target as a multipart/form-data POST target.
// The OS share sheet hits this route; the browser then expects either a
// response or a redirect. We can't pass File objects through a redirect, so
// we render an HTML stub that:
//   1. Stashes any shared file in IndexedDB (so the dashboard UI can pick it
//      up after the redirect).
//   2. Navigates the window to a small in-app landing page where the user
//      picks where to attach it (car / customer).
//
// For Tier 1, the landing page is intentionally minimal — just enough that
// the share flow doesn't dead-end. Wiring it into specific attachments is a
// follow-up.
//
// GET is also handled (some browsers may issue a GET probe).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Some browsers GET-probe the share target; just send them to the inbox.
  return NextResponse.redirect(new URL("/share-inbox", req.url), { status: 303 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // The form fields are decoded once below — we then re-encode the file as
  // base64 in a self-contained HTML page so that client JS can put it into
  // IndexedDB before navigating into the authenticated landing page.
  const form = await req.formData().catch(() => null);
  const title = (form?.get("title") as string | null) ?? "";
  const text = (form?.get("text") as string | null) ?? "";
  const url = (form?.get("url") as string | null) ?? "";

  // Browsers send files under whatever key the manifest declared (name=file).
  const fileEntries: Array<{ name: string; type: string; b64: string }> = [];
  if (form) {
    for (const [, value] of form.entries()) {
      if (value instanceof File) {
        const buf = Buffer.from(await value.arrayBuffer());
        fileEntries.push({
          name: value.name || "shared",
          type: value.type || "application/octet-stream",
          b64: buf.toString("base64"),
        });
      }
    }
  }

  const payload = JSON.stringify({ title, text, url, files: fileEntries });
  const safePayload = payload
    .replace(/</g, "\\u003c")
    .replace(/-->/g, "--\\u003e");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Monza — Receiving share…</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #111827; color: #f3f4f6; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  p { opacity: 0.8; }
</style>
</head>
<body>
<p>Saving shared content…</p>
<script>
(async function() {
  var payload = ${safePayload};
  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open("monza-share-inbox", 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore("items", { keyPath: "id", autoIncrement: true });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function b64ToBlob(b64, type) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type });
  }
  try {
    var db = await openDb();
    var tx = db.transaction("items", "readwrite");
    var store = tx.objectStore("items");
    var files = (payload.files || []).map(function (f) {
      return { name: f.name, type: f.type, blob: b64ToBlob(f.b64, f.type) };
    });
    store.add({
      receivedAt: Date.now(),
      title: payload.title,
      text: payload.text,
      url: payload.url,
      files: files,
    });
    tx.oncomplete = function () { window.location.replace("/share-inbox"); };
    tx.onerror = function () { window.location.replace("/share-inbox"); };
  } catch (e) {
    window.location.replace("/share-inbox");
  }
})();
</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // No cache — every share is a one-off.
      "cache-control": "no-store",
    },
  });
}
