// Copies Tesseract.js runtime assets (worker + WASM cores) from node_modules
// into public/tesseract/ so the OCR VIN scanner can self-host them.
//
// Why: the app's CSP uses 'strict-dynamic' and has no CDN allow for scripts/
// WASM, so Tesseract's default CDN-hosted worker + core are blocked. Serving
// them from our own origin ('self') makes them load under the policy. The
// language data (eng.traineddata.gz) is fetched at runtime from the jsDelivr
// CDN, which we allow narrowly in connect-src (it's a data fetch, not script).
//
// Runs as the first step of `npm run build` (see package.json). Idempotent.

import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dest = join(root, "public", "tesseract");

const worker = join(root, "node_modules", "tesseract.js", "dist", "worker.min.js");
const coreDir = join(root, "node_modules", "tesseract.js-core");

// LSTM-only cores (Tesseract.js v7 default). We ship the plain + SIMD + relaxed
// SIMD variants so the worker can pick whichever the device supports.
const coreFiles = [
  "tesseract-core-lstm.wasm",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
];

function copy(src, dst) {
  if (!existsSync(src)) {
    console.error(`[copy-tesseract-assets] MISSING source: ${src}`);
    process.exit(1);
  }
  copyFileSync(src, dst);
}

mkdirSync(dest, { recursive: true });
copy(worker, join(dest, "worker.min.js"));
for (const f of coreFiles) copy(join(coreDir, f), join(dest, f));

console.log(`[copy-tesseract-assets] copied worker + ${coreFiles.length} core files → public/tesseract/`);
