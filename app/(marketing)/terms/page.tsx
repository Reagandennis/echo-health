import Link from "next/link";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import LegalDoc, { type LegalSection } from "@/app/components/marketing/LegalDoc";
import { pageMetadata, legalEntityName } from "@/lib/seo";
import {
  PLAN_SESSIONS,
  PROMO_DISCOUNT_PERCENT,
  formatKes,
  PLAN_PRICES,
} from "@/lib/constants";
import { describeRegionalBands } from "@/lib/pricing";

/**
 * ── Terms of service ───────────────────────────────────────────────────────
 *
 * ## The gap this fills
 *
 * The previous version had **no governing-law or jurisdiction clause at all**
 * — the single biggest hole in either legal document, flagged in review. A
 * contract that does not say which law governs it leaves that to be argued
 * from scratch, and for a Kenyan company with clients in thirteen countries
 * that is the one clause you cannot omit. Section 12 states it.
 *
 * Also fixed: §5 referenced a "Refund Policy" that does not exist as a route,
 * so the refund terms are now stated here rather than pointing nowhere.
 *
 * ## Commercial terms are read from `lib/constants.ts`, never typed
 *
 * Every figure — prices, session counts, the promo percentage — comes from the
 * same module the checkout charges from. A terms page quoting a different
 * number from the one billed is a dispute, not a typo, and this repo has
 * already been bitten by prose prices drifting from the source of truth.
 *
 * That now includes the **regional bands** in `lib/pricing.ts`: §5 no longer
 * presents three fixed prices, because there are not three fixed prices. It
 * states the standard ones as a maximum, states that some countries pay less,
 * names them and their figures from the same function `/pricing` uses, and says
 * a band and a promo code do not stack.
 *
 * ## What I did NOT write, deliberately
 *
 * Sections 9 and 10 describe limits WITHOUT purporting to exclude rights that
 * cannot be excluded. The previous version was a block-capitals US-style
 * blanket disclaimer, which Kenya's Consumer Protection Act 2012 may render
 * partly unenforceable — and an unenforceable disclaimer is worse than a
 * narrower one, because it invites a court to strike the lot. There is no
 * monetary liability cap, no indemnity and no arbitration clause here, because
 * inventing those is drafting a legal position rather than describing a
 * product.
 *
 * ## ⚠️ The two-practitioner split, and the limit of what this document does
 *
 * §2, §3 and §7 now distinguish **licensed therapists** from **wellness
 * coaches**, because Echo works with practitioners worldwide and cannot
 * lawfully offer therapy in every market it has clients in.
 *
 * That structure is a real legal distinction — coaching is unregulated in most
 * places, therapy is not — but **it only protects Echo if the product actually
 * behaves the way these sections say it does.** The document is not the
 * control; the code is. Specifically, all three of these must stay true:
 *
 *   1. A coach is never titled "therapist" anywhere — directory, profile,
 *      booking, email, marketing. `displayTitle()` in `lib/practitioners.ts`
 *      is the single place that decides, so that a page cannot hardcode the
 *      wrong noun.
 *   2. A coach never takes a client with a clinical presentation.
 *      `requiresLicensedPractitioner()` is that gate, and it fails towards the
 *      clinician: an intake answer nobody has classified routes to a licensed
 *      therapist rather than defaulting to coaching.
 *   3. Marketing for a coaching-only market does not describe therapy.
 *      `offeringFor()` is what the country pages must ask.
 *
 * If any of those stops holding, this document stops being a defence and
 * becomes evidence that the mislabelling was deliberate. A disclaimer does not
 * cure practising a regulated activity without registration — in several
 * jurisdictions that is criminal rather than contractual, and the noun on the
 * contract does not determine the legal character of what was delivered.
 * **Withdraw the coaching route in a market rather than paper over a gap in
 * it.**
 *
 * ## Still needs a Kenyan commercial lawyer — and now local advice too
 *
 *   • Confirmation of the governing-law and jurisdiction wording in §12, and
 *     whether a consumer in the EU/UK retains a right to their local forum.
 *   • Whether §9/§10 are adequate, and what liability cap is appropriate.
 *   • The interaction between §7 termination and §5's "credits never expire" —
 *     §7 now says paid credits survive termination by us, which is the honest
 *     reading of §5 but needs confirming as a contractual commitment.
 *   • Whether the 13–17 consent model in §4 satisfies Kenyan law on minors.
 *   • An IP / user-content licence clause, which is absent.
 *   • Confirmation that `legalEntityName` is the contracting entity.
 *   • **Per-market advice on the coaching route.** Whether non-clinical
 *     coaching is genuinely unregulated in each market, what a coach may not
 *     say without straying into regulated activity, and whether Echo
 *     contracting from Kenya changes the answer. Kenyan counsel cannot advise
 *     on German or Californian scope-of-practice law.
 *   • Whether §3's promise — that we refuse the sale rather than sell coaching
 *     to someone with a clinical need — creates a duty we should be explicit
 *     about discharging.
 *   • Whether the coaches themselves need their own contract terms; these are
 *     client-facing and say nothing about the practitioner relationship.
 *   • **Country-based pricing in §5**, which is new and is the item most
 *     likely to need redrafting rather than review. Three things to put to
 *     counsel: whether differential pricing by country needs a disclosure
 *     stronger than the one in §5 and on `/pricing` under Kenya's Consumer
 *     Protection Act 2012 s.12–13; whether deriving the price from an
 *     IP-inferred country is adequately disclosed for the DPA 2019 (privacy
 *     §1 and §5 describe the processing); and whether "we will never charge
 *     more than the standard price" should be a contractual commitment rather
 *     than a description of current behaviour, given the code enforces it.
 */

export const metadata = pageMetadata({
  title: "Terms of service",
  description:
    "What you agree to when you book therapy on Echo Health: what the service is and is not, how credits and cancellations work, refunds, and the governing law.",
  path: "/terms",
});

const LAST_UPDATED = "12 September 2026";
const EFFECTIVE_DATE = "12 September 2026";

/**
 * The same sentence `/pricing` renders, from the same function.
 *
 * §5 lists the standard prices and now also has to state that they vary by
 * country. Two documents describing one price list from two hand-written
 * sources is how a contract ends up naming a country the product does not
 * discount — see `describeRegionalBands` in `lib/pricing.ts`.
 */
const REGIONAL_SUMMARY = describeRegionalBands();

const INTRO = [
  `These terms are the agreement between you and ${legalEntityName}, operating as Echo Health, when you use this site or book a session. We have tried to write them in language you can actually read, and to put the things that most often surprise people near the top rather than in the last section.`,

  `**The four that matter most.**\nEcho is not an emergency service. Your therapist is licensed in Kenya and probably not where you are. You are charged in Kenyan shillings. And you are buying a fixed number of sessions outright, not a subscription.`,
];

const SECTIONS: readonly LegalSection[] = [
  {
    id: "emergencies",
    title: "1. Echo is not for emergencies",
    content: `**This section comes first because it is the one that could matter most.**

Echo Health is **not** an emergency or crisis service. Nobody monitors the platform for urgent messages. A message sent at 2am is read when your therapist next works.

If you or someone else is in immediate danger, contact your **local emergency number**. Our [crisis page](/crisis) lists verified helplines by region, and [findahelpline.com](https://findahelpline.com) will find one wherever you are. We deliberately do not print a single emergency number on every page, because we serve thirteen countries and publishing one we have not verified for your country would be worse than publishing none.

By using Echo you accept that it is not a substitute for emergency care, for inpatient treatment, or for a crisis line.`,
  },
  {
    id: "what-it-is",
    title: "2. What the service is, and what it is not",
    content: `Echo Health is a platform. We provide the matching, the scheduling, the video and messaging, and the payment rail. **The practitioner provides the service itself**, in their own professional capacity, under their own qualifications and their own insurance. We are not a medical provider and we do not supervise clinical decisions.

**We work with practitioners worldwide, and there are two kinds.** Which one is available to you depends on where you are, and you will be told which before you pay:

- **Licensed therapists.** Practitioners holding a current licence or registration to provide therapy in a named jurisdiction. This is therapy.
- **Wellness coaches.** Practitioners providing structured, **non-clinical** support — goals, habits, stress, life transitions. This is **not** therapy, is not treatment, and is not delivered by a clinician.

Section 3 explains which you get and why. **The difference is real, not a matter of wording**, and we will never describe a coach to you as a therapist.

**What nobody on this platform can do.** Plainly, because each of these sends a proportion of people to the wrong service:

- **Prescribe or manage medication.** No practitioner on Echo, of either kind, anywhere.
- **Provide a formal diagnosis**, or a letter, report or assessment for an insurer, employer, school, immigration authority or court.
- **Fulfil court-ordered or mandated therapy.**
- **Provide the care your local health system or insurance will reimburse**, unless your practitioner is licensed where you are.
- **Provide inpatient, emergency or psychiatric care.**

If you need any of those, a locally registered practitioner is the right choice and we would rather tell you now.`,
  },
  {
    id: "licensing",
    title: "3. Who you work with, and what they are qualified to do",
    content: `**Read this before you pay. It is the most important section in this document.**

Echo works with practitioners in a number of countries. Whether you are offered **therapy** or **wellness coaching** depends on whether we have a practitioner licensed to provide therapy where you are.

**If we have a licensed therapist for your jurisdiction**, you are offered therapy. Their licence is verified against the relevant regulator before their profile appears, we record which jurisdiction it covers, and a complaint about their professional conduct can go to that regulator as well as to us.

**If we do not, you are offered wellness coaching instead.** Not therapy with a disclaimer attached — a different service, with a different scope:

- A coach supports goals, habits, stress, motivation and life transitions.
- A coach does **not** assess, diagnose or treat any mental-health condition, and is not a clinician.
- A coach will **not** work with you if you are at risk of harming yourself or anyone else. Our intake asks about this, and it routes to a licensed therapist rather than a coach.
- A coach is **never** described by us as a therapist, psychotherapist, counsellor or psychologist, and may not describe themselves that way on this platform.

**Why it works this way.** In many countries "therapist", "psychotherapist" and "psychologist" are protected titles, and providing regulated treatment without local registration is unlawful — in some places a criminal matter. Offering coaching where we cannot lawfully offer therapy is the honest option. Offering therapy and calling it coaching would not be, and we are not doing that.

**We are working towards locally licensed therapists in more countries.** As that happens, those markets move from coaching to therapy and the change is reflected here and on the [country pages](/online-therapy). Until it does, what is on offer in your country is what section 3 says it is.

**If your intake indicates a clinical need and we have no licensed therapist for your jurisdiction, we will tell you so and not sell you coaching instead.** You will be pointed at local options. That is a sale we are choosing not to make.

**Sessions are scheduled in East Africa Time (GMT+3)** unless your practitioner's profile says otherwise. Depending where you are, the overlap may be narrow — the [country pages](/online-therapy) give the actual time difference and which parts of your day are realistic. If none work for you, establish that before buying.`,
  },
  {
    id: "eligibility",
    title: "4. Who can use Echo",
    content: `**Adults.** You must be 18 or over to open an account for yourself, and you must have the legal capacity to enter into this agreement.

**13 to 17 year-olds.** Therapy is available, but the account must be opened by a **parent or legal guardian**, who enters into these terms on the young person's behalf and provides consent for their care. A young person cannot sign themselves up — our questionnaire stops and explains why, and points to helplines that do not require a parent's permission.

**Under 13s.** Echo is not available, in any circumstances.

**Your account is yours alone.** Keep your sign-in details private, do not share your account, and tell us promptly if you believe someone else has access to it. Couples therapy is the one exception: both partners take part in the same session, joined from the same device, because the video service connects two participants and will refuse a third.

You are responsible for the accuracy of what you tell us. Therapy depends on it, and so does matching you with someone appropriate.`,
  },
  {
    id: "payments",
    title: "5. Prices, credits and refunds",
    content: `**You are buying sessions, not a subscription.**
Each plan is a **one-time payment** for a fixed number of 50-minute sessions. Nothing renews. There is no card kept on file charging you monthly and nothing to remember to cancel.

**Standard prices.**
- Individual — ${formatKes(PLAN_PRICES.individual)} for ${PLAN_SESSIONS.individual} session.
- Plus — ${formatKes(PLAN_PRICES.plus)} for ${PLAN_SESSIONS.plus} sessions.
- Couples — ${formatKes(PLAN_PRICES.couples)} for ${PLAN_SESSIONS.couples} joint sessions.

**Prices vary by country, downwards only.**
Those are our standard prices and the most you will be charged. In some countries we charge a lower regional price — ${REGIONAL_SUMMARY} for a single session — and the reduction is applied automatically at checkout without you having to ask for it. Which price applies is determined from the country your connection reaches us from at the moment you pay, so it can change if you travel or use a VPN. We will never charge you **more** than the standard price shown on the [pricing page](/pricing), and the exact amount is shown to you before you authorise the payment. A regional price and a promotional code do not combine: you are charged whichever of the two is lower, not both.

**You are charged in Kenyan shillings.**
Always, whatever your own currency. Where prices are shown we also display an approximate amount in your local currency for browsing, with the exact shilling figure you will be charged alongside it. **Your bank sets the exchange rate** and may add its own cross-border fee, so the amount on your statement can differ slightly from the converted figure we showed. That difference is your bank's; we add no margin of our own.

**Credits never expire.**
Sessions you have paid for stay in your account until you use them, however long that takes.

**Cancelling and rescheduling.**
Cancel or move a session at least **24 hours** before it starts and the credit returns to your account, ready to rebook. Inside 24 hours the credit is spent, because your therapist has held that time for you and cannot fill it.

**Refunds.**
- **Unused credits** can be refunded to the original payment method. [Ask us](/contact) and we will process it.
- **Sessions you have attended** are not refundable.
- **If we cannot match you** with a suitable therapist, you get a full refund.
- Nothing here affects any refund right you have under the consumer law that applies to you — see section 10.

**Promotional codes.**
Where we offer one it is worth ${PROMO_DISCOUNT_PERCENT}% off a plan, applied before you pay. You will never be charged the full amount and refunded the difference. One code per purchase unless we say otherwise.

**Switching therapists is free**, and your unused credits follow you.`,
  },
  {
    id: "acceptable-use",
    title: "6. How you agree to behave",
    content: `Therapy needs a safe space for both people in it. So:

- Do not abuse, threaten, harass or discriminate against your therapist or our staff.
- Do not record a session without your therapist's express consent. Sessions are not recorded by us and recording without consent may be unlawful where you are.
- Do not impersonate anyone, or provide false information about who you are or your age.
- Do not use Echo for anything unlawful, or to arrange anything unlawful.
- Do not attempt to access another person's records, probe or attack the platform, or use automated means to scrape it.
- Do not resell, republish or commercially exploit the platform or its content.

**A therapist may end a session** where they judge that continuing would be unsafe or clinically inappropriate, and we may suspend or close an account for a serious or repeated breach of this section. Where we do, section 7 applies to anything you have paid for.`,
  },
  {
    id: "your-therapist",
    title: "7. Your relationship with your practitioner",
    content: `**If you are working with a licensed therapist**, they exercise independent professional judgement: how to work with you, whether they are the right clinician for what you need, and — within the limits they will explain — what stays confidential.

**Confidentiality and its limits.** What you discuss is confidential. Your therapist will explain the exceptions at the outset; broadly they arise where there is a serious and imminent risk to your safety or someone else's, or where the law requires disclosure. That judgement belongs to your clinician, not to our software.

**Clinical notes** are your therapist's professional record. You do not have access to them through the platform.

**If you are working with a wellness coach**, the relationship is different in ways that matter:

- It is **not** a clinical relationship and your coach is **not** your clinician.
- There are no clinical notes, because a coach does not keep a clinical record.
- Your coach cannot assess or treat a mental-health condition, and if what you bring turns out to need one, their job is to tell you so and stop — not to continue outside their competence.
- Coaching conversations are treated as confidential on the same basis, and the same safety limits apply.

**If coaching turns out to be the wrong fit**, tell us. Where we have a licensed therapist for your jurisdiction we will move you and carry your unused credits across. Where we do not, we will say so plainly and refund you rather than keep you in a service that cannot help — see section 5.

**Automated safety scanning.** Messages you send are checked against a fixed word list, and a high-risk result files an internal safety alert. It is crude, produces frequent false positives, and is described in full in section 3 of the [privacy policy](/privacy). It is not a monitoring service and it does not make Echo an emergency service — see section 1.

**No guarantee of outcome.** Therapy and coaching both help a great many people and we believe in them, but nobody can promise a particular result and we do not. What we commit to is that a practitioner presented to you as licensed is licensed, that a coach is never presented as a therapist, and that switching is free if the fit is wrong.`,
  },
  {
    id: "termination",
    title: "8. Ending the relationship",
    content: `**You can stop at any time.** There is no notice period, no exit fee and nothing to cancel, because there is no subscription. Unused credits can be refunded under section 5.

**We may suspend or close your account** for a serious or repeated breach of section 6, where we are legally required to, or where continuing to provide the service would be unsafe.

**What happens to what you have paid for.** If we close your account for a reason other than your breach of section 6, we refund your unused credits. If we close it for a serious breach, we will still refund unused credits unless the law permits us to withhold them — we are not going to keep money for sessions we will not now deliver.

**If we discontinue the service** we will give you reasonable notice, help you complete sessions in progress or find another practitioner, and refund anything unused.

Section 4 of the [privacy policy](/privacy) explains what happens to your records, and which of them are retained regardless.`,
  },
  {
    id: "platform",
    title: "9. The platform itself",
    content: `We work to keep Echo available and functioning, but we do not promise it will be uninterrupted or error-free. It depends on things outside our control — your internet connection, your device, and third-party services including our authentication, payment and video providers.

**Video quality depends on your connection.** If it is poor, a phone session needs far less bandwidth and the therapy is no worse for it.

**Planned maintenance** will be announced where we reasonably can. **Unplanned outages** we will fix as quickly as we can, and if one causes you to miss a session, the credit goes back to your account.

We may change, add to or remove features. Where a change materially reduces something you have paid for, we will tell you and offer a refund of the affected credits.

**Content on this site** — the guides, articles and condition pages — is general information, not clinical advice about you, and does not create a therapeutic relationship. Do not use it to decide whether to change or stop treatment; talk to a clinician.`,
  },
  {
    id: "liability",
    title: "10. Responsibility and your consumer rights",
    content: `**What we are responsible for.** Providing the platform with reasonable care and skill, verifying that the practitioners in our directory are licensed, handling your information as set out in the [privacy policy](/privacy), and charging you only what we said we would.

**What your therapist is responsible for.** The clinical care itself. They practise independently, under their own licence and their own professional indemnity cover, and are responsible for their own professional conduct. We are not a medical provider and do not supervise clinical decisions.

**What we are not responsible for.** Loss arising from your internet connection or device; from a third-party provider's outage; from information you gave us that was inaccurate; or from your use of general content on this site as though it were advice about you.

**Rights that cannot be excluded are not excluded.**
This section does not limit anything that cannot lawfully be limited — including liability for death or personal injury caused by negligence, for fraud, and any right you have under the consumer-protection law that applies to you, such as Kenya's **Consumer Protection Act 2012**. If any part of this section is found unenforceable where you are, the rest continues to apply.

We would rather state a narrower limit that holds than a sweeping one that a court strikes out entirely.`,
  },
  {
    id: "complaints",
    title: "11. Complaints",
    content: `**Something about your care.** [Contact us](/contact) directly rather than leaving it in session feedback. A complaint about a clinician reaches a person the same day, and you can ask to be matched with someone else at the same time.

**Something about your therapist's professional conduct.** Tell us, and you may also raise it with their regulator in Kenya. We will tell you who that is and give you their details — we will not put ourselves between you and a regulator.

**Something about billing.** Contact us with the payment reference and we will investigate.

**Something about your data.** Section 13 of the [privacy policy](/privacy), which also explains your right to complain to Kenya's Office of the Data Protection Commissioner.

We aim to acknowledge every complaint promptly and to tell you what we are doing about it. If we get something wrong we would rather hear it from you than not.`,
  },
  {
    id: "governing-law",
    title: "12. Governing law and jurisdiction",
    content: `These terms, and any dispute or claim arising out of them or out of your use of Echo Health, are governed by the **laws of Kenya**.

The courts of Kenya have jurisdiction over any such dispute. ${legalEntityName} is established in Kenya, the service is delivered from Kenya, the practitioners are licensed in Kenya, and payment settles in Kenyan shillings.

**If you are a consumer outside Kenya**, this does not deprive you of the protection of any mandatory consumer law of the country where you live, or of any right you have to bring proceedings there where that right cannot be excluded by agreement.

Before going to court, please [talk to us](/contact). Most things are resolvable, and we would like the chance.`,
  },
  {
    id: "changes",
    title: "13. Changes to these terms",
    content: `We will update these terms as the service changes, and the dates at the top will change with them.

**For a material change** — anything affecting what you are buying, what it costs, or your rights under sections 5, 10 or 12 — we will tell you directly and give you reasonable notice before it takes effect. Continuing to use Echo after that notice means you accept the new terms. If you do not, you can stop and take a refund of unused credits under section 5.

A change will never apply retrospectively to credits you have already bought.

Previous versions are available on request.`,
  },
  {
    id: "general",
    title: "14. The rest",
    content: `**Entire agreement.** These terms and the [privacy policy](/privacy) are the whole agreement between us about the service.

**Severability.** If any provision is found unenforceable, the rest continues in force.

**No waiver.** If we do not enforce something immediately, we have not given up the right to enforce it later.

**Assignment.** You may not transfer your account or these terms to anyone else. We may transfer them as part of a reorganisation or sale of the business, and will tell you if that happens.

**No third-party rights**, other than your therapist's rights in respect of section 6.

**Contact.** ${legalEntityName}, trading as Echo Health. Reach us through the [contact page](/contact).`,
  },
];

export default function TermsOfServicePage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/terms", label: "Terms of service" }]} />
      <LegalDoc
        title="Terms of service"
        lastUpdated={LAST_UPDATED}
        effectiveDate={EFFECTIVE_DATE}
        intro={INTRO}
        sections={SECTIONS}
        footer={
          <div className="rounded-3xl bg-stone-50 p-6 sm:p-8">
            <h2 className="font-display text-xl tracking-tight text-stone-900">
              Anything here you would want clarified?
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-stone-600">
              Ask before you buy rather than after. We would much rather answer
              a question about section 3 or section 5 now than process a refund
              later.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Contact us
              </Link>
              <Link
                href="/privacy"
                className="inline-flex min-h-11 items-center rounded-full bg-surface px-6 text-sm font-semibold text-stone-800 ring-1 ring-inset ring-stone-300 transition hover:ring-stone-400"
              >
                Privacy policy
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-11 items-center rounded-full bg-surface px-6 text-sm font-semibold text-stone-800 ring-1 ring-inset ring-stone-300 transition hover:ring-stone-400"
              >
                See the prices
              </Link>
            </div>
          </div>
        }
      />
    </>
  );
}
