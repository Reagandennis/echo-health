// ─── Plan allowances ──────────────────────────────────────────────────────────
/**
 * Sessions included in each plan.
 *
 * These are ONE-TIME BUNDLES, not monthly allowances — a purchase buys this many
 * sessions outright. This gates what a client can book, so it is not cosmetic:
 * the previous values (4 / 8 / 4) would have granted four sessions to someone
 * who paid for one.
 */
export const PLAN_SESSIONS: Record<string, number> = {
  individual: 1,
  plus: 2,
  couples: 2,
  free: 1,
};

/**
 * How each plan's price should be described in the UI.
 *
 * Every page previously rendered "/month" while `PriceTag` defaulted to
 * "/ week" — so the same plan advertised two different billing periods
 * depending on where you looked, and neither was true.
 */
export const PLAN_PERIOD_LABELS: Record<string, string> = {
  individual: "per session",
  plus: "for 2 sessions",
  couples: "for 2 sessions",
  free: "trial",
};

export const PLAN_LABELS: Record<string, string> = {
  individual: "Individual",
  plus: "Plus",
  couples: "Couples",
  free: "Free Trial",
};

/**
 * Plan prices in WHOLE KES — the currency the Paystack account settles in.
 *
 * ## These are the PUBLISHED prices, and they are a ceiling
 *
 * Every public page renders these figures, and `/pricing` is statically
 * rendered, so they are the same for every visitor. `lib/pricing.ts` may charge
 * a country LESS than the figure here and may never charge more — a cached page
 * advertising KES 2,000 to a reader who is then billed more is a
 * price-transparency breach, whereas billing them less is a courtesy. The
 * therapist's accrual is measured against these, never against a regional band.
 *
 * Fixed figures, deliberately not derived from a live exchange rate. A converted
 * price moves daily, which means the amount shown can differ from the amount
 * charged and refunds stop matching the original transaction.
 *
 * The minor-unit conversion (× 100) happens once, in `lib/paystack.ts`, so it
 * cannot be applied twice — doing so would charge 100× the intended amount.
 *
 * Approximate USD equivalents at the time of writing, for reference only:
 *   individual  KES 2,000  ≈ $15
 *   plus        KES 3,500  ≈ $27
 *   couples     KES 5,000  ≈ $38
 */
export const PLAN_CURRENCY = "KES" as const;

export const PLAN_PRICES: Record<string, number> = {
  individual: 2000,
  plus: 3500,
  couples: 5000,
  free: 0,
};

/**
 * The KES charge, as prose.
 *
 * ## Why the locale is `"en"` and not `"en-KE"`
 *
 * `en-KE` renders `KES 2000` as **"Ksh 2,000"** — the local symbol. That is
 * the right answer for a reader in Nairobi and an opaque one for the twelve
 * other markets in `lib/markets.ts`: "Ksh" is not a string a client in Toronto
 * or Riyadh can identify, and a price they cannot identify is a price they do
 * not trust. `"en"` renders the ISO code, **"KES 2,000"**, which is
 * unambiguous everywhere and is what the rest of the copy calls it.
 *
 * This is for PROSE — the amount actually charged. It is not the localised
 * browsing figure: `lib/useCurrency.ts` and `PriceTag` handle that, showing an
 * approximate amount in the reader's own currency with this exact figure
 * alongside it. Do not use one where the other belongs; the distinction is
 * what keeps "≈ $15" from becoming a chargeback.
 *
 * It previously lived as a copy-pasted `money()` in ten page files, which is
 * ten places for a currency decision to drift.
 */
export function formatKes(amount: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: PLAN_CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Guard flag: real prices are configured, so live charges are permitted.
 *
 * Set back to `false` if these ever revert to placeholders — `assertPricesConfigured()`
 * blocks the payment path while it is false, because a customer charged a
 * placeholder is a refund and a trust problem that nobody notices until someone
 * reconciles the ledger.
 */
export const PLAN_PRICES_CONFIGURED = true;

/**
 * Share of a session's price paid to the therapist. The remainder is platform
 * revenue.
 *
 * Held as a fraction rather than a percentage so it is used directly in
 * arithmetic — `amount * 0.4`, never `amount * 40 / 100` with a stray division
 * somewhere down the line.
 */
export const THERAPIST_REVENUE_SHARE = 0.4;

/**
 * Whether the therapist's 40% is calculated on the plan's LIST price or on the
 * discounted price the client actually paid.
 *
 * `true`  → the clinician is paid the same for the same 50 minutes, always.
 * `false` → the clinician's pay moves with whatever promotion marketing is running.
 *
 * WHAT THIS COSTS, stated plainly, so the choice is made with the number in
 * front of you rather than discovered later. Individual plan, KES 2,000,
 * 50%-off promo, ~2.9% payment-processing fee:
 *
 *                        client pays   therapist   platform   contribution
 *   no promo                   2,000         800      1,200      60% (~57% net)
 *   50% off, paid on LIST      1,000         800        200      20% (~17% net)
 *   50% off, paid on DISCOUNT  1,000         400        600      60% (~57% net)
 *
 * So `true` costs roughly 40 points of contribution margin on every discounted
 * session — on a deep enough discount the platform can even clear less than the
 * clinician does. That is a real cost and flipping this to `false` is a
 * legitimate business decision.
 *
 * It defaults to `true` because the alternative has a cost that does not appear
 * on any dashboard: under `false`, 40% of every promotion is financed by the
 * therapist, who did not authorise the discount, cannot see that it was applied,
 * and cannot decline it. A clinician's rate silently changing because someone
 * else ran a campaign is the kind of thing that ends in a contractor-pay
 * dispute, and "the pricing page decided your wages" is not a defensible answer.
 *
 * Changing this is not retroactive: `payout_ledger` stores the amount owed as a
 * fact at accrual time, so flipping the flag re-prices future sessions only and
 * never rewrites what a therapist has already earned.
 *
 * ## Regional pricing is the same problem wearing a different hat
 *
 * `lib/pricing.ts` charges some countries a lower KES amount. Everything above
 * applies to it unchanged, and for the same reason: a clinician in Nairobi must
 * not earn less for the same 50 minutes because their client happens to be in
 * Kampala. They did not set the band, cannot see which one applied, and cannot
 * decline it.
 *
 * So `LIST` means the figure in `PLAN_PRICES` — the standard, published,
 * Kenya-anchored price — not the regional band and not the charged amount. The
 * cost of that is a further ~17 to ~33 points of contribution margin on a
 * discounted tier, and at both discounted tiers the platform already clears
 * less per session than the clinician does. The table is in `lib/pricing.ts`;
 * read it there rather than rediscovering it from a dashboard.
 */
export const THERAPIST_PAID_ON_LIST_PRICE = true;

/**
 * The LIST value of ONE session under `plan`, in MINOR units (KES cents).
 *
 * Minor units because this feeds `payout_ledger.gross_minor`, and money is
 * integers everywhere past the pricing layer — see the note on
 * `payments.amount_minor`. Bundles divide: Plus is KES 3,500 for two sessions,
 * so one session lists at 175,000 minor, not 350,000.
 *
 * Returns null for an unknown plan rather than 0. A missing plan means the
 * caller cannot establish what the session was worth, and silently accruing
 * zero would record "this therapist earned nothing" as though it were measured.
 *
 * ## IT TAKES A PLAN AND NOTHING ELSE. KEEP IT THAT WAY.
 *
 * This is the function that feeds `payout_ledger.gross_minor`, so its signature
 * is the mechanism by which a regional price would reach clinician pay: add a
 * `tier` (or a country, or a `chargedMinor`) parameter and every therapist in
 * Nairobi starts earning less for clients in Kampala, retroactively invisible
 * because the ledger stores the number as a fact at accrual time. There is a
 * test asserting the arity for that reason. `lib/pricing.ts` computes what the
 * CLIENT pays; this computes what the SESSION was worth, and they are allowed
 * to differ — see `THERAPIST_PAID_ON_LIST_PRICE` above.
 */
export function listPriceMinorPerSession(plan: string): number | null {
  const price = PLAN_PRICES[plan];
  if (price === undefined) return null;
  const sessions = Math.max(1, PLAN_SESSIONS[plan] ?? 1);
  return Math.round((price * 100) / sessions);
}

/**
 * The therapist's cut of a session, in MINOR units.
 *
 * The minor-unit twin of `therapistEarnings`. Rounding happens once, here, and
 * the result is stored — `payout_ledger` never recomputes it, so a later change
 * to `THERAPIST_REVENUE_SHARE` cannot silently restate past earnings.
 */
export function therapistShareMinor(grossMinor: number): number {
  return Math.round(grossMinor * THERAPIST_REVENUE_SHARE);
}

/** Discount applied by a valid promo code, as a percentage of the plan price. */
export const PROMO_DISCOUNT_PERCENT = 50;

/**
 * Therapist earnings for a session, in whole KES.
 *
 * Rounded to whole currency units because payouts are made in them; leaving
 * fractional shillings to accumulate across thousands of sessions is how ledgers
 * stop reconciling.
 */
export function therapistEarnings(sessionAmount: number): number {
  return Math.round(sessionAmount * THERAPIST_REVENUE_SHARE);
}

/**
 * Price after a promo, in whole currency units.
 *
 * `percent` comes from the promo row so each code can carry its own discount;
 * `PROMO_DISCOUNT_PERCENT` is the fallback for codes that do not set one.
 * Clamped because a negative or >100 value in the database would otherwise
 * produce a negative charge.
 *
 * A non-finite `percent` is treated as **no discount at all**, not as zero-ish.
 * `Math.min(100, Math.max(0, NaN))` is `NaN`, so without this line a NaN
 * propagates through the charge into `toMinorUnits` and reaches Paystack as
 * `amount: NaN` — the failure being that it is not a smaller price, it is not a
 * price. Failing towards the full price is the recoverable direction: an
 * unapplied discount is a support ticket, a NaN is a broken checkout.
 *
 * Callers pass the **list** price, not a regionally-banded one: discounts do
 * not compound. `amountToChargeKes()` in `lib/pricing.ts` takes the lower of
 * this result and the band, and explains why stacking them loses money.
 */
export function applyPromoDiscount(
  price: number,
  percent: number = PROMO_DISCOUNT_PERCENT
): number {
  const safe = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return Math.round(price * (1 - safe / 100));
}

/**
 * Guards the payment initialisation path.
 *
 * Charging a placeholder is worse than failing: a customer billed KES 69 for a
 * KES 8,900 plan is a refund, a support ticket and a trust problem, and it will
 * not be noticed until someone reconciles the ledger. Failing loudly at the
 * point of purchase is recoverable in a way that a wrong charge is not.
 *
 * This is the BASE-PRICE half of the guard, and it still means exactly what it
 * says. Regional bands add a second way for the price table to be wrong while
 * looking fine, so the payment path calls `assertPricingConfigured()` in
 * `lib/pricing.ts` — which runs this first and then validates every band
 * against `PLAN_PRICES`. Keep this one as the check on `PLAN_PRICES` itself.
 */
export function assertPricesConfigured(): void {
  if (!PLAN_PRICES_CONFIGURED) {
    throw new Error(
      "Plan prices are still placeholders. Set real KES amounts in " +
        "lib/constants.ts and flip PLAN_PRICES_CONFIGURED to true before " +
        "accepting payments."
    );
  }
}

// ─── Emergency hotlines ───────────────────────────────────────────────────────
/**
 * Crisis resources, rendered by `app/crisis/page.tsx`.
 *
 * THIS IS THE HIGHEST-CONSEQUENCE DATA IN THE REPOSITORY. Someone reads it
 * while deciding whether to stay alive. A wrong number is not a cosmetic bug —
 * it is a dead end at the worst possible moment. Two rules follow:
 *
 *   1. EVERY number here was verified at the operating organisation's OWN live
 *      site (or a government/major-institution source), and the `source` field
 *      records where. Do not add an entry without one. Aggregator sites and
 *      blog posts are not sources — the previous version of this list was
 *      seeded from them and every entry was US-only, on a platform whose
 *      clinicians are in Nairobi.
 *   2. Never round an availability claim UP. "09:00–17:00" must not become
 *      "24/7" for visual symmetry, and a paid private line must not be listed
 *      beside free ones without saying so. An unanswered call from someone who
 *      was told the line was open is worse than not listing it.
 *
 * WHAT THIS LIST DELIBERATELY DOES NOT DO: enumerate emergency numbers for
 * every country. Publishing an unverified emergency number is the specific
 * failure this rewrite exists to fix. Everywhere not covered below is served by
 * `CRISIS_DIRECTORY_URL`, which geolocates and is maintained by people who do
 * this full time.
 */
export interface CrisisService {
  readonly name: string;
  /** Displayed exactly as written. */
  readonly contact: string;
  /** `tel:` / `sms:` / `https:` — what the card actually links to. */
  readonly href: string;
  readonly description: string;
  /** Verbatim from the source. Never inferred, never rounded up. */
  readonly availability: string;
  /** Stated when it is not free, so nobody is surprised at the worst moment. */
  readonly cost?: string;
  /** Who it is for, when that is narrower than "anyone". */
  readonly scope?: string;
  /** Where this was verified. Required. */
  readonly source: string;
}

/**
 * Where to send anyone outside the regions listed below — which, on a global
 * platform, is most people.
 *
 * Find A Helpline geolocates, is current, and marks each listing "verified by
 * this helpline". IASP has RETIRED its own crisis-centre directory and now
 * points at this, so it is effectively the authoritative international index.
 * The previous link here (`iasp.info/resources/Crisis_Centres/`) is that retired
 * page; the page it replaced on the crisis route was a plain-HTTP link to
 * `suicide.org`.
 */
export const CRISIS_DIRECTORY_URL = "https://findahelpline.com";

export const CRISIS_REGIONS: ReadonlyArray<{
  readonly region: string;
  /** Emergency services, listed separately because they are the first call. */
  readonly emergency: { readonly numbers: string; readonly note: string; readonly source: string };
  readonly services: ReadonlyArray<CrisisService>;
}> = [
  {
    region: "Kenya",
    emergency: {
      numbers: "999 · 112 · 911",
      // All three are published together in the National Police Service site
      // header. NPS does not distinguish mobile from landline and no
      // authoritative Kenyan source does, so this claims nothing about which
      // works from what.
      note:
        "All three reach the National Police Service. For an ambulance, dial 999 — " +
        "but Kenya has no single national ambulance number, so Kenya Red Cross (1199) " +
        "is often the faster route.",
      source: "https://nationalpolice.go.ke/",
    },
    services: [
      {
        name: "Kenya Red Cross",
        contact: "1199",
        href: "tel:1199",
        description:
          "National emergency line and ambulance dispatch. This is an emergency service, not a counselling line.",
        availability: "Any time",
        cost: "Toll-free",
        source: "https://redcross.or.ke/contact-us/",
      },
      {
        name: "NACADA Helpline",
        contact: "1192",
        href: "tel:1192",
        description:
          "Government helpline offering counselling and referrals. Framed around drugs and alcohol, but staffed for counselling generally — the only free, national, round-the-clock counselling line in the country.",
        availability: "24 hours, every day",
        cost: "Free",
        source: "https://nacada.go.ke/",
      },
      {
        name: "Befrienders Kenya",
        contact: "+254 722 178 177",
        href: "tel:+254722178177",
        description:
          "Kenya's dedicated suicide-prevention service. Answers by phone, SMS and WhatsApp on the same number.",
        // 09:00–17:00 and NOT 24/7. Sources disagree on which DAYS (Befrienders
        // Worldwide says Mon–Sun, Find A Helpline says Mon–Fri), so this states
        // only the hours both agree on. Their own website is dead and the apex
        // domain redirects to an unrelated broadband company, so it is
        // deliberately not linked anywhere on the page.
        availability: "09:00–17:00 — not overnight",
        source: "https://befrienders.org/find-support-now/befrienders-kenya/",
      },
      {
        name: "Childline Kenya",
        contact: "116",
        href: "tel:116",
        description: "National helpline for children and young people, with a 24-hour counsellor on the line.",
        availability: "24 hours",
        cost: "Toll-free",
        scope: "Under 18s",
        source: "https://www.childlinekenya.co.ke/contact-us/",
      },
      {
        name: "Chiromo Hospital Group",
        contact: "+254 20 3971 000",
        href: "tel:+254203971000",
        description: "Private psychiatric hospital with a round-the-clock emergency mental health team.",
        availability: "24/7",
        cost: "Paid — private hospital, not a free crisis line",
        source: "https://chiromohospitalgroup.co.ke/",
      },
    ],
  },
  {
    region: "United States",
    emergency: {
      numbers: "911",
      note: "For immediate danger to life.",
      source: "https://www.usa.gov/emergency-services",
    },
    services: [
      {
        name: "988 Suicide & Crisis Lifeline",
        contact: "988",
        href: "tel:988",
        description: "Free, confidential support for anyone in distress. Call or text. Veterans can press 1.",
        availability: "24/7",
        cost: "Free",
        source: "https://988lifeline.org/",
      },
      {
        name: "Crisis Text Line",
        contact: "Text HOME to 741741",
        href: "sms:741741",
        description: "Text with a trained volunteer crisis counsellor.",
        availability: "24/7",
        cost: "Free",
        source: "https://www.crisistextline.org/",
      },
      {
        name: "The Trevor Project",
        contact: "1-866-488-7386",
        href: "tel:+18664887386",
        description: "Crisis intervention and suicide prevention for LGBTQ+ young people.",
        availability: "24/7",
        cost: "Free",
        scope: "LGBTQ+ under 25s",
        source: "https://www.thetrevorproject.org/get-help/",
      },
    ],
  },
];

// ─── Resource library ─────────────────────────────────────────────────────────
export const RESOURCE_ARTICLES = [
  { id: "r1", title: "Understanding Anxiety: Signs, Symptoms & Coping Strategies", tag: "Anxiety", type: "article", readTime: "5 min", date: "Apr 20, 2026", therapistPick: true },
  { id: "r2", title: "How to Prepare for Your First Therapy Session", tag: "Getting Started", type: "article", readTime: "4 min", date: "Apr 15, 2026", therapistPick: false },
  { id: "r3", title: "The Science Behind Mindfulness & Mental Health", tag: "Mindfulness", type: "article", readTime: "6 min", date: "Apr 10, 2026", therapistPick: true },
  { id: "r4", title: "Couples Therapy: When to Seek Help & What to Expect", tag: "Relationships", type: "article", readTime: "5 min", date: "Apr 5, 2026", therapistPick: false },
  { id: "r5", title: "CBT Thought Record Worksheet", tag: "CBT", type: "worksheet", readTime: "10 min exercise", date: "Mar 30, 2026", therapistPick: true },
  { id: "r6", title: "5-Minute Body Scan Meditation", tag: "Mindfulness", type: "exercise", readTime: "5 min", date: "Mar 25, 2026", therapistPick: false },
  { id: "r7", title: "Understanding the PHQ-9 Depression Scale", tag: "Education", type: "article", readTime: "3 min", date: "Mar 20, 2026", therapistPick: false },
  { id: "r8", title: "Sleep Hygiene Guide for Mental Wellness", tag: "Habits", type: "guide", readTime: "7 min", date: "Mar 15, 2026", therapistPick: true },
];

// ─── Mood emoji scale ─────────────────────────────────────────────────────────
export const MOOD_EMOJIS = [
  { score: 1, emoji: "😞", label: "Very low" },
  { score: 2, emoji: "😔", label: "Low" },
  { score: 3, emoji: "😕", label: "Below average" },
  { score: 4, emoji: "😐", label: "Neutral" },
  { score: 5, emoji: "🙂", label: "Okay" },
  { score: 6, emoji: "😊", label: "Good" },
  { score: 7, emoji: "😄", label: "Great" },
  { score: 8, emoji: "😁", label: "Very good" },
  { score: 9, emoji: "🤩", label: "Excellent" },
  { score: 10, emoji: "🌟", label: "Amazing" },
] as const;

export const MOOD_TAGS = [
  "Anxious", "Calm", "Tired", "Energetic", "Sad", "Happy", "Stressed",
  "Grateful", "Irritable", "Focused", "Overwhelmed", "Hopeful",
];

// ─── Placeholder therapist (until matching feature ships) ──────────────────────
export const PLACEHOLDER_THERAPIST_ID = "therapist-placeholder-001";
