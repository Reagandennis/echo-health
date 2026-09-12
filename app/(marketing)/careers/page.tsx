import { MapPin, Laptop, HeartPulse, Coffee, GraduationCap } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Careers at Echo Health",
  description:
    "Help us make therapy reachable worldwide, from a team based in Kenya. Open roles across engineering, clinical operations and design — remote-first.",
  path: "/careers",
});

/**
 * ## Perks and locations are Kenyan, and carry no invented numbers
 *
 * This page offered "a $1,000 WFH stipend", "a $2,000 annual learning
 * stipend", "100% covered premium medical, dental, and vision insurance" and
 * roles sited "Remote (US/UK)" and "Remote (Multiple States)" — a US benefits
 * package, priced in dollars, at a company whose clinicians are registered in
 * Kenya and whose sessions settle in KES. A candidate reading a dollar figure
 * takes it as the offer, so the figures are gone rather than converted: no
 * number here is one anybody has approved.
 *
 * The therapist role likewise asked for LCSW / LMFT / LPC — three US licence
 * types that no Kenyan clinician holds.
 */
const perks = [
  {
    icon: Laptop,
    title: "Remote-first",
    desc: "Work from anywhere in Kenya. We cover the equipment and connectivity you need to do the job well.",
  },
  {
    icon: HeartPulse,
    title: "Health cover",
    desc: "Medical cover for you and your dependants, including outpatient mental health.",
  },
  {
    icon: Coffee,
    title: "Time off",
    desc: "Leave has a floor, not a ceiling — we ask everyone to take at least three weeks a year.",
  },
  {
    icon: GraduationCap,
    title: "Learning",
    desc: "An annual budget for courses, conferences, supervision and books.",
  },
];

const jobs = [
  {
    title: "Senior Full Stack Engineer",
    department: "Engineering",
    location: "Remote (Kenya)",
    type: "Full-time",
  },
  {
    title: "Clinical Director",
    department: "Clinical Operations",
    location: "Nairobi or remote (Kenya)",
    type: "Full-time",
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remote (Kenya)",
    type: "Full-time",
  },
  {
    title: "Licensed Therapist (Counselling or Clinical Psychologist)",
    department: "Providers",
    location: "Remote (Kenya), licence required",
    type: "Contract",
  },
];

export default function CareersPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/careers", label: "Careers" }]} />

      <div className="pb-24">
        {/* Hero */}
        <section className="bg-cream px-6 py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-5xl sm:text-6xl font-bold text-slate-800 tracking-tight mb-6">
              Join us in reimagining <span className="text-brand">mental health.</span>
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10">
              We&apos;re looking for engineers, designers and clinicians to help us
              take down the barriers between people in Kenya and the care they
              need.
            </p>
            <a href="#open-roles" className="rounded-full bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-brand/90 transition-colors">
              View Open Roles
            </a>
          </div>
        </section>

        {/* Perks */}
        <section className="px-6 py-24 bg-white border-b border-cream">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-800">Benefits &amp; Perks</h2>
              <p className="text-slate-500 mt-4">We take care of our team, so you can take care of our users.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {perks.map((p) => (
                <div key={p.title} className="bg-cream/30 rounded-3xl p-8">
                  <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mb-6">
                    <p.icon className="w-6 h-6 text-brand" />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2">{p.title}</h3>
                  <p className="text-sm text-slate-500">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Open Roles — `scroll-mt` clears the layout's sticky header, which the
            hero's "#open-roles" jump would otherwise land underneath. */}
        <section id="open-roles" className="scroll-mt-20 px-6 py-24 bg-white">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold text-slate-800 mb-10">Open Roles</h2>
            <div className="flex flex-col gap-4">
              {jobs.map((job) => (
                <a
                  key={job.title}
                  href={`mailto:careers@echohealth.app?subject=Application: ${job.title}`}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-6 sm:p-8 rounded-3xl border border-slate-200 hover:border-brand hover:shadow-md transition-all bg-white"
                >
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 group-hover:text-brand transition-colors mb-2">
                      {job.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      <span className="font-medium text-slate-700">{job.department}</span>
                      <span className="flex items-center gap-1"><MapPin size={14}/> {job.location}</span>
                      <span className="bg-cream px-2 py-0.5 rounded-md text-xs font-semibold text-brand">{job.type}</span>
                    </div>
                  </div>
                  <div className="mt-4 sm:mt-0 text-brand font-semibold text-sm flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    Apply Now &rarr;
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
