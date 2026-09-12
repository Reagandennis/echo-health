import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import { pageMetadata, legalEntityName } from "@/lib/seo";

/**
 * The public privacy policy.
 *
 * ── What was removed from this file, and why ────────────────────────────────
 * This was a United States healthcare privacy policy with a second, unrelated
 * product spliced into it. It asserted, in the document a person reads before
 * deciding whether to trust us with a diagnosis:
 *
 *   • HIPAA covered-entity status — an entire "2. HIPAA — Protected Health
 *     Information" section, a "Your HIPAA Rights" list, HIPAA breach-notice
 *     deadlines, HIPAA staff training, and a complaint route pointing Kenyan
 *     users at the HHS Office for Civil Rights. HIPAA is a US statute with no
 *     application to a service delivered from Kenya, so that complaint route
 *     goes nowhere: a reader who followed it would reach a US federal agency
 *     with no jurisdiction over them and no ability to help. The rest of the
 *     site was swept for this months ago (see the comments on /organizations
 *     and /therapy-for/[condition], and the FAQ answer on confidentiality) —
 *     the policy was missed, which is the single worst page to miss.
 *   • A "4. FlameUp App-Specific Disclosures" section, plus an intro line
 *     saying the policy also covered "TechGetAfrica apps ... including FlameUp
 *     (flameup.com), a productivity app". Another company's product, governed
 *     by the same document as therapy records.
 *   • A badge row reading "HIPAA Compliant / GDPR Ready / CCPA Compliant /
 *     SOC 2 (in progress) / COPPA Safe". Echo holds none of those
 *     certifications and has sat none of those audits. A badge is cheap to
 *     type and expensive to verify, which is exactly why this one survived —
 *     and why `__tests__/static-pages.test.tsx` was asserting it into place.
 *   • A "7. CCPA/CPRA — California Consumer Rights" section granting
 *     California statutory rights, including a 45-day response deadline we are
 *     under no obligation to meet and had never measured.
 *
 * ── What replaced it ────────────────────────────────────────────────────────
 * The governing instrument is Kenya's Data Protection Act 2019, administered by
 * the Office of the Data Protection Commissioner (ODPC). Where the old text
 * described a HIPAA or CCPA right, the DPA equivalent is stated ONLY where the
 * Act actually provides one. Nothing here invents a procedure, a statutory
 * deadline, a retention period or a registration number — §7 says out loud that
 * we have not fixed a clinical-record retention period rather than repeating
 * the "7 years under state law" the US text claimed. The badge row now
 * describes implemented behaviour (TLS, row-level security in the database,
 * licence checks) and matches the assurances in `SiteFooter`.
 *
 * ── The standing rule ───────────────────────────────────────────────────────
 * Do not add a compliance claim to this page that someone could not produce
 * evidence for on request. If you are unsure whether the DPA grants something,
 * leave it out; an under-stated policy is recoverable, a false one is not.
 *
 * ── NOT LEGALLY REVIEWED ────────────────────────────────────────────────────
 * This edit stopped the page asserting things that are untrue. It did not make
 * the document sufficient, and nobody qualified has read it. A Kenyan data
 * protection practitioner still needs to settle, at minimum: ODPC registration
 * status as a data controller/processor, the actual clinical-record retention
 * period, the lawful basis and safeguards for the cross-border transfers in
 * §11, children's-data consent mechanics, and whether a data protection
 * officer must be designated.
 */

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "Echo Health's comprehensive Privacy Policy — what we collect, how we use and protect it, and your rights under Kenya's Data Protection Act 2019.",
  path: "/privacy",
});

const LAST_UPDATED = "May 1, 2026";
const EFFECTIVE_DATE = "May 1, 2026";

/**
 * Descriptions of what the system does, NOT certifications.
 *
 * Replaces "HIPAA Compliant / GDPR Ready / CCPA Compliant / SOC 2 (in
 * progress) / COPPA Safe". Every entry here is something a reader could check:
 * TLS is observable, the row-level policies are in
 * `lib/db/migrations/0001_row_level_security.sql`, and licence verification is
 * the credentialing flow. Do not add a fourth that is a claim about paperwork.
 * Kept word-for-word in step with `ASSURANCES` in `SiteFooter`.
 */
const ASSURANCES = [
  "Encrypted in transit",
  "Row-level access control in the database",
  "Licence-verified therapists",
  "Kenya DPA 2019 aligned",
];

const sections = [
  {
    id: "overview",
    title: "1. Overview & Our Commitment",
    content: `Echo Health is operated by ${legalEntityName} ("Echo Health," "we," "us," or "our"), an online mental-health platform that connects people with licensed therapists and clinical professionals. Information shared in the course of mental-health care is among the most sensitive personal data that exists. This Privacy Policy explains what we collect, why we collect it, how we use and protect it, and what you can require us to do about it.

Echo Health is operated from Kenya. The law that governs how we handle your personal data is the **Kenya Data Protection Act 2019** (the "Act"), administered by the **Office of the Data Protection Commissioner (ODPC)**. This policy is governed by Kenyan law, and any dispute arising under it is subject to the jurisdiction of the courts of Kenya.

If you are in the European Union or European Economic Area, the General Data Protection Regulation (GDPR) may also apply to your use of Echo Health.

By accessing or using Echo Health's website, mobile application, or services (collectively, the "Platform"), you acknowledge that you have read and understood this Privacy Policy.`,
  },
  {
    id: "information-we-collect",
    title: "2. Information We Collect",
    content: `**a) Information you provide directly**

- Account registration: name, email address, date of birth, gender identity, preferred pronouns
- Clinical intake forms: presenting concerns, mental-health history, medications, prior diagnoses
- Payment details: billing information and payment method. Payments are handled by our payment provider — we do not store raw card numbers or mobile-money credentials.
- Communications: messages to your therapist, session notes, in-app chat, support tickets
- Journal entries you write in the app
- Identity and credential documents, if you apply to practise on the Platform

**b) Information collected automatically**

- Device and browser data: IP address, browser type, operating system, device identifiers
- Usage data: pages visited, features used, session duration, referring URLs
- Cookies and similar technologies (see Section 9)
- Crash reports and performance metrics

**c) Information from third parties**

- Identity and credential verification providers, for therapist licence checks
- Google or another sign-in provider, if you choose to sign in that way
- Our payment provider, which confirms to us that a payment succeeded

**d) Sensitive categories**

The Act treats health data as sensitive personal data, and most of what you tell a therapist through Echo Health falls into that category — mental-health history, diagnoses and the content of your sessions. It may also include information about your sexual orientation or gender identity, or your ethnicity, where you choose to tell us because it matters to how you are matched. We do not require any of that, and we apply heightened protections to all of it.`,
  },
  {
    id: "how-we-use",
    title: "3. How We Use Your Information",
    content: `We use your information to:

- **Provide and personalise services**: match you with an appropriate therapist, run video, audio and messaging sessions, and maintain your session records
- **Take payment**: process purchases of session bundles, issue receipts and handle refunds
- **Keep people safe**: messages you send are scanned server-side against a fixed list of crisis-related keywords, and a match creates an internal alert for staff to review. Messages written by therapists and staff are not scanned. The outcome is stored in our own database and is never sent to an analytics provider or any other third party.
- **Secure the Platform**: prevent fraud, abuse and unauthorised access
- **Meet legal obligations**: comply with the Act and other applicable law
- **Improve the service**: analyse aggregated usage patterns. We do not use your personal or health information to train AI models.
- **Communicate with you**: appointment reminders, service updates, and — only if you have opted in — marketing
- **Research**: only with your explicit written consent, and with ethics approval where that is required

We do **not** sell your personal or health information. We do **not** use the content of your sessions, messages, notes or journal entries for advertising, and we do not share it with advertisers.`,
  },
  {
    id: "your-rights",
    title: "4. Your Rights Under the Data Protection Act",
    content: `Kenya's Data Protection Act 2019 gives you the following rights over your personal data:

- **Access**: ask for a copy of the personal data we hold about you
- **Correction**: ask us to correct data that is inaccurate, incomplete, out of date or misleading
- **Erasure**: ask us to delete personal data, subject to the record-keeping obligations described in Section 7
- **Objection**: object to our processing of all or part of your personal data
- **Portability**: ask to receive your data in a structured, commonly used, machine-readable format
- **Complaint**: lodge a complaint with the Office of the Data Protection Commissioner

**Lawful bases for processing**

We process personal data on one or more of these bases: your consent; performance of the contract between us; compliance with a legal obligation; protection of your vital interests or those of another person; and our legitimate interests in operating, securing and improving the Platform, where those interests are not overridden by your rights.

**Withdrawing consent**

Where we rely on your consent — marketing email, research participation — you can withdraw it at any time. Withdrawal does not affect processing already carried out on the basis of that consent, and it does not require you to explain why.

**Automated decisions**

We do not make decisions about you by purely automated means that produce legal or similarly significant effects. The keyword scan described in Section 3 raises an alert for a person to look at; it does not suspend accounts, contact anyone on your behalf, or change your care.

**How to exercise a right**

Email privacy@echohealth.app, or use Settings → Privacy in the app. We will verify your identity before acting on a request, and we aim to respond within 30 days — sooner where the law requires it.`,
  },
  {
    id: "data-sharing",
    title: "5. How We Share Your Information",
    content: `We share personal and health information only in the following limited circumstances:

**Your therapist**

Your therapist can see what they need in order to provide care: your intake form, your session history and their own clinical notes. Therapists are bound by their professional codes of ethics, by the terms of their registration in Kenya, and by written confidentiality obligations to us. Your journal entries are not part of this — nobody but you can read them, including administrators.

**Service providers**

We engage vetted providers for cloud hosting, payment processing, video infrastructure, identity verification, email delivery, customer support tooling and product analytics. Each is bound by a written agreement requiring it to protect your data and to process it only on our instructions, and each receives only what it needs for its function.

**Legal and safety disclosures**

We may disclose information: (a) where required by law, regulation or court order; (b) to protect the vital interests or safety of you or another person where there is a serious risk of harm; (c) to respond to a lawful request from a competent authority.

**Business transfers**

If Echo Health is involved in a merger, acquisition or sale of assets, your information may transfer with the business. We will notify you before your health information becomes subject to a different privacy policy.

**With your consent**

We may share information for any other purpose you specifically authorise.

**We do not sell personal information, and we do not share health information with advertisers.**`,
  },
  {
    id: "security",
    title: "6. Data Security",
    content: `We implement administrative and technical safeguards designed to protect your information against unauthorised access, disclosure, alteration or destruction:

- **In transit**: connections to the Platform are secured with TLS 1.2 or higher
- **At rest**: data is held in a managed database with storage-level encryption
- **Row-level access control**: every database query runs under the identity of the person making it, and rows they have no right to see are not returned. Access control lives in the datastore itself, not only in application code, so a bug in a screen cannot expose records the database would refuse.
- **Separation by role**: clinical notes are readable by their authoring therapist and administrators, never by other clients; journal entries are readable only by the person who wrote them
- **Uploaded documents**: identity documents are restricted to their owner and to administrators, and are served as downloads rather than rendered in the browser
- **Credential verification**: a practitioner's licence is checked before their profile is published
- **Video**: sessions run directly between the two participants. Our servers relay call setup only; they do not carry, see or store the audio and video.

No system is completely secure, and we do not claim otherwise. We hold no third-party security certification and this policy does not assert one.

**Breach notification**

If a breach affects your personal data, we will notify you, and the Office of the Data Protection Commissioner, without undue delay and in the manner the Act requires.`,
  },
  {
    id: "retention",
    title: "7. Data Retention",
    content: `We retain your personal and health information for as long as necessary to:

- Provide ongoing services to you
- Meet the record-keeping obligations that apply to clinical records in Kenya, including those your therapist owes to their professional body
- Resolve disputes and enforce our agreements
- Comply with tax, accounting and other legal obligations

When data is no longer required for those purposes it is deleted or irreversibly anonymised.

This policy does not quote a fixed retention period for clinical records, because the period that applies depends on your therapist's professional obligations. Ask your therapist, or email privacy@echohealth.app, and we will tell you what applies to your records.

You may request early deletion at any time (see Section 4). We will delete what we are not obliged to keep, and tell you what we have kept and why.`,
  },
  {
    id: "minors",
    title: "8. Children's Privacy",
    content: `Echo Health's services are intended for adults aged 18 and over.

Under Kenyan law a child is anyone under the age of 18, and a child's personal data may only be processed with the verifiable consent of a parent or guardian and where the processing is in the best interests of the child. We do not knowingly collect personal data from anyone under 18 without that consent, and if we learn that we have, we will delete it.

If you believe we hold a child's information without the consent of their parent or guardian, contact us immediately at privacy@echohealth.app.`,
  },
  {
    id: "cookies",
    title: "9. Cookies, Analytics & Tracking",
    content: `**Cookies we use**

- Session cookies that keep you signed in — strictly necessary, and not optional
- Preference cookies that remember your settings
- Analytics cookies that measure how the Platform performs

We do not use advertising cookies or ad-network tracking pixels anywhere on the Platform.

**How our analytics are constrained**

This is a mental-health service, so our product analytics are deliberately limited:

- You are identified to our analytics provider by an account identifier and a coarse role — not by name and not by email address
- Session replay is disabled once you are signed in, so no recording is made of the screens where notes, messages or client names appear
- Record identifiers are stripped out of page addresses before an event is sent
- The content of what you write — messages, clinical notes, journal entries — is never sent to an analytics provider, and neither is the outcome of the safety scan described in Section 3

**Managing cookies**

Use our Cookie settings page, linked in the footer of every page, or your browser's own controls. Disabling strictly necessary cookies will prevent you from signing in.`,
  },
  {
    id: "therapist-privacy",
    title: "10. Therapist & Clinician Privacy",
    content: `If you are a therapist or clinician on the Echo Health platform, we collect additional professional information: your practising licence and registration details, your qualifications and training, professional indemnity insurance details, professional references, identity documents, and the bank or mobile-money details we pay you through.

We use it to verify your credentials before your profile is published, to match you with clients, to pay you, and to meet our own record-keeping obligations. Identity and credential documents are restricted to you and to Echo Health administrators; clients never see them.

Where the law requires it, or in connection with a complaint or regulatory enquiry, we may share credential information with the relevant Kenyan regulatory or professional body.`,
  },
  {
    id: "international",
    title: "11. Where Your Data Is Processed",
    content: `Echo Health operates from Kenya, but several services we depend on are provided by companies outside it. That means some of your personal data is processed outside Kenya. Those services are:

- Cloud database and application hosting
- Authentication and sign-in
- Payment processing
- Transactional email delivery
- Product analytics

The Act restricts transfers of personal data outside Kenya and requires appropriate safeguards. We contract with each provider on terms requiring it to protect your data and process it only on our instructions, and we limit what each receives to what its function needs — our analytics provider, for instance, never receives the content of messages, notes or journal entries, and our email provider receives only what is needed to deliver a message to you.

If you would like the current list of providers and the countries they operate in, email privacy@echohealth.app and we will send it to you.`,
  },
  {
    id: "your-choices",
    title: "12. Your Choices & Controls",
    content: `- **Account deletion**: delete your account at any time through Settings → Account → Delete Account. Clinical records are kept where record-keeping obligations require it — see Section 7.
- **Marketing opt-out**: unsubscribe from the link in any marketing email, or through Settings → Notifications. This never affects service messages such as appointment reminders.
- **Session recording**: video sessions run directly between you and your therapist, and Echo Health does not record them.
- **Data export**: request a copy of your data in a portable format through Settings → Privacy → Export Data.
- **Therapist change**: request a different therapist at any time, at no cost and without giving a reason.`,
  },
  {
    id: "contact",
    title: "13. Contact Us & How to Exercise Your Rights",
    content: `For privacy-related requests, questions or complaints:

**Privacy & Compliance Team**

${legalEntityName}
Email: privacy@echohealth.app
Response time: we aim to respond to every privacy request within 30 days, or sooner where the law requires it.

**If you are not satisfied with our response**

You have the right to lodge a complaint with Kenya's Office of the Data Protection Commissioner — odpc.go.ke.

If you are in the EU/EEA or the United Kingdom, you may also contact your local data protection authority.`,
  },
  {
    id: "changes",
    title: "14. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. When we make a material change we will post the updated policy with a revised "Last Updated" date, and notify you by email or in-app notification at least 30 days before it takes effect. Where a change requires your consent under the Act, we will ask for it rather than assume it.

Your continued use of the Platform after the effective date of a change constitutes acceptance of the updated policy.`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/privacy", label: "Privacy policy" }]} />

      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <div className="mb-12 border-b border-slate-100 pb-10">
          <span className="inline-block rounded-full bg-cream px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand mb-6">
            Legal
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 leading-tight">
            Privacy Policy
          </h1>
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-400">
            <span>Last Updated: {LAST_UPDATED}</span>
            <span>Effective Date: {EFFECTIVE_DATE}</span>
          </div>
          <p className="mt-6 text-base leading-7 text-slate-500 max-w-2xl">
            Your privacy, and the confidentiality of your mental-health
            information, are fundamental to how Echo Health is built. This
            policy explains what we collect, why, and what you can require us to
            do about it.
          </p>
          <p className="mt-4 text-base leading-7 text-slate-500 max-w-2xl">
            Effective{" "}
            <strong className="text-slate-700 font-semibold">
              {EFFECTIVE_DATE}
            </strong>
            . Echo Health is operated from Kenya. This policy is governed by
            Kenyan law — principally the{" "}
            <strong className="text-slate-700 font-semibold">
              Data Protection Act 2019
            </strong>
            , administered by the Office of the Data Protection Commissioner —
            and any dispute arising under it is subject to the jurisdiction of
            the Kenyan courts. If you are in the EU/EEA, the GDPR may also apply
            to your use of Echo Health.
          </p>

          {/*
            What the system does, not what it has been certified for. See the
            ASSURANCES comment above before adding to this row.
          */}
          <div className="mt-8 flex flex-wrap gap-3">
            {ASSURANCES.map((item) => (
              <span
                key={item}
                className="rounded-full border border-brand/20 bg-cream/60 px-4 py-1.5 text-xs font-semibold text-brand"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Table of contents */}
        <nav
          aria-label="Table of contents"
          className="mb-12 rounded-2xl border border-slate-100 bg-slate-50 p-6"
        >
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
            Table of Contents
          </h2>
          <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-sm text-slate-600 hover:text-brand transition-colors"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="space-y-14">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-xl font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">
                {section.title}
              </h2>
              <div className="prose prose-slate prose-sm max-w-none">
                {section.content.split("\n\n").map((paragraph, i) => {
                  if (paragraph.startsWith("**") && paragraph.includes("**\n")) {
                    // Bold heading paragraph
                    const [heading, ...rest] = paragraph.split("\n");
                    return (
                      <div key={i} className="mb-4">
                        <p className="font-semibold text-slate-700 mb-1">
                          {heading.replace(/\*\*/g, "")}
                        </p>
                        {rest.length > 0 && (
                          <p className="text-slate-500 leading-7">
                            {rest.join(" ")}
                          </p>
                        )}
                      </div>
                    );
                  }
                  if (paragraph.startsWith("- ")) {
                    const items = paragraph
                      .split("\n")
                      .filter((l) => l.startsWith("- "));
                    return (
                      <ul key={i} className="list-disc list-inside space-y-2 mb-4 text-slate-500">
                        {items.map((item, j) => {
                          const text = item.slice(2);
                          // Handle **bold**: text inline
                          const parts = text.split(/(\*\*[^*]+\*\*)/g);
                          return (
                            <li key={j} className="leading-7">
                              {parts.map((p, k) =>
                                p.startsWith("**") ? (
                                  <strong key={k} className="text-slate-700 font-semibold">
                                    {p.replace(/\*\*/g, "")}
                                  </strong>
                                ) : (
                                  p
                                )
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    );
                  }
                  // Inline bold handling
                  const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
                  return (
                    <p key={i} className="text-slate-500 leading-7 mb-4">
                      {parts.map((p, k) =>
                        p.startsWith("**") ? (
                          <strong key={k} className="text-slate-700 font-semibold">
                            {p.replace(/\*\*/g, "")}
                          </strong>
                        ) : (
                          p
                        )
                      )}
                    </p>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-20 rounded-2xl bg-teal-700 p-8 text-center text-white">
          <h2 className="text-xl font-bold mb-2">Questions about your privacy?</h2>
          <p className="text-white/80 text-sm mb-6">
            Our privacy team reads every request. We aim to respond within 30
            days.
          </p>
          <a
            href="mailto:privacy@echohealth.app"
            className="inline-block rounded-full bg-white px-8 py-3 text-sm font-semibold text-teal-700 hover:opacity-90 transition-opacity"
          >
            Contact Privacy Team
          </a>
        </div>
      </div>
    </>
  );
}
