import { ArrowLeft, Clock, Calendar } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Footer from "../components/Footer";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Mental health insights & stories",
  description:
    "Articles, expert advice, and personal stories on therapy, anxiety, relationships, and emotional well-being from the Echo Health team.",
  path: "/blog",
});

const featuredPost = {
  title: "The Silent Epidemic: High-Functioning Anxiety in the Modern Workplace",
  category: "Mental Health",
  excerpt: "You hit every deadline, maintain a perfect social life, and seem entirely in control. But underneath the surface, your mind is racing. Here's how to recognize and manage high-functioning anxiety.",
  date: "Oct 12, 2023",
  readTime: "8 min read",
  author: "Dr. Amara Osei",
  image: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=1200&q=80&fit=crop",
};

const recentPosts = [
  {
    title: "5 Signs You Might Need Couples Therapy (And Why That's Okay)",
    category: "Relationships",
    excerpt: "Therapy isn't just for couples on the brink of divorce. It's a tool for strengthening communication and deepening connection.",
    date: "Oct 05, 2023",
    readTime: "6 min read",
    author: "Marcus Rivera, LCSW",
    image: "https://images.unsplash.com/photo-1521754040860-ed38b308ac9d?w=800&q=80&fit=crop",
  },
  {
    title: "Demystifying EMDR: How Eye Movements Help Process Trauma",
    category: "Therapy Methods",
    excerpt: "It sounds like science fiction, but EMDR is one of the most rigorously tested and effective treatments for PTSD and complex trauma.",
    date: "Sep 28, 2023",
    readTime: "10 min read",
    author: "Dr. Sarah Chen",
    image: "https://images.unsplash.com/photo-1551009175-8a68da93d5f9?w=800&q=80&fit=crop",
  },
  {
    title: "Setting Boundaries with Family During the Holidays",
    category: "Wellness",
    excerpt: "The holiday season doesn't have to mean sacrificing your peace. A practical guide to saying 'no' with love and firmness.",
    date: "Sep 15, 2023",
    readTime: "5 min read",
    author: "Elena Rodriguez, LMFT",
    image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&q=80&fit=crop",
  },
  {
    title: "Why 'Just Think Positive' is Toxic Advice",
    category: "Mental Health",
    excerpt: "Toxic positivity dismisses genuine pain. Discover how practicing emotional validation is actually the key to moving forward.",
    date: "Sep 02, 2023",
    readTime: "7 min read",
    author: "Dr. Amara Osei",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80&fit=crop",
  },
];

export default function BlogPage() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-white min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b border-cream bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-brand hover:opacity-80 transition-opacity"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-24">
        {/* Header */}
        <section className="bg-cream px-6 py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-5xl sm:text-6xl font-bold text-slate-800 tracking-tight mb-6">
              The Echo Health <span className="text-brand">Blog</span>
            </h1>
            <p className="text-lg text-slate-500">
              Insights, stories, and expert advice on mental wellness, relationships, and the therapeutic journey.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 -mt-10 relative z-10">
          {/* Featured Post */}
          <a href="#" className="group block bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-100 hover:shadow-xl transition-shadow mb-16">
            <div className="grid md:grid-cols-2 h-full">
              <div className="relative h-64 md:h-auto overflow-hidden">
                <Image 
                  src={featuredPost.image} 
                  alt={featuredPost.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="p-8 sm:p-12 flex flex-col justify-center">
                <span className="inline-block rounded-full bg-brand/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand mb-6 w-max">
                  Featured · {featuredPost.category}
                </span>
                <h2 className="text-3xl font-bold text-slate-800 mb-4 group-hover:text-brand transition-colors leading-tight">
                  {featuredPost.title}
                </h2>
                <p className="text-slate-500 leading-relaxed mb-8">
                  {featuredPost.excerpt}
                </p>
                <div className="flex items-center gap-6 text-sm text-slate-400 font-medium mt-auto">
                  <div className="flex items-center gap-2"><Calendar size={14}/> {featuredPost.date}</div>
                  <div className="flex items-center gap-2"><Clock size={14}/> {featuredPost.readTime}</div>
                </div>
              </div>
            </div>
          </a>

          {/* Grid */}
          <h3 className="text-2xl font-bold text-slate-800 mb-8 border-b border-slate-100 pb-4">Latest Articles</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {recentPosts.map((post) => (
              <a key={post.title} href="#" className="group flex flex-col h-full">
                <div className="relative h-48 w-full rounded-2xl overflow-hidden mb-5 bg-cream">
                  <Image 
                    src={post.image} 
                    alt={post.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 rounded-full bg-white/90 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-800">
                    {post.category}
                  </div>
                </div>
                <h4 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-brand transition-colors leading-snug">
                  {post.title}
                </h4>
                <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium pt-4 border-t border-slate-100 mt-auto">
                  <span>{post.date}</span>
                  <span>{post.readTime}</span>
                </div>
              </a>
            ))}
          </div>

          <div className="mt-16 text-center">
            <button className="rounded-full border-2 border-brand px-8 py-3 text-sm font-semibold text-brand hover:bg-cream/40 transition-colors">
              Load more articles
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
