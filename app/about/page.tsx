import { ArrowLeft, Target, Heart, Shield, Users } from "lucide-react";
import Image from "next/image";
import Footer from "../components/Footer";

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

const team = [
  {
    name: "Dr. Barbara Were",
    role: "Chief Medical Officer",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80&fit=crop",
  },
  {
    name: "Reagan Enoch",
    role: "Co-Founder & CTO",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&q=80&fit=crop",
  },
  {
    name: "Elena Rodriguez",
    role: "VP of Product",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80&fit=crop",
  },
  {
    name: "David Kim",
    role: "Head of Engineering",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&q=80&fit=crop",
  },
];

export default function AboutPage() {
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

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-teal-800 text-white px-6 py-24 sm:py-32 overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
          <div className="mx-auto max-w-4xl text-center relative z-10">
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-8">
              We're on a mission to make mental healthcare <span className="text-teal-300">universal</span>.
            </h1>
            <p className="text-lg sm:text-xl text-teal-100/90 leading-relaxed max-w-3xl mx-auto mb-10">
              Echo Health was founded on a simple premise: finding a great therapist shouldn't be harder than the things you're seeking therapy for.
            </p>
          </div>
        </section>

        {/* The Story */}
        <section className="px-6 py-24 bg-white">
          <div className="mx-auto max-w-4xl grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand/60 mb-4 block">Our Story</span>
              <h2 className="text-3xl font-bold text-slate-800 mb-6 leading-tight">
                Born out of frustration, built with care.
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                In 2021, our founders spent months navigating broken directories, unreturned phone calls, and out-of-network bills just to find a therapist who was taking new patients.
              </p>
              <p className="text-slate-600 leading-relaxed">
                They realized the system wasn't just broken; it was actively discouraging people from getting help. Echo Health was built to be the antidote—a seamless, modern platform that connects you with compassionate care in days, not months.
              </p>
            </div>
            <div className="relative h-[400px] rounded-3xl overflow-hidden bg-cream">
              <Image 
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80&fit=crop" 
                alt="Team collaborating"
                fill
                className="object-cover"
              />
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
                We're a team of clinicians, engineers, and designers dedicated to building the future of mental healthcare.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member) => (
                <div key={member.name} className="group">
                  <div className="relative h-72 rounded-3xl overflow-hidden mb-5 bg-cream">
                    <Image 
                      src={member.image} 
                      alt={member.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{member.name}</h3>
                  <p className="text-brand text-sm">{member.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-20 bg-teal-800 text-center">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Ready to join us on this journey?
            </h2>
            <div className="flex justify-center gap-4">
              <a href="/careers" className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-teal-800 shadow-md hover:bg-teal-50 transition-colors">
                View Open Roles
              </a>
              <a href="/signup" className="rounded-full border border-teal-300 bg-transparent px-8 py-3.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
                Find a Therapist
              </a>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
