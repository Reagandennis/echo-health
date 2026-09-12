import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The marketing page kit.
 *
 * Every public page is assembled from these, so a change to the section rhythm
 * happens once. All of it is server-rendered — there is no `"use client"` in
 * this file and there should not be one: nothing here is interactive, and the
 * FAQ accordion below uses native `<details>` precisely so an expandable list
 * does not cost a hydration boundary on a page whose whole job is to load fast
 * and be readable by a crawler.
 */

/* ── Headings ────────────────────────────────────────────────────────────── */

export function Eyebrow({ children }: { readonly children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{children}</p>;
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "center",
  as: Tag = "h2",
}: {
  readonly eyebrow?: string;
  readonly title: React.ReactNode;
  readonly body?: React.ReactNode;
  readonly align?: "center" | "left";
  readonly as?: "h2" | "h3";
}) {
  const centred = align === "center";
  return (
    <div className={centred ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Tag
        className={`font-display tracking-tight text-stone-900 ${eyebrow ? "mt-3" : ""} ${
          Tag === "h2"
            ? "text-3xl sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]"
            : "text-2xl sm:text-3xl"
        }`}
      >
        {title}
      </Tag>
      {body && (
        <p className={`mt-5 text-[17px] leading-8 text-stone-600 ${centred ? "mx-auto max-w-xl" : ""}`}>
          {body}
        </p>
      )}
    </div>
  );
}

/* ── Layout ──────────────────────────────────────────────────────────────── */

export function Section({
  children,
  tone = "white",
  id,
  className = "",
}: {
  readonly children: React.ReactNode;
  readonly tone?: "white" | "muted" | "brand";
  readonly id?: string;
  readonly className?: string;
}) {
  const tones = {
    white: "bg-white",
    muted: "border-y border-stone-200/70 bg-stone-50",
    brand: "bg-brand-950 text-white",
  } as const;
  return (
    <section id={id} className={`${tones[tone]} px-4 py-16 sm:px-6 sm:py-24 ${className}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

export function CtaButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  readonly href: string;
  readonly children: React.ReactNode;
  readonly variant?: "primary" | "secondary" | "onDark";
  readonly className?: string;
}) {
  /* `min-h-12` rather than vertical padding alone: a pill at `py-3` with a 14px
     label measures 44px only if the font actually loaded at 14px, and 44px is
     the floor for a touch target. Stating the height removes the dependency. */
  const base =
    "group inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold transition-colors";
  const variants = {
    primary: "bg-brand text-white shadow-lg shadow-brand-900/15 hover:bg-brand-700",
    secondary: "bg-white text-stone-800 shadow-sm ring-1 ring-inset ring-stone-300 hover:ring-stone-400",
    onDark: "bg-white text-brand-900 shadow-lg hover:bg-brand-50",
  } as const;

  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ── Steps ───────────────────────────────────────────────────────────────── */

export interface Step {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
}

export function Steps({ steps }: { readonly steps: readonly Step[] }) {
  return (
    <ol className="mt-14 grid gap-6 md:grid-cols-3">
      {steps.map((step, i) => (
        <li
          key={step.title}
          className="flex flex-col gap-6 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 transition-shadow hover:shadow-md sm:p-8"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
              <step.icon className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <span aria-hidden="true" className="font-display text-4xl text-stone-200">
              0{i + 1}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-900">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-stone-600">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ── Feature grid ────────────────────────────────────────────────────────── */

export interface Feature {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
}

export function FeatureGrid({
  features,
  columns = 3,
}: {
  readonly features: readonly Feature[];
  readonly columns?: 2 | 3 | 4;
}) {
  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  } as const;
  return (
    <div className={`mt-14 grid gap-6 ${cols[columns]}`}>
      {features.map(({ icon: Icon, title, body }) => (
        <div key={title} className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <h3 className="mt-5 font-semibold text-stone-900">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Checklist ───────────────────────────────────────────────────────────── */

export function CheckList({
  items,
  onDark = false,
}: {
  readonly items: readonly string[];
  readonly onDark?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[15px]">
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              onDark ? "bg-white/10 text-brand-200" : "bg-brand-50 text-brand-700"
            }`}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <span className={onDark ? "text-white/85" : "text-stone-600"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────────── */

export interface Faq {
  readonly q: string;
  readonly a: string;
}

/**
 * Native `<details>`, no JavaScript.
 *
 * The answer text is in the DOM whether or not the item is open, so it is
 * indexable and findable with the browser's own Ctrl-F — neither of which is
 * true of a React accordion that mounts its panel on click. The `group`
 * utilities drive the toggle from `[open]` in CSS.
 */
export function FaqList({ faqs }: { readonly faqs: readonly Faq[] }) {
  return (
    <div className="mt-12 divide-y divide-stone-200 border-y border-stone-200">
      {faqs.map((faq) => (
        <details key={faq.q} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
            <h3 className="text-[15px] font-semibold text-stone-900 sm:text-base">{faq.q}</h3>
            <span
              aria-hidden="true"
              className="relative h-5 w-5 shrink-0 text-brand-600 transition-transform group-open:rotate-45"
            >
              <span className="absolute left-1/2 top-1/2 h-[1.5px] w-4 -translate-x-1/2 -translate-y-1/2 rounded bg-current" />
              <span className="absolute left-1/2 top-1/2 h-4 w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded bg-current" />
            </span>
          </summary>
          <p className="pb-6 pr-9 text-[15px] leading-7 text-stone-600">{faq.a}</p>
        </details>
      ))}
    </div>
  );
}

/** The `FAQPage` twin of `FaqList`. Pass the same array to both so they cannot drift. */
export function faqJsonLd(faqs: readonly Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/* ── Closing CTA ─────────────────────────────────────────────────────────── */

export function CtaBand({
  title,
  body,
  href = "/get-started",
  label = "Get started",
}: {
  readonly title: string;
  readonly body: string;
  readonly href?: string;
  readonly label?: string;
}) {
  return (
    <section className="bg-stone-50 px-4 pb-20 sm:px-6 sm:pb-24">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-brand-gradient px-6 py-14 text-center sm:px-12 sm:py-20">
        <div className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[17px] leading-8 text-white/90">{body}</p>
          <CtaButton href={href} variant="onDark" className="mt-9">
            {label}
          </CtaButton>
        </div>
      </div>
    </section>
  );
}

/* ── Internal linking ────────────────────────────────────────────────────── */

/**
 * The related-pages rail that closes most content pages.
 *
 * This is the mechanism that stops the condition and location pages being
 * leaves: each links sideways to its siblings, so link equity moves between
 * them instead of dead-ending.
 */
export function RelatedLinks({
  title,
  links,
}: {
  readonly title: string;
  readonly links: readonly { readonly href: string; readonly label: string }[];
}) {
  return (
    <Section tone="muted">
      <h2 className="font-display text-2xl tracking-tight text-stone-900">{title}</h2>
      <ul className="mt-7 flex flex-wrap gap-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-inset ring-stone-200 transition-colors hover:text-brand-700 hover:ring-stone-300"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
