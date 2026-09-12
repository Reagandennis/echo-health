import Link from "next/link";
import { Check, CreditCard, Minus, Smartphone, Landmark } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import JsonLd from "@/app/components/marketing/JsonLd";
import PriceTag from "@/app/components/PriceTag";
import {
  CtaBand,
  FaqList,
  RelatedLinks,
  Section,
  SectionHeading,
  faqJsonLd,
  type Faq,
} from "@/app/components/marketing/sections";
import { pageMetadata, siteUrl } from "@/lib/seo";
import {
  PLAN_CURRENCY,
  formatKes as money,
  PLAN_PERIOD_LABELS,
  PLAN_PRICES,
  PLAN_SESSIONS,
  PROMO_DISCOUNT_PERCENT,
} from "@/lib/constants";

/**
 * The page the FAQ has been pointing at in prose for months without it
 * existing ("See our Pricing page for the full comparison" — not even a link,
 * because there was nowhere to link to).
 *
 * Pricing lived only as `/#pricing`, an in-page anchor, so it could not rank,
 * could not carry its own title and description, and could not be deep-linked
 * from a search for "echo health pricing". Meanwhile three footer links
 * pointed at that anchor from every page on the site, concentrating the anchor
 * text "Pricing" on a URL that already ranked for the brand.
 *
 * ## Every figure here is read from `lib/constants.ts`
 *
 * Not one is typed into this file. The FAQ page learned this the hard way: it
 * used to spell the numbers into prose, which is how a pricing page and an FAQ
 * end up quoting different amounts for the same plan — and this one carries
 * `Offer` structured data, so a stale figure would propagate into search
 * results.
 *
 * ## KES is a fact about the charge, not a fact about the buyer
 *
 * Most people reading this page are outside Kenya (`lib/markets.ts`), and this
 * page used to treat the settlement currency as though it also described the
 * audience — "pricing in Kenyan shillings" in the meta description, "if you are
 * paying from outside Kenya" as the edge case. Both halves have to be true at
 * once: the charge really does settle in KES and has to be stated plainly, and
 * the reader is probably paying from somewhere else. `PriceTag` is what bridges
 * them — it shows an approximate local figure marked "≈" beside the exact KES
 * amount — so the prose here describes that behaviour rather than assuming a
 * reader who does not need it.
 */
export const metadata = pageMetadata({
  title: "Pricing — pay once, credits never expire",
  description:
    "What therapy costs on Echo Health: a one-time payment for a bundle of 50-minute sessions, charged in Kenyan shillings. Nothing renews and credits never expire.",
  path: "/pricing",
});


const perSession = (plan: string) =>
  money(Math.round(PLAN_PRICES[plan]! / Math.max(1, PLAN_SESSIONS[plan] ?? 1)));

const PLANS = [
  {
    id: "individual",
    name: "Individual",
    for: "One person",
    description: "One session with a licensed therapist. Book another whenever you need it.",
    highlighted: false,
  },
  {
    id: "plus",
    name: "Plus",
    for: "One person",
    description: "Two sessions plus therapy materials. The lowest cost per session.",
    highlighted: true,
  },
  {
    id: "couples",
    name: "Couples",
    for: "Two people",
    description: "Two joint sessions with both partners on the call.",
    highlighted: false,
  },
] as const;

/**
 * The comparison matrix.
 *
 * `true` renders a tick, `false` a dash, a string renders verbatim. Keeping
 * the numeric cells as functions of `lib/constants.ts` rather than strings is
 * what stops this table drifting from the cards above it.
 */
const MATRIX: readonly {
  readonly label: string;
  readonly values: Record<string, string | boolean>;
}[] = [
  {
    label: "50-minute sessions included",
    values: {
      individual: String(PLAN_SESSIONS.individual),
      plus: String(PLAN_SESSIONS.plus),
      couples: `${PLAN_SESSIONS.couples} (joint)`,
    },
  },
  {
    label: "Cost per session",
    values: {
      individual: perSession("individual"),
      plus: perSession("plus"),
      couples: perSession("couples"),
    },
  },
  {
    label: "People covered",
    values: { individual: "1", plus: "1", couples: "2" },
  },
  {
    label: "Video, phone or messaging",
    values: { individual: true, plus: true, couples: true },
  },
  {
    label: "Secure messaging between sessions",
    values: { individual: true, plus: true, couples: true },
  },
  {
    label: "Progress tracking dashboard",
    values: { individual: true, plus: true, couples: true },
  },
  {
    label: "Therapy worksheets and exercises",
    values: { individual: false, plus: true, couples: true },
  },
  {
    label: "Matched with a couples therapist",
    values: { individual: false, plus: false, couples: true },
  },
  {
    label: "Credits never expire",
    values: { individual: true, plus: true, couples: true },
  },
  {
    label: "Free cancellation 24h ahead",
    values: { individual: true, plus: true, couples: true },
  },
  {
    label: "Free to switch therapist",
    values: { individual: true, plus: true, couples: true },
  },
];

/**
 * Card first, M-Pesa last.
 *
 * M-Pesa was listed first and described as "the most common way people pay on
 * Echo" — an unevidenced claim about our own ledger, and a default that only
 * makes sense for a Kenyan buyer. Card is the rail that works from all thirteen
 * markets; M-Pesa is a real option for the subset with a Kenyan mobile-money
 * account and is described as exactly that.
 */
const PAYMENT = [
  { icon: CreditCard, title: "Card", body: "Visa and Mastercard, debit or credit, processed by Paystack. Works from any country." },
  { icon: Landmark, title: "Bank transfer", body: "Direct transfer for anyone who would rather not use a card." },
  { icon: Smartphone, title: "M-Pesa", body: "Mobile money from your phone, if you hold a Kenyan M-Pesa account." },
];

const FAQS: readonly Faq[] = [
  {
    q: "Is this a subscription?",
    a: "No. Every plan is a one-time payment for a fixed number of sessions. Nothing renews, there is no card on file charging you monthly, and there is nothing to remember to cancel. When you have used your sessions, you buy more only if you want to.",
  },
  {
    q: "Do my sessions expire?",
    a: "No. Session credits stay in your account until you use them, however long that takes. If life gets in the way for three months, the sessions you paid for are still there.",
  },
  {
    q: "What if I need to cancel or move a session?",
    a: "Cancel at least 24 hours before the session and the credit goes straight back to your account, ready to rebook. Inside 24 hours the credit is used, because your therapist has held that time for you and cannot fill it.",
  },
  {
    q: "Can I get a refund?",
    a: "Unused session credits can be refunded to the payment method you used — contact support and we will process it. Sessions you have already attended are not refundable.",
  },
  {
    q: "Do you offer any discounts?",
    a: `We run promotional codes from time to time, worth ${PROMO_DISCOUNT_PERCENT}% off a plan. If you have one, enter it at checkout and the discount is applied before you pay — you will never be charged the full amount and refunded the difference.`,
  },
  {
    q: "What currency am I charged in?",
    a: "Kenyan shillings, wherever you are — that is the currency Echo's payment account settles in. Where we can tell you are somewhere else, the prices above also show an approximate amount in your own currency, marked with a ≈, alongside the exact shilling figure you will be charged. Treat the approximate one as a guide only: your bank does the actual conversion at its own rate.",
  },
  {
    q: "Do you take insurance?",
    a: "Not at the moment — sessions are paid for directly. If your insurer or employer reimburses outpatient mental health care, email support@echohealth.app and we can send you an itemised receipt to submit to them; we cannot guarantee any particular insurer will accept it, and your therapist is licensed in Kenya rather than in your own country, which some insurers require. If your employer offers a mental-health benefit, ask them about Echo for organizations — we can invoice an employer directly.",
  },
  {
    q: "Why is it cheaper than seeing someone in person?",
    a: "There is no room to rent, no receptionist, and no travel time built into the hour. Your therapist is paid a fixed share of every session regardless of any discount we run, so a lower price to you does not mean a lower rate for them.",
  },
];

export default function PricingPage() {
  return (
    <>
      <JsonLd data={faqJsonLd(FAQS)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Online therapy sessions",
          description:
            "One-to-one and couples therapy with licensed practitioners, sold as one-time bundles of 50-minute sessions.",
          brand: { "@type": "Brand", name: "Echo Health" },
          offers: PLANS.map((p) => ({
            "@type": "Offer",
            name: p.name,
            price: PLAN_PRICES[p.id],
            priceCurrency: PLAN_CURRENCY,
            availability: "https://schema.org/InStock",
            url: `${siteUrl}/pricing`,
          })),
        }}
      />
      <Breadcrumbs trail={[{ href: "/pricing", label: "Pricing" }]} />

      <section className="bg-hero-soft px-4 pb-16 pt-6 sm:px-6 sm:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
            Pay once. Nothing renews.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-8 text-stone-600">
            Therapy on Echo is sold as a bundle of sessions, paid for one time.
            There is no subscription, no card kept on file for a monthly charge,
            and no expiry date on what you have bought. Every price below is
            charged in Kenyan shillings, whichever currency your card is in.
          </p>
        </div>
      </section>

      <Section>
        <div className="grid items-stretch gap-x-6 gap-y-10 md:grid-cols-3 md:gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl p-8 ${
                plan.highlighted
                  ? "bg-brand-900 text-white shadow-xl shadow-brand-950/20"
                  : "bg-surface shadow-sm ring-1 ring-stone-200"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sage px-4 py-1 text-xs font-bold uppercase tracking-widest text-brand-950 shadow">
                  Best value
                </span>
              )}
              <p
                className={`text-xs font-semibold uppercase tracking-[0.14em] ${
                  plan.highlighted ? "text-brand-200" : "text-brand-700"
                }`}
              >
                {plan.for}
              </p>
              <h2
                className={`mt-2 text-xl font-semibold ${plan.highlighted ? "text-white" : "text-stone-900"}`}
              >
                {plan.name}
              </h2>
              <p
                className={`mt-1.5 text-sm leading-6 ${
                  plan.highlighted ? "text-brand-100/80" : "text-stone-500"
                }`}
              >
                {plan.description}
              </p>
              <div className="mt-7">
                <PriceTag
                  amount={PLAN_PRICES[plan.id]}
                  period={PLAN_PERIOD_LABELS[plan.id]}
                  priceClass={plan.highlighted ? "text-white" : "text-stone-900"}
                  periodClass={plan.highlighted ? "text-brand-100/70" : "text-stone-500"}
                />
                <p className={`mt-2 text-sm ${plan.highlighted ? "text-brand-100/70" : "text-stone-500"}`}>
                  {perSession(plan.id)} per session
                </p>
              </div>
              <div className="h-8" aria-hidden="true" />
              <Link
                href={`/get-started?for=${plan.id === "couples" ? "couple" : "self"}`}
                /* `mt-auto` pins the CTA to the card's bottom edge, so all
                   three line up however long the descriptions run. */
                className={`mt-auto flex min-h-12 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-white text-brand-900 hover:bg-brand-50"
                    : "bg-brand text-white hover:bg-brand-700"
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading title="What's in each plan" align="center" />
        <div className="mx-auto mt-12 max-w-4xl overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">Feature comparison of the Individual, Plus and Couples plans</caption>
            <thead>
              <tr className="border-b border-stone-300">
                <th scope="col" className="py-4 pr-4 text-sm font-semibold text-stone-900">
                  <span className="sr-only">Feature</span>
                </th>
                {PLANS.map((p) => (
                  <th
                    key={p.id}
                    scope="col"
                    className={`w-28 py-4 text-center text-sm font-semibold ${
                      p.highlighted ? "text-brand-700" : "text-stone-700"
                    }`}
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.label} className="border-b border-stone-200">
                  <th scope="row" className="py-4 pr-4 text-[15px] font-normal text-stone-700">
                    {row.label}
                  </th>
                  {PLANS.map((p) => (
                    <td key={p.id} className="py-4 text-center text-sm text-stone-800">
                      <Cell value={row.values[p.id]!} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Payment" title="Three ways to pay" />
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {PAYMENT.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl bg-surface p-7 shadow-sm ring-1 ring-stone-200/70">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <h3 className="mt-5 font-semibold text-stone-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex max-w-2xl flex-col gap-4 text-sm leading-7 text-stone-600">
          {/* Describes what `PriceTag` actually does: an approximate converted
              figure, marked as approximate, with the exact settlement amount
              underneath it. Do not promise a converted price the cards cannot
              render — currency detection can fail, in which case they simply
              show the shilling figure. */}
          <p>
            Every charge settles in Kenyan shillings, whatever your own currency
            is. Where we can tell you are somewhere else, the prices above are
            also shown as an approximate amount in yours, with the exact
            shilling figure — the one that reaches your statement — underneath
            it.
          </p>
          <p>
            Your bank sets the exchange rate on that conversion and may add its
            own fee, so the amount you are billed can differ slightly from the
            approximate figure shown here. That difference is your
            bank&apos;s, not ours, and we do not add a margin of our own.
          </p>
        </div>
      </Section>

      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          <SectionHeading title="Questions about money" />
          <FaqList faqs={FAQS} />
        </div>
      </Section>

      <RelatedLinks
        title="Before you decide"
        links={[
          { href: "/how-it-works", label: "How it works" },
          { href: "/therapists", label: "Meet the therapists" },
          { href: "/online-therapy", label: "Is online therapy right for me?" },
          { href: "/faq", label: "All questions" },
          { href: "/organizations", label: "Therapy as an employee benefit" },
        ]}
      />

      <CtaBand
        title="Start with one session."
        body="You are not signing up for anything ongoing. Answer a few questions, meet a therapist, and see how it goes."
      />
    </>
  );
}

function Cell({ value }: { readonly value: string | boolean }) {
  if (value === true) {
    return (
      <>
        <Check className="mx-auto h-5 w-5 text-brand-600" strokeWidth={3} aria-hidden="true" />
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="mx-auto h-5 w-5 text-stone-300" strokeWidth={2.5} aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <span className="font-medium">{value}</span>;
}
