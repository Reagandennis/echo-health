import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Echo Health's comprehensive Privacy Policy — how we collect, use, protect, and share your information in compliance with HIPAA, GDPR, CCPA, and applicable mental-health privacy laws.",
};

const LAST_UPDATED = "May 1, 2026";
const EFFECTIVE_DATE = "May 1, 2026";

const sections = [
  {
    id: "overview",
    title: "1. Overview & Our Commitment",
    content: `Echo Health, Inc. ("Echo Health," "we," "us," or "our") operates an online mental-health platform that connects individuals with licensed therapists and clinical professionals. We understand that information shared in the context of mental-health care is among the most sensitive personal data that exists. This Privacy Policy explains what information we collect, why we collect it, how we use and protect it, and your rights over it.

We are committed to maintaining the confidentiality, integrity, and security of your personal and health information in accordance with the Health Insurance Portability and Accountability Act of 1996 (HIPAA), the General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA)/California Privacy Rights Act (CPRA), and other applicable laws.

By accessing or using Echo Health's website, mobile application, or services (collectively, the "Platform"), you acknowledge that you have read and understood this Privacy Policy.

This Privacy Policy also applies to TechGetAfrica apps and digital products that link to, incorporate, or reference this Privacy Policy.`,
  },
  {
    id: "hipaa",
    title: "2. HIPAA — Protected Health Information",
    content: `Echo Health is a HIPAA-covered entity or acts as a Business Associate depending on the context of your use. As such, we maintain and enforce a comprehensive HIPAA compliance programme.

**What is PHI?**
Protected Health Information (PHI) is individually identifiable health information that we create, receive, maintain, or transmit in connection with the provision of healthcare services. This includes, but is not limited to: your name when combined with mental-health diagnoses, therapy session notes, treatment plans, appointment records, billing records, and any communications with your therapist.

**How We Use and Disclose PHI**
We may use or disclose your PHI for Treatment, Payment, and Healthcare Operations (TPO) without your express written authorisation. Beyond TPO, we will only use or disclose PHI with your signed authorisation, except where disclosure is required by law (e.g., mandatory reporting of imminent harm, child abuse, elder abuse, or court order).

**Minimum Necessary Standard**
We apply the HIPAA minimum necessary standard — we only access, use, or share the minimum amount of PHI required to accomplish the intended purpose.

**Business Associate Agreements**
All third-party vendors, cloud providers, and subprocessors who handle PHI on our behalf are required to sign Business Associate Agreements (BAAs) and maintain equivalent safeguards.

**Your HIPAA Rights**
Under HIPAA, you have the right to: (a) access and receive a copy of your PHI; (b) request corrections to inaccurate PHI; (c) receive an accounting of certain disclosures; (d) request restrictions on how we use or disclose your PHI; (e) receive communications through alternative means; and (f) file a complaint with the HHS Office for Civil Rights at www.hhs.gov/ocr.

**Notice of Privacy Practices**
Our full Notice of Privacy Practices (NPP) is available on request and is provided to all clients at the commencement of services.`,
  },
  {
    id: "information-we-collect",
    title: "3. Information We Collect",
    content: `**a) Information You Provide Directly**
- Account registration: name, email address, date of birth, gender identity, preferred pronouns
- Clinical intake forms: presenting concerns, mental-health history, medications, prior diagnoses
- Payment information: billing address, payment method (processed via PCI-DSS-compliant processors; we do not store raw card numbers)
- Communications: messages, session notes, in-app chat, support tickets

**b) Information Collected Automatically**
- Device and browser data: IP address, browser type, operating system, device identifiers
- Usage data: pages visited, features used, session duration, referring URLs
- Cookies and similar technologies (see Section 11)
- Crash reports and performance metrics (anonymised)

**c) Information from Third Parties**
- Identity verification providers (for therapist credential checks)
- Insurance providers (if you use insurance benefits)
- Referral partners (only with your consent)
- Google or other OAuth providers if you sign in via social login

**d) Sensitive Categories**
We may collect special categories of sensitive data including: mental-health diagnoses, sexual orientation or gender identity (only if voluntarily disclosed), racial or ethnic origin (for matching preferences), and biometric data (if you use voice or video sessions). We treat all such data with heightened protections.`,
  },
  {
    id: "how-we-use",
    title: "4. How We Use Your Information",
    content: `We use your information to:

- **Provide and personalise services**: match you with appropriate therapists, facilitate video/audio/chat sessions, maintain session records
- **Billing and payment processing**: generate invoices, process subscriptions, handle refunds
- **Safety and clinical risk management**: detect crisis indicators, trigger mandatory reporting where required by law
- **Platform security**: prevent fraud, abuse, and unauthorised access
- **Legal compliance**: comply with HIPAA, GDPR, CCPA, and other applicable laws
- **Service improvement**: analyse aggregate, anonymised usage patterns to improve the Platform (we never train AI models on your PHI without explicit consent)
- **Communications**: send appointment reminders, service updates, and (with your consent) marketing communications
- **Research**: only with your explicit written consent and IRB oversight where required

We do **not** sell your personal health information. We do **not** use your therapy session content for advertising.`,
  },
  {
    id: "gdpr",
    title: "5. GDPR — Rights of EU/EEA Data Subjects",
    content: `If you are located in the European Union, European Economic Area, or United Kingdom, the following rights apply to you under the GDPR and UK GDPR:

**Legal Bases for Processing**
We process your personal data on the following lawful bases:
- **Contract**: processing necessary to deliver the services you requested
- **Legal obligation**: compliance with HIPAA, GDPR, and other laws
- **Vital interests**: preventing imminent risk of harm
- **Consent**: where we have obtained your explicit consent (e.g., marketing, research participation)
- **Legitimate interests**: fraud prevention, platform security, internal analytics (balanced against your rights)

**Your GDPR Rights**
- **Right of Access (Art. 15)**: request a copy of all personal data we hold about you
- **Right to Rectification (Art. 16)**: correct inaccurate or incomplete data
- **Right to Erasure (Art. 17)**: request deletion of your personal data ("right to be forgotten"), subject to our legal retention obligations
- **Right to Restriction (Art. 18)**: ask us to restrict processing in certain circumstances
- **Right to Data Portability (Art. 20)**: receive your data in a structured, machine-readable format
- **Right to Object (Art. 21)**: object to processing based on legitimate interests, including profiling
- **Rights related to automated decision-making (Art. 22)**: we do not make solely automated decisions with legal or significant effects without human review

**Data Transfers**
Where personal data is transferred outside the EU/EEA, we ensure appropriate safeguards are in place, including EU Standard Contractual Clauses (SCCs) or adequacy decisions.

**Data Protection Officer**
You may contact our Data Protection Officer at: privacy@echohealth.app`,
  },
  {
    id: "ccpa",
    title: "6. CCPA/CPRA — California Consumer Rights",
    content: `If you are a California resident, the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA) grants you the following rights:

**Categories of Personal Information Collected**
In the past 12 months we have collected: identifiers (name, email, IP address); commercial information (subscription records); Internet or network activity; geolocation data; professional or employment-related information (for therapists); health and medical information (as permitted under HIPAA/CMIA); and inferences drawn to create a profile.

**Your California Rights**
- **Right to Know**: request disclosure of the categories and specific pieces of personal information we have collected about you, the sources, purposes, and third parties with whom we share it
- **Right to Delete**: request deletion of your personal information, subject to certain exceptions
- **Right to Correct**: request correction of inaccurate personal information
- **Right to Opt-Out of Sale/Sharing**: we do not sell or share personal information for cross-context behavioural advertising
- **Right to Limit Use of Sensitive Personal Information**: you may direct us to limit use of sensitive personal information to what is necessary to provide services
- **Right to Non-Discrimination**: we will not discriminate against you for exercising your privacy rights

**How to Submit a Request**
Email: privacy@echohealth.app | In-app: Settings → Privacy → Submit Request
We will verify your identity before processing requests and respond within 45 days (extendable by another 45 days with notice).

**Authorised Agents**
You may designate an authorised agent to submit requests on your behalf by providing a signed written authorisation.`,
  },
  {
    id: "data-sharing",
    title: "7. How We Share Your Information",
    content: `We share personal and health information only in the following limited circumstances:

**Your Therapist**
Your therapist has access to information necessary to provide care, including session history, intake forms, and in-session notes. Therapists are bound by their professional ethical codes, state licensing laws, and our Business Associate Agreements.

**Service Providers (Sub-processors)**
We engage vetted third-party providers for: cloud hosting (with BAAs), payment processing (PCI-DSS compliant), video conferencing infrastructure, identity verification, email delivery, and customer support tooling. All sub-processors are bound by confidentiality and data processing agreements.

**Legal and Safety Disclosures**
We may disclose information: (a) when required by law, regulation, or court order; (b) to protect the vital interests or safety of you or another person (imminent harm); (c) to respond to lawful government requests; (d) in connection with mandatory reporting obligations (child abuse, elder abuse, duty to warn).

**Business Transfers**
If Echo Health is involved in a merger, acquisition, or asset sale, your information may be transferred. We will notify you before your PHI is transferred and subject to a different privacy policy.

**With Your Consent**
We may share your information with your explicit consent for research studies, insurance coordination, or other purposes you specifically authorise.

**We do not sell personal information. We do not share PHI with advertisers.**`,
  },
  {
    id: "security",
    title: "8. Data Security",
    content: `We implement administrative, technical, and physical safeguards designed to protect your information against unauthorised access, disclosure, alteration, or destruction:

- **Encryption at rest**: all PHI and personal data encrypted using AES-256
- **Encryption in transit**: all connections secured with TLS 1.2 or higher
- **Access controls**: role-based access control (RBAC); employees access only the minimum data necessary for their role
- **Audit logging**: all access to PHI is logged and monitored
- **Penetration testing**: regular third-party security assessments
- **Workforce training**: all staff complete HIPAA security and privacy training annually
- **Incident response**: documented breach response plan meeting HIPAA 60-day notification requirements and GDPR 72-hour notification requirements to supervisory authorities

**Data Breach Notification**
In the event of a breach affecting your PHI, we will notify you in writing within the timeframes required by applicable law (no later than 60 days under HIPAA, 72 hours under GDPR for reportable breaches to authorities).`,
  },
  {
    id: "retention",
    title: "9. Data Retention",
    content: `We retain your personal and health information for as long as necessary to:
- Provide ongoing services to you
- Comply with legal retention obligations (clinical records are typically retained for a minimum of 7 years under state law; some jurisdictions require longer retention for minors)
- Resolve disputes and enforce our agreements
- Meet HIPAA medical record retention standards

When data is no longer required, it is securely deleted or anonymised using industry-standard methods. You may request early deletion subject to legal retention requirements (see Section 5 and 6).`,
  },
  {
    id: "minors",
    title: "10. Children's Privacy (COPPA)",
    content: `Echo Health's services are intended for adults (18+). We do not knowingly collect personal information from children under 13 without verifiable parental consent. If we become aware that we have inadvertently collected personal information from a child under 13, we will promptly delete it.

For users aged 13–17, parental or guardian consent is required before account creation. Clinical records for minors are subject to additional state law protections, and parental access to minor PHI may be restricted depending on the nature of treatment and applicable law (e.g., treatment for substance use, reproductive health, or sexual abuse).

If you believe we have collected information from a child in violation of COPPA, please contact us immediately at privacy@echohealth.app.`,
  },
  {
    id: "cookies",
    title: "11. Cookies & Tracking Technologies",
    content: `We use cookies and similar technologies to:
- Maintain your login session (strictly necessary)
- Remember your preferences
- Measure platform performance (analytics)
- Prevent fraud

We do **not** use tracking pixels or third-party advertising cookies on pages where PHI is accessible.

**Managing Cookies**
You can manage cookie preferences through your browser settings or our Cookie Preference Centre (accessible from the footer). Disabling strictly necessary cookies will affect your ability to use the Platform.

**Do Not Track**
We honour browser-level "Do Not Track" signals for non-essential analytics.`,
  },
  {
    id: "therapist-privacy",
    title: "12. Therapist & Clinician Privacy",
    content: `If you are a therapist or clinician on the Echo Health platform, we collect additional professional information including: NPI number, state licences, DEA registration (if applicable), malpractice insurance details, educational credentials, professional references, and bank account details for payments.

This information is used to verify your credentials, facilitate client matching, process payments, and comply with state licensing board requirements. Therapist credential information may be shared with state licensing authorities when required by law or in connection with a complaint.`,
  },
  {
    id: "international",
    title: "13. International Data Transfers",
    content: `Echo Health is headquartered in the United States. If you access our services from outside the United States, your information may be transferred to, stored, and processed in the United States and other countries.

For transfers from the EU/EEA/UK, we rely on:
- Standard Contractual Clauses (SCCs) approved by the European Commission
- UK International Data Transfer Agreements (IDTAs)
- Supplementary technical and organisational measures where required by the EDPB recommendations

By using our services, you consent to the transfer of your information to countries outside your jurisdiction where data protection laws may differ.`,
  },
  {
    id: "your-choices",
    title: "14. Your Choices & Controls",
    content: `- **Account deletion**: You may delete your account at any time through Settings → Account → Delete Account. Clinical records are retained as required by law.
- **Marketing opt-out**: Unsubscribe via the link in any marketing email or through Settings → Notifications.
- **Session recording**: Video sessions are not recorded by default. If recording is enabled, you will be notified and must consent.
- **Data export**: Request a copy of your data in a portable format through Settings → Privacy → Export Data.
- **Therapist change**: You may request a new therapist match at any time without penalty.`,
  },
  {
    id: "contact",
    title: "15. Contact Us & How to Exercise Your Rights",
    content: `For privacy-related requests, questions, or complaints:

**Privacy & Compliance Team**
Echo Health, Inc.
Email: privacy@echohealth.app
Response time: We aim to respond to all privacy requests within 30 days (or within the timeframe required by applicable law).

**To file a complaint with a supervisory authority:**
- United States (HIPAA): HHS Office for Civil Rights — www.hhs.gov/ocr
- European Union: Your local Data Protection Authority — edpb.europa.eu
- United Kingdom: Information Commissioner's Office — ico.org.uk
- California: California Privacy Protection Agency — cppa.ca.gov`,
  },
  {
    id: "changes",
    title: "16. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. When we make material changes, we will: (a) post the updated policy with a revised "Last Updated" date; (b) notify you by email or in-app notification at least 30 days before the change takes effect; and (c) for changes affecting how we use your PHI, obtain your consent where required by HIPAA.

Your continued use of the Platform after the effective date of any change constitutes acceptance of the updated policy.`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            <span className="text-brand">Echo Psychology </span>
            <span className="text-slate-700">Group</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 hover:text-brand transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
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
            Your privacy and the confidentiality of your mental-health
            information are fundamental to who we are. This policy covers your
            use of Echo Health and TechGetAfrica apps that reference this
            policy, along with your
            {" "}
            rights under{" "}
            <strong className="text-slate-700 font-semibold">HIPAA</strong>,{" "}
            <strong className="text-slate-700 font-semibold">GDPR</strong>,{" "}
            <strong className="text-slate-700 font-semibold">CCPA/CPRA</strong>
            ,{" "}
            <strong className="text-slate-700 font-semibold">COPPA</strong>,
            and other applicable privacy laws.
          </p>

          {/* Compliance badges */}
          <div className="mt-8 flex flex-wrap gap-3">
            {["HIPAA Compliant", "GDPR Ready", "CCPA Compliant", "SOC 2 (in progress)", "COPPA Safe"].map(
              (badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-brand/20 bg-cream/60 px-4 py-1.5 text-xs font-semibold text-brand"
                >
                  ✓ {badge}
                </span>
              )
            )}
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
            Our Privacy & Compliance team is here to help. We aim to respond
            within 30 days.
          </p>
          <a
            href="mailto:privacy@echohealth.app"
            className="inline-block rounded-full bg-white px-8 py-3 text-sm font-semibold text-teal-700 hover:opacity-90 transition-opacity"
          >
            Contact Privacy Team
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 mt-16 py-8 text-center text-xs text-slate-400">
        <p>
          © {new Date().getFullYear()} Echo Health, Inc. All rights reserved.
        </p>
        <div className="flex justify-center gap-6 mt-3">
          <Link href="/privacy" className="hover:text-brand transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-brand transition-colors">
            Terms of Service
          </Link>
          <Link href="/" className="hover:text-brand transition-colors">
            Back to Home
          </Link>
        </div>
      </footer>
    </div>
  );
}
