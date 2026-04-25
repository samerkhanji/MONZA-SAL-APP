import { useEffect, useState } from "react";

/**
 * Returns a debounced view of `value` that only updates after `delayMs` of
 * inactivity. Use it to feed expensive `useMemo` filters from a fast-changing
 * search input, so a 500-row table doesn't re-sort on every keystroke.
 *
 * @example
 *   const [search, setSearch] = useState("");
 *   const debouncedSearch = useDebouncedValue(search, 250);
 *   const filtered = useMemo(() => list.filter(byQuery(debouncedSearch)), [list, debouncedSearch]);
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
