"use client";

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { Menu, X } from "lucide-react";

/**
 * The shared half of every overlay: Escape closes it, the page behind stops
 * scrolling, and focus moves into it so keyboard users are not left on a
 * trigger that is now covered.
 */
export function useModalBehavior(
  open: boolean,
  onClose: () => void,
  focusRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    focusRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose, focusRef]);
}

interface MobileDrawerProps {
  /** Top of the panel, beside the close button — usually the BrandMark. */
  readonly header: React.ReactNode;
  readonly children: React.ReactNode;
  /** Accessible name for the dialog; the trigger is "Open <label>". */
  readonly label?: string;
  readonly tone?: "light" | "dark";
  /** Applied to the trigger's wrapper — typically a `*:hidden` breakpoint. */
  readonly className?: string;
}

/**
 * Slide-over navigation for the portals below their sidebar breakpoint.
 *
 * The therapist and admin portals previously had no navigation at all on small
 * screens: their sidebars were `hidden lg:flex` / `hidden md:flex`, and the
 * admin header's hamburger was a <button> with no handler.
 */
export default function MobileDrawer({
  header,
  children,
  label = "Menu",
  tone = "light",
  className = "",
}: MobileDrawerProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useModalBehavior(open, close, closeRef);

  const dark = tone === "dark";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Open ${label.toLowerCase()}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            aria-hidden="true"
            onClick={close}
            className="absolute inset-0 bg-stone-950/40 backdrop-blur-[2px] motion-safe:animate-fade-in"
          />
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            // Following any link closes the drawer. Doing it here, rather than
            // by watching the pathname in an effect, also covers a link to the
            // page you are already on.
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) close();
            }}
            className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col shadow-xl motion-safe:animate-drawer-in ${
              dark ? "bg-stone-950 text-stone-100" : "bg-white"
            }`}
          >
            <div
              className={`flex h-16 shrink-0 items-center justify-between border-b px-4 ${
                dark ? "border-stone-800" : "border-stone-100"
              }`}
            >
              {header}
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label={`Close ${label.toLowerCase()}`}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  dark
                    ? "text-stone-400 hover:bg-stone-800 hover:text-stone-100"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
