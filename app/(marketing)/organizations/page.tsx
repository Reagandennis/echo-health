import {
  Building2,
  ShieldCheck,
  Users,
  LineChart,
  HeartHandshake,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import { pageMetadata } from "@/lib/seo";

/**
 * The B2B page. It was the only marketing page with no `metadata` export at
 * all, so it inherited the root title and shipped with no canonical — on the
 * one page an HR buyer is most likely to reach from a search.
 */
export const metadata = pageMetadata({
  title: "Echo Health for employers",
  description:
    "Give your team confidential access to licensed therapists in Kenya. Priced in shillings, booked by employees directly, with no visibility for you into who attends.",
  path: "/organizations",
});

/* ─── Data ─────────────────────────────────────────── */

const features = [
  {
    icon: Users,
    title: "Dedicated Account Management",
    description:
      "Your team gets a dedicated success manager to assist with onboarding, utilisation campaigns, and ongoing support.",
  },
  {
    /*
     * Was "Track engagement, stress levels, and ROI ... without compromising
     * employee privacy" — two of those three cannot be delivered and the third
     * contradicts the sentence it sits in. Echo does not compute a stress score
     * per employee or per team, and if it did, handing it to an employer is
     * exactly the disclosure this platform's privacy rules exist to prevent.
     * What an employer can actually have is seat usage.
     */
    icon: LineChart,
    title: "Seat usage, nothing more",
    description:
      "You see how many seats are in use and how many sessions have been drawn down. Never who booked, never when, never what was discussed.",
  },
  {
    icon: HeartHandshake,
    title: "Priority Employee Matching",
    description:
      "Employees are matched with a licensed therapist directly, without going through your HR team or asking anyone's permission.",
  },
  {
    /*
     * Was "Fully HIPAA and GDPR compliant ... 256-bit encryption". HIPAA is a
     * United States statute with no application to a service delivered from
     * Kenya, and the same claim was removed from /faq for that reason. We hold
     * no certification against any of these regimes, so this states the
     * protections that are actually implemented and names the law that applies.
     */
    icon: ShieldCheck,
    title: "Built for confidentiality",
    description:
      "Sessions are encrypted between participants; notes, messages and journals sit behind per-record access controls. Handled in line with Kenya's Data Protection Act 2019.",
  },
];

const steps = [
  {
    step: "01",
    title: "Onboard your company",
    description: "We set up your account, agree the number of seats, and give you an invite link to share.",
  },
  {
    step: "02",
    title: "Invite your team",
    description: "Employees redeem the link themselves. They sign up in their own name, not through your HR system.",
  },
  {
    step: "03",
    title: "Track the seats, not the people",
    description: "Your only view is how much of the cover has been used, so nobody has to weigh being seen against being helped.",
  },
];

/**
 * What replaced the stat band.
 *
 * Three tiles read "4x ROI on mental health investments", "32% Reduction in
 * employee turnover" and "85% Of employees feel more engaged", sitting directly
 * above a "Talk to Sales" CTA. There is no study behind any of them — not an
 * internal one, not a cited external one — which makes them a misleading
 * representation under the Consumer Protection Act 2012 (Kenya) s.12-13, in
 * the position where a buyer is most likely to rely on them. The same sweep
 * removed "10,000+ people helped" and "94% report improvement" from the home
 * page; these three were missed.
 *
 * Every line below is a property of the product, verifiable by reading the
 * code or the terms rather than by trusting a number.
 */
const commitments = [
  {
    title: "Nothing expires",
    body: "Sessions are bought as bundles and the credits do not expire. Unused cover is not lost at the end of a month or a quarter.",
  },
  {
    title: "You are not in the room",
    body: "Employees book, attend and message their therapist without you. There is no manager view, no attendance report and no transcript.",
  },
  {
    title: "Every licence is checked",
    body: "A therapist submits their licence and ID, an administrator verifies both, and only then can they be matched with anyone on your team.",
  },
  {
    title: "Priced in shillings",
    body: "Invoiced in KES, paid by M-Pesa, card or bank transfer. No currency conversion and no surprise on the renewal.",
  },
];

/* ─── Page ─────────────────────────────────────────── */

export default function OrganizationsPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/organizations", label: "For employers" }]} />

      {/* ── Hero ─────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-6 py-28 text-center bg-cream overflow-hidden">
        <div className="relative mx-auto max-w-3xl z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand mb-8 border border-brand/20">
            <Building2 size={14} />
            Echo Health for Business
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight text-slate-800">
            Invest in your team&apos;s <span className="text-brand">mental wealth.</span>
          </h1>
          <p className="mt-6 text-lg leading-8 max-w-2xl mx-auto text-slate-600">
            Give your employees confidential access to licensed therapists —
            booked directly by them, priced in shillings, and invisible to you.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:sales@echohealth.app?subject=Enterprise Inquiry"
              className="w-full sm:w-auto rounded-full bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-brand-700 transition-colors"
            >
              Get a custom proposal
            </a>
            <a
              href="#benefits"
              className="w-full sm:w-auto rounded-full border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Explore benefits
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────── */}
      <section id="benefits" className="scroll-mt-20 px-6 py-24 bg-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800">
              Enterprise-grade support, human-first care
            </h2>
            <p className="mt-4 text-slate-500 max-w-2xl mx-auto leading-7">
              We handle the logistics so you can focus on your people. Echo sits
              alongside your existing benefits rather than inside them.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-cream/70 bg-cream/20 p-8 hover:bg-cream/40 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-brand" strokeWidth={1.8} />
                </div>
                <h3 className="font-semibold text-slate-800 text-lg mb-3">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What you can hold us to ──────────────── */}
      <section id="commitments" className="scroll-mt-20 px-6 py-24 bg-teal-800 text-white">
        <div className="mx-auto max-w-5xl grid gap-16 lg:grid-cols-2 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-100 mb-6">
              What you can hold us to
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight mb-6">
              Mental health isn&apos;t a perk you can measure in a dashboard.
            </h2>
            <p className="text-teal-100/90 leading-relaxed mb-8">
              We are not going to quote you a return on investment. Nobody has
              run that study on this platform, and a benefit whose value has to
              be proven in percentages usually ends up designed around the
              reporting rather than around the person using it. What we will do
              is tell you exactly what your employees get, and exactly what you
              do not get to see.
            </p>
            <ul className="space-y-4">
              {[
                "Confidential by default — no attendance reports, ever",
                "Licence-verified therapists, registered in Kenya",
                "No subscription: buy sessions once, credits never expire",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-teal-300 shrink-0 mt-0.5" />
                  <span className="text-teal-50">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2">
            {commitments.map((c) => (
              <li key={c.title} className="rounded-2xl bg-teal-900/50 border border-teal-700 p-6">
                <h3 className="text-base font-bold text-white mb-2">{c.title}</h3>
                <p className="text-sm leading-6 text-teal-100/90">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── How it works ─────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-20 px-6 py-24 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800">
              Roll out in days, not months
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.step} className="relative pt-8">
                <div className="absolute top-0 left-0 text-6xl font-black text-cream/80 -z-10 select-none">
                  {step.step}
                </div>
                <h3 className="text-xl font-bold text-brand mb-3">{step.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────── */}
      <section className="px-6 py-24 bg-cream">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-6">
            Ready to support your team?
          </h2>
          <p className="text-slate-600 mb-10 max-w-xl mx-auto">
            Tell us roughly how many people you are covering and we will come
            back with a seat price and a rollout plan.
          </p>
          <a
            href="mailto:sales@echohealth.app?subject=Enterprise Inquiry"
            className="inline-flex items-center gap-2 rounded-full bg-brand px-10 py-4 text-sm font-semibold text-white shadow-lg hover:bg-brand-700 transition-colors"
          >
            Talk to our Sales Team <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </>
  );
}
