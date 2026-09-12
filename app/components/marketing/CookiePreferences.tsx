"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  analyticsNeverReadyOnServer,
  getAnalytics,
  isAnalyticsReady,
  optInCapturing,
  optOutCapturing,
  subscribeAnalyticsReady,
} from "@/lib/analytics/client";
import { Check, Loader2 } from "lucide-react";

/**
 * A cookie control that actually changes something.
 *
 * ## What was here before
 *
 * Four toggles and a "Save Preferences" button with no `onClick`, no form, and
 * no storage of any kind. Every preference anyone set was discarded on the
 * next paint. That is worse than having no control at all: a consent mechanism
 * that silently throws consent away is a misrepresentation to the person using
 * it, and under the Kenya Data Protection Act 2019 consent has to be
 * withdrawable as easily as it is given — which it cannot be if the withdraw
 * button is decorative.
 *
 * ## Why there are two categories now and not four
 *
 * The old page offered "Functional" and "Targeting & Advertising" toggles.
 * Neither described anything this application does:
 *
 *  - There are no third-party functional cookies. Video is self-hosted WebRTC
 *    against `video.echopsychology.com` and sets none; the support chat is
 *    first-party.
 *  - There are no advertising cookies anywhere in the product, and no ad
 *    network is loaded on any route. Offering a toggle for them implied a
 *    category of tracking that does not exist, which is its own kind of
 *    inaccuracy.
 *
 * What is left is what is real: the Auth0 session cookie, which the site
 * cannot function without, and PostHog, which it can.
 *
 * ## How the analytics toggle works
 *
 * `optOutCapturing()` sets PostHog's own persisted opt-out flag and
 * stops every subsequent capture, including autocapture and pageviews. It is
 * read back with `has_opted_out_capturing()`, so this component holds no
 * duplicate source of truth that could disagree with the library's — a second
 * flag in `localStorage` is exactly how a consent UI ends up displaying
 * "analytics off" while events keep sending.
 */
export default function CookiePreferences() {
  /* `null` until the browser has been asked. Rendering "on" before checking
     would flash the wrong state at someone who had already opted out. */
  const [analytics, setAnalytics] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  /*
   * `react-hooks/set-state-in-effect` is disabled deliberately.
   *
   * The rule wants this derived during render or delivered by a subscription
   * callback. Neither is possible: the opt-out flag lives in the browser's
   * storage, which does not exist while this renders on the server, and
   * posthog-js emits no event when it changes. Reading it in a `useState`
   * initialiser would give a first client render that disagrees with the
   * server HTML — a hydration mismatch, which is a worse bug than one extra
   * render of a toggle nobody can have touched yet.
   *
   * This is the case effects exist for: reading a value out of an external
   * store on mount.
   */
  /*
   * The SDK is dynamically imported, so on a fast click into /cookies it may
   * genuinely not be loaded yet. Waiting on readiness is what stops the toggle
   * rendering "off" — which would read as "analytics is already disabled" — to
   * someone whose analytics are in fact on.
   */
  const ready = useSyncExternalStore(
    subscribeAnalyticsReady,
    isAnalyticsReady,
    analyticsNeverReadyOnServer
  );

  /* eslint-disable react-hooks/set-state-in-effect -- see the note above */
  useEffect(() => {
    const ph = getAnalytics();
    if (!ph) {
      /* Not loaded. Either it is still arriving — in which case `ready` flips
         and this runs again — or the key is unset (local dev, a self-hosted
         build with analytics off, an extension that blocked the request). In
         the latter case "off" is not a guess: nothing is being captured. */
      if (ready) setAnalytics(false);
      return;
    }
    setAnalytics(!ph.has_opted_out_capturing());
  }, [ready]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function save() {
    /* Queued if the SDK has not arrived, so a preference set in the first
       second of the page load is applied rather than dropped. */
    if (analytics) optInCapturing();
    else optOutCapturing();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 4000);
  }

  return (
    <div className="flex flex-col gap-4">
      <Category
        title="Strictly necessary"
        body="One encrypted cookie that keeps you signed in, and a short-lived one used to complete the sign-in round trip. Without these you cannot log in, so there is nothing to switch off — they are not used to track you and carry no advertising identifier."
        state="required"
      />

      <Category
        title="Analytics"
        body="PostHog, which counts page views and product events so we can see which parts of Echo people cannot find. It never receives the content of what you write, what you tell us you are struggling with, or anything a risk scanner produced — those stay in our own database. Session recording is switched off entirely once you are signed in."
        state={analytics}
        onChange={setAnalytics}
      />

      <div className="mt-4 flex flex-wrap items-center justify-end gap-4">
        {/* `aria-live` so the confirmation is announced; the button is at the
            bottom of a long page and the only other feedback is visual. */}
        <p aria-live="polite" className="text-sm font-medium text-brand-700">
          {saved && (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4" strokeWidth={2.5} />
              Preferences saved.
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={analytics === null}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-8 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {analytics === null ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Loading
            </>
          ) : (
            "Save preferences"
          )}
        </button>
      </div>

      <p className="text-sm leading-6 text-stone-500">
        Your choice is stored in this browser only. If you use Echo on another
        device, or clear your browsing data, set it again there.
      </p>
    </div>
  );
}

function Category({
  title,
  body,
  state,
  onChange,
}: {
  readonly title: string;
  readonly body: string;
  readonly state: boolean | null | "required";
  readonly onChange?: (next: boolean) => void;
}) {
  const required = state === "required";
  const checked = required ? true : state === true;

  return (
    <div className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-stone-200/70">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
        </div>

        {required ? (
          <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
            Always on
          </span>
        ) : (
          /*
           * A real `<button role="switch">` rather than a styled checkbox.
           * The previous markup was an `<input>` with no label association at
           * all — `sr-only peer` inside a `<label>` whose only other content
           * was the decorative track — so a screen reader announced an unnamed
           * checkbox three times with no way to tell them apart.
           */
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={`${title} cookies`}
            disabled={state === null}
            onClick={() => onChange?.(!checked)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              checked ? "bg-brand-600" : "bg-stone-300"
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                checked ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        )}
      </div>
    </div>
  );
}
