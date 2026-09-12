import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import { pageMetadata, legalEntityName } from "@/lib/seo";

/**
 * The public terms of service.
 *
 * ── What was corrected here, and why ────────────────────────────────────────
 * Swept alongside /privacy, which had been a United States healthcare policy
 * with a second company's product spliced into it. This file was in far better
 * shape — no HIPAA, no CCPA, no arbitration clause naming a US forum, no USD,
 * and §5 had already been corrected to Kenyan Shillings and one-time bundles.
 * The one false statement was the contracting party: both §1 and §10 named
 * "Echo Health, Inc.", a US corporate form. The registered entity is declared
 * once in `lib/seo.ts` as `legalEntityName`, and is now interpolated from there
 * so the contract and the footer copyright cannot drift apart. **Verify that
 * string against the certificate of incorporation before relying on it** — a
 * contract that names a party which does not exist binds nobody.
 *
 * ── WHAT IS MISSING, and was deliberately NOT invented ──────────────────────
 * These are gaps, not oversights. Writing them would have meant drafting novel
 * legal terms, which is not something to do from a code editor:
 *
 *   • **No governing-law or jurisdiction clause.** /privacy now states Kenyan
 *     law and Kenyan courts; these Terms say nothing at all, so the agreement
 *     they form has no stated forum. This is the largest gap on the page.
 *   • **No dispute-resolution or complaints route** — nothing tells a user how
 *     to raise a complaint about a therapist, or where it goes.
 *   • **§5 references "our Refund Policy". There is no such page.** The route
 *     does not exist and nothing links to one.
 *   • **§4's "13-17" age band is a US COPPA artifact.** Kenyan law treats
 *     everyone under 18 as a child requiring verifiable parental consent; the
 *     13 floor comes from a statute that does not apply here.
 *   • **§8 and §9 are US-style blanket disclaimers in capitals.** Kenya's
 *     Consumer Protection Act 2012 limits how far a supplier can exclude
 *     liability to a consumer, so parts of them may simply be unenforceable.
 *     They were left as found rather than narrowed by guesswork.
 *   • No intellectual-property or content-licence terms, and no clause
 *     covering what happens to session credits on termination (§7 terminates
 *     accounts "at any time, for any reason" and is silent on paid-for
 *     credits, which §5 says do not expire).
 *
 * NOT LEGALLY REVIEWED. A Kenyan practitioner needs to close the above.
 */

export const metadata = pageMetadata({
  title: "Terms of Service",
  description:
    "Echo Health's Terms of Service: what you agree to when you book a session, how session credits and cancellations work, and the limits of the service.",
  path: "/terms",
});

const LAST_UPDATED = "May 1, 2026";
const EFFECTIVE_DATE = "May 1, 2026";

const sections = [
  {
    id: "overview",
    title: "1. Acceptance of Terms",
    content: `By accessing or using the Echo Health website, mobile application, or services (collectively, the "Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Platform.
    
These Terms constitute a legally binding agreement between you and ${legalEntityName} ("Echo Health," "we," "us," or "our"), which operates the Platform from Kenya.`,
  },
  {
    id: "not-medical-emergency",
    title: "2. Not for Medical Emergencies",
    content: `**IF YOU ARE EXPERIENCING A MEDICAL EMERGENCY, ARE IN DANGER, OR ARE FEELING SUICIDAL, CALL YOUR LOCAL EMERGENCY NUMBER IMMEDIATELY OR GO TO THE NEAREST EMERGENCY ROOM.** In Kenya that is 999, 112 or 911; in the United States it is 911.

Echo Health is not a suicide prevention lifeline, and our therapists cannot provide emergency psychiatric or medical care. Our Platform is not designed for crisis situations. Please use our Crisis Support page for immediate resources.`,
  },
  {
    id: "services",
    title: "3. Nature of Services",
    content: `Echo Health provides a technology platform that connects users with independent, licensed mental health professionals ("Providers"). 

**We do not provide healthcare services.** Echo Health itself does not provide medical advice, diagnosis, or treatment. The Providers on our platform are independent contractors who exercise their own independent professional judgment. Your relationship with your Provider is strictly between you and the Provider.`,
  },
  {
    id: "eligibility",
    title: "4. Eligibility & Accounts",
    content: `To use the Platform, you must:
- Be at least 18 years old (or have verifiable parental/guardian consent if between 13-17).
- Reside in a jurisdiction where we operate.
- Provide accurate, current, and complete information during registration.

You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorised use.`,
  },
  {
    id: "payments",
    // Retitled from "Payments & Subscriptions". Echo Health sells one-time
    // session bundles; there is no subscription product, and the section
    // opened by referring to "your selected subscription plan" — a term of
    // art that describes recurring billing we do not operate. A contract that
    // contradicts the thing being sold is unenforceable in the parts that
    // matter and misleading in the rest.
    title: "5. Payments",
    content: `**Fees:** You agree to pay the fee for the session bundle you select. All fees are listed on our Pricing page and are charged in Kenyan Shillings.

**One-time purchases:** Session bundles are one-time purchases. Nothing auto-renews, there is no recurring billing and there is no subscription to cancel. Session credits do not expire, and cancelling a booking at least 24 hours ahead returns the credit to your account. You can review your purchase history in your Account Settings.

**Switching therapists:** There is no charge to be matched with a different therapist, and doing so does not affect any session credits you hold.

**Refunds:** All payments are generally non-refundable, except as required by law or as explicitly stated in our Refund Policy. If you cancel a session with less than 24 hours' notice, you may be charged a cancellation fee.`,
  },
  {
    id: "acceptable-use",
    title: "6. Acceptable Use",
    content: `You agree not to:
- Use the Platform for any illegal purpose, or in violation of Kenyan law or any other law that applies to you.
- Harass, abuse, or harm another person, including Providers.
- Impersonate any person or entity or misrepresent your affiliation.
- Interfere with or disrupt the operation of the Platform or the servers or networks used to make the Platform available.
- Attempt to gain unauthorised access to the Platform or other users' accounts.`,
  },
  {
    id: "termination",
    title: "7. Termination",
    content: `We reserve the right to suspend or terminate your account and your access to the Platform at any time, for any reason, without notice or liability. You may terminate your account at any time through your Account Settings. Upon termination, you remain liable for any outstanding fees.`,
  },
  {
    id: "disclaimer",
    title: "8. Disclaimers",
    content: `THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. ECHO HEALTH EXPLICITLY DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

We do not guarantee that the Platform will be uninterrupted, secure, or error-free, or that any Provider will meet your specific needs.`,
  },
  {
    id: "liability",
    title: "9. Limitation of Liability",
    content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL ECHO HEALTH BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF OR IN CONNECTION WITH THE PLATFORM OR THESE TERMS, WHETHER BASED ON WARRANTY, CONTRACT, TORT, OR ANY OTHER LEGAL THEORY.`,
  },
  {
    id: "contact",
    title: "10. Contact Information",
    content: `If you have any questions about these Terms, please contact us at:

${legalEntityName}
Email: legal@echohealth.app`,
  },
];

export default function TermsOfServicePage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/terms", label: "Terms of service" }]} />

      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        {/* Header */}
        <div className="mb-12 border-b border-slate-100 pb-10">
          <span className="inline-block rounded-full bg-cream px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand mb-6">
            Legal
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 leading-tight">
            Terms of Service
          </h1>
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-400">
            <span>Last Updated: {LAST_UPDATED}</span>
            <span>Effective Date: {EFFECTIVE_DATE}</span>
          </div>
          <p className="mt-6 text-base leading-7 text-slate-500 max-w-2xl">
            Please read these Terms of Service carefully before using Echo Health. 
            By using our platform, you agree to be bound by these rules.
          </p>
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
      </div>
    </>
  );
}
