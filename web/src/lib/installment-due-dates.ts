/**
 * Compute installment due date for a month offset from plan start,
 * clamping due_day to the last day of the month (e.g. day 31 → Feb 28/29).
 */
export function installmentDueDateIso(
  planStartDateYmd: string,
  monthOffset: number,
  dueDay: number
): string {
  const base = new Date(`${planStartDateYmd}T12:00:00`);
  const y = base.getFullYear();
  const m = base.getMonth() + monthOffset;
  const firstOfTarget = new Date(y, m, 1);
  const y2 = firstOfTarget.getFullYear();
  const m2 = firstOfTarget.getMonth();
  const daysInMonth = new Date(y2, m2 + 1, 0).getDate();
  const day = Math.min(Math.max(1, dueDay), daysInMonth);
  // Format directly from the parts — never round-trip through toISOString(),
  // which converts local midnight to UTC and shifts the day backwards in
  // positive-offset timezones (e.g. Lebanon, UTC+2/+3).
  const mm = String(m2 + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${y2}-${mm}-${dd}`;
}
