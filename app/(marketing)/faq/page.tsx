import { ArrowLeft, Plus, MessageCircle } from "lucide-react";
import Link from "next/link";
import Footer from "@/app/components/Footer";
import { pageMetadata } from "@/lib/seo";
import {
  PLAN_PRICES,
  PLAN_SESSIONS,
  PLAN_CURRENCY,
} from "@/lib/constants";

/**
 * Prices are read from `lib/constants.ts`, never typed out here.
 *
 * This page previously spelled the figures into prose, which is how a pricing
 * page and an FAQ end up quoting different numbers for the same plan — and this
 * one is indexed as FAQ structured data, so a stale figure propagates into
 * search results.
 */
const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: PLAN_CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);

export const metadata = pageMetadata({
  title: "Frequently Asked Questions",
  description:
    "Answers to common questions about Echo Health therapy, pricing, insurance, and privacy.",
  path: "/faq",
});

const faqs = [
  {
    category: "Therapy & Matching",
    questions: [
      {
        q: "How does the matching process work?",
        a: "When you sign up, you'll complete a brief assessment about your goals, preferences, and what you're looking for in a therapist. Our algorithm uses this to recommend licensed professionals who specialize in your specific needs.",
      },
      {
        // Was "through your dashboard, no questions asked". There is no switch
        // control in the dashboard — reassignment is performed by our team — and
        // sending someone to look for a button that does not exist is a worse
        // experience than telling them who to ask.
        q: "Can I change my therapist if it's not a good fit?",
        a: "Yes. Finding the right connection is the most important part of therapy. Email support@echohealth.app or message us from your dashboard and we'll match you with someone else. There is no charge to switch, and any unused session credits stay with you.",
      },
      {
        // The specific credentialing figures — "at least 3 years and 1,000
        // hours" — were removed. Licence verification is real (a therapist
        // cannot see clients until an admin has reviewed their documents), but
        // nothing in the product records or enforces an experience threshold, so
        // there was no basis for the number.
        q: "Are the therapists licensed?",
        a: "Yes. Every therapist applying to Echo Health submits their professional licence and identification, and an administrator reviews and verifies it before they are able to see any client. Therapists who have not completed that review cannot be matched with you.",
      },
    ],
  },
  {
    category: "Pricing & Payment",
    questions: [
      {
        q: "How much does Echo Health cost?",
        a: `Sessions start at ${money(PLAN_PRICES.individual)} for a single 50-minute video session. The Plus bundle is ${money(PLAN_PRICES.plus)} for ${PLAN_SESSIONS.plus} sessions plus therapy materials, and Couples is ${money(PLAN_PRICES.couples)} for ${PLAN_SESSIONS.couples} joint sessions covering both partners. These are one-time purchases — there is no subscription and nothing auto-renews. Your session credits never expire. Pay by M-Pesa, card or bank transfer through Paystack; you never pay your therapist directly. See our Pricing page for the full comparison.`,
      },
      {
        // Replaced an answer written for the United States: "superbill",
        // "out-of-network reimbursement" and "HSA/FSA cards" are US insurance
        // constructs that do not exist for a Kenyan client, and offering them
        // is a promise we cannot keep.
        q: "Do you accept insurance?",
        a: "Not at the moment — sessions are paid for directly. If your insurer or employer reimburses outpatient mental health care, email support@echohealth.app and we can send you an itemised receipt for your payment to submit to them. We cannot guarantee any particular insurer will accept it.",
      },
      {
        // The old question asked how to cancel a subscription. There is no
        // subscription to cancel: these are one-time bundles, so the honest
        // answer is that the question does not apply — and what people actually
        // want to know is what happens to a session they have already booked.
        q: "Is this a subscription? What if I need to cancel a session?",
        a: "It is not a subscription. You buy a bundle of sessions once, nothing recurs and there is nothing to cancel. If you need to move or cancel a booked session, cancel it at least 24 hours ahead and the credit returns to your account for you to use whenever you're ready — credits do not expire.",
      },
    ],
  },
  {
    category: "Privacy & Security",
    questions: [
      {
        // Was "Echo Health is fully HIPAA-compliant". HIPAA is a United States
        // statute and does not apply to a service operating in Kenya — the
        // relevant instrument is the Data Protection Act 2019. We hold no
        // certification against either, so this now describes the protections
        // that are actually in place rather than naming a regime.
        q: "Is my data secure and private?",
        a: "Your video sessions are encrypted end to end between participants, and everything else — messages, notes, journal entries — travels over an encrypted connection and is stored behind per-record access controls, so only you and the therapist you are working with can read it. We never sell your personal or health data. Kenya's Data Protection Act 2019 gives you the right to access, correct or delete your data; email support@echohealth.app to exercise it.",
      },
      {
        q: "Can I remain anonymous to my therapist?",
        a: "While you need to provide emergency contact information for safety reasons, you can choose a nickname to use during your sessions and in your communications with your therapist.",
      },
    ],
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.flatMap((group) =>
    group.questions.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    }))
  ),
};

export default function FAQPage() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-cream min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <header className="sticky top-0 z-50 w-full border-b border-cream bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-brand hover:opacity-80 transition-opacity"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 tracking-tight">
              Frequently Asked <span className="text-brand">Questions</span>
            </h1>
            <p className="mt-4 text-lg text-slate-500">
              Everything you need to know about getting started with Echo Health.
            </p>
          </div>

          <div className="space-y-16">
            {faqs.map((group) => (
              <div key={group.category}>
                <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">
                  {group.category}
                </h2>
                <div className="space-y-6">
                  {group.questions.map((item) => (
                    <details
                      key={item.q}
                      className="group rounded-2xl bg-white p-6 shadow-sm border border-brand/5 hover:border-brand/20 transition-colors [&_summary::-webkit-details-marker]:hidden"
                    >
                      <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-slate-800 select-none">
                        {item.q}
                        <span className="shrink-0 rounded-full bg-cream p-1.5 text-brand group-open:-rotate-45 transition-transform duration-300">
                          <Plus size={16} />
                        </span>
                      </summary>
                      <p className="mt-4 leading-relaxed text-slate-500 text-sm">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Need more help */}
          <div className="mt-20 rounded-3xl bg-brand/5 border border-brand/10 p-8 text-center sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm mb-6">
              <MessageCircle className="h-8 w-8 text-brand" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">Still have questions?</h3>
            <p className="mt-2 text-slate-500 mb-8 max-w-md mx-auto">
              Our support team is here to help you navigate your journey. We typically respond within a few hours.
            </p>
            <a
              href="mailto:support@echohealth.app"
              className="inline-block rounded-full bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-brand/90 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
