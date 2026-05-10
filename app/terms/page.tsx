import type { Metadata } from "next";
import Link from "next/link";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Echo Health's Terms of Service — the rules and agreements that govern your use of our platform.",
};

const LAST_UPDATED = "May 1, 2026";
const EFFECTIVE_DATE = "May 1, 2026";

const sections = [
  {
    id: "overview",
    title: "1. Acceptance of Terms",
    content: `By accessing or using the Echo Health website, mobile application, or services (collectively, the "Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Platform.
    
These Terms constitute a legally binding agreement between you and Echo Health, Inc. ("Echo Health," "we," "us," or "our").`,
  },
  {
    id: "not-medical-emergency",
    title: "2. Not for Medical Emergencies",
    content: `**IF YOU ARE EXPERIENCING A MEDICAL EMERGENCY, ARE IN DANGER, OR ARE FEELING SUICIDAL, CALL 911 (OR YOUR LOCAL EMERGENCY NUMBER) IMMEDIATELY OR GO TO THE NEAREST EMERGENCY ROOM.**

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
    title: "5. Payments & Subscriptions",
    content: `**Fees:** You agree to pay all fees associated with your selected subscription plan or individual sessions. All fees are listed on our Pricing page.
    
**Subscriptions:** Subscriptions auto-renew automatically unless cancelled before the end of the current billing period. You can manage your subscription in your Account Settings.

**Refunds:** All payments are generally non-refundable, except as required by law or as explicitly stated in our Refund Policy. If you cancel a session with less than 24 hours' notice, you may be charged a cancellation fee.`,
  },
  {
    id: "acceptable-use",
    title: "6. Acceptable Use",
    content: `You agree not to:
- Use the Platform for any illegal purpose or in violation of any local, state, national, or international law.
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

Echo Health, Inc.
Email: legal@echohealth.app`,
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-white min-h-screen">
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

      <main className="flex-1 mx-auto max-w-4xl px-6 py-16 w-full">
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
      </main>

      <Footer />
    </div>
  );
}
