import { PLAN_CURRENCY } from "@/lib/constants";

/**
 * Money formatting for the admin console.
 *
 * ONE unit throughout: minor units (KES cents), which is what the `payments`
 * ledger stores and what Paystack's API speaks. Anything sourced in whole
 * shillings — `therapy_sessions.amount` is the only such column — is converted
 * at the query boundary in `_lib/queries.ts` rather than by a second formatter
 * here. Two near-identical money helpers is how the wrong one eventually gets
 * called, and a 100× error on a payout screen looks entirely plausible.
 *
 * The currency is not cosmetic. Every billing screen used to render `$` on an
 * account that settles in KES, so an operator reading "$4,320" against a real
 * KES balance was out by roughly two orders of magnitude — in the direction
 * that still looks like a believable number.
 */

/** Whole shillings, with cents shown only when a row actually has them. */
const KES = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: PLAN_CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Abbreviated, for chart axes and tiles where the exact shilling is noise. */
const KES_COMPACT = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: PLAN_CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Format a minor-unit (KES cents) amount for display. */
export function formatKes(amountMinor: number): string {
  return KES.format(amountMinor / 100);
}

/** Format a minor-unit (KES cents) amount abbreviated — "KSh 12K". */
export function formatKesCompact(amountMinor: number): string {
  return KES_COMPACT.format(amountMinor / 100);
}
