"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The phone-only conversion bar.
 *
 * On a phone the hero CTA scrolls out of view within one flick and does not
 * come back until the footer, which is most of the page with no way to act on
 * it. This pins the action to the bottom of the viewport once the hero leaves.
 *
 * Deliberately NOT rendered on desktop (`sm:hidden`) — there the header is
 * sticky and already carries "Get started", so a second persistent bar would
 * only cover content.
 */
export default function StickyCta({
  label = "Get started",
  href = "/get-started",
  note = "Takes about 3 minutes",
}: {
  readonly label?: string;
  readonly href?: string;
  readonly note?: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    /* Cheap: a passive listener reading one already-computed value — no layout
       read, no observer to tear down. */
    const onScroll = () => setShown(window.scrollY > 560);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur-md transition-transform duration-300 sm:hidden ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!shown}
      /* Sits above the iOS home indicator rather than under it. */
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-900">Ready when you are</p>
          <p className="truncate text-xs text-stone-500">{note}</p>
        </div>
        <Link
          href={href}
          tabIndex={shown ? undefined : -1}
          className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          {label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
