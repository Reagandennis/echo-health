import Link from "next/link";
import { Printer } from "lucide-react";

/**
 * The shared shell for `/privacy` and `/terms`.
 *
 * Both pages used to hand-roll the header, the table of contents, and a small
 * markdown renderer — about 120 lines each, duplicated and already drifted:
 * the privacy page grew a row of assurance chips and a different heading scale,
 * and its inline renderer supported `**bold**` in list items while the terms
 * page's did not. Two copies of a parser is two sets of formatting bugs.
 *
 * Content is plain strings so the documents read as prose in the source, which
 * is what a non-engineer reviewing them needs. The supported syntax is
 * deliberately tiny — see `renderInline`.
 */

export interface LegalSection {
  readonly id: string;
  readonly title: string;
  readonly content: string;
}

/**
 * `**bold**` and `[text](/href)`. That is the whole grammar.
 *
 * No general markdown library, because the input is a fixed set of strings in
 * this repository rather than anything user-supplied — a parser would be
 * dependency weight for no capability. Links are matched only when they point
 * at a path or an https URL, so a stray bracket in prose renders as itself.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\((?:\/|https:\/\/)[^)]+\))/g);

  return tokens.filter(Boolean).map((token, i) => {
    const key = `${keyPrefix}-${i}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-stone-900">
          {token.slice(2, -2)}
        </strong>
      );
    }

    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
    if (link) {
      const [, label, href] = link;
      const className = "font-medium text-brand-700 underline underline-offset-2";
      /* External links get the usual rel; internal ones go through next/link
         so they prefetch and do not full-reload the document. */
      return href.startsWith("/") ? (
        <Link key={key} href={href} className={className}>
          {label}
        </Link>
      ) : (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {label}
        </a>
      );
    }

    return token;
  });
}

/** One block: a bullet list, a bold-led paragraph, or a plain paragraph. */
function Block({ text, index }: { readonly text: string; readonly index: number }) {
  if (text.startsWith("- ")) {
    const items = text.split("\n").filter((line) => line.startsWith("- "));
    return (
      <ul className="my-4 flex flex-col gap-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-7 text-stone-600">
            <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
            <span>{renderInline(item.slice(2), `b${index}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
  }

  /* A paragraph whose first line is entirely bold becomes a labelled block —
     the pattern legal prose uses constantly ("**Retention.** We keep…"). */
  const lines = text.split("\n");
  if (lines.length > 1 && /^\*\*[^*]+\*\*$/.test(lines[0]!)) {
    return (
      <div className="my-5">
        <p className="font-semibold text-stone-900">{lines[0]!.slice(2, -2)}</p>
        <p className="mt-1 text-[15px] leading-7 text-stone-600">
          {renderInline(lines.slice(1).join(" "), `h${index}`)}
        </p>
      </div>
    );
  }

  return (
    <p className="my-4 text-[15px] leading-7 text-stone-600">
      {renderInline(text, `p${index}`)}
    </p>
  );
}

export default function LegalDoc({
  title,
  lastUpdated,
  effectiveDate,
  intro,
  sections,
  footer,
}: {
  readonly title: string;
  readonly lastUpdated: string;
  readonly effectiveDate: string;
  /** Rendered above the contents list. Same tiny grammar as a section. */
  readonly intro: readonly string[];
  readonly sections: readonly LegalSection[];
  /** Closing block — typically how to get in touch. */
  readonly footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="border-b border-stone-200 pb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Legal</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
          {title}
        </h1>
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-stone-500">
          <div className="flex gap-2">
            <dt>Effective</dt>
            <dd className="font-medium text-stone-700">{effectiveDate}</dd>
          </div>
          <div className="flex gap-2">
            <dt>Last updated</dt>
            <dd className="font-medium text-stone-700">{lastUpdated}</dd>
          </div>
        </dl>
        <div className="mt-6">
          {intro.map((paragraph, i) => (
            <Block key={i} text={paragraph} index={i} />
          ))}
        </div>
      </header>

      {/*
        `scroll-mt-24` on each section, because the marketing header is sticky
        and an anchor jump would otherwise land the heading underneath it.
        `globals.css` sets `scroll-padding-top: 5rem` for the same reason; both
        are needed since the value differs from the header's actual height.
      */}
      <nav aria-label="Contents" className="mt-12 rounded-2xl border border-stone-200 bg-stone-50 p-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Contents</h2>
        <ol className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-sm leading-6 text-stone-600 transition-colors hover:text-brand-700"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-14 flex flex-col gap-12">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="border-b border-stone-200 pb-3 font-display text-2xl tracking-tight text-stone-900">
              {section.title}
            </h2>
            <div className="mt-2">
              {section.content.split("\n\n").map((block, i) => (
                <Block key={i} text={block.trim()} index={i} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {footer && <div className="mt-14 border-t border-stone-200 pt-10">{footer}</div>}

      {/* A legal document is a thing people save. `print:hidden` on the site
          chrome would be the complete fix; this at least makes the intent
          discoverable without JavaScript. */}
      <p className="mt-12 flex items-center gap-2 text-xs text-stone-400">
        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
        Use your browser&apos;s print or &ldquo;save as PDF&rdquo; to keep a copy of this document.
      </p>
    </div>
  );
}
