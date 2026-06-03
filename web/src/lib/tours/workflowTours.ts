// Workflow tours — cross-page, task-oriented guides. Exposed under the v3
// architecture name; the collection is owned by the registry.
import type { Tour } from "./types";
import { getAllWorkflowTours } from "./registry";

/** Every workflow tour. */
export const allWorkflowTours: Tour[] = getAllWorkflowTours();
