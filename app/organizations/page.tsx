import {
  Building2,
  TrendingUp,
  ShieldCheck,
  Users,
  LineChart,
  HeartHandshake,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import Footer from "../components/Footer";

/* ─── Data ─────────────────────────────────────────── */

const features = [
  {
    icon: Users,
    title: "Dedicated Account Management",
    description:
      "Your team gets a dedicated success manager to assist with onboarding, utilisation campaigns, and ongoing support.",
  },
  {
    icon: LineChart,
    title: "Anonymous Utilisation Analytics",
    description:
      "Track engagement, stress levels, and ROI through our secure admin dashboard without compromising employee privacy.",
  },
  {
    icon: HeartHandshake,
    title: "Priority Employee Matching",
    description:
      "Employees bypass the waitlist and are matched with licensed therapists within 24 hours of signing up.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise-Grade Security",
    description:
      "Fully HIPAA and GDPR compliant. We protect your company's data and your employees' confidentiality with 256-bit encryption.",
  },
];

const steps = [
  {
    step: "01",
    title: "Onboard your company",
    description: "We configure your custom portal and integrate with your existing HR/benefits systems seamlessly.",
  },
  {
    step: "02",
    title: "Invite your team",
    description: "Send automated, secure invitations to your employees. They can sign up anonymously and privately.",
  },
  {
    step: "03",
    title: "Monitor impact",
    description: "Use your admin dashboard to track anonymized engagement metrics and see the positive impact on team wellbeing.",
  },
];

const roiStats = [
  { value: "4x", label: "ROI on mental health investments" },
  { value: "32%", label: "Reduction in employee turnover" },
  { value: "85%", label: "Of employees feel more engaged" },
];

/* ─── Page ─────────────────────────────────────────── */

export default function OrganizationsPage() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-white">
      {/* ── Nav ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-cream bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-semibold tracking-tight hover:opacity-80 transition-opacity">
            <span className="text-brand">Echo Psychology </span>
            <span className="text-slate-700">Group</span>
          </Link>
          <nav className="hidden gap-8 text-sm font-medium sm:flex text-slate-500">
            <a href="#benefits" className="hover:text-brand transition-colors">Benefits</a>
            <a href="#how-it-works" className="hover:text-brand transition-colors">How it works</a>
            <a href="#roi" className="hover:text-brand transition-colors">ROI</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="/signin" className="hidden sm:inline text-sm font-medium text-brand hover:opacity-80 transition-opacity">
              Admin login
            </a>
            <a
              href="mailto:sales@echohealth.app?subject=Enterprise Inquiry"
              className="rounded-full bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors shadow-sm"
            >
              Talk to Sales
            </a>
          </div>
        </div>
      </header>

      <main className="flex flex-col flex-1">
        {/* ── Hero ─────────────────────────────────── */}
        <section className="relative flex flex-col items-center justify-center px-6 py-28 text-center bg-cream overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />
          <div className="relative mx-auto max-w-3xl z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand mb-8 border border-brand/20">
              <Building2 size={14} />
              Echo Health for Business
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight text-slate-800">
              Invest in your team&apos;s <span className="text-brand">mental wealth.</span>
            </h1>
            <p className="mt-6 text-lg leading-8 max-w-2xl mx-auto text-slate-600">
              Provide your employees with confidential, on-demand access to licensed therapists. 
              Reduce burnout, improve retention, and foster a culture of genuine care.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="mailto:sales@echohealth.app?subject=Enterprise Inquiry"
                className="w-full sm:w-auto rounded-full bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-md hover:opacity-90 transition-opacity"
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

        {/* ── Logos ────────────────────────────────── */}
        <section className="border-y border-cream bg-white py-10">
          <div className="mx-auto max-w-5xl px-6">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6">
              Trusted by forward-thinking HR teams
            </p>
            <div className="flex flex-wrap justify-center gap-8 sm:gap-16 opacity-50 grayscale">
              {/* Placeholders for logos */}
              <div className="text-xl font-bold text-slate-800">Acme Corp</div>
              <div className="text-xl font-bold text-slate-800">Globex</div>
              <div className="text-xl font-bold text-slate-800">Soylent</div>
              <div className="text-xl font-bold text-slate-800">Initech</div>
              <div className="text-xl font-bold text-slate-800">Umbrella</div>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────── */}
        <section id="benefits" className="px-6 py-24 bg-white">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800">
                Enterprise-grade support, human-first care
              </h2>
              <p className="mt-4 text-slate-500 max-w-2xl mx-auto leading-7">
                We handle the logistics so you can focus on your people. Our platform is designed to integrate effortlessly into your existing benefits package.
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

        {/* ── ROI / Stats ──────────────────────────── */}
        <section id="roi" className="px-6 py-24 bg-teal-800 text-white">
          <div className="mx-auto max-w-5xl grid gap-16 lg:grid-cols-2 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-100 mb-6">
                <TrendingUp size={14} /> Real Business Impact
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold leading-tight mb-6">
                Mental health isn&apos;t just a perk. It&apos;s a strategic advantage.
              </h2>
              <p className="text-teal-100/80 leading-relaxed mb-8">
                Untreated mental health conditions cost companies billions annually in lost productivity and absenteeism. 
                Partnering with Echo Health yields measurable returns while genuinely improving your team&apos;s quality of life.
              </p>
              <ul className="space-y-4">
                {[
                  "Reduce absenteeism and burnout",
                  "Attract top-tier talent with competitive benefits",
                  "Gain actionable insights into organisational stress",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-teal-300 shrink-0" />
                    <span className="text-teal-50">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {roiStats.map((stat, i) => (
                <div key={i} className={`rounded-2xl bg-teal-900/50 border border-teal-700 p-8 ${i === 2 ? 'sm:col-span-2' : ''}`}>
                  <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                  <div className="text-sm text-teal-200">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────── */}
        <section id="how-it-works" className="px-6 py-24 bg-white">
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
              Our enterprise team is ready to design a mental health program tailored to your organization&apos;s specific needs and budget.
            </p>
            <a
              href="mailto:sales@echohealth.app?subject=Enterprise Inquiry"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-10 py-4 text-sm font-semibold text-white shadow-lg hover:bg-brand/90 transition-colors"
            >
              Talk to our Sales Team <ArrowRight size={16} />
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
