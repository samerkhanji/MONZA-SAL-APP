// Page tours — the per-page guides. Source of truth for the collection is the
// registry (which imports the individual page-*.ts files and keys them by
// route); this module exposes them under the v3 architecture name.
import type { Tour } from "./types";
import { getAllPageTours, getRawPageTours } from "./registry";

/** Every page tour across all routes. */
export const allPageTours: Tour[] = getAllPageTours();

/** Page tour(s) registered for a path (most-specific route key wins). */
export { getRawPageTours as getPageToursForRoute };
