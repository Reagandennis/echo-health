import Link from "next/link";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import CookiePreferences from "@/app/components/marketing/CookiePreferences";
import { pageMetadata } from "@/lib/seo";

/**
 * Cookie preferences.
 *
 * The controls on this page used to be decorative — four toggles and a "Save
 * Preferences" button with no handler, no form and no storage, so every choice
 * anyone made was discarded. `CookiePreferences` is the working replacement
 * and carries the reasoning, including why four categories became two.
 *
 * `index: false` is correct and stays: this is a preferences screen, not
 * content. Note it is therefore also absent from `ALL_INDEXABLE_ROUTES` —
 * submitting a noindex URL in a sitemap is a contradiction Search Console
 * reports as an error, and the previous sitemap did exactly that.
 */
export const metadata = pageMetadata({
  title: "Cookie settings",
  description:
    "Choose whether Echo Health may use analytics cookies. See exactly which cookies we set, what each one does, and how long it lasts.",
  path: "/cookies",
  index: false,
});

const LAST_UPDATED = "May 1, 2026";

/**
 * Every cookie the application actually sets.
 *
 * Listing them individually is the part of a cookie policy that is genuinely
 * useful and the part most often replaced with a paragraph of generalities. If
 * you add a cookie, add a row — a policy that does not match the browser's
 * storage inspector is worse than none, because it is checkable in ten seconds.
 */
const COOKIES = [
  {
    name: "appSession",
    purpose: "Keeps you signed in. Encrypted; readable only by the server.",
    who: "Echo Health",
    life: "Until you sign out",
  },
  {
    name: "__txn_*",
    purpose: "Completes the round trip to the sign-in page and back.",
    who: "Echo Health",
    life: "A few minutes",
  },
  {
    name: "ph_*",
    purpose: "PostHog analytics: a random device id and session id. No name, no email.",
    who: "PostHog",
    life: "Up to 12 months",
  },
] as const;

export default function CookieSettingsPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/cookies", label: "Cookie settings" }]} />

      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="border-b border-stone-200 pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            Privacy &amp; control
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
            Cookie settings
          </h1>
          <p className="mt-4 text-sm text-stone-500">Last updated: {LAST_UPDATED}</p>
          <p className="mt-6 max-w-2xl text-[17px] leading-8 text-stone-600">
            Echo sets two kinds of cookie: the ones that keep you signed in, and
            analytics. There are no advertising cookies on this site and no ad
            network is loaded on any page. You can turn the analytics off below,
            and it takes effect immediately.
          </p>
        </header>

        <div className="mt-12">
          <CookiePreferences />
        </div>

        <section className="mt-16">
          <h2 className="font-display text-2xl tracking-tight text-stone-900">
            Every cookie we set
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-stone-600">
            This is the complete list. You can check it against your
            browser&apos;s storage inspector.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <caption className="sr-only">Cookies set by Echo Health, their purpose and lifetime</caption>
              <thead>
                <tr className="border-b border-stone-300">
                  <th scope="col" className="py-3 pr-4 font-semibold text-stone-900">Cookie</th>
                  <th scope="col" className="py-3 pr-4 font-semibold text-stone-900">What it does</th>
                  <th scope="col" className="py-3 pr-4 font-semibold text-stone-900">Set by</th>
                  <th scope="col" className="py-3 font-semibold text-stone-900">Lasts</th>
                </tr>
              </thead>
              <tbody>
                {COOKIES.map((c) => (
                  <tr key={c.name} className="border-b border-stone-200 align-top">
                    <th scope="row" className="py-4 pr-4 font-mono text-xs font-normal text-stone-800">
                      {c.name}
                    </th>
                    <td className="py-4 pr-4 leading-6 text-stone-600">{c.purpose}</td>
                    <td className="py-4 pr-4 text-stone-600">{c.who}</td>
                    <td className="py-4 text-stone-600">{c.life}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl tracking-tight text-stone-900">
            What analytics never receives
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-stone-600">
            This matters more here than on most sites, so it is worth stating
            precisely. What you write in a journal entry, a message to your
            therapist or an intake answer is never sent to our analytics
            provider — not the text, not a score, not a category. Neither is
            your name or your email address: analytics identifies you by a
            random id and a coarse role, and nothing else. Page addresses are
            stripped of record identifiers before they are sent, and session
            recording is disabled outright once you are signed in.
          </p>
          <p className="mt-4 text-[15px] leading-7 text-stone-600">
            Turning analytics off above stops all of it. It will not affect your
            sessions, your messages or your account in any way.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl tracking-tight text-stone-900">
            Blocking cookies in your browser
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-stone-600">
            Every major browser can block or clear cookies from its settings,
            and you are welcome to. Be aware that blocking all cookies for this
            site will stop you signing in, because the sign-in cookie is how the
            server knows who you are between one page and the next.
          </p>
        </section>

        <p className="mt-16 border-t border-stone-200 pt-8 text-center text-sm text-stone-500">
          For the full picture of what we do with your data, read the{" "}
          <Link href="/privacy" className="font-semibold text-brand-700 underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </>
  );
}
