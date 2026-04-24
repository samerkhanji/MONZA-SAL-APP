import type { Page, TestInfo } from "@playwright/test";

/**
 * Attach listeners to catch console errors + any 4xx/5xx network responses.
 * Call at the top of a test (or inside beforeEach). Errors are collected in an
 * array and the test is asked (via `attach`) to surface them in the HTML report.
 */
export function captureAppProblems(page: Page, info: TestInfo) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // Next-dev emits lots of "Warning:" noise as errors; filter true app errors
      const text = msg.text();
      if (text.includes("ResizeObserver") || text.includes("Hydration")) return;
      consoleErrors.push(text);
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });

  page.on("response", async (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    // Chrome-internal + favicon noise
    if (url.endsWith(".ico") || url.startsWith("chrome-extension://")) return;
    // Deliberately ignored: auth probe 401s on initial load
    if (status === 401 && /\/auth\/v1\/user/.test(url)) return;
    failedRequests.push(`${status} ${response.request().method()} ${url}`);
  });

  // Push collected data into the report after the test body runs.
  return async function finish() {
    if (consoleErrors.length) {
      await info.attach("console-errors.txt", {
        body: consoleErrors.join("\n"),
        contentType: "text/plain",
      });
    }
    if (failedRequests.length) {
      await info.attach("failed-requests.txt", {
        body: failedRequests.join("\n"),
        contentType: "text/plain",
      });
    }
    return { consoleErrors, failedRequests };
  };
}
