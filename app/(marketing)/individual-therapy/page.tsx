import Link from "next/link";
import { CalendarCheck, LifeBuoy, Search, Video } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import JsonLd from "@/app/components/marketing/JsonLd";
import {
  CheckList,
  CtaBand,
  CtaButton,
  Eyebrow,
  FaqList,
  RelatedLinks,
  Section,
  SectionHeading,
  Steps,
  faqJsonLd,
} from "@/app/components/marketing/sections";
import type { Faq } from "@/app/components/marketing/sections";
import { CONDITIONS } from "@/lib/navigation";
import { MARKETS } from "@/lib/markets";
import {
  PLAN_CURRENCY,
  formatKes as money,
  PLAN_PERIOD_LABELS,
  PLAN_PRICES,
  PLAN_SESSIONS,
} from "@/lib/constants";
import { legalEntityName, pageMetadata, siteUrl } from "@/lib/seo";

/**
 * One-to-one therapy — the service most people mean when they say "therapy".
 *
 * The copy here deliberately refuses two things the category usually does:
 * it does not predict how many sessions you will need, and it does not claim
 * an outcome. Both are unknowable in advance, both are routinely asserted on
 * pages like this one, and a person deciding whether to spend money on their
 * own mental health deserves the version that is true.
 *
 * Kenya appears on this page only as a disclosure — the licence your therapist
 * holds, the clock their availability is published on, the currency the card is
 * charged in. It is not a statement about who may book: the clinicians are
 * Kenyan, the clients are worldwide (`lib/markets.ts`).
 */


export const metadata = pageMetadata({
  title: "Individual therapy online: what to expect",
  description:
    "One-to-one online therapy with a therapist licensed in Kenya, booked from anywhere. What a 50-minute session involves, which approaches are used, and what it costs.",
  path: "/individual-therapy",
});

const STEPS = [
  {
    icon: Search,
    title: "Say what is going on",
    body: "A few questions about what you want help with and when you are free. You do not need the right words for it — \"I can't really explain it\" is a normal answer and a workable one.",
  },
  {
    icon: CalendarCheck,
    title: "Choose your therapist",
    body: "You see therapists whose training and availability match what you described, and you pick. If the fit is wrong after a session or two, email us and we will move you — there is no charge, and unused credits stay with you.",
  },
  {
    icon: Video,
    title: "Fifty minutes, in the browser",
    body: "Same therapist, same slot, as often as you choose to book. Availability is published in East Africa Time (GMT+3), so check a slot against your own clock before you take it. Nothing to install, and camera off is a normal way to use a session rather than a downgrade.",
  },
];

const GOOD_FOR = [
  "Something specific you want to work through — a loss, a decision, an event that keeps returning.",
  "A pattern that has followed you across jobs, friendships or relationships.",
  "Low mood, anxiety or stress that has stopped shifting on its own.",
  "Wanting somewhere to think out loud that is not your partner, your family or your colleagues.",
  "Working on a relationship when the other person will not come — which is common, and not second best.",
];

const APPROACHES = [
  {
    name: "Cognitive behavioural therapy (CBT)",
    body: "Structured, present-focused work on the link between what you think, what you do, and how you feel. The most researched of the talking therapies, and usually the shortest.",
  },
  {
    name: "Behavioural activation",
    body: "Used mainly for depression. Puts activity back in ahead of motivation, because in depression motivation tends to follow action rather than arrive before it.",
  },
  {
    name: "Trauma-focused approaches",
    body: "Trauma-focused CBT and EMDR, for memories that are still operating in the present tense. Both start with stabilisation rather than with the memory itself.",
  },
  {
    name: "Compassion-focused therapy",
    body: "For people whose main difficulty is shame and self-attack, and for whom argument with the inner critic has never worked.",
  },
  {
    name: "Acceptance and commitment therapy (ACT)",
    body: "Moves the goal from removing a feeling to acting on what matters while it is present. Useful when years of trying to get rid of something have become the problem.",
  },
  {
    name: "Person-centred and integrative work",
    body: "Less protocol, more space. Sometimes the right answer is a skilled person who listens properly and asks better questions than anyone else in your life will.",
  },
];

const FAQS: readonly Faq[] = [
  {
    q: "How many sessions will I need?",
    a: "Nobody can honestly answer that before meeting you, and it is worth being sceptical of anyone who does. Some people come with one specific thing and work through it in a handful of sessions; others stay for months. What you can reasonably ask for, early on, is a shared sense of what you are working on and how you will both know whether it is helping.",
  },
  {
    q: "What happens in a first session?",
    a: "Mostly listening and asking. Your therapist will want to know what brought you, how long it has been going on, what you have already tried, how you are sleeping and eating, and whether anything is unsafe. You do not need to arrive organised, and nothing you say obliges you to book again.",
  },
  {
    q: "What if I do not click with my therapist?",
    a: "Tell us. Fit is the part of therapy that most reliably predicts whether it is useful, and it is not a personal failing on anyone's side. Email support@echohealth.app or message us from your dashboard and we will match you with someone else — there is no charge to switch, and any unused session credits stay with you.",
  },
  {
    q: "Can I message my therapist between sessions?",
    a: "Yes, securely, in the platform. It is there to support the sessions rather than replace them, and it is not monitored around the clock — so it is not the route for anything urgent.",
  },
  {
    q: "Can Echo prescribe medication or give me a diagnosis for work?",
    a: "No to both. Echo therapists do not prescribe or adjust medication, and do not issue diagnoses or reports for insurers, employers, schools or courts. If medication is worth considering, that is a conversation with a doctor — and therapy can run alongside it.",
  },
  {
    q: "Where is my therapist licensed, and can I book from outside Kenya?",
    a: "Echo's therapists hold Kenyan licences, and sessions are online, so being elsewhere changes three practical things rather than whether you can book. Licensure: your therapist is not registered by the regulator where you live, which is fine for the therapy and no substitute if an insurer, an employer or a court requires a local provider. Scheduling: availability is published in East Africa Time (GMT+3), which overlaps an ordinary working day across Africa, the Gulf and the UK, and narrows to your morning in North America. Payment: the charge settles in Kenyan shillings whatever your card's currency.",
  },
  {
    q: "Is it confidential?",
    a: "Video runs directly between you and your therapist rather than being recorded by us, and notes and messages sit behind per-record access controls. Your therapist will explain at the start the narrow circumstances in which they would have to break confidentiality — essentially, a serious risk of harm to you or someone else. Echo is a Kenyan data controller, so your records are handled under Kenya's Data Protection Act 2019, which gives you the right to access, correct or delete them.",
  },
];

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Individual therapy",
  serviceType: "Individual psychotherapy and counselling, delivered online",
  url: `${siteUrl}/individual-therapy`,
  provider: {
    "@type": "Organization",
    name: legalEntityName,
    alternateName: "Echo Health",
    url: siteUrl,
  },
  /* Was `{ name: "Kenya" }`, which declared a one-country service area. The
     clinicians are Kenyan; the clients are not. Read from `lib/markets.ts` so
     this cannot drift from the country pages. */
  areaServed: MARKETS.map((m) => ({
    "@type": "Country",
    name: m.country.replace(/^the /, ""),
  })),
  availableChannel: {
    "@type": "ServiceChannel",
    serviceUrl: `${siteUrl}/get-started`,
    availableLanguage: { "@type": "Language", name: "English" },
  },
  offers: [
    {
      "@type": "Offer",
      name: "Single session",
      price: PLAN_PRICES.individual,
      priceCurrency: PLAN_CURRENCY,
      url: `${siteUrl}/pricing`,
    },
    {
      "@type": "Offer",
      name: "Plus",
      price: PLAN_PRICES.plus,
      priceCurrency: PLAN_CURRENCY,
      url: `${siteUrl}/pricing`,
    },
  ],
};

const medicalWebPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  name: "Individual therapy online",
  url: `${siteUrl}/individual-therapy`,
  inLanguage: "en",
  audience: { "@type": "Patient" },
};

export default function IndividualTherapyPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/individual-therapy", label: "Individual therapy" }]} />
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={medicalWebPageJsonLd} />
      <JsonLd data={faqJsonLd(FAQS)} />

      <section className="curve-down bg-hero-soft px-4 pb-24 pt-8 [--curve-to:#fff] sm:px-6 sm:pb-32 sm:pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Individual therapy</Eyebrow>
          <h1 className="mt-4 font-display text-4xl tracking-tight text-stone-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
            Fifty minutes that are only about you
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-stone-600">
            One-to-one sessions over video, from wherever you can close a door.
            Your therapist is licensed in Kenya rather than in your own country,
            and keeps hours on East Africa Time. No diagnosis required to book,
            and no subscription to leave running afterwards.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaButton href="/get-started">Find your therapist</CtaButton>
            <CtaButton href="/therapists" variant="secondary">
              Browse therapists
            </CtaButton>
          </div>
          <p className="mt-5 text-sm text-stone-500">
            {money(PLAN_PRICES.individual)} {PLAN_PERIOD_LABELS.individual}. Credits never expire.
          </p>
        </div>
      </section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="What it is"
            title="Therapy, with nobody else in the room"
          />
          <div className="mt-8 flex flex-col gap-5 text-[17px] leading-8 text-stone-600">
            <p>
              Individual therapy is a recurring fifty-minute conversation with
              one trained person whose entire job, for that time, is your
              situation. Not advice, and not a friend who happens to be patient —
              a clinician working with recognised methods towards something you
              have both agreed you are trying to change.
            </p>
            <p>
              It is the format most people mean when they say therapy, and it is
              what most of the research on talking therapy is about. It is also
              the right starting point when you want to work on a relationship
              and the other person will not come — you can only change your own
              half of a pattern anyway, and changing it often changes the
              pattern.
            </p>
            <p>
              You do not need a diagnosis, a crisis, or a reason that sounds
              serious enough. &ldquo;This has quietly shaped my life for twenty
              years&rdquo; is as legitimate a reason to book as any.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="How it works"
          title="From intake to first session"
          body="About three minutes of admin, and then a real appointment with a real person."
        />
        <Steps steps={STEPS} />
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Who it is for"
              title="Individual therapy tends to suit…"
            />
            <div className="mt-9 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 sm:p-8">
              <CheckList items={GOOD_FOR} />
            </div>
          </div>
          <div className="lg:pt-2">
            <SectionHeading
              align="left"
              as="h3"
              title="And is not the right service if…"
              body="Naming this matters more than the booking does."
            />
            <div className="mt-9 flex flex-col gap-4 text-[15px] leading-7 text-stone-700">
              <p className="rounded-3xl bg-stone-50 p-5 ring-1 ring-stone-200/70">
                You are in crisis or someone is in immediate danger. Echo is not
                an emergency service and nobody is watching for urgent messages.
              </p>
              <p className="rounded-3xl bg-stone-50 p-5 ring-1 ring-stone-200/70">
                You need medication prescribed or reviewed, or a diagnosis for an
                insurer, an employer, a school or a court. We do neither.
              </p>
              <p className="rounded-3xl bg-stone-50 p-5 ring-1 ring-stone-200/70">
                You need a level of care online sessions cannot hold — inpatient
                treatment, an eating disorder requiring medical monitoring, or
                active psychosis.
              </p>
              <p className="rounded-3xl bg-stone-50 p-5 ring-1 ring-stone-200/70">
                You are under 18. A parent or guardian has to start the account
                and consent —{" "}
                <Link href="/teen-therapy" className="font-semibold text-brand-700 underline underline-offset-2">
                  see teen therapy
                </Link>
                .
              </p>
            </div>
            <div className="mt-6 flex items-start gap-3 rounded-3xl bg-brand-50 p-6 ring-1 ring-brand-100">
              <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden="true" />
              <p className="text-sm leading-6 text-stone-700">
                In immediate danger? Contact your local emergency number, or see
                our{" "}
                <Link href="/crisis" className="font-semibold text-brand-700 underline underline-offset-2">
                  verified crisis lines
                </Link>
                , which include a directory that finds one wherever you are.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="The methods"
          title="What your therapist may actually use"
          body="Which approach fits is a conversation with your therapist, not something a website decides. None of them is a guaranteed outcome, and a good therapist will tell you what they are doing and why."
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {APPROACHES.map((a) => (
            <div key={a.name} className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70">
              <h3 className="font-semibold text-stone-900">{a.name}</h3>
              <p className="mt-3 text-[15px] leading-7 text-stone-600">{a.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading
            eyebrow="What it costs"
            title="Pay for what you use"
            body="One-time purchases. Nothing recurs, nothing auto-renews, and there is no subscription to cancel."
          />
          <dl className="mt-12 grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl bg-white p-7 text-left shadow-sm ring-1 ring-stone-200/70 sm:p-8">
              <dt className="font-semibold text-stone-900">A single session</dt>
              <dd className="mt-4 font-display text-4xl tracking-tight text-stone-900">
                {money(PLAN_PRICES.individual)}
              </dd>
              <dd className="mt-1 text-sm text-stone-500">
                {PLAN_SESSIONS.individual} × 50-minute session
              </dd>
              <dd className="mt-4 text-[15px] leading-7 text-stone-600">
                The honest way to find out whether therapy — and this therapist —
                is for you.
              </dd>
            </div>
            <div className="rounded-3xl bg-white p-7 text-left shadow-sm ring-1 ring-stone-200/70 sm:p-8">
              <dt className="font-semibold text-stone-900">Plus</dt>
              <dd className="mt-4 font-display text-4xl tracking-tight text-stone-900">
                {money(PLAN_PRICES.plus)}
              </dd>
              <dd className="mt-1 text-sm text-stone-500">
                {PLAN_SESSIONS.plus} sessions, plus therapy materials
              </dd>
              <dd className="mt-4 text-[15px] leading-7 text-stone-600">
                For when you already know you want to start properly rather than
                test the water.
              </dd>
            </div>
          </dl>
          <div className="mt-10 flex flex-col items-center gap-4">
            <CtaButton href="/pricing" variant="secondary">
              See the full comparison
            </CtaButton>
            <p className="max-w-xl text-sm leading-7 text-stone-500">
              Card or bank transfer through Paystack, or M-Pesa if you hold a
              Kenyan mobile-money account. Charged in Kenyan shillings whatever
              your own currency. Cancel a booked session at least 24 hours ahead
              and the credit returns to your account.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="Questions"
            title="Individual therapy, answered plainly"
          />
          <FaqList faqs={FAQS} />
        </div>
      </Section>

      <CtaBand
        title="One session is a reasonable place to start"
        body="No subscription, no auto-renewal, and credits that do not expire. Answer a few questions and we will match you with a licensed therapist."
        label="Find your therapist"
      />

      <RelatedLinks
        title="Related pages"
        links={[
          { href: "/couples-therapy", label: "Couples therapy" },
          { href: "/teen-therapy", label: "Teen therapy" },
          { href: "/online-therapy", label: "How online therapy works" },
          { href: "/therapy-for", label: "What we help with" },
          ...CONDITIONS.map((c) => ({
            href: `/therapy-for/${c.slug}`,
            label: `Therapy for ${c.short}`,
          })),
          ...MARKETS.map((m) => ({
            href: `/online-therapy/${m.slug}`,
            label: `Therapy in ${m.country}`,
          })),
        ]}
      />
    </>
  );
}
