import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CreditCard, LifeBuoy, Smartphone, Video } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import JsonLd from "@/app/components/marketing/JsonLd";
import {
  CheckList,
  CtaBand,
  FaqList,
  RelatedLinks,
  Section,
  SectionHeading,
  faqJsonLd,
  type Faq,
} from "@/app/components/marketing/sections";
import { CONDITIONS } from "@/lib/navigation";
import {
  MARKETS,
  clientTimeForNairobiHour,
  describeOffset,
  findMarket,
  hoursFromEat,
  overlapDifficulty,
  type Market,
} from "@/lib/markets";
import { CRISIS_DIRECTORY_URL, formatKes as money, PLAN_PRICES } from "@/lib/constants";
import { priceTier, tierForCountry } from "@/lib/pricing";
import { pageMetadata, siteUrl } from "@/lib/seo";

/**
 * One page per client market.
 *
 * ## What replaced what, and why
 *
 * This route was `[city]` and generated five Kenyan cities. That is the right
 * shape for a service with local clinicians in each city and the wrong shape
 * for this one: Echo's therapists are licensed in Kenya and its clients are
 * worldwide, so "online therapy in Mombasa" was serving a local-search intent
 * the product does not uniquely answer, while a reader in Lagos or Toronto had
 * no page at all.
 *
 * ## The rule these pages are written to
 *
 * Every one of them opens with what is NOT true: your therapist is not
 * licensed where you are. Twelve of the thirteen markets have
 * `locallyLicensed: false`, and a page that buried that would be a doorway
 * page dressed as a service page — the visitor finds out at the point they
 * need a letter for an insurer, or a diagnosis for a school, and we have taken
 * their money.
 *
 * The honest version costs conversions and is the only version worth shipping.
 * Everything else on the page — the time-zone arithmetic, the currency note,
 * the payment rails — exists because those are the three things that actually
 * differ by country and that a visitor cannot find out anywhere else.
 */

/** All thirteen are prebuilt; an unknown slug 404s rather than rendering empty. */
export const dynamicParams = false;

export function generateStaticParams() {
  return MARKETS.map((m) => ({ country: m.slug }));
}

type Props = { params: Promise<{ country: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const market = findMarket(country);
  if (!market) return { title: "Not found", robots: { index: false, follow: true } };

  /* Titles read "Online therapy in Kenya" / "...in the United States" — the
     article lives in `country` so both forms are grammatical. */
  return pageMetadata({
    title: `Online therapy in ${market.country}`,
    /*
     * Kept short on purpose. `country` ranges from "Kenya" (5 chars) to "the
     * United Arab Emirates" (24), and the longer names pushed the earlier
     * wording to 176 characters — past the point Google truncates. This
     * template measures 144-163 across all thirteen markets.
     */
    description:
      `Talk to a licensed therapist from ${market.country} by video, phone or message. ` +
      `How session times fit your day, what you pay, and what we can and cannot do.`,
    path: `/online-therapy/${market.slug}`,
  });
}


export default async function CountryPage({ params }: Props) {
  const { country } = await params;
  const market = findMarket(country);
  /* `dynamicParams = false` means Next 404s an unknown slug before reaching
     here, so this is a type narrowing rather than a runtime path. */
  if (!market) return null;

  /* Computed at render, not stored: the UK, US and Canada all observe DST
     while Kenya does not, so a literal offset would be wrong for months of
     every year. */
  const offset = hoursFromEat(market.zone);
  const difficulty = overlapDifficulty(offset);
  const faqs = buildFaqs(market, offset);

  return (
    <>
      <JsonLd data={faqJsonLd(faqs)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Online psychotherapy",
          name: `Online therapy in ${market.country}`,
          url: `${siteUrl}/online-therapy/${market.slug}`,
          provider: { "@type": "MedicalOrganization", name: "Echo Health", url: siteUrl },
          areaServed: { "@type": "Country", name: market.country.replace(/^the /, "") },
          /* No `address` and no `LocalBusiness`: there is no consulting room in
             this country, and claiming a local presence in structured data is
             the machine-readable version of the lie this page refuses to tell
             in prose. */
        }}
      />
      <Breadcrumbs
        trail={[
          { href: "/online-therapy", label: "Online therapy" },
          { href: `/online-therapy/${market.slug}`, label: market.country },
        ]}
      />

      <section className="bg-hero-soft px-4 pb-14 pt-6 sm:px-6 sm:pb-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
            Online therapy in {market.country}
          </h1>
          <p className="mt-6 text-[17px] leading-8 text-stone-600">
            Echo connects you with a licensed therapist by video, phone or
            message, booked around your week. Before anything else, here are the
            three things that are specific to {market.country} — because they
            are the three you cannot find out from a home page.
          </p>

          {/* The disclosure block, above the fold, on purpose. */}
          <dl className="mt-10 grid gap-4 sm:grid-cols-3">
            <Fact
              icon={CalendarClock}
              term="Session times"
              detail={
                offset === 0
                  ? `The same clock as your therapist. No arithmetic.`
                  : `You are ${describeOffset(offset)} your therapist's working hours.`
              }
            />
            <Fact
              icon={CreditCard}
              term="What you pay"
              detail={priceFact(market)}
            />
            <Fact
              icon={Video}
              term="Who you see"
              detail={
                market.locallyLicensed
                  ? `A practitioner licensed here, in ${market.country}.`
                  : `A practitioner licensed in Kenya — not in ${market.country}.`
              }
            />
          </dl>
        </div>
      </section>

      {/* ── The licensure disclosure, at length ──────────────────────── */}
      <Section>
        <div className="mx-auto max-w-3xl">
          {market.locallyLicensed ? (
            <>
              <SectionHeading
                as="h3"
                align="left"
                title="Your therapist is licensed here"
              />
              <p className="mt-5 text-[15px] leading-7 text-stone-600">
                Echo&apos;s practitioners are registered in Kenya, which is where
                you are. That means the usual local protections apply: you can
                verify a practitioner with their regulator, and a complaint has
                somewhere to go. It also means session times need no arithmetic
                and you can pay with M-Pesa.
              </p>
            </>
          ) : (
            <>
              <SectionHeading
                as="h3"
                align="left"
                title={`What "licensed in Kenya" means for you in ${market.country}`}
              />
              <p className="mt-5 text-[15px] leading-7 text-stone-600">
                This is the part most services leave until after you have paid,
                so it goes first here. Echo&apos;s therapists hold current
                licences to practise in Kenya. They are qualified,
                credential-checked clinicians — and they are not registered with
                a regulator in {market.country}.
              </p>
              <p className="mt-4 text-[15px] leading-7 text-stone-600">
                For most people wanting to talk to someone regularly and
                privately, that distinction changes nothing about the therapy.
                It matters in specific situations, so here they are:
              </p>
              <div className="mt-7">
                <CheckList
                  items={[
                    `We cannot provide a diagnosis or a letter that an insurer, employer, school or court in ${market.country} will accept.`,
                    "We cannot prescribe or manage medication anywhere, including in Kenya.",
                    `If you need therapy that your local health system or insurance will reimburse, you need a practitioner registered in ${market.country}.`,
                    `A complaint about your therapist goes to their Kenyan regulator and to us — not to a body in ${market.country}.`,
                  ]}
                />
              </div>
              <p className="mt-7 rounded-2xl bg-stone-50 p-5 text-sm leading-6 text-stone-600">
                If any of those apply to you, a local practitioner is the right
                choice and we would rather say so now. If none of them do, the
                rest of this page is about the practical details.
              </p>
            </>
          )}
        </div>
      </Section>

      {/* ── Time zones, with real numbers ────────────────────────────── */}
      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            as="h3"
            align="left"
            title={offset === 0 ? "Session times" : "When you can actually meet"}
          />
          <p className="mt-5 text-[15px] leading-7 text-stone-600">
            Therapists keep their hours in East Africa Time (GMT+3).{" "}
            {offset === 0
              ? `You are on the same clock, so a time that looks good to you is the time your therapist sees.`
              : `You are ${describeOffset(offset)} them, so it is worth knowing which part of your day is realistic before you book.`}
            {market.zoneNote ? ` ${market.zoneNote}` : ""}
          </p>

          {offset !== 0 && (
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[26rem] border-collapse text-left text-sm">
                <caption className="sr-only">
                  Therapist working hours in East Africa Time and the matching local time
                </caption>
                <thead>
                  <tr className="border-b border-stone-300">
                    <th scope="col" className="py-3 pr-4 font-semibold text-stone-900">
                      Therapist&apos;s time (EAT)
                    </th>
                    <th scope="col" className="py-3 pr-4 font-semibold text-stone-900">
                      Your time
                    </th>
                    <th scope="col" className="py-3 font-semibold text-stone-900">
                      Realistic?
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[8, 12, 17, 20].map((hour) => {
                    const local = clientTimeForNairobiHour(market.zone, hour);
                    const localHour = Number(local.slice(0, 2));
                    const civil = localHour >= 7 && localHour <= 22;
                    return (
                      <tr key={hour} className="border-b border-stone-200">
                        <th scope="row" className="py-3.5 pr-4 font-normal text-stone-700">
                          {String(hour).padStart(2, "0")}:00
                        </th>
                        <td className="py-3.5 pr-4 font-medium text-stone-900">{local}</td>
                        <td className="py-3.5 text-stone-600">
                          {civil ? "Workable" : "Middle of the night"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-7 text-[15px] leading-7 text-stone-600">
            {difficulty === "easy" &&
              "In practice the overlap is wide enough that most therapists have a slot that suits you."}
            {difficulty === "workable" &&
              "The overlap is real but not unlimited — expect your options to cluster in the morning or the evening rather than across the whole day."}
            {difficulty === "narrow" &&
              `Being ${describeOffset(offset).replace(" the", "")} is the honest constraint here: your therapist's afternoon is your early morning. People in ${market.country} generally book either before work or late at night, and if neither works for you, this is not the right service. Saying that now is cheaper for both of us than a refund later.`}
          </p>
          <p className="mt-4 text-[15px] leading-7 text-stone-600">
            Messaging removes the problem entirely — you write when it suits you
            and your therapist replies inside their working hours.
          </p>
        </div>
      </Section>

      {/* ── Paying from here ─────────────────────────────────────────── */}
      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading as="h3" align="left" title={`Paying from ${market.country}`} />
          <p className="mt-5 text-[15px] leading-7 text-stone-600">
            Sessions are priced and charged in Kenyan shillings — one payment for
            a bundle, nothing recurring, and credits that never expire. Where
            prices appear on this site they are also shown as an approximate
            amount in your own currency, with the exact shilling figure you will
            be charged stated alongside it.
          </p>
          <p className="mt-4 text-[15px] leading-7 text-stone-600">
            Your bank sets the {market.currency}-to-KES rate and may add its own
            cross-border fee, so the figure on your statement can differ slightly
            from the converted amount shown here. That difference is your
            bank&apos;s, not ours.
          </p>
          <ul className="mt-8 flex flex-wrap gap-3">
            {market.mpesa && (
              <PayChip icon={Smartphone} label="M-Pesa" note="Available here" />
            )}
            <PayChip icon={CreditCard} label="Card" note="Visa & Mastercard" />
            <PayChip icon={CreditCard} label="Bank transfer" note="Direct" />
          </ul>
        </div>
      </Section>

      {/* ── Crisis, geo-neutral ──────────────────────────────────────── */}
      <Section tone="muted">
        <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-stone-200">
          <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.8} aria-hidden="true" />
          <p className="text-sm leading-6 text-stone-600">
            Echo is not an emergency service and nobody is monitoring the
            platform for urgent messages. If you or someone else is in immediate
            danger, contact your local emergency number. Our{" "}
            <Link href="/crisis" className="font-semibold text-brand-700 underline underline-offset-2">
              crisis page
            </Link>{" "}
            lists verified helplines by region, and{" "}
            <a
              href={CRISIS_DIRECTORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-700 underline underline-offset-2"
            >
              findahelpline.com
            </a>{" "}
            will find one wherever you are.
            {/* No number named here. Thirteen markets, and `CRISIS_REGIONS`
                verifies numbers for two of them — inventing the other eleven is
                the specific failure lib/constants.ts exists to prevent. */}
          </p>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={`Questions from ${market.country}`} />
          <FaqList faqs={faqs} />
        </div>
      </Section>

      <RelatedLinks
        title="Therapy by country"
        links={MARKETS.filter((m) => m.slug !== market.slug).map((m) => ({
          href: `/online-therapy/${m.slug}`,
          label: m.country.replace(/^the /, ""),
        }))}
      />

      <RelatedLinks
        title="What we help with"
        links={CONDITIONS.map((c) => ({
          href: `/therapy-for/${c.slug}`,
          label: c.label,
        }))}
      />

      <CtaBand
        title="See who you could work with."
        body="Browse the therapists, or answer a few questions and we'll suggest the ones whose hours and focus fit you."
      />
    </>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────────── */

/**
 * "What you pay", for one market.
 *
 * This used to read "from ${PLAN_PRICES.individual}" on all thirteen pages.
 * Regional bands (`lib/pricing.ts`) made that stale in the worst direction for
 * five of them: a reader in Kampala was told a session starts at KES 2,000 when
 * they would actually be charged KES 1,100, so the one page written to tell
 * them what is specific to their country was overstating the price.
 *
 * The band is resolvable here without reading a request, because the country IS
 * the route — these thirteen pages are prebuilt by `generateStaticParams`. That
 * is also why the lower figure is stated as a **condition** ("if you are paying
 * from Uganda") rather than as the price: the charged amount comes from where
 * the payment is made, not from which page was read, and someone browsing the
 * Uganda page from Nairobi pays the standard price. Stating it unconditionally
 * would be the one thing regional pricing must never do — advertise a figure
 * below what the card is debited.
 */
function priceFact(market: Market): string {
  const banded = priceTier(tierForCountry(market.iso)).prices.individual ?? PLAN_PRICES.individual;
  const converts = `Your bank converts from ${market.currency}.`;

  if (banded >= PLAN_PRICES.individual) {
    return `Charged in Kenyan shillings — from ${money(PLAN_PRICES.individual)}. ${converts}`;
  }

  return (
    `Charged in Kenyan shillings — from ${money(banded)} paying from ${market.country}, ` +
    `against ${money(PLAN_PRICES.individual)} standard. ${converts}`
  );
}

function Fact({
  icon: Icon,
  term,
  detail,
}: {
  readonly icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  readonly term: string;
  readonly detail: string;
}) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-stone-200/70">
      <Icon className="h-5 w-5 text-brand-600" strokeWidth={1.8} aria-hidden="true" />
      <dt className="mt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{term}</dt>
      <dd className="mt-1.5 text-sm leading-6 text-stone-800">{detail}</dd>
    </div>
  );
}

function PayChip({
  icon: Icon,
  label,
  note,
}: {
  readonly icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  readonly label: string;
  readonly note: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface px-5 py-3 shadow-sm ring-1 ring-stone-200/70">
      <Icon className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={1.8} aria-hidden="true" />
      <span>
        <span className="block text-sm font-semibold text-stone-900">{label}</span>
        <span className="block text-xs text-stone-500">{note}</span>
      </span>
    </li>
  );
}

/**
 * Per-market FAQs.
 *
 * Built from the market rather than written out thirteen times, so a change to
 * the licensure wording cannot land on some countries and not others.
 */
function buildFaqs(market: Market, offset: number): readonly Faq[] {
  const local = market.country;
  return [
    {
      q: `Can I use Echo from ${local}?`,
      a: `Yes. Sessions are online — video, phone or messaging — so where you are matters only for scheduling and payment, both of which are covered on this page. What you should know before booking is that your therapist is licensed in Kenya${market.locallyLicensed ? ", which is where you are" : `, not in ${local}`}.`,
    },
    {
      q: `Is my therapist registered in ${local}?`,
      a: market.locallyLicensed
        ? `Yes. Echo's practitioners hold current licences to practise in Kenya, so the local regulator and complaints route apply to you in the normal way.`
        /*
         * Phrased prepositionally — "a regulator in X", not "a X regulator".
         * `market.country` carries its own article for some markets ("the
         * United States", "the United Arab Emirates"), so using it
         * adjectivally produced "a the United States regulator". Prepositional
         * form is grammatical for all thirteen names without a second field.
         */
        : `No. They hold current Kenyan licences and are credential-checked by us before appearing in the directory, but they are not registered with any regulator in ${local}. For ordinary talking therapy that changes nothing. It matters if you need a diagnosis or a letter that an insurer, employer, school or court in ${local} will accept — we cannot provide those, and you would need a locally registered practitioner.`,
    },
    {
      q: "What time will my sessions be?",
      a:
        offset === 0
          ? `Whatever you book. You and your therapist are on the same clock, so the time you pick is the time they see.`
          /*
         * This sentence used to end "the booking screen shows times converted
         * to your own time zone, so you are never doing the arithmetic
         * yourself." That was a claim about a feature nobody had checked:
         * there is no slot-picker UI, and `app/dashboard/sessions/page.tsx`
         * renders with `toLocaleTimeString` and no `timeZone` option, which
         * happens to yield the viewer's local zone but labels it nowhere. A
         * client seven hours out cannot tell whether "10:00" is theirs or
         * Nairobi's. Describing the behaviour we actually have, and no more.
         */
          : `Therapists publish availability in East Africa Time (GMT+3), and you are ${describeOffset(offset)} them. In practice that means your realistic slots are ${overlapDifficulty(offset) === "narrow" ? "early morning or late evening" : "spread across your morning and evening"}. Times in your account are shown in your own device's time zone, and the table above converts the therapist's hours for you.`,
    },
    {
      q: `What currency am I charged in?`,
      a: `Kenyan shillings, always — that is the currency the payments account settles in. Prices are also displayed as an approximate amount in ${market.currency} so you can browse without converting, and the exact shilling figure is shown before you pay. Your bank sets the rate and may add a cross-border fee.`,
    },
    {
      q: market.mpesa ? "How can I pay?" : "Can I pay without M-Pesa?",
      a: market.mpesa
        ? `M-Pesa, card or bank transfer. M-Pesa is available in ${local} and is the most common choice; card and bank transfer work the same way from anywhere.`
        : `Yes — M-Pesa is not available in ${local} and you do not need it. Visa and Mastercard, debit or credit, and direct bank transfer all work.`,
    },
    {
      q: "What if I need help urgently?",
      a: `Echo is not a crisis service and nobody monitors the platform for urgent messages. Contact your local emergency number, or use our crisis page, which lists verified helplines by region. We deliberately do not print an emergency number for every country we serve, because publishing one we have not verified would be worse than publishing none.`,
    },
  ];
}
