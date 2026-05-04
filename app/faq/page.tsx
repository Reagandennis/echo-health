import { ArrowLeft, Plus, MessageCircle } from "lucide-react";
import Footer from "../components/Footer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frequently Asked Questions - Echo Health",
  description: "Answers to common questions about Echo Health therapy, pricing, insurance, and privacy.",
  openGraph: {
    title: "Frequently Asked Questions - Echo Health",
    description: "Answers to common questions about Echo Health therapy, pricing, insurance, and privacy.",
    url: "https://echohealth.app/faq",
    siteName: "Echo Health",
  },
  twitter: {
    title: "Frequently Asked Questions - Echo Health",
    description: "Answers to common questions about Echo Health therapy, pricing, insurance, and privacy.",
  },
};

const faqs = [
  {
    category: "Therapy & Matching",
    questions: [
      {
        q: "How does the matching process work?",
        a: "When you sign up, you'll complete a brief assessment about your goals, preferences, and what you're looking for in a therapist. Our algorithm uses this to recommend licensed professionals who specialize in your specific needs.",
      },
      {
        q: "Can I change my therapist if it's not a good fit?",
        a: "Absolutely. Finding the right connection is the most important part of therapy. You can request to switch therapists at any time through your dashboard, no questions asked.",
      },
      {
        q: "Are the therapists licensed?",
        a: "Yes. Every therapist on Echo Health is fully licensed, background-checked, and thoroughly vetted. They hold degrees such as Ph.D., PsyD, LMFT, LCSW, or LPC and possess at least 3 years and 1,000 hours of hands-on experience.",
      },
    ],
  },
  {
    category: "Pricing & Insurance",
    questions: [
      {
        q: "How much does Echo Health cost?",
        a: "Our subscriptions start at $69/week (billed monthly). This includes weekly 50-minute live video sessions and unlimited secure messaging with your therapist. Check our Pricing page for more detailed tier information.",
      },
      {
        q: "Do you accept insurance?",
        a: "At this time, we do not bill insurance directly. However, we can provide you with an itemized receipt (a 'superbill') that you can submit to your insurance provider for potential out-of-network reimbursement. You can also use your HSA/FSA cards to pay.",
      },
      {
        q: "Can I cancel my subscription anytime?",
        a: "Yes, there are no long-term contracts. You can cancel your subscription at any time from your account settings.",
      },
    ],
  },
  {
    category: "Privacy & Security",
    questions: [
      {
        q: "Is my data secure and private?",
        a: "Yes. Echo Health is fully HIPAA-compliant. All video sessions are peer-to-peer encrypted, and your messages are secured with 256-bit banking-grade encryption. We never sell your personal or health data.",
      },
      {
        q: "Can I remain anonymous to my therapist?",
        a: "While you need to provide emergency contact information for safety reasons, you can choose a nickname to use during your sessions and in your communications with your therapist.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-cream min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b border-cream bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center px-6 py-4">
          <a
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-brand hover:opacity-80 transition-opacity"
          >
            <ArrowLeft size={16} />
            Back to Home
          </a>
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
