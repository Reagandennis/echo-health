import Link from "next/link";
import { BadgeCheck, Eye, MessageSquareWarning, RefreshCw, ScrollText, Wallet } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import JsonLd from "@/app/components/marketing/JsonLd";
import {
  CtaBand,
  FaqList,
  FeatureGrid,
  RelatedLinks,
  Section,
  SectionHeading,
  faqJsonLd,
  type Faq,
} from "@/app/components/marketing/sections";
import { pageMetadata } from "@/lib/seo";

/**
 * ## Why this page has no reviews on it
 *
 * This is the one place the redesign deliberately departs from the pattern it
 * is modelled on, and the reasoning should outlive whoever next opens the file.
 *
 * A competitor's reviews page is its highest-converting asset: thousands of
 * quotes, each stamped with the presenting issue and how long the person had
 * been in therapy. We cannot build that, for two separate reasons, and only
 * the first is about us not having the data yet.
 *
 *  1. **There is nothing to publish.** `session_feedback` holds a rating and
 *     an optional comment, and it is early. Inventing the page's contents is
 *     precisely what the fabricated testimonials on the old home page did —
 *     three named people with invented quotes, sitting above a price.
 *
 *  2. **Even with the data, publishing it would be wrong.** A client writes
 *     session feedback to their therapist and to our quality review. Nobody
 *     consented to being quoted on a marketing page, and consent obtained from
 *     someone currently in your care is not freely given — which is why
 *     soliciting testimonials from current clients is restricted or prohibited
 *     under most psychology codes of practice. A quote reading "anxiety, six
 *     weeks" is health information about an identifiable person the moment
 *     anyone who knows them reads it.
 *
 * So the page does the job a reviews page does — help someone decide whether
 * to trust us — using things that are checkable instead of things that are
 * flattering. If a properly consented testimonial programme is ever built,
 * with opt-in from former clients and review by a clinician, this page is
 * where it goes. Until then, do not fill it with quotes.
 */
export const metadata = pageMetadata({
  title: "Reviews, feedback and how to judge us",
  description:
    "Echo Health does not publish client testimonials, and this page explains why — plus the things you can actually check before trusting a therapy service with something this personal.",
  path: "/reviews",
});

const CHECKABLE = [
  {
    icon: BadgeCheck,
    title: "Every therapist is verifiable",
    body: "Our therapists are independently licensed in Kenya. Their profiles are public, no account needed — read them, and ask us for licence details before you book if you want to confirm them yourself.",
  },
  {
    icon: Wallet,
    title: "The price is the price",
    body: "Every figure is published, in shillings, before you create an account. There is no subscription, nothing renews, and nothing is disclosed at checkout that was not on the pricing page.",
  },
  {
    icon: RefreshCw,
    title: "Leaving is free",
    body: "Switching therapists costs nothing and your unused credits follow you. A service confident in its matching does not need to make leaving expensive.",
  },
  {
    icon: ScrollText,
    title: "We say what we can't do",
    body: "No prescribing, no formal diagnosis, no court-ordered treatment, and not a crisis service. Those limits are on the pricing page and in the FAQ, not buried in the terms.",
  },
  {
    icon: Eye,
    title: "No borrowed credibility",
    body: "There are no press logos we did not earn, no client logos, no invented statistics and no stock photographs presented as our staff or our clients anywhere on this site.",
  },
  {
    icon: MessageSquareWarning,
    title: "Feedback goes somewhere",
    body: "After each session you can rate it and write a note. It goes to your therapist and to our quality review — not to a marketing page.",
  },
];

const FAQS: readonly Faq[] = [
  {
    q: "Why don't you show client testimonials?",
    a: "Two reasons. We are early, so there would be very little to show — and inventing it is not an option. More importantly, feedback written after a therapy session is written to a therapist, not for publication. Asking someone currently in your care for a quote you will use in advertising is not a request they are in a good position to decline, which is why most psychology codes of practice restrict it.",
  },
  {
    q: "Doesn't every other therapy service publish reviews?",
    a: "Most do, and some obtain consent properly. Judge any of them the same way you would judge us: ask whether the reviews could have been declined without cost, whether the quotes carry details the person might not want published, and whether the service pays for or incentivises them.",
  },
  {
    q: "So how do I know Echo is any good?",
    a: "By the things on this page that you can check without taking our word for anything: whether the therapists are really licensed, whether the price you were shown is the price you are charged, and whether you can leave without penalty. Then by one session, which is the smallest thing we sell precisely so that trying us is a small decision.",
  },
  {
    q: "Can I leave feedback about my therapist?",
    a: "Yes, and please do — you can rate every session and add a note. It goes to your therapist and to the team that reviews session quality. If something went wrong, contact support directly rather than leaving it in session feedback, so it reaches a person the same day.",
  },
  {
    q: "Will you publish reviews in future?",
    a: "Possibly, if we can do it properly: opt-in from people who have finished therapy rather than people still in it, reviewed by a clinician, with no detail that could identify someone. If you see quotes appear on this page, that is the standard they were collected to.",
  },
];

export default function ReviewsPage() {
  return (
    <>
      <JsonLd data={faqJsonLd(FAQS)} />
      <Breadcrumbs trail={[{ href: "/reviews", label: "Reviews" }]} />

      <section className="bg-hero-soft px-4 pb-16 pt-6 sm:px-6 sm:pb-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
            We don&apos;t publish client testimonials
          </h1>
          <p className="mt-6 text-[17px] leading-8 text-stone-600">
            You came here to find out whether Echo is any good, and the honest
            answer is that a wall of five-star quotes would not have told you.
            What someone writes to their therapist after a session is written to
            their therapist. We are not going to put it in an advert, and we are
            certainly not going to make it up.
          </p>
          <p className="mt-5 text-[17px] leading-8 text-stone-600">
            Here is what you can check instead.
          </p>
        </div>
      </section>

      <Section>
        <SectionHeading
          eyebrow="Instead of reviews"
          title="Six things you can verify yourself"
          body="None of these require you to trust us. That is the point of them."
        />
        <FeatureGrid features={CHECKABLE} columns={3} />
      </Section>

      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          <SectionHeading as="h3" title="If you are comparing services" align="left" />
          <p className="mt-5 text-[15px] leading-7 text-stone-600">
            Whoever you end up with — and it does not have to be us — these are
            worth asking of any online therapy service:
          </p>
          <ol className="mt-7 flex list-decimal flex-col gap-4 pl-5 text-[15px] leading-7 text-stone-600 marker:font-semibold marker:text-stone-400">
            <li>
              <strong className="text-stone-900">Can I see who the therapists are before I pay?</strong>{" "}
              If the roster is behind a signup wall, you are agreeing to a
              stranger.
            </li>
            <li>
              <strong className="text-stone-900">What is the total I will be charged, and does it repeat?</strong>{" "}
              A weekly price quoted as a monthly bill is the most common way
              this industry surprises people.
            </li>
            <li>
              <strong className="text-stone-900">What happens if I stop?</strong>{" "}
              Ask specifically what happens to money already paid.
            </li>
            <li>
              <strong className="text-stone-900">Which regulator licenses the therapists, and where?</strong>{" "}
              A service quoting a foreign compliance regime is telling you the
              rules it names do not govern your data.
            </li>
            <li>
              <strong className="text-stone-900">What does the service say it cannot do?</strong>{" "}
              A service that claims no limits has not thought about them, or is
              not telling you.
            </li>
          </ol>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading title="Questions about this" />
          <FaqList faqs={FAQS} />
        </div>
      </Section>

      <Section tone="muted">
        <div className="mx-auto max-w-2xl rounded-3xl bg-surface p-8 text-center shadow-sm ring-1 ring-stone-200/70 sm:p-10">
          <h2 className="font-display text-2xl tracking-tight text-stone-900">
            Something went wrong with your care?
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-stone-600">
            Tell us directly rather than leaving it in session feedback. A
            complaint about a clinician reaches a person the same day, and you
            can ask to be matched with someone else at the same time.
          </p>
          <Link
            href="/contact"
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Contact us
          </Link>
        </div>
      </Section>

      <RelatedLinks
        title="Judge for yourself"
        links={[
          { href: "/therapists", label: "Read the therapist profiles" },
          { href: "/pricing", label: "See every price" },
          { href: "/how-it-works", label: "How it works" },
          { href: "/faq", label: "All questions" },
          { href: "/privacy", label: "What we do with your data" },
        ]}
      />

      <CtaBand
        title="One session is the smallest thing we sell."
        body="On purpose. Trying us should be a small decision, not a commitment you have to talk yourself into."
      />
    </>
  );
}
