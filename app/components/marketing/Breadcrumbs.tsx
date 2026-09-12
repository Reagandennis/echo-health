import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { siteUrl } from "@/lib/seo";
import JsonLd from "./JsonLd";

export interface Crumb {
  readonly href: string;
  readonly label: string;
}

/**
 * Visible breadcrumbs plus the matching `BreadcrumbList`.
 *
 * Both halves come from one array, because the failure mode of hand-writing
 * the JSON-LD separately is structured data that disagrees with the page —
 * which Google treats as a markup violation rather than a nicety, and which is
 * invisible until a manual action arrives.
 *
 * The trail always starts at Home; callers pass the rest, current page last.
 */
export default function Breadcrumbs({ trail }: { readonly trail: readonly Crumb[] }) {
  const full: Crumb[] = [{ href: "/", label: "Home" }, ...trail];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: full.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: `${siteUrl}${c.href === "/" ? "" : c.href}`,
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-stone-500">
          {full.map((c, i) => {
            const last = i === full.length - 1;
            return (
              <li key={c.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-stone-300" aria-hidden="true" />}
                {last ? (
                  <span aria-current="page" className="font-medium text-stone-700">{c.label}</span>
                ) : (
                  <Link href={c.href} className="transition-colors hover:text-brand-700">{c.label}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
