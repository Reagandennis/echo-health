/**
 * ── The site's public information architecture, in one place ───────────────
 *
 * The header, the footer, `app/sitemap.ts` and every breadcrumb read from this
 * file. That is the point: before it existed, each of the thirteen marketing
 * pages inlined its own `<header>` containing a back-arrow to "/" and nothing
 * else, so /faq and /guides had no crawlable link between them — and the home
 * page's own nav pointed at `#how`, `#therapists` and `#pricing`, three
 * in-page anchors that can never rank for anything because they are not URLs.
 *
 * Adding a public page means adding it HERE. `sitemap.ts` derives itself from
 * `ALL_INDEXABLE_ROUTES` below, so a page added to the nav is submitted to
 * search engines automatically and one that is not in the nav cannot silently
 * become an orphan. `/organizations` shipped, was linked from the footer, and
 * was never added to the old hand-maintained sitemap — that is the failure
 * this structure is meant to make impossible.
 */

export interface NavLink {
  readonly href: string;
  readonly label: string;
  /** Shown under the label in the desktop mega-menu. Omit for plain lists. */
  readonly blurb?: string;
}

export interface NavGroup {
  readonly label: string;
  /** Landing page for the group itself — the pillar page, always crawlable. */
  readonly href: string;
  readonly items: readonly NavLink[];
  /** Promoted link rendered in the mega-menu's accent panel. */
  readonly feature?: NavLink;
}

/* ── Conditions ──────────────────────────────────────────────────────────── */

/**
 * The condition pages, which are the topical-authority play: someone searching
 * "help with anxiety" is far earlier in the funnel than someone searching
 * "online therapy", and there was no page to meet them on.
 *
 * `slug` is the URL. Keep them stable — these are the pages that accrue links.
 */
export const CONDITIONS = [
  { slug: "anxiety",       label: "Anxiety",          short: "anxiety" },
  { slug: "depression",    label: "Depression",       short: "depression" },
  { slug: "stress",        label: "Stress & burnout", short: "stress" },
  { slug: "trauma",        label: "Trauma & PTSD",    short: "trauma" },
  { slug: "grief",         label: "Grief & loss",     short: "grief" },
  { slug: "relationships", label: "Relationships",    short: "relationships" },
  { slug: "self-esteem",   label: "Self-esteem",      short: "self-esteem" },
  { slug: "sleep",         label: "Sleep problems",   short: "sleep" },
] as const;

export type ConditionSlug = (typeof CONDITIONS)[number]["slug"];

/* ── Locations ───────────────────────────────────────────────────────────── */

/**
 * Location pages. Kenyan cities, not US states — the clinicians are licensed
 * in Kenya, the prices are in KES and the payment rail is M-Pesa, so "online
 * therapy in California" would be a page we cannot serve.
 */
export const LOCATIONS = [
  { slug: "nairobi", label: "Nairobi", county: "Nairobi County" },
  { slug: "mombasa", label: "Mombasa", county: "Mombasa County" },
  { slug: "kisumu",  label: "Kisumu",  county: "Kisumu County" },
  { slug: "nakuru",  label: "Nakuru",  county: "Nakuru County" },
  { slug: "eldoret", label: "Eldoret", county: "Uasin Gishu County" },
] as const;

export type LocationSlug = (typeof LOCATIONS)[number]["slug"];

/* ── Primary navigation ──────────────────────────────────────────────────── */

export const NAV_THERAPY: NavGroup = {
  label: "Therapy",
  href: "/online-therapy",
  items: [
    {
      href: "/individual-therapy",
      label: "Individual therapy",
      blurb: "One-to-one sessions with a licensed therapist.",
    },
    {
      href: "/couples-therapy",
      label: "Couples therapy",
      blurb: "Work through it together, in a joint session.",
    },
    {
      href: "/teen-therapy",
      label: "Teen therapy",
      blurb: "Support for 13–17s, started by a parent or guardian.",
    },
    {
      href: "/online-therapy",
      label: "How online therapy works",
      blurb: "Video, phone or messaging — what to expect.",
    },
  ],
  feature: {
    href: "/get-started",
    label: "Find your therapist",
    blurb: "Answer a few questions and we'll match you. About 3 minutes.",
  },
};

export const NAV_CONDITIONS: NavGroup = {
  label: "What we help with",
  href: "/therapy-for",
  items: CONDITIONS.map((c) => ({
    href: `/therapy-for/${c.slug}`,
    label: c.label,
  })),
};

export const NAV_RESOURCES: NavGroup = {
  label: "Resources",
  href: "/guides",
  items: [
    { href: "/guides",  label: "Guides",         blurb: "Practical, clinically reviewed walkthroughs." },
    { href: "/blog",    label: "Articles",       blurb: "Writing from the Echo clinical team." },
    { href: "/faq",     label: "FAQ",            blurb: "Pricing, privacy, matching, cancellations." },
    { href: "/reviews", label: "Client stories", blurb: "What therapy on Echo has been like." },
    { href: "/crisis",  label: "Crisis support", blurb: "Verified helplines, available right now." },
  ],
};

/** The desktop header, left to right. Groups render as mega-menus. */
export const PRIMARY_NAV: readonly (NavGroup | NavLink)[] = [
  NAV_THERAPY,
  NAV_CONDITIONS,
  { href: "/therapists",   label: "Find a therapist" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing",      label: "Pricing" },
  NAV_RESOURCES,
];

export function isNavGroup(item: NavGroup | NavLink): item is NavGroup {
  return "items" in item;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

/**
 * The footer is the site's link hub, so it carries considerably more than the
 * header: every condition page and every location page appears here and
 * nowhere else in the chrome. That is deliberate — it is how those pages get
 * an internal link without pushing the header past twenty items.
 */
export const FOOTER_COLUMNS: readonly NavGroup[] = [
  {
    label: "Therapy",
    href: "/online-therapy",
    items: [
      { href: "/online-therapy",     label: "Online therapy" },
      { href: "/individual-therapy", label: "Individual therapy" },
      { href: "/couples-therapy",    label: "Couples therapy" },
      { href: "/teen-therapy",       label: "Teen therapy" },
      { href: "/therapists",         label: "Find a therapist" },
      { href: "/how-it-works",       label: "How it works" },
      { href: "/pricing",            label: "Pricing" },
    ],
  },
  {
    label: "What we help with",
    href: "/therapy-for",
    items: CONDITIONS.map((c) => ({
      href: `/therapy-for/${c.slug}`,
      label: `Therapy for ${c.short}`,
    })),
  },
  {
    label: "Resources",
    href: "/guides",
    items: [
      { href: "/guides",  label: "Mental health guides" },
      { href: "/blog",    label: "Articles" },
      { href: "/faq",     label: "FAQ" },
      { href: "/reviews", label: "Client stories" },
      { href: "/crisis",  label: "Crisis support" },
    ],
  },
  {
    label: "Company",
    href: "/about",
    items: [
      { href: "/about",          label: "About us" },
      { href: "/organizations",  label: "For organizations" },
      { href: "/therapist-jobs", label: "Join as a therapist" },
      { href: "/careers",        label: "Careers" },
      { href: "/press",          label: "Press" },
      { href: "/contact",        label: "Contact" },
    ],
  },
];

/** Cities, rendered as one wrapped row rather than a fifth column. */
export const FOOTER_LOCATIONS: readonly NavLink[] = LOCATIONS.map((l) => ({
  href: `/online-therapy/${l.slug}`,
  label: `Therapy in ${l.label}`,
}));

export const FOOTER_LEGAL: readonly NavLink[] = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms",   label: "Terms of service" },
  { href: "/cookies", label: "Cookie settings" },
];

/* ── Sitemap source ──────────────────────────────────────────────────────── */

interface RouteSpec {
  readonly path: string;
  readonly changeFrequency:
    | "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  readonly priority: number;
}

/**
 * Everything `app/sitemap.ts` submits.
 *
 * `/cookies` is deliberately absent: it is `index: false`, and submitting a
 * noindex URL in a sitemap is a direct contradiction that Search Console
 * reports as an error ("Submitted URL marked 'noindex'"). The old sitemap
 * listed it.
 */
export const ALL_INDEXABLE_ROUTES: readonly RouteSpec[] = [
  { path: "/",                   changeFrequency: "weekly",  priority: 1.0 },
  { path: "/get-started",        changeFrequency: "monthly", priority: 0.9 },
  { path: "/how-it-works",       changeFrequency: "monthly", priority: 0.9 },
  { path: "/pricing",            changeFrequency: "weekly",  priority: 0.9 },
  { path: "/therapists",         changeFrequency: "daily",   priority: 0.9 },
  { path: "/online-therapy",     changeFrequency: "monthly", priority: 0.9 },
  { path: "/individual-therapy", changeFrequency: "monthly", priority: 0.8 },
  { path: "/couples-therapy",    changeFrequency: "monthly", priority: 0.8 },
  { path: "/teen-therapy",       changeFrequency: "monthly", priority: 0.8 },
  { path: "/therapy-for",        changeFrequency: "monthly", priority: 0.8 },
  ...CONDITIONS.map((c) => ({
    path: `/therapy-for/${c.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.75,
  })),
  ...LOCATIONS.map((l) => ({
    path: `/online-therapy/${l.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  })),
  { path: "/reviews",        changeFrequency: "weekly",  priority: 0.7 },
  { path: "/guides",         changeFrequency: "weekly",  priority: 0.8 },
  { path: "/blog",           changeFrequency: "weekly",  priority: 0.8 },
  { path: "/faq",            changeFrequency: "monthly", priority: 0.7 },
  { path: "/crisis",         changeFrequency: "yearly",  priority: 0.9 },
  { path: "/about",          changeFrequency: "monthly", priority: 0.7 },
  { path: "/organizations",  changeFrequency: "monthly", priority: 0.7 },
  { path: "/therapist-jobs", changeFrequency: "monthly", priority: 0.7 },
  { path: "/careers",        changeFrequency: "weekly",  priority: 0.6 },
  { path: "/press",          changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact",        changeFrequency: "yearly",  priority: 0.6 },
  { path: "/privacy",        changeFrequency: "yearly",  priority: 0.3 },
  { path: "/terms",          changeFrequency: "yearly",  priority: 0.3 },
];
