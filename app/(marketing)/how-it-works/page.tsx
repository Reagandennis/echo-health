import {
  CalendarCheck,
  CreditCard,
  HeartHandshake,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Video,
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
import { pageMetadata, siteUrl } from "@/lib/seo";
import { PLAN_CURRENCY, PLAN_PRICES } from "@/lib/constants";

/**
 * The content of the home page's `#how` anchor, given a URL.
 *
 * "How it works" was three cards on the home page that the footer linked to
 * from every page in the site as `/#how`. That is a high-intent query
 * ("how does online therapy work") pointed at a fragment, which cannot rank,
 * cannot carry a description, and cannot be a search result on its own.
 */
export const metadata = pageMetadata({
  title: "How Echo Health works",
  description:
    "From a three-minute questionnaire to your first 50-minute session: how matching, booking, paying and switching therapists work on Echo Health.",
  path: "/how-it-works",
});

const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: PLAN_CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);

const STEPS = [
  {
    icon: Search,
    title: "Tell us what you need",
    body: "A short questionnaire about what you'd like to work on, what you'd want in a therapist, and when you could meet. Roughly three minutes.",
  },
  {
    icon: CalendarCheck,
    title: "We introduce you",
    body: "Our team reads your answers and suggests a licensed therapist whose focus and hours fit. We aim to do this within 24 hours of sign-up.",
  },
  {
    icon: HeartHandshake,
    title: "Book your first session",
    body: "Pick a time from your therapist's real availability and meet by video, phone or message. Fifty minutes, from wherever you are.",
  },
];

const DETAIL = [
  {
    icon: Video,
    title: "Three ways to meet",
    body: "Video, a plain phone call with no camera, or written messages. You are not locked in — change format between sessions as suits you.",
  },
  {
    icon: MessageSquare,
    title: "Between the sessions",
    body: "Secure in-app messaging. Therapists reply during their working hours, not instantly — this is not a chat line, and treating it as one would be a promise we cannot keep.",
  },
  {
    icon: RefreshCw,
    title: "If it isn't a fit",
    body: "Tell us and we will match you with someone else, at no charge. Unused session credits stay with you. The fit between you and your therapist is the part of therapy that most predicts whether it helps.",
  },
  {
    icon: CreditCard,
    title: "How you pay",
    body: `A one-time payment for a bundle of sessions, from ${money(PLAN_PRICES.individual)}. M-Pesa, card or bank transfer. Nothing renews and there is no card left on file charging you monthly.`,
  },
  {
    icon: CalendarCheck,
    title: "Moving a session",
    body: "Cancel at least 24 hours ahead and the credit returns to your account. Inside 24 hours it is spent, because your therapist held that hour and cannot fill it.",
  },
  {
    icon: ShieldCheck,
    title: "Who sees what",
    body: "Sessions and messages are visible only to you and your therapist. Your therapist keeps clinical notes that you do not see and that no other client or support agent can read.",
  },
];

const FIRST_SESSION = [
  "Your therapist will ask what brought you here and what you would like to be different.",
  "You will not be asked to relive anything you are not ready to talk about.",
  "They will explain confidentiality and its limits — what stays between you, and the narrow circumstances where it cannot.",
  "You will agree roughly what the next few sessions are for. This can change.",
  "It is normal to leave a first session feeling it was mostly admin. That is what a first session is.",
];

const NOT_FOR = [
  "You are in immediate danger, or someone else is — call 999 or 112, or see our crisis page.",
  "You need medication prescribed, changed or monitored. Echo cannot prescribe.",
  "You need a formal diagnosis for a court, an insurer, a school or an employer.",
  "You have been ordered into therapy by a court — we cannot fulfil court-mandated treatment.",
  "You do not have a reliable internet connection or a private place to talk.",
];

const FAQS: readonly Faq[] = [
  {
    q: "How long until I'm matched with a therapist?",
    a: "We aim to introduce you within 24 hours of sign-up. If nobody suitable is free in that window we will tell you rather than match you with someone who is not a good fit, because a bad match is the most common reason people give up on therapy entirely.",
  },
  {
    q: "Can I choose my own therapist instead of being matched?",
    a: "Yes. The directory is public and you do not need an account to browse it — read the profiles, find someone whose focus fits, and start with them. The questionnaire is there for people who would rather not have to choose.",
  },
  {
    q: "How long are sessions, and how often should I have them?",
    a: "Sessions are 50 minutes, which is the standard therapeutic hour. How often is between you and your therapist; many people start weekly or fortnightly and taper. Because credits never expire, you are not paying for a cadence you cannot keep.",
  },
  {
    q: "What do I need for a video session?",
    a: "A phone, tablet or computer with a camera and a reasonably stable connection, and somewhere you can speak privately. If your connection is poor, switch to a phone session — audio needs far less bandwidth and the therapy is not worse for it.",
  },
  {
    q: "Do I have to turn my camera on?",
    a: "No. Plenty of people find it easier to talk without being looked at, especially early on. Phone sessions exist for exactly this reason and your therapist will not treat it as avoidance.",
  },
  {
    q: "What happens in the very first session?",
    a: "Mostly orientation: what brought you here, what you want to be different, how your therapist works, and what confidentiality does and does not cover. You will not be pushed to go into anything you are not ready for.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd data={faqJsonLd(FAQS)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to start therapy with Echo Health",
          description:
            "Answer a short questionnaire, get matched with a licensed therapist, and book a 50-minute session.",
          url: `${siteUrl}/how-it-works`,
          step: STEPS.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.title,
            text: s.body,
          })),
        }}
      />
      <Breadcrumbs trail={[{ href: "/how-it-works", label: "How it works" }]} />

      <section className="bg-hero-soft px-4 pb-16 pt-6 sm:px-6 sm:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
            How Echo Health works
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-8 text-stone-600">
            No referral letter, no waiting list, no phoning round to find out
            who has space. Here is the whole process, including the parts most
            services leave out.
          </p>
        </div>
      </section>

      <Section>
        <SectionHeading eyebrow="The short version" title="Three steps to a first session" />
        <Steps steps={STEPS} />
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="The detail"
          title="What it's actually like"
          body="The things you only find out after signing up, before you sign up."
        />
        <FeatureGrid features={DETAIL} columns={3} />
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading as="h3" title="Your first session" align="left" />
            <p className="mt-5 text-[15px] leading-7 text-stone-600">
              The first one is not really therapy yet — it is two people working
              out whether they can work together.
            </p>
            <div className="mt-7">
              <CheckList items={FIRST_SESSION} />
            </div>
          </div>
          <div>
            <SectionHeading as="h3" title="When Echo is the wrong choice" align="left" />
            <p className="mt-5 text-[15px] leading-7 text-stone-600">
              We would rather say this now than take a payment from someone we
              cannot help.
            </p>
            <ul className="mt-7 flex flex-col gap-3.5">
              {NOT_FOR.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px]">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400"
                  />
                  <span className="text-stone-600">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-7 rounded-2xl bg-brand-50 p-5 text-sm leading-6 text-brand-900">
              If you need help right now, Echo is not the fastest route.{" "}
              <a href="/crisis" className="font-semibold underline underline-offset-2">
                See verified crisis lines
              </a>{" "}
              — several are free and answer 24 hours a day.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          <SectionHeading title="Questions about the process" />
          <FaqList faqs={FAQS} />
        </div>
      </Section>

      <RelatedLinks
        title="Read next"
        links={[
          { href: "/pricing", label: "What it costs" },
          { href: "/therapists", label: "Meet the therapists" },
          { href: "/online-therapy", label: "About online therapy" },
          { href: "/individual-therapy", label: "Individual therapy" },
          { href: "/couples-therapy", label: "Couples therapy" },
          { href: "/teen-therapy", label: "Teen therapy" },
          { href: "/faq", label: "All questions" },
        ]}
      />

      <CtaBand
        title="Ready when you are."
        body="Three minutes of questions, then a therapist who fits what you told us."
      />
    </>
  );
}
