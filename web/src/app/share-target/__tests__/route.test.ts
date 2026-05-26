import { describe, it, expect } from "vitest";
import { POST, GET } from "../route";
import { NextRequest } from "next/server";

/**
 * Regression test for adversarial review #135 — the Web Share Target POST
 * endpoint now caps the multipart body so a 200 MB OS share can't
 * base64-inline into the HTML response and blow up serverless memory.
 *
 * We only exercise the cheap `content-length` pre-flight here; full-blob
 * FormData iteration behaves differently across `jsdom` vs Node/undici
 * environments and is covered by the route's per-file/total/count guards
 * at runtime.
 */
describe("share-target POST size limits", () => {
  function makeRequest(body: BodyInit | null, headers?: Record<string, string>) {
    return new NextRequest("http://localhost/share-target", {
      method: "POST",
      body,
      headers,
    });
  }

  it("rejects requests whose declared content-length exceeds the 25 MB cap", async () => {
    const req = makeRequest("", {
      "content-length": String(30 * 1024 * 1024),
      "content-type": "multipart/form-data; boundary=---x",
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it("allows requests with a small declared content-length", async () => {
    const req = makeRequest(new FormData(), {
      "content-length": "16",
    });
    const res = await POST(req);
    // Even with no files, the route renders the bootstrap HTML stub.
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
  });

  it("ignores a missing content-length header and still returns the HTML stub", async () => {
    const fd = new FormData();
    fd.append("title", "hello");
    fd.append("text", "world");
    const req = makeRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("redirects GETs to the in-app share inbox", async () => {
    const req = new NextRequest("http://localhost/share-target", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toMatch(/\/share-inbox$/);
  });
});
