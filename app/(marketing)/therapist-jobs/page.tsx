import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  FileCheck2,
  Laptop,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import JsonLd from "@/app/components/marketing/JsonLd";
import {
  CheckList,
  CtaBand,
  FaqList,
  FeatureGrid,
  RelatedLinks,
  Section,
  SectionHeading,
  Steps,
  faqJsonLd,
  type Faq,
} from "@/app/components/marketing/sections";
import { pageMetadata } from "@/lib/seo";
import { THERAPIST_REVENUE_SHARE, THERAPIST_PAID_ON_LIST_PRICE } from "@/lib/constants";

/**
 * Supply-side acquisition, which had no page at all.
 *
 * There is a complete therapist onboarding flow with KYC document upload
 * behind `/onboarding/therapist`, and the only route to it from the public
 * site was a `mailto:` buried in the careers page. A marketplace needs its
 * supply-side landing page as much as its demand-side one.
 *
 * ## The revenue share is stated as a number
 *
 * `THERAPIST_REVENUE_SHARE` is read from `lib/constants.ts` rather than typed,
 * for the same reason the pricing page reads its figures: a recruiting page
 * quoting a different split from the one the payout ledger actually applies is
 * a contract dispute rather than a typo.
 *
 * `THERAPIST_PAID_ON_LIST_PRICE` is surfaced too, because it is the thing a
 * clinician would most want to know and least expect to be told: whether a
 * marketing promotion quietly reduces their fee. The constant's own comment
 * spells out what the flag costs the business either way.
 */
export const metadata = pageMetadata({
  title: "Join Echo Health as a therapist",
  description:
    "Practise online with Echo Health. Set your own hours, keep a fixed share of every session, and let us handle matching, scheduling, payments and the platform.",
  path: "/therapist-jobs",
});

const SHARE_PERCENT = Math.round(THERAPIST_REVENUE_SHARE * 100);

const BENEFITS = [
  {
    icon: Wallet,
    title: `A fixed ${SHARE_PERCENT}% of every session`,
    body: THERAPIST_PAID_ON_LIST_PRICE
      ? `Calculated on the plan's list price, not on whatever a client paid after a promotion. If we run a discount, we fund it — your fee for the same fifty minutes does not move.`
      : `Calculated on the amount the client paid, so a promotional discount reduces the fee for that session.`,
  },
  {
    icon: CalendarClock,
    title: "Your hours, your calendar",
    body: "You publish the times you are willing to work and clients book inside them. No minimum caseload, no shifts, no obligation to take anyone we send you.",
  },
  {
    icon: Laptop,
    title: "No practice overhead",
    body: "No room to rent, no receptionist, no billing admin and no chasing payments. Matching, scheduling, video and money are the platform's problem.",
  },
  {
    icon: ShieldCheck,
    title: "Clinical records that stay yours",
    body: "Your clinical notes are readable by you and by administrators for audit — never by the client, and never by another therapist. That boundary is enforced by the database, not by convention.",
  },
  {
    icon: BadgeCheck,
    title: "Colleagues who were checked too",
    body: "Every practitioner on the platform clears the same credential review before their profile goes live. Nobody appears in the directory unverified.",
  },
  {
    icon: FileCheck2,
    title: "You stay independent",
    body: "You practise under your own licence, as an independent practitioner, and keep your own indemnity cover. Echo is the platform you work through, not your employer.",
  },
];

const STEPS = [
  {
    icon: FileCheck2,
    title: "Apply and upload credentials",
    body: "Your licence, your identity document and a short professional profile. Fifteen minutes if your documents are to hand.",
  },
  {
    icon: BadgeCheck,
    title: "We verify",
    body: "A member of our team checks your licence against the issuing body. If something is missing you hear exactly what, not a rejection with no reason.",
  },
  {
    icon: CalendarClock,
    title: "Publish your hours",
    body: "Set your availability in your own time zone, write your profile, and go live in the public directory. Clients can then find and book you.",
  },
];

const REQUIREMENTS = [
  "A current licence or registration to practise as a mental-health professional in Kenya.",
  "Professional indemnity cover you hold in your own name.",
  "A private space and a connection good enough for video sessions.",
  "Willingness to publish a profile under your real name — the directory is public, and that is the point.",
  "Capacity to respond to client messages within your stated working hours.",
];

const FAQS: readonly Faq[] = [
  {
    q: "How and when am I paid?",
    a: `You keep ${SHARE_PERCENT}% of each session's value. Earnings accrue to a payout ledger as each session completes, and the amount owed is recorded at that moment as a fact — so a later change to the revenue share can never restate what you have already earned.`,
  },
  {
    q: "Does a promotional discount reduce my fee?",
    a: THERAPIST_PAID_ON_LIST_PRICE
      ? "No. Your share is calculated on the plan's list price. If marketing runs a 50% promotion, the platform absorbs it — your fee for the same fifty minutes is unchanged. We are explicit about this because a clinician's rate quietly moving because of a campaign they did not authorise and cannot see is not a defensible way to run a marketplace."
      : "Yes. Your share is calculated on the amount the client actually paid, so a promotional discount reduces the fee for that session.",
  },
  {
    q: "Am I an employee?",
    a: "No. You practise as an independent professional under your own licence and your own indemnity cover, choosing your own hours and your own caseload. Echo provides the platform, the clients and the payment rail.",
  },
  {
    q: "How many clients will I get?",
    a: "We cannot promise a number and will not pretend otherwise — it depends on your specialties, your availability and demand at the time. What we can say is how matching works: our team reads a client's intake answers and suggests therapists whose focus and hours fit. Publishing more availability, and specialties that are in demand, is what moves it.",
  },
  {
    q: "What happens if a client is in crisis?",
    a: "Echo is not a crisis service and neither you nor we are expected to act as one. The platform surfaces verified crisis lines to clients throughout the product, and there is an internal escalation route for concerns raised in session. Your own professional judgement and duty of care apply exactly as they would in a room.",
  },
  {
    q: "Can I see what a client wrote before our first session?",
    a: "You see what is relevant to matching and preparing — what they said they want to work on, their preferences and their availability. You do not see another therapist's clinical notes, and clients never see yours.",
  },
  {
    q: "What if I want to leave?",
    a: "Unpublish your availability and finish with the clients you have. There is no notice period and no exit fee. We will help those clients find someone else.",
  },
];

export default function TherapistJobsPage() {
  return (
    <>
      <JsonLd data={faqJsonLd(FAQS)} />
      <Breadcrumbs trail={[{ href: "/therapist-jobs", label: "Join as a therapist" }]} />

      <section className="bg-hero-soft px-4 pb-16 pt-6 sm:px-6 sm:pb-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            For clinicians
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
            Practise online. Keep the practice, lose the overhead.
          </h1>
          <p className="mt-6 text-[17px] leading-8 text-stone-600">
            Echo handles matching, scheduling, video and payments. You do the
            work you trained for, in the hours you choose, for a fixed share of
            every session that does not move when marketing runs a promotion.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/onboarding/therapist"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-white shadow-lg shadow-brand-900/15 transition-colors hover:bg-brand-700"
            >
              Start an application
            </Link>
            <Link
              href="/therapists"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-surface px-7 text-sm font-semibold text-stone-800 shadow-sm ring-1 ring-inset ring-stone-300 transition hover:ring-stone-400"
            >
              See who already practises here
            </Link>
          </div>
        </div>
      </section>

      <Section>
        <SectionHeading eyebrow="What you get" title="The terms, stated plainly" />
        <FeatureGrid features={BENEFITS} columns={3} />
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Applying"
          title="Three steps, and a real person reads it"
          body="Credential checks are done by our team, not by a form that either accepts or silently rejects you."
        />
        <Steps steps={STEPS} />
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading as="h3" title="What you'll need" align="left" />
            <div className="mt-7">
              <CheckList items={REQUIREMENTS} />
            </div>
          </div>
          <div className="rounded-3xl bg-stone-50 p-8">
            <h3 className="font-display text-2xl tracking-tight text-stone-900">
              What we won&apos;t ask of you
            </h3>
            <ul className="mt-6 flex flex-col gap-4 text-[15px] leading-7 text-stone-600">
              <li>A minimum number of sessions a week.</li>
              <li>Exclusivity — keep your own practice, and your other platforms.</li>
              <li>To accept a client we suggest, if you do not think you are the right person for them.</li>
              <li>To be reachable outside the hours you publish.</li>
              <li>To take part in a promotion that reduces your own fee.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          <SectionHeading title="Questions clinicians ask" />
          <FaqList faqs={FAQS} />
        </div>
      </Section>

      <RelatedLinks
        title="More about Echo"
        links={[
          { href: "/about", label: "About us" },
          { href: "/how-it-works", label: "How the client side works" },
          { href: "/careers", label: "Non-clinical roles" },
          { href: "/contact", label: "Ask us something" },
        ]}
      />

      <CtaBand
        title="Bring your practice online."
        body="Fifteen minutes to apply if your licence and ID are to hand. A person reviews it, and tells you either way."
        href="/onboarding/therapist"
        label="Start an application"
      />
    </>
  );
}
