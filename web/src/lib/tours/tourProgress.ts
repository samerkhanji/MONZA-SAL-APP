// ============================================================================
// Per-user tour progress, stored in localStorage.
//
// We key by tour id and (best-effort) by user id so multiple profiles on one
// device don't clobber each other. If/when a profile-preferences table exists,
// this module is the single place to swap the backend.
// ============================================================================

export type TourProgress = {
  /** true once the user reached the final step. */
  completed: boolean;
  /** highest step index the user reached (0-based). */
  lastStep: number;
  /** total steps the run had (so we can show "3 / 8"). */
  totalSteps: number;
  /** ISO timestamp of the last update. */
  updatedAt: string;
};

export type TourStatus = "not-started" | "in-progress" | "completed";

const KEY_PREFIX = "monza:tour-progress:v1:";

function keyFor(userId: string | null | undefined): string {
  return `${KEY_PREFIX}${userId ?? "anon"}`;
}

function readAll(userId: string | null | undefined): Record<string, TourProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as Record<string, TourProgress>) : {};
  } catch {
    return {};
  }
}

function writeAll(
  userId: string | null | undefined,
  data: Record<string, TourProgress>
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(data));
  } catch {
    // storage full / disabled — progress is best-effort, never block the tour.
  }
}

export function getTourProgress(
  userId: string | null | undefined,
  tourId: string
): TourProgress | null {
  return readAll(userId)[tourId] ?? null;
}

export function getAllTourProgress(
  userId: string | null | undefined
): Record<string, TourProgress> {
  return readAll(userId);
}

export function getTourStatus(
  userId: string | null | undefined,
  tourId: string
): TourStatus {
  const p = getTourProgress(userId, tourId);
  if (!p) return "not-started";
  if (p.completed) return "completed";
  return "in-progress";
}

/**
 * Record where a run ended. `reachedLast` marks the tour completed; otherwise
 * we remember the abandoned step so the panel can offer "Resume".
 */
export function recordTourProgress(
  userId: string | null | undefined,
  tourId: string,
  lastStep: number,
  totalSteps: number,
  reachedLast: boolean
): void {
  const all = readAll(userId);
  const prev = all[tourId];
  all[tourId] = {
    completed: reachedLast || prev?.completed === true,
    lastStep,
    totalSteps,
    updatedAt: new Date().toISOString(),
  };
  writeAll(userId, all);
}
