import Link from "next/link";
import { AlertTriangle, CalendarCheck, LifeBuoy, Search, Users } from "lucide-react";
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
import { CONDITIONS, LOCATIONS } from "@/lib/navigation";
import { PLAN_CURRENCY, PLAN_PRICES, PLAN_SESSIONS } from "@/lib/constants";
import { legalEntityName, pageMetadata, siteUrl } from "@/lib/seo";

/**
 * Couples therapy.
 *
 * ── Two things on this page are load-bearing and must not be softened ──
 *
 * 1. **Both partners join from the same device.** The video backend
 *    (`lib/video.ts`) is a 1:1 signalling service: one room holds exactly two
 *    connections, and a third is refused. So a couples session is the therapist
 *    on one side and the two of you on the other. Describing it as "join from
 *    wherever you each are" would sell a session that physically cannot start,
 *    and the failure would happen at the appointment rather than at checkout.
 *
 * 2. **The intimate-partner-violence carve-out.** Joint sessions are not
 *    recommended where one partner is afraid of the other: speaking honestly in
 *    front of someone you fear can raise the risk to you after the session
 *    ends. That paragraph is a safety notice, not a disclaimer, and it is
 *    placed where someone skimming will hit it.
 */

const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: PLAN_CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);

export const metadata = pageMetadata({
  title: "Couples therapy online in Kenya",
  description:
    "Online couples therapy with therapists licensed in Kenya. What a joint session involves, one price covering both partners, and when it is not the right step.",
  path: "/couples-therapy",
});

const STEPS = [
  {
    icon: Search,
    title: "One of you starts it",
    body: "Usually one partner does the booking, and that is normal. Say what the two of you are dealing with — the intake asks about the relationship, not about who is at fault.",
  },
  {
    icon: CalendarCheck,
    title: "Agree a time you can both make",
    body: "The one genuinely hard part of couples therapy is the diary. Pick a slot you can both protect every week or fortnight; evening times exist for exactly this reason.",
  },
  {
    icon: Users,
    title: "Sit down together, and join once",
    body: "You join from one device, side by side, and your therapist joins from theirs. Fifty minutes, with both of you in the same conversation rather than in two separate ones.",
  },
];

const WORKS_ON = [
  "The argument that keeps happening — same shape, different subject, no resolution.",
  "Communication that has broken down into either silence or escalation.",
  "Rebuilding after an affair, a betrayal, or a secret coming out.",
  "Sex and intimacy that has become difficult to talk about, let alone change.",
  "Money, in-laws, extended family obligations, and decisions neither of you feels free to make.",
  "Parenting as a team when you disagree about how.",
  "Deciding whether to stay — including separating well, if that is the answer.",
];

const FAQS: readonly Faq[] = [
  {
    q: "Do we both need to be in the same room?",
    a: "Yes. A couples session on Echo is the two of you together on one device and your therapist on the other — the session room holds two connections, so you cannot each join from a different place. If you are currently living apart, or one of you travels, plan the sessions around being in the same room; if that is not possible, individual therapy on the relationship is the workable alternative.",
  },
  {
    q: "Whose therapist is it? Will they take sides?",
    a: "Neither of yours — the relationship is the client. A couples therapist will give both of you the floor and will decline to arbitrate, because a therapist who rules on who is right has stopped being useful to either of you. If it starts feeling like two against one, say so in the session. That is workable material, not rudeness.",
  },
  {
    q: "My partner will not come. Is there any point?",
    a: "Yes, and it is a more common starting point than you would think. Individual therapy focused on the relationship is real work: you can only change your own half of a pattern anyway, and changing it frequently changes the pattern. It is also the correct route if joint sessions would not be safe.",
  },
  {
    q: "Will the therapist tell us whether to break up?",
    a: "No. That decision belongs to the people who have to live with it. What a therapist can do is help you both see the relationship clearly enough to make it — and help you do it without destroying each other, if separating is where you land.",
  },
  {
    q: "What does it cost?",
    a: `The Couples bundle is ${money(PLAN_PRICES.couples)} for ${PLAN_SESSIONS.couples} joint sessions, and that is one price covering both partners rather than each. It is a one-time purchase: nothing recurs, nothing auto-renews, and session credits do not expire. Cancel a booked session at least 24 hours ahead and the credit returns to your account.`,
  },
  {
    q: "Is what we say confidential?",
    a: "Video runs directly between the two ends of the call rather than being recorded by us, and notes sit behind per-record access controls. Your therapist will explain at the start how they handle information one of you gives them outside the joint session — policies differ, and it is worth agreeing that between the three of you before it comes up rather than after.",
  },
];

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Couples therapy",
  serviceType: "Couples counselling and relationship therapy, delivered online",
  url: `${siteUrl}/couples-therapy`,
  provider: {
    "@type": "Organization",
    name: legalEntityName,
    alternateName: "Echo Health",
    url: siteUrl,
  },
  areaServed: { "@type": "Country", name: "Kenya" },
  availableChannel: {
    "@type": "ServiceChannel",
    serviceUrl: `${siteUrl}/get-started`,
    availableLanguage: { "@type": "Language", name: "English" },
  },
  offers: {
    "@type": "Offer",
    name: "Couples",
    price: PLAN_PRICES.couples,
    priceCurrency: PLAN_CURRENCY,
    description: `${PLAN_SESSIONS.couples} joint sessions covering both partners`,
    url: `${siteUrl}/pricing`,
  },
};

const medicalWebPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  name: "Couples therapy online in Kenya",
  url: `${siteUrl}/couples-therapy`,
  inLanguage: "en-KE",
  audience: { "@type": "Patient" },
};

export default function CouplesTherapyPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/couples-therapy", label: "Couples therapy" }]} />
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={medicalWebPageJsonLd} />
      <JsonLd data={faqJsonLd(FAQS)} />

      <section className="curve-down bg-hero-soft px-4 pb-24 pt-8 [--curve-to:#fff] sm:px-6 sm:pb-32 sm:pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Couples therapy</Eyebrow>
          <h1 className="mt-4 font-display text-4xl tracking-tight text-stone-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
            The conversation you keep not managing to have
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-stone-600">
            Joint sessions with a therapist licensed in Kenya, for couples who
            are stuck in the same argument, rebuilding after something, or trying
            to work out whether to stay. One price covers both of you.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaButton href="/get-started">Book a joint session</CtaButton>
            <CtaButton href="/pricing" variant="secondary">
              See pricing
            </CtaButton>
          </div>
          <p className="mt-5 text-sm text-stone-500">
            {money(PLAN_PRICES.couples)} for {PLAN_SESSIONS.couples} joint
            sessions, covering both partners. Credits never expire.
          </p>
        </div>
      </section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="What it is"
            title="The relationship is the client"
          />
          <div className="mt-8 flex flex-col gap-5 text-[17px] leading-8 text-stone-600">
            <p>
              Couples therapy is a fifty-minute session with both partners and
              one therapist. It is not mediation and it is not a hearing: nobody
              is going to establish who is right, because in almost every couple
              that walks in, both people are describing something real.
            </p>
            <p>
              What a couples therapist works on instead is the cycle — the
              predictable sequence the two of you fall into, what each of you is
              actually afraid of underneath it, and what would have to change for
              the conversation to go differently. Approaches you may hear named
              include emotionally focused therapy, which works on that cycle
              directly, and Gottman-informed work, which is more behavioural:
              how conflict starts, what escalates it, and how repair happens.
            </p>
            <p>
              Both of you have to agree to come. Couples therapy where one
              partner has been brought along to be fixed does not work, and a
              good therapist will name that in the first session rather than
              charge you for six.
            </p>
          </div>
        </div>
      </Section>

      {/* Placed high, before the booking sections, because someone skimming for
          "can we do this?" must hit it. See the file header. */}
      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200 sm:p-9">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                <AlertTriangle className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-2xl tracking-tight text-stone-900">
                  If you are afraid of your partner, start individually
                </h2>
                <p className="mt-4 text-[15px] leading-7 text-stone-600">
                  Joint sessions are not the right first step where there is
                  violence, intimidation or coercive control in a relationship.
                  Speaking honestly in front of someone you are frightened of can
                  increase the risk to you once the session ends — which is why
                  couples work is generally not recommended in that situation.
                </p>
                <p className="mt-4 text-[15px] leading-7 text-stone-600">
                  Book{" "}
                  <Link href="/individual-therapy" className="font-semibold text-brand-700 underline underline-offset-2">
                    individual therapy
                  </Link>{" "}
                  instead and tell your therapist what is happening. If you are in
                  immediate danger, contact your local emergency number
                  , or see our{" "}
                  <Link href="/crisis" className="font-semibold text-brand-700 underline underline-offset-2">
                    verified crisis lines
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="How it works"
          title="Booking a session for two"
          body="The logistics are simpler than the conversation. Both of you need to be in the same room, and that is the only unusual requirement."
        />
        <Steps steps={STEPS} />
        <p className="mx-auto mt-12 max-w-2xl rounded-3xl bg-stone-50 p-6 text-center text-sm leading-7 text-stone-600 ring-1 ring-stone-200/70">
          <strong className="font-semibold text-stone-800">
            Both partners join from one device.
          </strong>{" "}
          A session room connects two ends — you together on one, your therapist
          on the other. Joining separately from two places will not work, so if
          you are apart, either move the session or start with individual
          therapy instead.
        </p>
      </Section>

      <Section tone="muted">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="What couples bring"
              title="Reasons people book"
            />
            <div className="mt-9 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 sm:p-8">
              <CheckList items={WORKS_ON} />
            </div>
          </div>
          <div className="lg:pt-2">
            <SectionHeading
              align="left"
              as="h3"
              title="What couples therapy will not do"
              body="Worth knowing before you spend the money."
            />
            <div className="mt-9 flex flex-col gap-4 text-[15px] leading-7 text-stone-700">
              <p className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/70">
                It will not decide for you whether to stay or go, and a therapist
                who offers to is overstepping.
              </p>
              <p className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/70">
                It will not fix a relationship one partner has already left in
                every way but the announcement.
              </p>
              <p className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/70">
                It is not a legal or custody process. Echo does not produce
                reports for courts and cannot certify that either of you
                attended.
              </p>
              <p className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/70">
                It does not replace individual therapy where one partner is
                dealing with something of their own — depression, trauma, an
                addiction. Frequently the two run alongside each other.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="Questions"
            title="Couples therapy, answered plainly"
          />
          <FaqList faqs={FAQS} />

          <div className="mt-10 flex items-start gap-3 rounded-3xl bg-brand-50 p-6 ring-1 ring-brand-100">
            <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden="true" />
            <p className="text-sm leading-6 text-stone-700">
              Echo is not a crisis service. If you or someone else is in
              immediate danger, contact your local emergency number
              , or see our{" "}
              <Link href="/crisis" className="font-semibold text-brand-700 underline underline-offset-2">
                verified crisis lines
              </Link>
              .
            </p>
          </div>
        </div>
      </Section>

      <CtaBand
        title="Two sessions, one price, both of you"
        body="Answer a few questions together and we will match you with a therapist who does couples work. Nothing recurs and credits do not expire."
        label="Book a joint session"
      />

      <RelatedLinks
        title="Related pages"
        links={[
          { href: "/therapy-for/relationships", label: "Therapy for relationships" },
          { href: "/individual-therapy", label: "Individual therapy" },
          { href: "/teen-therapy", label: "Teen therapy" },
          { href: "/online-therapy", label: "How online therapy works" },
          { href: "/therapy-for", label: "What we help with" },
          ...CONDITIONS.filter((c) => c.slug !== "relationships").map((c) => ({
            href: `/therapy-for/${c.slug}`,
            label: `Therapy for ${c.short}`,
          })),
          ...LOCATIONS.map((l) => ({
            href: `/online-therapy/${l.slug}`,
            label: `Therapy in ${l.label}`,
          })),
        ]}
      />
    </>
  );
}
