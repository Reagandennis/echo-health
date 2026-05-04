import { ArrowLeft, MapPin, Laptop, HeartPulse, Coffee, GraduationCap } from "lucide-react";
import Footer from "../components/Footer";

const perks = [
  { icon: Laptop, title: "Remote-First", desc: "Work from anywhere in the US or UK. We provide a $1,000 WFH stipend." },
  { icon: HeartPulse, title: "Healthcare", desc: "100% covered premium medical, dental, and vision insurance." },
  { icon: Coffee, title: "Unlimited PTO", desc: "Take the time you need. We require a minimum of 3 weeks off per year." },
  { icon: GraduationCap, title: "Learning", desc: "$2,000 annual stipend for courses, conferences, and books." },
];

const jobs = [
  {
    title: "Senior Full Stack Engineer",
    department: "Engineering",
    location: "Remote (US/UK)",
    type: "Full-time",
  },
  {
    title: "Clinical Director",
    department: "Clinical Operations",
    location: "Remote (US)",
    type: "Full-time",
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remote (US/UK)",
    type: "Full-time",
  },
  {
    title: "Licensed Therapist (LCSW, LMFT, LPC)",
    department: "Providers",
    location: "Remote (Multiple States)",
    type: "Contract",
  },
];

export default function CareersPage() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-white min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b border-cream bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <a
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-brand hover:opacity-80 transition-opacity"
          >
            <ArrowLeft size={16} />
            Back to Home
          </a>
        </div>
      </header>

      <main className="flex-1 pb-24">
        {/* Hero */}
        <section className="bg-cream px-6 py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-5xl sm:text-6xl font-bold text-slate-800 tracking-tight mb-6">
              Join us in reimagining <span className="text-brand">mental health.</span>
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10">
              We're looking for passionate engineers, designers, and clinicians to help us break down barriers to therapy and bring accessible care to millions.
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
              <h2 className="text-3xl font-bold text-slate-800">Benefits & Perks</h2>
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

        {/* Open Roles */}
        <section id="open-roles" className="px-6 py-24 bg-white">
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
                  <div className="mt-4 sm:mt-0 text-brand font-semibold text-sm flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-4 group-hover:translate-x-0">
                    Apply Now &rarr;
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
