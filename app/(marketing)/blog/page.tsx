import Image from "next/image";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Mental health insights & stories",
  description:
    "Articles, expert advice, and personal stories on therapy, anxiety, relationships, and emotional well-being from the Echo Health team.",
  path: "/blog",
});

/**
 * ## Why nothing on this page is a link
 *
 * There is no `/blog/[slug]` route. Every card here used to be an `<a href="#">`
 * with a hover state and a "Load more articles" button that had no handler, so
 * the page rendered a working-looking blog where every single interaction was a
 * no-op. Cards are `<article>` elements now: a page that cannot navigate should
 * not look like it can.
 *
 * The publication dates and read-time estimates went with them. They described
 * articles that were never published — "Oct 12, 2023" on a piece that does not
 * exist is the same invented detail as an invented statistic, and it is the
 * detail that makes the rest of the card look verified.
 *
 * ## Why every `&fm=jpg`
 *
 * Unsplash ignores `q=` for PNG, so these URLs were returning ~979 KB PNGs.
 * Pinning the format to JPEG brings the featured image to ~126 KB. Next's
 * optimiser re-encodes to AVIF/WebP anyway — this is about what it has to
 * fetch upstream before it can.
 */

const featuredPost = {
  title: "The Silent Epidemic: High-Functioning Anxiety in the Modern Workplace",
  category: "Mental Health",
  excerpt: "You hit every deadline, maintain a perfect social life, and seem entirely in control. But underneath the surface, your mind is racing. Here's how to recognize and manage high-functioning anxiety.",
  image: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=1200&q=80&fit=crop&fm=jpg",
};

const recentPosts = [
  {
    title: "5 Signs You Might Need Couples Therapy (And Why That's Okay)",
    category: "Relationships",
    excerpt: "Therapy isn't just for couples on the brink of divorce. It's a tool for strengthening communication and deepening connection.",
    image: "https://images.unsplash.com/photo-1521754040860-ed38b308ac9d?w=800&q=80&fit=crop&fm=jpg",
  },
  {
    title: "Demystifying EMDR: How Eye Movements Help Process Trauma",
    category: "Therapy Methods",
    excerpt: "It sounds like science fiction, but EMDR is one of the most rigorously tested and effective treatments for PTSD and complex trauma.",
    image: "https://images.unsplash.com/photo-1551009175-8a68da93d5f9?w=800&q=80&fit=crop&fm=jpg",
  },
  {
    title: "Setting Boundaries with Family During the Holidays",
    category: "Wellness",
    excerpt: "The holiday season doesn't have to mean sacrificing your peace. A practical guide to saying 'no' with love and firmness.",
    image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&q=80&fit=crop&fm=jpg",
  },
  {
    title: "Why 'Just Think Positive' is Toxic Advice",
    category: "Mental Health",
    excerpt: "Toxic positivity dismisses genuine pain. Discover how practicing emotional validation is actually the key to moving forward.",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80&fit=crop&fm=jpg",
  },
];

export default function BlogPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/blog", label: "Blog" }]} />

      <div className="pb-24">
        {/* Header */}
        <section className="bg-cream px-6 py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-5xl sm:text-6xl font-bold text-slate-800 tracking-tight mb-6">
              The Echo Health <span className="text-brand">Blog</span>
            </h1>
            <p className="text-lg text-slate-500">
              Insights, stories, and expert advice on mental wellness, relationships, and the therapeutic journey.
            </p>
            <p className="mt-6 text-sm text-stone-500">
              Individual articles are not published yet. These are the pieces
              currently being written.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 -mt-10 relative z-10">
          {/* Featured Post */}
          <article className="block bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-100 mb-16">
            <div className="grid md:grid-cols-2 h-full">
              <div className="relative h-64 md:h-auto overflow-hidden">
                {/*
                  LCP candidate, so it is preloaded. `preload`, not `priority` —
                  Next 16 deprecated the latter. `sizes` is mandatory alongside
                  `fill`: without it Next emits `sizes="100vw"` silently and
                  every phone downloads the desktop-width source.
                */}
                <Image
                  src={featuredPost.image}
                  alt=""
                  fill
                  preload
                  sizes="(max-width:768px) 100vw, 576px"
                  className="object-cover"
                />
              </div>
              <div className="p-8 sm:p-12 flex flex-col justify-center">
                <span className="inline-block rounded-full bg-brand/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand mb-6 w-max">
                  Featured · {featuredPost.category}
                </span>
                <h2 className="text-3xl font-bold text-slate-800 mb-4 leading-tight">
                  {featuredPost.title}
                </h2>
                <p className="text-slate-500 leading-relaxed">
                  {featuredPost.excerpt}
                </p>
              </div>
            </div>
          </article>

          {/* Grid */}
          <h2 className="text-2xl font-bold text-slate-800 mb-8 border-b border-slate-100 pb-4">In the works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {recentPosts.map((post) => (
              <article key={post.title} className="flex flex-col h-full">
                <div className="relative h-48 w-full rounded-2xl overflow-hidden mb-5 bg-cream">
                  {/* Decorative: the heading beside it already names the piece,
                      and nobody here has seen the photograph well enough to
                      describe it. An empty alt is the honest one. */}
                  <Image
                    src={post.image}
                    alt=""
                    fill
                    sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,25vw"
                    className="object-cover"
                  />
                  <div className="absolute top-3 left-3 rounded-full bg-white/90 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-800">
                    {post.category}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2 leading-snug">
                  {post.title}
                </h3>
                <p className="text-sm text-slate-500 line-clamp-2 flex-1">
                  {post.excerpt}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
