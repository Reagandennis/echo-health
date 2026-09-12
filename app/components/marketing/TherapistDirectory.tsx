"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import TherapistCard from "./TherapistCard";
import type { DirectoryTherapist } from "@/lib/directory";

/**
 * Filtering for the public directory.
 *
 * ## Why the filter is client-side
 *
 * The obvious design is `/therapists?specialty=anxiety`, read from
 * `searchParams` on the server. That would opt the route out of static
 * rendering — every visit to the directory would become a server round-trip
 * plus a database query — and it would mint a distinct crawlable URL for every
 * filter combination, each one a near-duplicate of the others. `robots.ts`
 * disallows `/therapists?` for that reason.
 *
 * So the server renders the complete roster into the HTML once, statically,
 * and this component hides rows. The crawler sees every therapist and every
 * link; the visitor gets instant filtering with no request. The full list is
 * in the DOM either way, so hiding is genuinely all that is happening.
 *
 * This trade stops being right somewhere in the low hundreds of clinicians, at
 * which point the page needs real pagination and the filter needs to move to
 * the server. It is nowhere near that.
 */
export default function TherapistDirectory({
  therapists,
  specialties,
}: {
  readonly therapists: readonly DirectoryTherapist[];
  readonly specialties: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return therapists.filter((t) => {
      if (specialty && !t.specialties.includes(specialty)) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.bio.toLowerCase().includes(q) ||
        t.specialties.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [therapists, query, specialty]);

  const filtering = Boolean(query.trim() || specialty);

  return (
    <div>
      <div className="flex flex-col gap-4">
        <label className="relative block">
          <span className="sr-only">Search therapists by name, focus or approach</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, focus or approach"
            className="min-h-12 w-full rounded-full border border-stone-300 bg-surface pl-11 pr-4 text-[15px] text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>

        {specialties.length > 0 && (
          <div>
            <h2 className="sr-only">Filter by focus</h2>
            <ul className="flex flex-wrap gap-2">
              {specialties.map((s) => {
                const on = specialty === s;
                return (
                  <li key={s}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSpecialty(on ? null : s)}
                      className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                        on
                          ? "bg-brand-600 text-white"
                          : "bg-surface text-stone-700 ring-1 ring-inset ring-stone-200 hover:ring-stone-300"
                      }`}
                    >
                      {s}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        {/* `aria-live` so a filter change is announced — the result count is
            the only feedback a screen-reader user gets that a chip did
            anything, since the change happens far below the control. */}
        <p aria-live="polite" className="text-sm text-stone-600">
          {visible.length} {visible.length === 1 ? "therapist" : "therapists"}
          {filtering ? " match your filters" : " available"}
        </p>
        {filtering && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSpecialty(null);
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {visible.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <TherapistCard key={t.id} therapist={t} />
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-3xl bg-stone-50 p-8 text-center text-[15px] leading-7 text-stone-600">
          No therapist matches that yet. Try a broader search — or{" "}
          <a href="/get-started" className="font-semibold text-brand-700 underline underline-offset-2">
            answer a few questions
          </a>{" "}
          and we&apos;ll match you ourselves.
        </p>
      )}
    </div>
  );
}
