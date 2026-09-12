import "server-only";

import {
  PLAN_PRICES,
  PLAN_SESSIONS,
  THERAPIST_REVENUE_SHARE,
  applyPromoDiscount,
  assertPricesConfigured,
  formatKes,
} from "@/lib/constants";
import { MARKETS, type Market } from "@/lib/markets";

/**
 * ── Regional pricing ───────────────────────────────────────────────────────
 *
 * Echo's clinicians are in Kenya; its clients are in the thirteen markets in
 * `lib/markets.ts`. Until now every client paid the same `PLAN_PRICES` figure.
 * This module is where a *different KES amount for a different country* is
 * decided, and it is the only place that decision is made.
 *
 * Four properties hold it together. Break any one of them and it is a money
 * bug rather than a layout bug, so each is stated and each is checked.
 *
 * ## 1. A tier is a different KES AMOUNT, never a different currency
 *
 * Paystack settles in KES. `lib/paystack.ts` converts whole KES to minor units
 * exactly once and warns that doing it twice charges 100×. So a band here is a
 * smaller number of shillings — nothing more. A second settlement currency
 * needs a second PSP and is out of scope.
 *
 * `lib/useCurrency.ts` already turns a KES figure into an approximate local one
 * for display, and `PriceTag` already prints the exact KES charge beside it.
 * That machinery is untouched and unduplicated: it converts whatever amount it
 * is handed.
 *
 * ## 2. The amount is decided HERE, on the server, from a request header
 *
 * `lib/useCurrency.ts` detects a country by calling `ipapi.co` **from the
 * browser**. That is display-only and completely untrusted. If a charged amount
 * were ever derived from it, a visitor would pick their own price. Nothing in
 * this module reads a request body, a query string, a cookie or a client
 * hint — see `resolveMarket` for what it does read and how much that is worth.
 *
 * ## 3. A TIER MAY ONLY LOWER THE PRICE, NEVER RAISE IT
 *
 * Checked by `validatePricing()` and enforced again by `amountToChargeKes()`.
 * The reason is a rendering constraint with a consumer-law edge:
 * `/pricing` is statically rendered (see AGENTS.md on the marketing route
 * group — nothing in that layout may read headers, which is what keeps all
 * thirteen public pages cacheable), so the figure on the public page is the
 * SAME figure for every visitor, and it is the standard one. If a tier could
 * raise the price, a visitor in London would read KES 2,000 on a cached page
 * and be charged more at checkout. Undercharging against a published price is
 * a courtesy; overcharging against one is a price-transparency breach and a
 * chargeback.
 *
 * The corollary, stated so nobody has to discover it: **charging high-income
 * markets MORE is not possible with this design.** Doing it would mean
 * resolving the country before the pricing page renders — which means either
 * a dynamic `/pricing` or a `Vary: CF-IPCountry` on a cached one, and a
 * `Vary` that is forgotten serves one country's prices to everybody. That is
 * the trade this ceiling buys out of, and it is why the bands below only go
 * down.
 *
 * ## 4. The therapist's pay does not move. See the arithmetic below.
 *
 * `listPriceMinorPerSession()` in `lib/constants.ts` is what feeds
 * `payout_ledger`, it takes a plan and nothing else, and no value from this
 * module is passed to it. A clinician's fee cannot change because their client
 * happens to be in Ghana.
 *
 * ### What that costs, with the numbers visible
 *
 * `THERAPIST_PAID_ON_LIST_PRICE` states the same choice for promotions and
 * gives its table; this is the regional-pricing half of it. Individual plan:
 * list KES 2,000, therapist paid 40% of LIST = KES 800, ~2.9% processing fee.
 *
 *                        client pays   therapist   platform   contribution
 *   standard                   2,000         800      1,200      60% (~57% net)
 *   reduced                    1,400         800        600      43% (~40% net)
 *   lowest                     1,100         800        300      27% (~24% net)
 *   lowest + 50% promo         1,000         800        200      20% (~17% net)
 *
 * Read the crossover off that table rather than being surprised by it later:
 * the platform clears less than the clinician below KES 1,600 a session, so at
 * BOTH discounted tiers it already does. At the `lowest` tier the platform
 * keeps 300 of 1,100 and the therapist takes 800. That is the price of not
 * financing regional pricing out of clinician pay, and it is a deliberate
 * choice, not an oversight — the alternative charges a Nairobi therapist for a
 * discount granted to a client in Kampala, which they did not authorise and
 * cannot see.
 *
 * The last row is bounded on purpose: a promo and a tier do not compound. See
 * `amountToChargeKes`.
 *
 * ## The bands are a STARTING POINT, not a derived result
 *
 * These three amounts and the countries in them are a product decision. No
 * affordability index, GNI series or PPP table was consulted, and none is
 * cited, because none was read. Three bands rather than thirteen prices is
 * also deliberate: thirteen prices is thirteen things to keep in step and a
 * support conversation every time two clients compare receipts.
 *
 * Whoever owns pricing should set these. What the code guarantees is that
 * whatever they set stays internally consistent (`validatePricing`), never
 * exceeds the published price, and never reaches payroll.
 */

/** Band ids. Deliberately about price level, not about geography. */
export type PriceTierId = "standard" | "reduced" | "lowest";

export interface PriceTier {
  readonly id: PriceTierId;
  /** For support, the admin surface and the public disclosure on `/pricing`. */
  readonly label: string;
  /** Whole KES per plan, keyed exactly like `PLAN_PRICES`. */
  readonly prices: Readonly<Record<string, number>>;
  /**
   * ISO 3166-1 alpha-2 codes this band applies to.
   *
   * Empty on `standard`, which is the default for every country not named in
   * another band — including the ~180 with no market entry at all, and every
   * request whose country could not be established.
   */
  readonly countries: readonly string[];
}

export const PRICE_TIERS: readonly PriceTier[] = [
  {
    id: "standard",
    label: "Standard",
    // The published list price, unchanged. Kenya pays this: it is the
    // therapists' own market and the anchor every other band is cut from.
    prices: { individual: 2000, plus: 3500, couples: 5000, free: 0 },
    countries: [],
  },
  {
    id: "reduced",
    label: "Reduced",
    prices: { individual: 1400, plus: 2500, couples: 3600, free: 0 },
    countries: ["NG", "GH"],
  },
  {
    id: "lowest",
    label: "Lowest",
    prices: { individual: 1100, plus: 1900, couples: 2800, free: 0 },
    countries: ["UG", "TZ", "RW"],
  },
];

const DEFAULT_TIER: PriceTierId = "standard";

export function priceTier(id: PriceTierId): PriceTier {
  // Non-null: `PriceTierId` is a closed union over the array above, and
  // `validatePricing()` fails loudly if an id ever goes missing from it.
  return PRICE_TIERS.find((t) => t.id === id)!;
}

/** The band a country falls in. Anything unrecognised gets the standard price. */
export function tierForCountry(iso: string | null | undefined): PriceTierId {
  if (!iso) return DEFAULT_TIER;
  const code = iso.toUpperCase();
  return PRICE_TIERS.find((t) => t.countries.includes(code))?.id ?? DEFAULT_TIER;
}

/** The markets in a band, for the disclosure on `/pricing`. */
export function marketsInTier(id: PriceTierId): readonly Market[] {
  const codes = priceTier(id).countries;
  return MARKETS.filter((m) => codes.includes(m.iso));
}

/**
 * The public one-liner: "KES 1,400 in Nigeria and Ghana, and KES 1,100 in
 * Uganda, Tanzania and Rwanda".
 *
 * Lives here, not in a page, because `/pricing` and `/terms` §5 both have to
 * say it and a contract that lists different countries from the pricing page is
 * a dispute rather than a typo. Every band with at least one country appears,
 * so adding a fourth band updates both documents without either being edited.
 *
 * `plan` is the worked example — the Individual session, because it is the
 * figure readers compare. The phrase deliberately carries no percentage: the
 * three plans are not reduced by an identical proportion, so a single "X% off"
 * would be wrong for two of them.
 */
export function describeRegionalBands(plan: string = "individual"): string {
  /* `en-GB`, not `en`: the bare locale inserts an Oxford comma ("Uganda,
     Tanzania, and Rwanda") and the rest of the site's copy does not use one.
     Note this is the opposite of the choice `formatKes` makes for the CURRENCY
     — there, `en` is required to render the ISO code rather than "Ksh". */
  const list = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

  const phrases = PRICE_TIERS.filter((t) => t.countries.length > 0).map((tier) => {
    const kes = tier.prices[plan] ?? PLAN_PRICES[plan] ?? 0;
    const countries = list.format(marketsInTier(tier.id).map((m) => m.country));
    return `${formatKes(kes)} in ${countries}`;
  });

  return phrases.join(", and ");
}

// ─── Resolving the country, server-side ──────────────────────────────────────

/**
 * Where a resolved country came from. Recorded on the analytics event so a
 * revenue anomaly can be traced to a signal rather than guessed at.
 */
export type MarketSource =
  /** A country header from our own network edge, and we are configured to trust it. */
  | "edge-header"
  /** A header was present but `TRUST_EDGE_COUNTRY_HEADER` is not set. Ignored. */
  | "edge-header-untrusted"
  /** No country header on the request at all. */
  | "absent"
  /** A header we could not read as a country: `XX`, `T1`, or malformed. */
  | "unusable";

export interface ResolvedMarket {
  /** ISO 3166-1 alpha-2, or null when nothing trustworthy was available. */
  readonly country: string | null;
  readonly tier: PriceTierId;
  readonly source: MarketSource;
}

/**
 * Headers a CDN edge sets to report the client's country, in preference order.
 *
 * Cloudflare's `CF-IPCountry` first: `cloudflared/config.yml` in this repo is
 * the documented deployment, so it is the one that actually arrives.
 * `x-vercel-ip-country` is listed because Next removed `NextRequest.geo` in
 * v15 ("these values are provided by your hosting provider") and this is the
 * other provider anyone here is likely to deploy to. There is no `geo` object
 * on `NextRequest` in Next 16 to read instead — verified against
 * `node_modules/next/dist/server/web/spec-extension/request.d.ts`.
 */
const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country"] as const;

/**
 * Values a geo provider sends that are not countries.
 *
 * `XX` (could not geolocate) and `T1` (arrived over Tor) are Cloudflare's own;
 * `ZZ`, `A1`, `A2` and `O1` are pseudo-codes other providers emit for
 * anonymising proxies and satellite ranges. `XX` and `ZZ` are the ones that
 * matter, because they are the only two that would otherwise pass the
 * two-letter format test below and be treated as a resolved country. The rest
 * are listed because the rule being expressed is "this is not a country", not
 * "this is not two letters" — a provider could tidy `A1` into `AA` tomorrow.
 */
const NON_COUNTRIES = new Set(["XX", "ZZ", "T1", "A1", "A2", "O1"]);

/**
 * ⚠️ HOW SPOOFABLE IS THIS? Honestly: it depends entirely on deployment, and
 * that is why it is behind an explicit opt-in.
 *
 * `CF-IPCountry` is trustworthy **only** while both of these hold:
 *
 *   1. **The origin is unreachable except through the Cloudflare edge.** The
 *      tunnel in `cloudflared/config.yml` gives exactly that — cloudflared
 *      holds outbound-only connections and nothing inbound is opened on the
 *      VM — so there is no path on which a client's own header survives.
 *      Cloudflare also *overwrites* the `CF-*` request headers, so a visitor
 *      sending `CF-IPCountry: UG` has it replaced, not honoured.
 *   2. **IP Geolocation is enabled on the zone.** If it is off the header is
 *      simply absent, which falls through to the standard tier — the safe
 *      direction.
 *
 * If condition 1 ever stops holding — a port opened on the VM, an Azure App
 * Service hostname reachable directly, `npm run dev` behind anything other
 * than the tunnel — then this header is **100% attacker-controlled** and
 * `curl -H 'cf-ipcountry: UG'` is a 45% discount. Nothing in the code can
 * detect the difference: a spoofed header and a real one are byte-identical.
 *
 * So the trust is declared by the operator, not assumed by the app.
 * `TRUST_EDGE_COUNTRY_HEADER` must be exactly `"true"` (an exact opt-in, as
 * with `DEV_AUTH_ENABLED`); anything else and every request is priced at the
 * standard tier. A wrong-but-safe default beats a spoofable one, and the
 * default here is "charge everyone the published price", which is the worst
 * outcome anyone can engineer by lying to us.
 *
 * What is NOT consulted, and why:
 *   • **The request body / query string.** Client-supplied, and the entire
 *     point. `/api/payments/initialize` takes a plan id and a promo code; it
 *     does not take a country and must not grow one.
 *   • **`Accept-Language`.** A locale is not a location (`en-GB` in Nairobi is
 *     ordinary) and the browser sends whatever it is told to.
 *   • **The request IP + a geo lookup.** There is no geo database in the
 *     process, and calling `ipapi.co` from the server would put a third-party
 *     network dependency on the path that takes money — for an answer a VPN
 *     defeats anyway. `lib/useCurrency.ts` may do that for a *display* guess;
 *     a charge may not.
 */
function edgeCountryTrusted(): boolean {
  return process.env.TRUST_EDGE_COUNTRY_HEADER === "true";
}

export function resolveMarket(request: Request): ResolvedMarket {
  let raw: string | null = null;
  for (const header of COUNTRY_HEADERS) {
    const value = request.headers.get(header);
    if (value) {
      raw = value.trim().toUpperCase();
      break;
    }
  }

  if (!raw) return { country: null, tier: DEFAULT_TIER, source: "absent" };

  /* The header exists but the operator has not vouched for the path it
     travelled. Reported rather than silently dropped: "prices are all standard
     and this is why" is a diagnosable state, an unexplained one is not. */
  if (!edgeCountryTrusted()) {
    return { country: null, tier: DEFAULT_TIER, source: "edge-header-untrusted" };
  }

  if (!/^[A-Z]{2}$/.test(raw) || NON_COUNTRIES.has(raw)) {
    return { country: null, tier: DEFAULT_TIER, source: "unusable" };
  }

  return { country: raw, tier: tierForCountry(raw), source: "edge-header" };
}

// ─── The charged amount ──────────────────────────────────────────────────────

export interface ChargeBreakdown {
  /** The published price: `PLAN_PRICES[plan]`, and the ceiling on everything below. */
  readonly listKes: number;
  /** What this band alone would charge. */
  readonly tierKes: number;
  /** What the client is actually charged, in whole KES. */
  readonly chargeKes: number;
  readonly tier: PriceTierId;
  /** Effective reduction off the published price, for a receipt or an event. */
  readonly effectiveDiscountPercent: number;
}

/**
 * THE amount to charge. One function, so there is one answer.
 *
 * ## A promo and a regional tier do not stack — the client gets whichever is
 * ## better, not both
 *
 * `chargeKes = min(tierPrice, promoPercent off the LIST price)`.
 *
 * Compounding them is the obvious implementation and it is the one that loses
 * money quietly: 50% off the `lowest` tier is KES 550 against a therapist
 * accrual of KES 800, so the platform would pay 250 out of its own pocket for
 * the privilege of processing the transaction, and the receipt would show a
 * charge below the cost of delivering it. Taking the better of the two caps the
 * worst case at the promo-on-list case that `THERAPIST_PAID_ON_LIST_PRICE`
 * already reasoned about and accepted (KES 1,000, 20% contribution) — no new
 * loss-making combination is introduced by adding tiers.
 *
 * It is also what `/terms` §5 already says ("one code per purchase"), and it is
 * explicable at a support desk in one sentence: the code takes 50% off the
 * standard price, which was already more than the regional price took off.
 *
 * Returns null for an unknown plan rather than a number, so a typo cannot be
 * charged. `free` returns a breakdown of zeroes and is rejected further up by
 * the caller's `price <= 0` guard, which is where that decision belongs.
 */
export function amountToChargeKes(params: {
  readonly plan: string;
  readonly tier: PriceTierId;
  /** From the promo ROW, not from the browser. Null when no code applies. */
  readonly promoPercent?: number | null;
}): ChargeBreakdown | null {
  const listKes = PLAN_PRICES[params.plan];
  if (listKes === undefined) return null;

  const tier = priceTier(params.tier);

  /* Falls back to the list price for a plan the band forgot. `validatePricing`
     makes that unreachable; if it ever happens anyway, the published price is
     the safe direction to fail in. */
  const banded = tier.prices[params.plan] ?? listKes;

  /* Property 3 enforced at the point of use as well as at validation: a band
     can only ever reduce. Two layers because this is the one line that decides
     what someone's card is debited. */
  const tierKes = Math.min(Math.max(0, Math.round(banded)), listKes);

  const promoKes =
    params.promoPercent === null || params.promoPercent === undefined
      ? null
      : applyPromoDiscount(listKes, params.promoPercent);

  const chargeKes = promoKes === null ? tierKes : Math.min(tierKes, promoKes);

  return {
    listKes,
    tierKes,
    chargeKes,
    tier: tier.id,
    effectiveDiscountPercent:
      listKes === 0 ? 0 : Math.round(((listKes - chargeKes) / listKes) * 100),
  };
}

// ─── Guards ──────────────────────────────────────────────────────────────────

/**
 * Everything wrong with the tier table, as a list of sentences.
 *
 * Pure and exported so the test suite can assert on the real shipped data
 * rather than on a fixture. Each rule below exists because getting it wrong is
 * silent:
 *
 *   • A plan missing from a band would charge the list price to a country the
 *     business believes is discounted, and nothing would look broken.
 *   • A band ABOVE the list price would charge more than the cached public page
 *     advertises — see property 3 at the top of this file.
 *   • `"UK"` instead of `"GB"` never matches a British visitor, and a band that
 *     matches nobody looks exactly like a band nobody is in.
 *   • A country in two bands takes whichever comes first in array order, which
 *     is not a pricing policy.
 */
export function validatePricing(
  /* Parameterised for the test suite only, which needs to prove each rule
     FIRES — a validator exercised solely against data that passes it is
     indistinguishable from `return []`. Production calls it with no argument. */
  tiers: readonly PriceTier[] = PRICE_TIERS
): readonly string[] {
  const problems: string[] = [];
  const known = new Set(MARKETS.map((m) => m.iso));
  const seen = new Map<string, PriceTierId>();

  for (const id of ["standard", "reduced", "lowest"] as const) {
    if (!tiers.some((t) => t.id === id)) {
      problems.push(`Price tier "${id}" is referenced by PriceTierId but missing from PRICE_TIERS.`);
    }
  }

  for (const tier of tiers) {
    for (const [plan, listKes] of Object.entries(PLAN_PRICES)) {
      const banded = tier.prices[plan];
      if (banded === undefined) {
        problems.push(`Tier "${tier.id}" has no price for plan "${plan}".`);
        continue;
      }
      if (!Number.isFinite(banded) || banded < 0) {
        problems.push(`Tier "${tier.id}" price for "${plan}" is not a non-negative number.`);
      }
      /* A band of zero for a paid plan does not make it free, it makes it
         unbuyable: the payment route rejects a zero charge ("this plan does not
         require payment") and no entitlement is ever granted, so the plan
         silently disappears for that country. */
      if (listKes > 0 && banded === 0) {
        problems.push(
          `Tier "${tier.id}" prices "${plan}" at 0 KES, which the payment route refuses ` +
            `rather than treating as free — the plan would be unbuyable in that tier.`
        );
      }
      if (banded > listKes) {
        problems.push(
          `Tier "${tier.id}" prices "${plan}" at ${banded} KES, above the published ` +
            `list price of ${listKes} KES. A tier may only reduce a price.`
        );
      }
    }

    for (const code of tier.countries) {
      if (!known.has(code)) {
        problems.push(
          `Tier "${tier.id}" names country "${code}", which is not the ISO code of ` +
            `any market in lib/markets.ts.`
        );
      }
      const other = seen.get(code);
      if (other) {
        problems.push(`Country "${code}" appears in both the "${other}" and "${tier.id}" tiers.`);
      } else {
        seen.set(code, tier.id);
      }
    }
  }

  /* Not via `priceTier()`, which asserts the tier exists. This function has to
     be able to report a missing `standard` band rather than throw on it. */
  const standard = tiers.find((t) => t.id === "standard");
  if (standard && standard.countries.length > 0) {
    problems.push(
      `The "standard" tier must not enumerate countries — it is the default for ` +
        `every country no other tier claims.`
    );
  }

  return problems;
}

/**
 * The guard the payment path calls. Both halves of it matter.
 *
 * `assertPricesConfigured()` (`lib/constants.ts`) is the original: it refuses
 * to charge while `PLAN_PRICES` are placeholders, because a customer billed a
 * placeholder is a refund nobody notices until the ledger is reconciled. It is
 * still exactly that check and still means exactly that.
 *
 * Regional pricing adds a second way for the price table to be wrong while
 * looking fine, so this wraps it rather than replacing it. `/api/payments/
 * initialize` calls THIS. A new payment path that calls only the base half
 * would charge from an unvalidated tier table — if you add one, call this.
 */
export function assertPricingConfigured(): void {
  assertPricesConfigured();

  const problems = validatePricing();
  if (problems.length > 0) {
    throw new Error(
      `Regional price tiers are inconsistent, so no amount can be trusted:\n` +
        problems.map((p) => `  • ${p}`).join("\n")
    );
  }
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

/**
 * Whether a charge would clear less for the platform than it accrues to the
 * clinician, and by how much.
 *
 * Exists so the condition is a number in a log line rather than a discovery
 * during a quarterly review. `/api/payments/initialize` warns on it; nothing
 * blocks on it, because it is a business decision the constants above have
 * already made deliberately — see the table at the top of this file.
 *
 * `sessions` divides, so a bundle is compared per session against the
 * per-session accrual: Plus is one charge funding two payouts.
 */
export function platformMarginKes(plan: string, chargeKes: number): {
  readonly therapistKes: number;
  readonly platformKes: number;
  readonly platformClearsLess: boolean;
} | null {
  const listKes = PLAN_PRICES[plan];
  if (listKes === undefined) return null;

  const sessions = Math.max(1, PLAN_SESSIONS[plan] ?? 1);
  /* 40% of the LIST price, matching `THERAPIST_PAID_ON_LIST_PRICE` — the whole
     point being that this number does not move with the tier. */
  const therapistKes = Math.round(listKes * THERAPIST_REVENUE_SHARE);
  const platformKes = chargeKes - therapistKes;

  return {
    therapistKes: Math.round(therapistKes / sessions),
    platformKes: Math.round(platformKes / sessions),
    platformClearsLess: platformKes < therapistKes,
  };
}
