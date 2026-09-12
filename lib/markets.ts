/**
 * ── The markets Echo serves, and what is true in each ─────────────────────
 *
 * ## The distinction this file exists to hold
 *
 * Echo's clinicians are licensed in **Kenya**. Echo's clients are **worldwide**
 * — `lib/constants.ts` says so plainly, in the note on the crisis directory:
 * "on a global platform, [everywhere not listed] is most people."
 *
 * Those two facts were collapsed into one during an earlier pass, and the
 * public site came out reading as a Kenya-only service: a home page titled
 * "online therapy … in Kenya", city pages for Nairobi and Mombasa, and a
 * footer that told every visitor on earth to dial 999. Kenya is where the
 * SUPPLY is. It is not who the market is.
 *
 * So every market below carries `locallyLicensed`, and for twelve of the
 * thirteen it is `false`. A client in Toronto is not getting an
 * Ontario-registered therapist and needs to be told that before they pay, not
 * after. That is the single most important field here.
 *
 * ## Time zones are computed, never typed
 *
 * `hoursFromEat()` derives the offset from the IANA zone at the moment of
 * render. Hand-written offsets would be wrong for four of these thirteen
 * markets for part of every year: the UK, US and Canada all observe DST while
 * Kenya does not, so the gap to Nairobi *changes* — London is 3 hours behind
 * in January and 2 in July. A literal would be silently wrong for months.
 */

export interface Market {
  readonly slug: string;
  readonly country: string;
  /** IANA zone. For multi-zone countries, the most populous one. */
  readonly zone: string;
  /** Shown to the reader when the country spans more than one zone. */
  readonly zoneNote?: string;
  /** ISO 4217, for "you will be charged in KES, your bank converts from this". */
  readonly currency: string;
  /** True in Kenya only. The whole reason this field exists. */
  readonly locallyLicensed: boolean;
  /** M-Pesa is a real option in some markets and meaningless in others. */
  readonly mpesa: boolean;
  readonly region: "East Africa" | "West & Southern Africa" | "Europe & North America" | "Gulf";
}

export const MARKETS: readonly Market[] = [
  // ── East Africa — same or near-same clock as the therapists ──────────────
  { slug: "kenya",         country: "Kenya",          zone: "Africa/Nairobi",        currency: "KES", locallyLicensed: true,  mpesa: true,  region: "East Africa" },
  { slug: "uganda",        country: "Uganda",         zone: "Africa/Kampala",        currency: "UGX", locallyLicensed: false, mpesa: true,  region: "East Africa" },
  { slug: "tanzania",      country: "Tanzania",       zone: "Africa/Dar_es_Salaam",  currency: "TZS", locallyLicensed: false, mpesa: true,  region: "East Africa" },
  { slug: "rwanda",        country: "Rwanda",         zone: "Africa/Kigali",         currency: "RWF", locallyLicensed: false, mpesa: true,  region: "East Africa" },

  // ── West & Southern Africa ───────────────────────────────────────────────
  { slug: "nigeria",       country: "Nigeria",        zone: "Africa/Lagos",          currency: "NGN", locallyLicensed: false, mpesa: false, region: "West & Southern Africa" },
  { slug: "ghana",         country: "Ghana",          zone: "Africa/Accra",          currency: "GHS", locallyLicensed: false, mpesa: false, region: "West & Southern Africa" },
  { slug: "south-africa",  country: "South Africa",   zone: "Africa/Johannesburg",   currency: "ZAR", locallyLicensed: false, mpesa: false, region: "West & Southern Africa" },

  // ── Europe & North America — the widest gap, stated plainly ──────────────
  { slug: "united-kingdom", country: "the United Kingdom", zone: "Europe/London",    currency: "GBP", locallyLicensed: false, mpesa: false, region: "Europe & North America" },
  {
    slug: "united-states", country: "the United States", zone: "America/New_York",   currency: "USD", locallyLicensed: false, mpesa: false, region: "Europe & North America",
    zoneNote: "The gap below is from Eastern Time; add three hours if you are on the West Coast.",
  },
  {
    slug: "canada",        country: "Canada",         zone: "America/Toronto",       currency: "CAD", locallyLicensed: false, mpesa: false, region: "Europe & North America",
    zoneNote: "The gap below is from Eastern Time; add up to four and a half hours further west.",
  },

  // ── Gulf — the most favourable overlap of any market here ────────────────
  { slug: "uae",           country: "the United Arab Emirates", zone: "Asia/Dubai",  currency: "AED", locallyLicensed: false, mpesa: false, region: "Gulf" },
  { slug: "saudi-arabia",  country: "Saudi Arabia",   zone: "Asia/Riyadh",           currency: "SAR", locallyLicensed: false, mpesa: false, region: "Gulf" },
  { slug: "qatar",         country: "Qatar",          zone: "Asia/Qatar",            currency: "QAR", locallyLicensed: false, mpesa: false, region: "Gulf" },
];

export type MarketSlug = (typeof MARKETS)[number]["slug"];

export function findMarket(slug: string): Market | undefined {
  return MARKETS.find((m) => m.slug === slug);
}

/** The therapists' clock. Every offset on the site is expressed against this. */
export const THERAPIST_ZONE = "Africa/Nairobi";

function utcOffsetHours(zone: string, at: Date): number {
  /* `longOffset` yields "GMT+3" / "GMT-04:00" / "GMT". Parsing that is more
     robust than arithmetic on two `toLocaleString` round trips, which loses
     the sign on half-hour zones. */
  const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  if (!name) return 0;
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return 0; /* Bare "GMT" means offset zero. */
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) + Number(m[3] ?? 0) / 60);
}

/**
 * How far a market's clock sits from the therapists', right now.
 *
 * Negative means the client is behind Nairobi — the common case, and the one
 * that matters: at −8 the therapist's 17:00 is the client's 09:00, so evening
 * slots in Nairobi are the client's morning. Positive means ahead (the Gulf).
 */
export function hoursFromEat(zone: string, at: Date = new Date()): number {
  return utcOffsetHours(zone, at) - utcOffsetHours(THERAPIST_ZONE, at);
}

/** "3 hours behind" / "1 hour ahead" / "the same time as". */
export function describeOffset(hours: number): string {
  if (hours === 0) return "the same time as";
  const abs = Math.abs(hours);
  const unit = abs === 1 ? "hour" : "hours";
  const whole = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace(/\.0$/, "");
  return `${whole} ${unit} ${hours < 0 ? "behind" : "ahead of"}`;
}

/**
 * A concrete worked example, because "8 hours behind" is not something most
 * people can act on without doing the arithmetic themselves.
 *
 * Returns the client-local clock time for a given Nairobi hour, so a page can
 * say "our 18:00 is your 10:00" rather than making the reader work it out.
 */
export function clientTimeForNairobiHour(zone: string, nairobiHour: number, at: Date = new Date()): string {
  const shifted = (nairobiHour + hoursFromEat(zone, at) + 24) % 24;
  const h = Math.floor(shifted);
  const mins = Math.round((shifted - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Whether the overlap is comfortable, awkward, or genuinely hard.
 *
 * Drives the honesty of the copy rather than a badge. A four-hour gap is a
 * scheduling note; a nine-hour gap means the only realistic slots are the
 * client's early morning, and someone should learn that before they pay
 * rather than when they try to book.
 */
export function overlapDifficulty(hours: number): "easy" | "workable" | "narrow" {
  const abs = Math.abs(hours);
  if (abs <= 2) return "easy";
  if (abs <= 5) return "workable";
  return "narrow";
}
