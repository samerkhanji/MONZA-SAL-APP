// ============================================================================
// Detection of sensitive *final-action* controls in tours.
//
// In interactive mode a tour must never auto-advance on (and thereby trick the
// user into firing) an approve / reject / refund-pay / delete / void / scrap /
// mark-paid / close-drawer action. We match action VERBS as discrete tokens,
// never module names — so a refunds search box or a "Back" button on the
// refunds page is not mistaken for the Approve button.
// ============================================================================

/** Patterns for a selector / element id / data-tour-id. */
export const SENSITIVE_ID_PATTERNS: RegExp[] = [
  /(^|[-_])(approve|reject|void|delete|deactivate|terminate|finalize|scrap|discard|pay)([-_]|$)/i,
  /mark-?paid/i,
  /confirm-?paid/i,
  /close-?drawer/i,
  /cancel-(po|request)/i,
  /remove-(line|part|item|vehicle|car)/i,
];

/** Patterns for rendered button text (word-level). */
export const SENSITIVE_TEXT_PATTERNS: RegExp[] = [
  /\b(approve|reject|void|delete|deactivate|finalize|scrap|discard)\b/i,
  /mark\s*as?\s*paid/i,
  /close\s*drawer/i,
];

export function isSensitiveSelector(value: string | null | undefined): boolean {
  return !!value && SENSITIVE_ID_PATTERNS.some((re) => re.test(value));
}

export function isSensitiveText(value: string | null | undefined): boolean {
  return !!value && SENSITIVE_TEXT_PATTERNS.some((re) => re.test(value));
}
