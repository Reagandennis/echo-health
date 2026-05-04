import type { Metadata } from "next";
import Link from "next/link";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Cookie Settings",
  description:
    "Manage your cookie preferences and learn how Echo Health uses tracking technologies.",
};

const LAST_UPDATED = "May 1, 2026";
const EFFECTIVE_DATE = "May 1, 2026";

export default function CookieSettingsPage() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-white min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            <span className="text-brand">Echo Psychology </span>
            <span className="text-slate-700">Group</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 hover:text-brand transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-3xl px-6 py-16 w-full">
        {/* Header */}
        <div className="mb-12 border-b border-slate-100 pb-10">
          <span className="inline-block rounded-full bg-cream px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand mb-6">
            Privacy & Control
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 leading-tight">
            Cookie Settings
          </h1>
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-400">
            <span>Last Updated: {LAST_UPDATED}</span>
            <span>Effective Date: {EFFECTIVE_DATE}</span>
          </div>
          <p className="mt-6 text-base leading-7 text-slate-500 max-w-2xl">
            We use cookies and similar technologies to ensure our platform works securely, to understand how you use our services, and to improve your experience. You can manage your preferences below.
          </p>
        </div>

        {/* Settings Toggles */}
        <div className="space-y-8">
          
          {/* Strictly Necessary */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                  Strictly Necessary Cookies
                  <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded uppercase tracking-wider font-bold">Required</span>
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  These cookies are essential for the platform to function securely. They enable core features such as logging in, remembering your session, and preventing fraudulent activity. Because they are required for security and core functionality, they cannot be disabled.
                </p>
              </div>
              <div className="shrink-0 pt-1">
                <div className="w-12 h-6 bg-brand rounded-full relative opacity-50 cursor-not-allowed">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Analytics & Performance */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-brand/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">
                  Analytics & Performance
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  These cookies help us understand how visitors interact with our platform by collecting and reporting information anonymously. They allow us to count visits and traffic sources so we can measure and improve the performance of our site.
                </p>
              </div>
              <label className="shrink-0 pt-1 relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
              </label>
            </div>
          </div>

          {/* Functional */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-brand/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">
                  Functional Cookies
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  These cookies enable the platform to provide enhanced functionality and personalization. They may be set by us or by third-party providers whose services we have added to our pages (e.g., video players or live chat).
                </p>
              </div>
              <label className="shrink-0 pt-1 relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
              </label>
            </div>
          </div>

          {/* Advertising */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-brand/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">
                  Targeting & Advertising
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  We <strong className="text-slate-700">do not</strong> use third-party advertising cookies on pages where protected health information (PHI) is accessible. We may use these cookies on public marketing pages to deliver relevant advertisements on other websites.
                </p>
              </div>
              <label className="shrink-0 pt-1 relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-10 flex justify-end">
          <button className="rounded-full bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-brand/90 transition-colors">
            Save Preferences
          </button>
        </div>

        {/* Footer info */}
        <div className="mt-16 border-t border-slate-100 pt-8 text-sm text-slate-500 text-center">
          For more information about how we handle your data, please read our <a href="/privacy" className="text-brand hover:underline font-semibold">Privacy Policy</a>.
        </div>
      </main>

      <Footer />
    </div>
  );
}
