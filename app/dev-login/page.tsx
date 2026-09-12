import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { AlertTriangle, LogOut, ShieldCheck, Stethoscope, User } from "lucide-react";
import {
  DEV_PERSONAS,
  DEV_SESSION_COOKIE,
  devAuthEnabled,
  isDevPersona,
} from "@/lib/auth/dev-session";

/**
 * A three-button sign-in for local development.
 *
 * `notFound()` when the guards do not hold, so this is indistinguishable from
 * a route that was never built — and because `devAuthEnabled()` is false at
 * build time in production, the page is not in that bundle at all.
 *
 * `noindex` is belt-and-braces: the page cannot exist in production, and if
 * somehow reached it must not be indexed.
 */
export const metadata = {
  title: "Local sign-in",
  robots: { index: false, follow: false },
};

const OPTIONS = [
  {
    role: "admin" as const,
    icon: ShieldCheck,
    lands: "/admin",
    blurb: "Full administrative access — the verification queue, risk views, billing, every user.",
  },
  {
    role: "therapist" as const,
    icon: Stethoscope,
    lands: "/therapist",
    blurb: "The clinician portal. Mapped to the first seeded therapist, so the profile is populated.",
  },
  {
    role: "client" as const,
    icon: User,
    lands: "/dashboard",
    blurb: "The client portal — sessions, messages, goals, progress, billing.",
  },
];

export default async function DevLoginPage() {
  if (!devAuthEnabled()) notFound();

  const current = (await cookies()).get(DEV_SESSION_COOKIE)?.value;
  const signedInAs = isDevPersona(current) ? current : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl tracking-tight text-stone-900">Local sign-in</h1>
      <p className="mt-4 text-[15px] leading-7 text-stone-600">
        Authentication is Auth0 Universal Login, so the app never handles a
        password and there are no test accounts in the database. These three
        personas mint a synthetic session instead, so you can look at the
        portals without setting up an Auth0 tenant.
      </p>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" strokeWidth={2} aria-hidden="true" />
        <div className="text-sm leading-6 text-amber-900">
          <p className="font-semibold">This bypasses authentication completely.</p>
          <p className="mt-1">
            It cannot exist in a production build — the check is inlined and the
            code is dropped. The one case the build cannot rule out is a dev
            server exposed over a tunnel: if this machine is reachable from the
            internet, unset <code className="font-mono text-xs">DEV_AUTH_ENABLED</code> before
            you expose it.
          </p>
        </div>
      </div>

      {signedInAs && (
        <p className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
          <span>
            Signed in as <strong>{DEV_PERSONAS[signedInAs].name}</strong> ({signedInAs}).
          </span>
          <a
            href="/api/dev/login?role=none"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </a>
        </p>
      )}

      <ul className="mt-8 flex flex-col gap-4">
        {OPTIONS.map(({ role, icon: Icon, lands, blurb }) => (
          <li key={role}>
            {/*
              A plain <a>, not next/link: the response sets a cookie and
              redirects, and a client-side navigation would not pick up the
              new cookie for the already-rendered tree.
            */}
            <a
              href={`/api/dev/login?role=${role}`}
              className="flex items-start gap-4 rounded-2xl border-2 border-stone-200 bg-white p-5 transition-colors hover:border-brand-400 hover:bg-brand-50/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-stone-900">
                  {DEV_PERSONAS[role].name}{" "}
                  <span className="font-normal text-stone-500">· {role}</span>
                </span>
                <span className="mt-1 block text-sm leading-6 text-stone-600">{blurb}</span>
                <span className="mt-1.5 block font-mono text-xs text-stone-400">→ {lands}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm leading-6 text-stone-500">
        Role checks are unchanged — each section&apos;s layout still enforces
        them, so the client persona is refused at <code className="font-mono text-xs">/admin</code>{" "}
        exactly as a real client would be. Run{" "}
        <code className="font-mono text-xs">npm run db:seed</code> first if the
        portals look empty.{" "}
        <Link href="/" className="font-semibold text-brand-700 underline underline-offset-2">
          Back to the site
        </Link>
      </p>
    </main>
  );
}
