import Link from "next/link";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import LegalDoc, { type LegalSection } from "@/app/components/marketing/LegalDoc";
import { pageMetadata, legalEntityName } from "@/lib/seo";

/**
 * ── Privacy policy ─────────────────────────────────────────────────────────
 *
 * ## Every factual claim below was checked against the code
 *
 * That is the point of writing it here rather than from a template. A template
 * describes a company like this one; this describes *this* one. Specifically
 * verified while writing:
 *
 *  - The processor list is every external origin the app actually contacts,
 *    read out of `lib/*`, `next.config.ts` and `instrumentation-client.ts`.
 *    It includes **ipapi.co**, which `lib/useCurrency.ts:83` sends the
 *    visitor's IP to in order to guess their currency. Nothing disclosed that
 *    before. A template would never have found it.
 *  - Retention matches the actual foreign keys. `clinical_notes -> therapists`
 *    is `ON DELETE RESTRICT` and `payout_ledger` restricts on both its
 *    parents, so clinical records and financial records genuinely cannot be
 *    removed by deleting the row that points at them. `messages ->
 *    therapy_sessions` is `ON DELETE CASCADE`.
 *  - The risk scanner is disclosed, because `sendMessageAction` runs
 *    `analyzeRisk` over message content and files a `risk_alerts` row on a
 *    `high` result. That is automated processing of the most sensitive thing
 *    on the platform and it appeared in no policy.
 *
 * ## What this policy deliberately does NOT promise
 *
 * **There is no account-deletion mechanism in this codebase.** Nothing under
 * `app/actions`, `app/api` or `lib` deletes a user, and
 * `app/admin/compliance/gdpr/page.tsx` is a hardcoded list of four invented
 * data-subject requests — the same failure AGENTS.md documents for the admin
 * risk pages, which "rendered hardcoded scores and flags under real clients'
 * names". So there is no request queue, no 30-day clock, and no erasure
 * button.
 *
 * Section 4 therefore describes a manual, email-based process, which is what
 * actually exists. It does not claim a statutory turnaround the product cannot
 * meet. When a real DSR workflow ships, this section should be the first thing
 * updated — and the gap is listed for counsel at the bottom of this comment.
 *
 * ## Still needs a Kenyan data-protection lawyer
 *
 * This removes false statements and describes real processing accurately. It
 * is not a substitute for review. Open items:
 *   • ODPC registration status as controller and/or processor, and whether a
 *     Data Protection Officer must be designated.
 *   • The lawful basis and safeguards for the cross-border transfers in §11 —
 *     the DPA restricts these and §11 only says we contract for protection.
 *   • A defined clinical-record retention period. §7 declines to state one
 *     rather than invent it.
 *   • Whether the risk scanner's automated processing needs a DPIA.
 *   • Children's-data consent mechanics for the 13–17 route.
 *   • Confirmation that `legalEntityName` is the registered controller.
 *   • **Practitioners are now worldwide**, which makes Echo a controller
 *     receiving identity and credential documents from data subjects in a
 *     dozen jurisdictions. §10 and §11 describe that accurately; whether the
 *     DPA's transfer rules and each practitioner's local law are satisfied by
 *     the current arrangement is a question for counsel, not for this file.
 *   • Whether a wellness coach's working notes are health data. §1 says they
 *     are narrower than clinical notes, which is true of their *content* and
 *     may not be true of their *classification*.
 *   • **The country signal now used to price a payment** (§1, and Cloudflare in
 *     §5). It is an IP-derived inference that determines what someone is
 *     charged, which is a stronger use than the currency guess beside it: it
 *     needs a lawful basis stated, and confirmation that "we do not keep it" is
 *     the right claim to make when the edge that supplies it keeps its own
 *     logs. Terms §5 carries the consumer-law half of the same question.
 */

export const metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "What Echo Health collects, why, who it is shared with, how long it is kept, and the rights you can exercise under Kenya's Data Protection Act 2019.",
  path: "/privacy",
});

const LAST_UPDATED = "12 September 2026";
const EFFECTIVE_DATE = "12 September 2026";

const INTRO = [
  `You are handing a mental-health service information about your inner life. This document is where we tell you exactly what happens to it — not in the abstract, but as the system is actually built.`,

  `**Who we are.**\n${legalEntityName}, operating as Echo Health, is the data controller. We are established in Kenya and this policy is governed by Kenyan law, principally the **Data Protection Act 2019**, administered by the Office of the Data Protection Commissioner (ODPC). If you are in the EU or EEA, the GDPR may also apply to your use of the service.`,

  `Our practitioners are in a number of countries and our clients are worldwide. Depending where you are you may be working with a **licensed therapist** or with a **wellness coach**, which are different services — the [terms](/terms) explain which you get and why. It matters here because a coach keeps no clinical record, so section 1 collects less about you.`,
];

const SECTIONS: readonly LegalSection[] = [
  {
    id: "collect",
    title: "1. What we collect",
    content: `**Your account.**
Your name, email address and a unique identifier issued by our authentication provider. We never receive or store your password — see section 5.

**What you tell us when you sign up.**
The answers you give in the intake questionnaire: who therapy is for, your age band, what you would like to work on, whether you have had therapy before, what you would prefer in a therapist, and when you can meet. Until you create an account these answers exist only in your own browser.

**What you write in the product.**
Messages to your therapist, journal entries, mood logs, goals, and feedback you leave after a session. This is the most sensitive category of information we hold and it is treated accordingly throughout this policy.

**What your practitioner writes.**
If you are working with a **licensed therapist**, clinical notes about your sessions. These are their professional record; you cannot read them, and neither can any other client or our support staff — see section 10.

If you are working with a **wellness coach**, there are **no clinical notes**, because a coach does not keep a clinical record and is not your clinician. They may keep working notes on goals and progress, which are far narrower in scope, and the [terms](/terms) §7 sets out the difference.

**Sessions and bookings.**
When a session is scheduled, whether it happened, its duration, and which therapist it was with. Video and audio are **never recorded**: the call runs peer-to-peer between the two browsers and our signalling service relays only call setup, never media.

**Payments.**
The amount, currency, status and reference of each transaction, plus which plan it bought. **We never see or store your card number** — it goes directly to our payment processor.

**Documents you upload.**
A profile photo, and for therapists, identity and licensing documents. These are stored as bytes in our own database rather than with a third-party file host.

**Technical information.**
IP address, browser and device type, the pages you visit, and approximate location derived from your IP. Section 9 covers this and what we do to limit it.

**The country you are paying from.**
When you start a payment, our network edge tells our server the two-letter country code your connection is coming from, worked out from your IP address. We use it for one thing: choosing which price applies to you, because [prices are lower in some countries](/pricing). We do not keep it. It is not written to your payment record, which stores the amount you were charged, and it is not sent to our analytics provider, which records only which of the three price bands applied.`,
  },
  {
    id: "use",
    title: "2. Why we use it",
    content: `We use your information to run the service you asked for: to match you with a suitable therapist, to let the two of you communicate, to schedule and host sessions, to take payment, and to support you when something goes wrong.

Under the Data Protection Act our lawful bases are:

- **Performance of a contract** — everything needed to deliver the sessions you have paid for.
- **Consent** — for analytics, and for the optional parts of the intake questionnaire. You can withdraw it at any time; see [cookie settings](/cookies).
- **Legal obligation** — retaining financial records, and responding to a lawful order.
- **Vital interests** — the narrow safety circumstances described in section 3.
- **Legitimate interests** — securing the platform, preventing abuse, and improving the product in aggregate. We do not rely on legitimate interests to process the content of what you write.

**What we never do.**
We do not sell your information. We do not share it with advertisers. There is no advertising network on this site and no advertising cookie. We do not use what you write to train machine-learning models.`,
  },
  {
    id: "risk-scanner",
    title: "3. Automated safety scanning",
    content: `**This section describes automated processing and you should read it.**

When you send a message to your therapist, its text is checked against a fixed list of words associated with crisis. If the check comes back **high**, a safety alert is recorded containing your identifier, a severity, and the time — but **not** the message text.

You should understand three things about this, because the mechanism is much cruder than the phrase "risk detection" suggests:

- It is **substring matching against a word list**. There is no AI involved and no clinical model. It has not been validated on any population, and nobody has measured how often it is right.
- It produces **false positives constantly**. It fires on quoted speech, on things that happened years ago, and on ordinary words that happen to be on the list. It also misses most genuine distress, because distress is usually phrased obliquely.
- **Messages written by your therapist are never scanned.** A clinician writing about what you told them is the likeliest source of a crisis keyword, and attributing that to them would be wrong.

Alerts are visible only to our safety team. The scan happens after your message is saved, so it can never cause a message to fail to send. A "moderate" result is deliberately not recorded at all — a system that cries wolf trains its reviewers to ignore it.

If you would rather not have your messages scanned, tell us and we will explain what we can and cannot change, honestly. Note that we would then have no automated safety net on your account.`,
  },
  {
    id: "rights",
    title: "4. Your rights, and how they actually work here",
    content: `Under the Data Protection Act 2019 you have the right to be informed about how your data is used, to **access** it, to have inaccurate data **corrected**, to have data **erased** in certain circumstances, to **object** to processing, to **restrict** processing, to receive your data in a **portable** form, and to lodge a complaint with the ODPC.

**How to exercise them.**
Email [privacy@echohealth.app](/contact). We will acknowledge your request and tell you what we can do and by when.

**Being straight with you about the mechanics.**
There is no self-service button for any of this yet, and no automated request queue behind the scenes. Every request is handled by a person reading your email. We would rather say that than publish a turnaround time we have not built the capacity to guarantee. If this matters to you before you sign up, ask us first.

**Two limits on erasure that are real.**
- **Clinical notes.** Your therapist's professional record is retained. This is both a clinical-governance obligation and enforced in our database, which refuses to remove a clinician's record while notes exist. Erasing your account does not erase your therapist's notes about your care.
- **Financial records.** Transactions and therapist earnings are retained for accounting and tax purposes and cannot be deleted on request.

Everything else — your profile, your messages, your journal entries, your mood logs, your goals, your uploaded photo — can be deleted. Say so and we will do it.`,
  },
  {
    id: "sharing",
    title: "5. Who else touches your data",
    content: `We share your information with your therapist, obviously, and with the service providers below. Each is a processor acting on our instructions under contract. This is the complete list.

- **Auth0 (Okta)** — authentication. Handles your email and password so that we never do. Your password is never transmitted to Echo Health.
- **Microsoft Azure** — hosting and the database, where everything in section 1 is stored.
- **Paystack** — payments. Receives your card or mobile-money details directly; we receive only a reference and a status.
- **Echo video backend** (video.echopsychology.com) — relays call setup so two browsers can connect. It does not see, record or store audio or video.
- **Resend** — transactional email. Receives your email address and the contents of the notification being sent.
- **PostHog** (United States) — product analytics. Receives a random identifier and a coarse role, never your name or email, and never the content of anything you write. Section 9 has the detail.
- **ipapi.co** — receives your **IP address** when a page needs to guess which currency to show you. It is told nothing else about you, and it happens on public pages regardless of whether you have an account.
- **Cloudflare** — our network edge. Every request to this site passes through it, and it derives the two-letter country code described in section 1 from your IP address. It is the only source we use for that, and we use it only to select a price.
- **open.er-api.com** — currency exchange rates. Receives no information about you.

**We share with no one else** except where we are legally required to, or in the safety circumstances below.

**Safety disclosure.**
Where there is a serious and imminent risk to your life or to someone else's, your therapist may need to involve emergency services or another third party. This is the standard limit of confidentiality in any therapeutic relationship and your therapist will explain it in your first session. It is a clinical judgement, made by a clinician — not something our software decides.`,
  },
  {
    id: "security",
    title: "6. How it is protected",
    content: `These are the controls that exist, described as what they do rather than as a certification. We hold no security certification and do not claim one.

- **Encrypted in transit.** All traffic uses TLS. Video and audio are encrypted peer-to-peer.
- **Row-level isolation in the database.** Access rules live in the datastore itself, not only in application code, and identity is attached per transaction. A client cannot read another client's records even if a bug in the application were to ask for them. Your journal entries are readable by you alone — not by your therapist, and not by an administrator.
- **Clinical notes are segregated.** Readable by their author and by administrators for audit. Never by you, never by another clinician.
- **Uploaded documents are served as downloads**, never rendered inline, which prevents an uploaded file being used to attack another user's browser.
- **Identity documents are restricted** to their owner and to administrators.
- **Session cookies are encrypted** and readable only by the server.
- **Passwords are never in our custody.** See section 5.

No system is perfectly secure, and we would rather describe our controls precisely than reassure you vaguely. If you believe you have found a vulnerability, please [tell us](/contact) before disclosing it publicly.`,
  },
  {
    id: "retention",
    title: "7. How long we keep it",
    content: `- **Your account and profile** — while your account is open, and until you ask us to delete it.
- **Messages** — for as long as the session they belong to exists. Deleting a session removes its messages.
- **Journal entries, mood logs and goals** — until you delete them, or until you ask us to delete your account.
- **Clinical notes** — retained as a clinical record. See the limits in section 4.
- **Session records** — retained while financial records referring to them exist.
- **Payments and therapist earnings** — retained for accounting and tax purposes.
- **Identity and licensing documents** — for as long as the clinician practises on Echo, and afterwards for as long as we may need to evidence that they were properly credentialed.
- **Safety alerts** — retained as a safety record, with the outcome of any review attached.
- **Analytics** — held by PostHog under its own retention schedule, and never containing your name, your email, or anything you wrote.

**We have not yet fixed a retention period for clinical records.**
Rather than print a number nobody has set, we are telling you that it is outstanding. It requires professional-standards advice we have sought but not concluded. When it is set, this section will say what it is and this document's date will change.`,
  },
  {
    id: "children",
    title: "8. Children and young people",
    content: `Echo is not for under-13s in any circumstances, and we do not knowingly collect their information.

Therapy for **13 to 17 year-olds** is available, but the account must be opened by a parent or guardian, who gives consent. A young person cannot sign themselves up: our intake questionnaire stops and explains why, and points to helplines for under-18s that do not require a parent's permission.

A teenage client's therapeutic conversations are treated as confidential from their parent within the limits their therapist explains at the outset. A parent who holds the account can see that sessions took place and what they cost; they cannot read the session content.

If you believe a child under 13 has given us information, [tell us](/contact) and we will delete it.`,
  },
  {
    id: "analytics",
    title: "9. Cookies, analytics and tracking",
    content: `[Cookie settings](/cookies) lists every cookie we set and lets you switch analytics off. It takes effect immediately. There are only two categories, because those are the only two that exist: the cookies that keep you signed in, and analytics.

**There is no advertising on this site.** No advertising network is loaded on any page and no advertising cookie is set, anywhere, ever.

Because this is a mental-health service, our analytics are constrained well beyond the norm, and these are enforced in code rather than by policy:

- **You are a random identifier.** Analytics receives an opaque id and a coarse role — "client", "therapist", "admin". Not your name. Not your email.
- **Content never leaves.** Not the text of what you write, not your intake answers, not a mood score, not a category. Not a derived score, either.
- **Safety-scanner outcomes are never sent.** An analytics record that an individual was flagged as in crisis is not something we will create.
- **Page addresses are scrubbed.** Record identifiers are stripped from URLs before they are transmitted, so an analytics event cannot tie a record to a person.
- **Session recording is off behind the login.** We record no screen activity once you are signed in.

Analytics is processed in the United States. See section 11.`,
  },
  {
    id: "clinicians",
    title: "10. If you are a practitioner",
    content: `We process your professional and identity information in order to verify that you are who you say you are and qualified to do what you are offering: your name, contact details, and — for a licensed therapist — your licence or registration details for **each jurisdiction** you practise in, with the documents that evidence them.

**Which jurisdictions you are licensed in is public.** Your name, biography, years of experience, areas of focus and the jurisdictions we have verified appear in our public directory, which anyone can browse without an account. Your licence numbers, your identity documents and the internal notes from your credential review are **not** public and are never sent to a client's browser.

**We record and publish what you actually are.** If you are on the platform as a wellness coach, that is how you are described to every client, in every surface, and you may not describe yourself as a therapist, psychotherapist, counsellor or psychologist here. That is not a presentational preference — in many jurisdictions those are protected titles, and it protects you as much as it protects the client.

**Your credential review is recorded.** Who reviewed a licence, when, against which body, and the outcome. On a rejection you are told why. These records are retained as evidence that your credentials were checked, which is the point of checking them — see section 7.

**Clinical notes belong to the clinician who wrote them.** Readable by you and by administrators for audit purposes. Never by the client they concern, and never by another practitioner. Coaches do not have access to this at all, because coaches do not keep clinical records.

Your earnings records are retained for accounting purposes and, once an amount has been recorded as owed, it is not rewritten by later changes to our fee structure — including the regional pricing in the [terms](/terms) §5, which does not alter what you are paid.`,
  },
  {
    id: "transfers",
    title: "11. Where your data goes",
    content: `Echo Health is operated from Kenya and your records are stored in Microsoft Azure.

Some of the processors in section 5 are established outside Kenya — notably **PostHog**, in the United States, and **Auth0**. That means your information is transferred across borders. The Data Protection Act restricts such transfers, and we require each processor by contract to protect your information and use it only as we instruct.

**This is one of the areas we are still taking advice on.** We are not going to assert a particular statutory transfer mechanism until we are certain which applies. What we can tell you now is exactly which providers are involved and what each receives, which is section 5.

If you are in the EU or EEA and have questions about transfers under the GDPR, [ask us](/contact) and we will answer specifically rather than generically.`,
  },
  {
    id: "changes",
    title: "12. Changes to this policy",
    content: `We will update this document when the product changes, and the dates at the top will change with it.

If a change materially affects how we handle what you have written — the content of your messages, journal or intake answers — we will tell you directly rather than quietly reposting the page. We will not start using your information for a substantially new purpose without asking you first.

Previous versions are available on request.`,
  },
  {
    id: "contact",
    title: "13. Contact and complaints",
    content: `**Privacy questions and requests**
[privacy@echohealth.app](/contact), or use the [contact form](/contact). A person reads these.

**If you are unhappy with our answer**
You can lodge a complaint with the **Office of the Data Protection Commissioner** in Kenya, at [odpc.go.ke](https://www.odpc.go.ke). You do not have to come to us first, though we would like the chance to put it right.

**If you are in the EU or EEA**
You may also complain to your local supervisory authority.

**Something urgent about your care**
Do not use the privacy address. Contact support directly, or if anyone is in immediate danger, your local emergency number — our [crisis page](/crisis) lists verified helplines by region.`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/privacy", label: "Privacy policy" }]} />
      <LegalDoc
        title="Privacy policy"
        lastUpdated={LAST_UPDATED}
        effectiveDate={EFFECTIVE_DATE}
        intro={INTRO}
        sections={SECTIONS}
        footer={
          <div className="rounded-3xl bg-stone-50 p-6 sm:p-8">
            <h2 className="font-display text-xl tracking-tight text-stone-900">
              Questions about any of this?
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-stone-600">
              Privacy policies are written to be complete, which rarely makes
              them clear. If something here matters to you and you cannot tell
              what it means in practice, ask — we will answer about your
              situation specifically.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Contact us
              </Link>
              <Link
                href="/terms"
                className="inline-flex min-h-11 items-center rounded-full bg-surface px-6 text-sm font-semibold text-stone-800 ring-1 ring-inset ring-stone-300 transition hover:ring-stone-400"
              >
                Terms of service
              </Link>
            </div>
          </div>
        }
      />
    </>
  );
}
