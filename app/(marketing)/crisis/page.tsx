import { AlertTriangle, Phone, MessageSquare, Globe, ExternalLink } from "lucide-react";
import Link from "next/link";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import { pageMetadata } from "@/lib/seo";
import { CRISIS_REGIONS, CRISIS_DIRECTORY_URL, type CrisisService } from "@/lib/constants";

/**
 * Crisis resources.
 *
 * This page previously opened with "call 911", titled its only section
 * "Immediate Resources (United States)", listed four US-only services, and
 * linked internationally over plain HTTP to a directory that is no longer
 * maintained. Echo's clinicians are in Nairobi and its clients are worldwide;
 * none of those numbers connect from a Kenyan handset.
 *
 * The structure now follows what someone in crisis actually needs, in order:
 *
 *   1. Call local emergency services. Stated WITHOUT a number, because there is
 *      no universal one and printing the wrong country's is the failure being
 *      fixed.
 *   2. Find a helpline where you are — a geolocating directory, first and
 *      prominent, because on a global platform most visitors are somewhere this
 *      page cannot enumerate.
 *   3. Verified numbers for the regions Echo actually operates in.
 *
 * All numbers live in `CRISIS_REGIONS` with a source URL each. Add them there,
 * never inline here, and read the rules on that constant first.
 */

export const metadata = pageMetadata({
  title: "Crisis resources & emergency support",
  description:
    "If you are in crisis, immediate help is available. Find a crisis helpline in your country, plus verified emergency numbers for Kenya and the United States.",
  path: "/crisis",
});

function ServiceCard({ service }: { service: CrisisService }) {
  const isText = service.href.startsWith("sms:");
  const Icon = isText ? MessageSquare : Phone;

  return (
    <a
      href={service.href}
      className="flex flex-col p-6 bg-white rounded-2xl border-2 border-slate-200 hover:border-brand/40 transition-colors group"
    >
      <div className="flex items-start gap-3 mb-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5 text-slate-800 group-hover:text-brand transition-colors" />
        <div className="min-w-0">
          <h3 className="font-bold text-lg text-slate-800 leading-tight">{service.name}</h3>
          {/* Scope before description: "Under 18s" changes whether the rest of
              the card is even relevant to the reader. */}
          {service.scope && (
            <p className="text-xs font-semibold text-brand mt-1">{service.scope}</p>
          )}
        </div>
      </div>

      <p className="text-slate-500 text-sm mb-4">{service.description}</p>

      {/* Availability and cost sit ABOVE the number, not below it. Someone
          scanning for a number to dial at 3am must not have to read past it to
          discover the line closed at five, or that it bills. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-4">
        <span className="text-slate-600 font-medium">{service.availability}</span>
        {service.cost && <span className="text-slate-400">·</span>}
        {service.cost && <span className="text-slate-600 font-medium">{service.cost}</span>}
      </div>

      <div className="mt-auto px-5 py-2.5 bg-slate-100 rounded-full font-bold text-slate-800 text-center group-hover:bg-brand group-hover:text-white transition-colors">
        {service.contact}
      </div>
    </a>
  );
}

export default function CrisisPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/crisis", label: "Crisis support" }]} />

      <div className="flex-1 bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          {/* No number in the headline. Echo serves clients worldwide and there
              is no emergency number that works everywhere — 911, 999 and 112 all
              fail somewhere. Naming the action without naming a number is the
              only instruction that is correct for every reader. */}
          <div className="rounded-3xl bg-red-50 border border-red-100 p-8 sm:p-12 mb-12 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 mb-6">
              <AlertTriangle className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-red-900 mb-4">
              If you are in immediate danger, call your local emergency services now.
            </h1>
            <p className="text-red-700 text-lg">
              Echo Health is not a crisis response service. If you are experiencing a mental health
              emergency, having thoughts of suicide, or considering harming yourself or others,
              immediate help is available — and it is free.
            </p>
          </div>

          {/* The directory comes FIRST, before any regional list. On a global
              platform most visitors are somewhere this page does not enumerate,
              and burying the one resource that covers them under two country
              sections would repeat the original mistake in a politer form. */}
          <a
            href={CRISIS_DIRECTORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-3xl bg-slate-800 p-8 sm:p-10 mb-16 text-center hover:bg-slate-700 transition-colors group"
          >
            <Globe className="h-10 w-10 text-slate-400 mx-auto mb-5" />
            <h2 className="text-2xl font-bold text-white mb-3">Find a helpline in your country</h2>
            <p className="text-slate-400 mb-7 max-w-lg mx-auto">
              Find A Helpline lists verified crisis services for almost every country and
              detects where you are. It is the directory the International Association for
              Suicide Prevention now points to.
            </p>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-slate-800 group-hover:bg-brand group-hover:text-white transition-colors">
              Open the directory
              <ExternalLink size={15} />
            </span>
          </a>

          {CRISIS_REGIONS.map((region) => (
            <section key={region.region} className="mb-16 last:mb-0">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">{region.region}</h2>

              <div className="rounded-2xl bg-red-50 border border-red-100 p-5 mb-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
                  <span className="text-sm font-semibold text-red-900">Emergency services</span>
                  <span className="text-xl font-bold text-red-900">{region.emergency.numbers}</span>
                </div>
                <p className="text-red-700 text-sm">{region.emergency.note}</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {region.services.map((service) => (
                  <ServiceCard key={service.name} service={service} />
                ))}
              </div>
            </section>
          ))}

          <p className="text-slate-400 text-xs text-center mt-4">
            Every number on this page was checked against the operating organisation&apos;s own
            published contact details. If you find one that is wrong or no longer answers, please{" "}
            <Link href="/contact" className="underline hover:text-slate-600">
              tell us
            </Link>{" "}
            — we will correct it immediately.
          </p>
        </div>
      </div>
    </>
  );
}
