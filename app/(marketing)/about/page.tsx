import { Target, Heart, Shield, Users } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import { CheckList } from "@/app/components/marketing/sections";
import { initialsOf } from "@/app/components/portal/Avatar";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About Echo Health",
  description:
    "Echo Health is on a mission to make therapy accessible, personal, and effective. Meet the team and the values behind our teletherapy platform.",
  path: "/about",
});

const values = [
  {
    icon: Heart,
    title: "Radical Empathy",
    description: "We build everything with deep compassion for the human experience. Therapy is vulnerable; our platform must feel safe.",
  },
  {
    icon: Users,
    title: "Accessible to All",
    description: "Mental healthcare shouldn't be a luxury. We strive to remove logistical, financial, and geographical barriers.",
  },
  {
    icon: Shield,
    title: "Clinical Excellence",
    description: "We don't compromise on quality. Every provider on our platform is thoroughly vetted, licensed, and experienced.",
  },
  {
    icon: Target,
    title: "Measurable Impact",
    description: "We believe in therapy that works. We use data to track outcomes and ensure our users are actually healing.",
  },
];

/**
 * The leadership list carries names and roles only.
 *
 * It used to carry a stock Unsplash portrait per person — including one
 * captioned "Reagan Enoch, Co-Founder & CTO", which put a stranger's face
 * under a real, named individual. A photograph is an assertion about who
 * someone is, so the safe version of a headshot you do not have is not a
 * different person's headshot; it is no photograph at all. Initials, following
 * the `portal/Avatar` pattern, say exactly as much as we can back.
 */
const team = [
  { name: "Dr. Barbara Were", role: "Chief Medical Officer" },
  { name: "Reagan Enoch", role: "Co-Founder & CTO" },
  { name: "Elena Rodriguez", role: "VP of Product" },
  { name: "David Kim", role: "Head of Engineering" },
];

/* Statements the product actually enforces, so the panel beside the story
   cannot quietly drift into marketing. Each one is checked somewhere in the
   codebase: licence review gates a therapist's first client, bundles are
   one-time purchases with non-expiring credits, and the clinicians are
   registered in Kenya with prices settled in KES. */
const commitments = [
  "Every therapist's licence and ID is reviewed by an administrator before they can see a single client.",
  "Sessions are bought once. Nothing recurs, nothing auto-renews, and session credits do not expire.",
  "Video sessions are encrypted between participants; notes, messages and journals sit behind per-record access controls.",
  "Our clinicians are registered in Kenya and sessions are priced in Kenyan shillings.",
];

export default function AboutPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/about", label: "About" }]} />

      {/* Hero */}
      <section className="bg-teal-800 text-white px-6 py-24 sm:py-32 overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
        <div className="mx-auto max-w-4xl text-center relative z-10">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-8">
            We&apos;re on a mission to make mental healthcare <span className="text-teal-300">universal</span>.
          </h1>
          <p className="text-lg sm:text-xl text-teal-100/90 leading-relaxed max-w-3xl mx-auto mb-10">
            Echo Health was founded on a simple premise: finding a great therapist shouldn&apos;t be harder than the things you&apos;re seeking therapy for.
          </p>
        </div>
      </section>

      {/* The Story */}
      <section className="px-6 py-24 bg-white">
        <div className="mx-auto max-w-4xl grid md:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4 block">Our Story</span>
            <h2 className="text-3xl font-bold text-slate-800 mb-6 leading-tight">
              Born out of frustration, built with care.
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              In 2021, our founders spent months navigating broken directories, unreturned phone calls, and out-of-network bills just to find a therapist who was taking new patients.
            </p>
            <p className="text-slate-600 leading-relaxed">
              They realized the system wasn&apos;t just broken; it was actively discouraging people from getting help. Echo Health was built to be the antidote—a seamless, modern platform that connects you with compassionate care in days, not months.
            </p>
          </div>
          {/* This was a stock photograph captioned "Team collaborating" — a
              picture of people who do not work here, standing in for the
              company. A panel of commitments we can actually point at in the
              product is both honest and more use to a reader. */}
          <div className="rounded-3xl bg-brand-gradient p-8 sm:p-10 text-white">
            <h3 className="font-display text-2xl tracking-tight mb-6">What that turned into</h3>
            <CheckList items={commitments} onDark />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="px-6 py-24 bg-cream">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800">Our Core Values</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((v) => (
              <div key={v.title} className="bg-white rounded-3xl p-8 border border-brand/5 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-6">
                  <v.icon className="w-6 h-6 text-brand" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">{v.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="px-6 py-24 bg-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">Meet the Leadership</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              We&apos;re a team of clinicians, engineers, and designers dedicated to building the future of mental healthcare.
            </p>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member) => (
              <li key={member.name} className="flex flex-col items-center text-center">
                <span
                  aria-hidden="true"
                  className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-2xl font-semibold text-brand-800 ring-1 ring-inset ring-brand-200"
                >
                  {initialsOf(member.name)}
                </span>
                <h3 className="text-lg font-bold text-slate-800">{member.name}</h3>
                <p className="text-brand text-sm">{member.role}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 bg-teal-800 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to join us on this journey?
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/careers" className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-teal-800 shadow-md hover:bg-teal-50 transition-colors">
              View Open Roles
            </a>
            <a href="/get-started" className="rounded-full border border-teal-300 bg-transparent px-8 py-3.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
              Find a Therapist
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
