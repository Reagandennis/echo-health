import Link from "next/link";
import { CalendarCheck, Lock, Phone, ShieldCheck, UserPlus } from "lucide-react";
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
  CRISIS_DIRECTORY_URL,
  CRISIS_REGIONS,
  PLAN_CURRENCY,
  formatKes as money,
  PLAN_PRICES,
  PLAN_SESSIONS,
} from "@/lib/constants";
import { legalEntityName, pageMetadata, siteUrl } from "@/lib/seo";

/**
 * Therapy for 13–17 year olds.
 *
 * ── Why this page is written mostly to the parent ──
 * The account, the consent and the payment are the adult's; the therapy is the
 * young person's. That split is the whole subject of the page, and the section
 * on confidentiality is the part that matters most: a teenager who believes
 * every word will be relayed home does not tell the truth, and therapy that
 * gets no truth is worth nothing. So the page states plainly what a parent does
 * and does not receive — before the booking, not after.
 *
 * ── Crisis routing is global first, Kenya second ──
 * Most families reading this page are not in Kenya (`lib/markets.ts`), so the
 * block below leads with `CRISIS_DIRECTORY_URL` — a directory that geolocates
 * and is maintained by people who do this full time — and offers Childline
 * Kenya as the named regional option beside it. It used to lead with 116, which
 * is toll-free from a Kenyan phone and unreachable from anywhere else: a parent
 * in Toronto was being handed a number that would not connect, at the one
 * moment a dead end costs the most.
 *
 * The Childline entry is read from `lib/constants.ts`, never typed here.
 * `CRISIS_REGIONS` is the repo's highest-consequence data: every number in it
 * was verified against the operating organisation's own site, and the file
 * records the source. Hard-coding "116" into this page would create a second
 * copy that nobody re-verifies. If the lookup below ever fails, that clause
 * renders nothing rather than rendering a guess — see the comment at its use.
 *
 * The 13–17 boundary is not a marketing decision. `app/(marketing)/terms` makes
 * verifiable parental or guardian consent a condition of using the platform for
 * anyone in that range, so this page describes an existing rule rather than
 * inventing one.
 */


/**
 * Looked up by name because that is the stable key in `CRISIS_REGIONS` — the
 * `scope` field is free prose and the array order is not a contract.
 */
const CHILDLINE = CRISIS_REGIONS.find((r) => r.region === "Kenya")?.services.find(
  (s) => s.name === "Childline Kenya"
);

export const metadata = pageMetadata({
  title: "Teen therapy online for ages 13–17",
  description:
    "Online therapy for 13 to 17 year olds, with therapists licensed in Kenya. A parent or guardian consents — and here is exactly how confidentiality works for a teen.",
  path: "/teen-therapy",
});

const STEPS = [
  {
    icon: UserPlus,
    title: "A parent or guardian opens the account",
    body: "The account, the consent and the payment are the adult's. You will be asked to confirm that you hold parental responsibility for the young person and to give consent before a first session is confirmed.",
  },
  {
    icon: CalendarCheck,
    title: "We match on who works with adolescents",
    body: "Not every therapist does. Say in the intake that the client is 13–17 and what is going on, and we put forward practitioners whose training fits. Availability is published in East Africa Time (GMT+3), which is worth holding against a school day where you live — email support@echohealth.app if you want to talk the timing through first.",
  },
  {
    icon: Lock,
    title: "The sessions belong to them",
    body: "Fifty minutes, over video, with the young person and the therapist. You are told that sessions are happening and anything that affects their safety — not a transcript. The section below sets out exactly where that line sits.",
  },
];

const TEENS_BRING = [
  "Anxiety about school, exams, the future, or being looked at.",
  "Low mood that has stopped lifting, and withdrawal from things they used to do.",
  "Friendships, bullying, and what happens online after everyone has gone home.",
  "Family change — separation, a death, a move, a new household.",
  "Anger that arrives faster than they can do anything about.",
  "Self-harm, or thoughts of it. Say so at intake so we match accordingly.",
  "Identity, belonging, and questions they are not ready to ask at home yet.",
];

const NOT_RIGHT_FOR = [
  "Children under 13. Younger children need specialist child training and usually an in-person setting — a paediatrician or a child and adolescent mental health service is the right route.",
  "A young person in crisis right now. Echo is not an emergency service and nobody is monitoring the platform for urgent messages.",
  "An eating disorder needing medical monitoring, or any situation where physical health has to be tracked.",
  "Court-ordered or school-mandated therapy. We cannot certify attendance or report on a young person to a third party.",
  "Medication. Echo therapists do not prescribe, review or adjust it — that is a doctor's decision, and therapy can run alongside one.",
  "A young person who has been brought under duress and has said clearly that they do not want to come. A first session can be about that, but therapy nobody consents to does not work.",
];

const FAQS: readonly Faq[] = [
  {
    q: "Will I be told what my child says in their sessions?",
    a: "Not in detail, and that is deliberate. You can expect to know that sessions are happening, how engagement is going, the broad themes of the work, and anything the therapist judges you need to know for your child's safety. You should not expect a session-by-session account. A teenager who believes everything goes home does not say the difficult thing, and the difficult thing is usually the reason they are there.",
  },
  {
    q: "So what would make a therapist break confidentiality?",
    a: "A serious risk of harm — to your child, or to someone else — or a child-protection concern. In those situations a therapist will act, which may mean telling you and in some cases telling someone else. Your therapist will explain their own policy in plain language at the first session, to your child as well as to you, so that nobody learns where the line is by crossing it.",
  },
  {
    q: "Can I sit in on the session?",
    a: "Usually not, beyond the beginning. Many therapists will start a first session with everyone present to agree how this is going to work, then see the young person alone. Ask the therapist how they prefer to run it, and agree it between the three of you rather than negotiating it in the moment.",
  },
  {
    q: "Can a 16 or 17 year old sign up on their own?",
    a: "No. A parent or guardian has to open the account and consent — that is a condition of using Echo for anyone under 18, and it is in our terms. If you are under 18 and cannot involve an adult at home, please talk to a school counsellor or a trusted adult, or find a helpline where you live at findahelpline.com — it lists them by country, including ones for under-18s.",
  },
  {
    q: "My child's parents are separated. Who consents?",
    a: "The adult who opens the account confirms they hold parental responsibility. Echo is not in a position to adjudicate a disagreement between parents about whether a young person should have therapy, so if that is contested, please resolve it before booking.",
  },
  {
    q: "What does it cost?",
    a: `The same as any other session: ${money(PLAN_PRICES.individual)} for a single 50-minute session, or ${money(PLAN_PRICES.plus)} for the Plus bundle of ${PLAN_SESSIONS.plus} sessions plus materials. One-time purchases — nothing recurs, nothing auto-renews, and credits do not expire. Cancel at least 24 hours ahead and the credit returns to the account.`,
  },
  {
    q: "My teenager does not want to go.",
    a: "Very common, and not automatically a reason to abandon it. What tends to help is giving them some control over it — a say in which therapist, a trial of one session with no commitment beyond it, and honesty from you that you will not be receiving a report afterwards. What does not help is arriving as a punishment.",
  },
];

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Teen therapy",
  serviceType: "Adolescent psychotherapy and counselling, delivered online",
  url: `${siteUrl}/teen-therapy`,
  provider: {
    "@type": "Organization",
    name: legalEntityName,
    alternateName: "Echo Health",
    url: siteUrl,
  },
  /* Was `{ name: "Kenya" }`. The therapists are Kenyan-licensed; the families
     are not. List read from `lib/markets.ts`. */
  areaServed: MARKETS.map((m) => ({
    "@type": "Country",
    name: m.country.replace(/^the /, ""),
  })),
  audience: {
    "@type": "PeopleAudience",
    suggestedMinAge: 13,
    suggestedMaxAge: 17,
  },
  availableChannel: {
    "@type": "ServiceChannel",
    serviceUrl: `${siteUrl}/get-started`,
    availableLanguage: { "@type": "Language", name: "English" },
  },
  offers: {
    "@type": "Offer",
    name: "Single session",
    price: PLAN_PRICES.individual,
    priceCurrency: PLAN_CURRENCY,
    url: `${siteUrl}/pricing`,
  },
};

const medicalWebPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  name: "Teen therapy online for ages 13–17",
  url: `${siteUrl}/teen-therapy`,
  inLanguage: "en",
  audience: {
    "@type": "PeopleAudience",
    suggestedMinAge: 13,
    suggestedMaxAge: 17,
  },
};

export default function TeenTherapyPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/teen-therapy", label: "Teen therapy" }]} />
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={medicalWebPageJsonLd} />
      <JsonLd data={faqJsonLd(FAQS)} />

      <section className="curve-down bg-hero-soft px-4 pb-24 pt-8 [--curve-to:#fff] sm:px-6 sm:pb-32 sm:pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Teen therapy · ages 13–17</Eyebrow>
          <h1 className="mt-4 font-display text-4xl tracking-tight text-stone-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
            Someone to talk to, who is not you
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-stone-600">
            A parent or guardian opens the account and gives consent — and then
            the sessions belong to the young person. The practitioners are
            licensed in Kenya rather than in your own country, and publish their
            hours in East Africa Time.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaButton href="/get-started">Start as a parent or guardian</CtaButton>
            <CtaButton href="/online-therapy" variant="secondary">
              How online therapy works
            </CtaButton>
          </div>

          {/* Under-18 crisis routing, above the fold.
              Ordered global-first on purpose: a toll-free national number is
              worse than useless to a family in another country, so the
              geolocating directory comes before the Kenyan line rather than
              after it. The Childline clause is read from the verified crisis
              data and disappears entirely if that lookup ever fails — a rename
              in `CRISIS_REGIONS` must not produce a number from memory. */}
          <div className="mx-auto mt-10 max-w-xl rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-stone-200">
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.8} aria-hidden="true" />
              <p className="text-sm leading-6 text-stone-600">
                If a young person needs help right now, this is not the place. In
                immediate danger, contact your local emergency number. Otherwise{" "}
                <a
                  href={CRISIS_DIRECTORY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-700 underline underline-offset-2"
                >
                  findahelpline.com
                </a>{" "}
                finds a helpline wherever you are, and our{" "}
                <Link href="/crisis" className="font-semibold text-brand-700 underline underline-offset-2">
                  crisis page
                </Link>{" "}
                lists verified lines with their real opening hours.
                {CHILDLINE && (
                  <>
                    {" "}
                    In Kenya,{" "}
                    <a
                      href={CHILDLINE.href}
                      className="font-semibold text-brand-700 underline underline-offset-2"
                    >
                      {CHILDLINE.name} — {CHILDLINE.contact}
                    </a>{" "}
                    is {CHILDLINE.cost?.toLowerCase() ?? "available"} and answers{" "}
                    {CHILDLINE.availability.toLowerCase()}.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <SectionHeading
          eyebrow="How it works"
          title="You set it up. They do the therapy."
          body="Three things happen before a first session, and only the first one is yours."
        />
        <Steps steps={STEPS} />
      </Section>

      {/* The centrepiece of the page. Deliberately its own section, at full
          width, rather than a paragraph inside an FAQ. */}
      <Section tone="muted">
        <div className="mx-auto max-w-4xl">
          <SectionHeading
            eyebrow="The part parents ask about first"
            title="What confidentiality means for a teenager"
            body="This is worth reading before you book, because getting it wrong at the start is very hard to repair afterwards."
          />

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                <Lock className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-semibold text-stone-900">
                What stays between them and their therapist
              </h3>
              <p className="mt-3 text-[15px] leading-7 text-stone-600">
                The content of the sessions. What they said about school, about
                you, about a friend, about themselves. Not because you are being
                shut out, but because a young person who believes every word goes
                home does not say the difficult thing — and the difficult thing is
                usually the reason they are there.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                <ShieldCheck className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-semibold text-stone-900">
                What you can expect to be told
              </h3>
              <p className="mt-3 text-[15px] leading-7 text-stone-600">
                That sessions are happening and how engagement is going. The broad
                themes of the work, in general terms. Anything the therapist
                judges you need to know for your child&rsquo;s safety. And practical
                things you have to act on — a referral they are recommending, or a
                change in how often they meet.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200 sm:p-9">
            <h3 className="font-display text-2xl tracking-tight text-stone-900">
              Where confidentiality stops
            </h3>
            <p className="mt-4 text-[15px] leading-7 text-stone-600">
              It is not absolute, and no responsible therapist will pretend
              otherwise. If a therapist believes there is a serious risk of harm
              to your child or to someone else, or there is a child-protection
              concern, they will act on it — which may mean telling you, and in
              some cases telling someone else as well.
            </p>
            <p className="mt-4 text-[15px] leading-7 text-stone-600">
              A good therapist explains this to the young person in plain language
              in the first session, before there is anything to disclose, so that
              nobody discovers where the line sits by crossing it. Therapists set
              out their own policy, so ask for theirs and agree it between the
              three of you at the start. That conversation is part of the therapy,
              not paperwork in front of it.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="What teens bring"
              title="Reasons young people start"
            />
            <div className="mt-9 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 sm:p-8">
              <CheckList items={TEENS_BRING} />
            </div>
            <p className="mt-6 text-[15px] leading-7 text-stone-600">
              Several of these have a page of their own —{" "}
              <Link href="/therapy-for/anxiety" className="font-semibold text-brand-700 underline underline-offset-2">
                anxiety
              </Link>
              ,{" "}
              <Link href="/therapy-for/depression" className="font-semibold text-brand-700 underline underline-offset-2">
                depression
              </Link>
              ,{" "}
              <Link href="/therapy-for/grief" className="font-semibold text-brand-700 underline underline-offset-2">
                grief
              </Link>{" "}
              and{" "}
              <Link href="/therapy-for/self-esteem" className="font-semibold text-brand-700 underline underline-offset-2">
                self-esteem
              </Link>{" "}
              cover what each looks like and what the therapy involves.
            </p>
          </div>

          <div className="lg:pt-2">
            <SectionHeading
              align="left"
              as="h3"
              title="When Echo is not the right service"
              body="Some of these need a different kind of help, and some need it today."
            />
            <ul className="mt-9 flex flex-col gap-4">
              {NOT_RIGHT_FOR.map((item) => (
                <li
                  key={item}
                  className="rounded-3xl bg-stone-50 p-5 text-[15px] leading-7 text-stone-700 ring-1 ring-stone-200/70"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Addressed to the young person rather than to the buyer. They are very
          often the one who ends up reading this page. */}
      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="If you are the teenager reading this"
            title="A few things nobody usually tells you"
          />
          <div className="mt-8 flex flex-col gap-5 text-[17px] leading-8 text-stone-600">
            <p>
              You do not have to have a reason that sounds serious enough. You do
              not have to know how to explain it. &ldquo;I don&rsquo;t really know,
              I just feel bad a lot&rdquo; is a completely normal way to start a
              first session, and a therapist will not be thrown by it.
            </p>
            <p>
              You are allowed to not like your therapist. If it does not feel
              right after a session or two, that is information, not rudeness —
              say so, and you can be matched with someone else at no cost.
            </p>
            <p>
              And you are allowed to ask the confidentiality question directly, in
              the first five minutes: <em>what will you tell my parents?</em> Any
              therapist worth seeing will give you a straight answer.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="Questions"
            title="Teen therapy, answered plainly"
          />
          <FaqList faqs={FAQS} />
        </div>
      </Section>

      <CtaBand
        title="Start the account, then hand it over"
        body="You set it up and consent; the sessions are theirs. One payment, no subscription, and credits that do not expire."
        label="Start as a parent or guardian"
      />

      <RelatedLinks
        title="Related pages"
        links={[
          { href: "/individual-therapy", label: "Individual therapy" },
          { href: "/couples-therapy", label: "Couples therapy" },
          { href: "/online-therapy", label: "How online therapy works" },
          { href: "/therapy-for", label: "What we help with" },
          { href: "/crisis", label: "Crisis support" },
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
