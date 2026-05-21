import { ArrowLeft, BookOpen, Compass, Heart, Brain, Moon, ShieldAlert } from "lucide-react";
import Link from "next/link";
import Footer from "../components/Footer";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Mental health guides & self-help resources",
  description:
    "In-depth guides on anxiety, depression, sleep, trauma, and relationships — clinically reviewed practical strategies for everyday wellbeing.",
  path: "/guides",
});

const guides = [
  {
    title: "Understanding and Managing Anxiety",
    description: "Learn practical coping mechanisms, breathing techniques, and how to identify your unique anxiety triggers.",
    icon: Brain,
    color: "bg-amber-100 text-amber-700",
    readTime: "12 min read",
    articles: 5,
  },
  {
    title: "Navigating Relationship Conflict",
    description: "Expert strategies for healthy communication, setting boundaries, and rebuilding trust with partners or family.",
    icon: Heart,
    color: "bg-rose-100 text-rose-700",
    readTime: "15 min read",
    articles: 8,
  },
  {
    title: "The Science of Sleep Hygiene",
    description: "Discover how to reset your circadian rhythm and build an evening routine that guarantees restorative sleep.",
    icon: Moon,
    color: "bg-indigo-100 text-indigo-700",
    readTime: "8 min read",
    articles: 3,
  },
  {
    title: "Coping with Grief and Loss",
    description: "A gentle guide through the stages of grief, honoring your feelings, and finding a path forward at your own pace.",
    icon: Compass,
    color: "bg-slate-100 text-slate-700",
    readTime: "20 min read",
    articles: 6,
  },
  {
    title: "Healing from Workplace Burnout",
    description: "Identify the signs of chronic stress and learn how to detach, recover, and advocate for yourself at work.",
    icon: ShieldAlert,
    color: "bg-orange-100 text-orange-700",
    readTime: "10 min read",
    articles: 4,
  },
  {
    title: "An Introduction to CBT",
    description: "Explore the basics of Cognitive Behavioral Therapy and how reframing your thoughts can change your emotions.",
    icon: BookOpen,
    color: "bg-teal-100 text-teal-700",
    readTime: "14 min read",
    articles: 7,
  },
];

export default function GuidesPage() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-cream min-h-screen">
      {/* ── Nav ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-cream bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-brand hover:opacity-80 transition-opacity"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand mb-6 border border-brand/20">
              <BookOpen size={14} />
              Resource Library
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 tracking-tight mb-6">
              Mental Health <span className="text-brand">Guides</span>
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Curated collections of evidence-based articles, exercises, and expert advice to help you navigate life's challenges.
            </p>
          </div>

          {/* Guide Grid */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide) => (
              <a 
                href="#" 
                key={guide.title}
                className="group flex flex-col bg-white rounded-3xl border border-brand/10 overflow-hidden hover:shadow-lg hover:border-brand/30 transition-all duration-300"
              >
                <div className="p-8 flex flex-col h-full">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${guide.color}`}>
                    <guide.icon size={24} strokeWidth={2} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-brand transition-colors">
                    {guide.title}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-8">
                    {guide.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest border-t border-slate-100 pt-6 mt-auto">
                    <span className="text-slate-400">{guide.articles} Articles</span>
                    <span className="text-brand">{guide.readTime}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Newsletter / CTA */}
          <div className="mt-24 rounded-3xl bg-teal-800 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="max-w-xl">
              <h2 className="text-3xl font-bold text-white mb-4">Want insights delivered weekly?</h2>
              <p className="text-teal-100/80 mb-0">
                Join our newsletter for the latest guides, mental health tips, and exclusive resources from our clinical team.
              </p>
            </div>
            <div className="w-full md:w-auto shrink-0 flex gap-2">
              <input 
                type="email" 
                placeholder="Your email address" 
                className="rounded-full px-6 py-3.5 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <button className="rounded-full bg-white px-6 py-3.5 text-sm font-bold text-teal-800 hover:bg-teal-50 transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
