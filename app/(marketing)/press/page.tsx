import Image from "next/image";
import { Download, Mail } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import { legalEntityName, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Press & media",
  description:
    "Brand assets, company boilerplate and media contacts for Echo Health — online therapy with clinicians registered in Kenya.",
  path: "/press",
});

/**
 * ## What this page used to be
 *
 * A "Recent News" list of four items — a "$15M Series A", a TechCrunch feature,
 * a Forbes "Top 10 Digital Health Startups to Watch", all dated 2023, every one
 * of them linking to `#`. None of it happened. Invented press coverage is worse
 * than an invented statistic: a funding round and a masthead are checkable
 * claims that an investor, a journalist or a regulator will check, and the
 * dead `#` link is what a reader hits at the exact moment they try.
 *
 * There was also a "Download ZIP (12MB)" button wired to nothing, and a promise
 * of "leadership headshots" we do not have.
 *
 * A press page with no coverage on it is not a weakness — it is what a press
 * kit is for. So this is the kit: boilerplate a journalist can paste, the logo
 * files that actually exist in `public/`, and a human to email.
 */

const ASSETS = [
  {
    src: "/echo-logo.png",
    name: "Primary logo",
    note: "Full lockup on an opaque white background. Use on white or very light surfaces.",
    dark: false,
  },
  {
    src: "/echo-butterfly.png",
    name: "Butterfly mark",
    note: "Transparent background. Use anywhere the surface is not white.",
    dark: true,
  },
  {
    src: "/echo-logo-mark.png",
    name: "Tight-crop mark",
    note: "Transparent background, cropped close. For avatars, favicons and small placements.",
    dark: true,
  },
];

export default function PressPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/press", label: "Press" }]} />

      <div className="pb-24">
        {/* Hero */}
        <section className="bg-slate-900 text-white px-6 py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="font-display text-4xl sm:text-6xl tracking-tight mb-6">
              Press &amp; media
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10">
              Company boilerplate, brand assets and a direct line to a human.
              If you need something that is not here, ask.
            </p>
            <a href="mailto:press@echohealth.app" className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-slate-900 shadow-md hover:bg-slate-100 transition-colors">
              <Mail size={16} /> Email the press team
            </a>
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-6 py-20">
          {/* Boilerplate */}
          <h2 className="text-2xl font-bold text-slate-800 mb-6 border-b border-slate-200 pb-4">
            About Echo Health
          </h2>
          <div className="space-y-5 text-[15px] leading-7 text-slate-600">
            <p>
              Echo Health is an online therapy platform operated by{" "}
              {legalEntityName}. It connects people with independently licensed
              mental-health practitioners registered in Kenya, for sessions
              delivered by video, phone or messaging.
            </p>
            <p>
              Every therapist submits their professional licence and
              identification, and an administrator verifies both before that
              therapist can be matched with any client. Sessions are bought as
              one-time bundles priced in Kenyan shillings — there is no
              subscription, nothing auto-renews, and session credits do not
              expire. Payment is by M-Pesa, card or bank transfer.
            </p>
            <p>
              Echo Health does not provide emergency, crisis or
              psychiatric-prescribing services. Anyone in immediate danger
              should contact local emergency services; verified crisis lines are
              listed at echohealth.app/crisis.
            </p>
          </div>

          {/* Brand assets */}
          <h2 className="mt-16 text-2xl font-bold text-slate-800 mb-6 border-b border-slate-200 pb-4">
            Brand assets
          </h2>
          <p className="text-[15px] leading-7 text-slate-600 mb-8">
            Please use the files below as they are — do not recolour, rotate,
            stretch or add effects to the mark, and keep clear space around it
            equal to the height of the butterfly.
          </p>
          <ul className="grid gap-6 sm:grid-cols-3">
            {ASSETS.map((asset) => (
              <li
                key={asset.src}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6"
              >
                <div
                  className={`relative mb-5 flex h-28 items-center justify-center rounded-2xl ${
                    asset.dark ? "bg-slate-900" : "bg-slate-50"
                  }`}
                >
                  {/* Fixed-size, so no `fill` and no `sizes` guesswork. */}
                  <Image
                    src={asset.src}
                    alt={`Echo Health ${asset.name.toLowerCase()}`}
                    width={160}
                    height={80}
                    className="h-auto max-h-20 w-auto object-contain"
                  />
                </div>
                <h3 className="text-base font-bold text-slate-800">{asset.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{asset.note}</p>
                <a
                  href={asset.src}
                  download
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <Download size={16} /> PNG
                </a>
              </li>
            ))}
          </ul>

          {/* Contact */}
          <h2 className="mt-16 text-2xl font-bold text-slate-800 mb-6 border-b border-slate-200 pb-4">
            Media enquiries
          </h2>
          <div className="rounded-3xl border border-cream bg-cream/50 p-8">
            <p className="text-[15px] leading-7 text-slate-600">
              For interview requests, expert commentary or anything else, email{" "}
              <a href="mailto:press@echohealth.app" className="font-semibold text-brand hover:underline">
                press@echohealth.app
              </a>
              . We aim to reply within one business day. We can arrange
              commentary from a licensed clinician on our panel; we do not
              comment on individual clients or sessions under any circumstances.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
