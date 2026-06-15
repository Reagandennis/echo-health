/**
 * Shared loading skeleton for every /admin/* route.
 *
 * Next.js renders this instantly on navigation (as a Suspense fallback around
 * the page) while the destination server component runs its auth check and
 * Appwrite queries — so module switches feel immediate instead of frozen.
 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg bg-stone-200" />
        <div className="h-4 w-80 rounded bg-stone-100" />
      </div>

      {/* Stat / filter row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <div className="h-11 w-11 rounded-xl bg-stone-200 mb-4" />
            <div className="h-3 w-20 rounded bg-stone-100 mb-2" />
            <div className="h-6 w-16 rounded bg-stone-200" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="h-12 bg-stone-50 border-b border-stone-100" />
        <div className="divide-y divide-stone-50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-9 w-9 rounded-full bg-stone-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 rounded bg-stone-200" />
                <div className="h-3 w-56 rounded bg-stone-100" />
              </div>
              <div className="h-5 w-16 rounded-full bg-stone-100" />
              <div className="h-3 w-12 rounded bg-stone-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
