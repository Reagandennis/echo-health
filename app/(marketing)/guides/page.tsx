import Link from "next/link";
import { ArrowRight, BookOpen, Compass, Heart, Brain, Moon, ShieldAlert } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import { CtaBand, RelatedLinks, Section } from "@/app/components/marketing/sections";
import { CONDITIONS } from "@/lib/navigation";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Mental health guides & self-help resources",
  description:
    "In-depth guides on anxiety, depression, sleep, trauma, and relationships — clinically reviewed practical strategies for everyday wellbeing.",
  path: "/guides",
});

/**
 * ## No card links to `#`, and the counts are gone
 *
 * Every card here was an `<a href="#">` advertising "5 Articles · 12 min read"
 * for a library with no pages behind it — six hover states, six dead anchors,
 * and metadata describing articles nobody can open. The counts and read times
 * went with the links: an invented article count is the detail that makes the
 * rest of the card look verified.
 *
 * A card now links only where there is a real page to land on — its
 * `/therapy-for/<slug>` twin, from `CONDITIONS` in `lib/navigation.ts`. "An
 * Introduction to CBT" has no twin (CBT is a modality, not a condition), so it
 * stays a plain `<article>` rather than being pointed at a near-miss.
 *
 * Headings were h1 → h3 → h2, which skips a level and puts the newsletter
 * above the cards in the document outline. The cards are h2s now.
 */
const guides = [
  {
    title: "Understanding and Managing Anxiety",
    description: "Practical coping mechanisms, breathing techniques, and how to identify your own anxiety triggers.",
    icon: Brain,
    color: "bg-amber-100 text-amber-700",
    href: "/therapy-for/anxiety",
  },
  {
    title: "Navigating Relationship Conflict",
    description: "Strategies for healthy communication, setting boundaries, and rebuilding trust with partners or family.",
    icon: Heart,
    color: "bg-rose-100 text-rose-700",
    href: "/therapy-for/relationships",
  },
  {
    title: "The Science of Sleep Hygiene",
    description: "How to reset your circadian rhythm and build an evening routine that supports restorative sleep.",
    icon: Moon,
    color: "bg-indigo-100 text-indigo-700",
    href: "/therapy-for/sleep",
  },
  {
    title: "Coping with Grief and Loss",
    description: "A gentle guide through grief, honouring your feelings, and finding a path forward at your own pace.",
    icon: Compass,
    color: "bg-slate-100 text-slate-700",
    href: "/therapy-for/grief",
  },
  {
    title: "Healing from Workplace Burnout",
    description: "Identify the signs of chronic stress and learn how to detach, recover, and advocate for yourself at work.",
    icon: ShieldAlert,
    color: "bg-orange-100 text-orange-700",
    href: "/therapy-for/stress",
  },
  {
    title: "An Introduction to CBT",
    description: "The basics of Cognitive Behavioural Therapy, and how reframing your thoughts can change how you feel.",
    icon: BookOpen,
    color: "bg-teal-100 text-teal-700",
    href: null,
  },
];

export default function GuidesPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/guides", label: "Guides" }]} />

      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand mb-6 border border-brand/20">
            <BookOpen size={14} />
            Resource Library
          </span>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-stone-900">
            Mental health guides
          </h1>
          <p className="mt-5 text-[17px] leading-8 text-stone-600">
            Plain-language explanations of what you might be dealing with, and
            what therapy for it actually involves.
          </p>
          <p className="mt-5 text-sm text-stone-500">
            The long-form guides are still being written. Where we already have
            a page on the topic, the card links to it.
          </p>
        </div>

        {/* Guide Grid */}
        <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => {
            const body = (
              <>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${guide.color}`}>
                  <guide.icon size={24} strokeWidth={2} />
                </div>
                <h2 className="text-xl font-bold text-stone-900 mb-3 group-hover:text-brand-700 transition-colors">
                  {guide.title}
                </h2>
                <p className="flex-1 text-stone-600 text-sm leading-relaxed">
                  {guide.description}
                </p>
              </>
            );
            const shell =
              "group flex flex-col rounded-3xl border border-stone-200/70 bg-white p-8 shadow-sm";

            return guide.href ? (
              <Link key={guide.title} href={guide.href} className={`${shell} transition-shadow hover:shadow-md`}>
                {body}
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                  Read the page
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ) : (
              <article key={guide.title} className={shell}>
                {body}
              </article>
            );
          })}
        </div>
      </Section>

      {/* The condition pages are the only long-form content that exists, and
          three of the eight have no card above. The rail is what stops those
          three being unreachable from the page that is supposed to be the
          resource library. */}
      <RelatedLinks
        title="Read about what you're dealing with"
        links={CONDITIONS.map((c) => ({
          href: `/therapy-for/${c.slug}`,
          label: c.label,
        }))}
      />

      {/*
        This replaced a newsletter sign-up: an email field and a "Subscribe"
        button that were not inside a form and had no handler, so every address
        typed into it was dropped on submit. There is no mailing-list endpoint
        in this app to wire it to, and a CTA that works beats one that looks
        like it does.
      */}
      <CtaBand
        title="Not sure where to start?"
        body="Answer a few questions and we'll match you with a licensed therapist. It takes about three minutes."
        label="Find your therapist"
      />
    </>
  );
}
