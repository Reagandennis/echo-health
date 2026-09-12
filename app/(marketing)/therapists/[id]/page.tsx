import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarClock, Check, Clock, Compass, Globe, Minus, MessageSquare, Video } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import JsonLd from "@/app/components/marketing/JsonLd";
import { Avatar } from "@/app/components/marketing/TherapistCard";
import { CtaBand, RelatedLinks, Section } from "@/app/components/marketing/sections";
import { getPublicTherapist, listPublicTherapists } from "@/lib/directory";
import { CONDITIONS } from "@/lib/navigation";
import { displayTitle, permittedScope } from "@/lib/practitioners";
import { siteUrl, siteName } from "@/lib/seo";

/**
 * A therapist's public profile.
 *
 * Long-tail landing pages: someone searching a clinician's name should find
 * this rather than a LinkedIn profile, and each page is an entity the
 * knowledge graph can attach reviews and credentials to later.
 *
 * BetterHelp puts these at the domain root (`/gema-martir/`). That buys a
 * little authority and permanently burns the top-level namespace — every
 * future route has to be checked against the roster. `/therapists/<id>` costs
 * almost nothing by comparison.
 */

export const revalidate = 300;

/**
 * Prebuild the roster; render anyone approved later on first request.
 *
 * `dynamicParams` defaults to true, which is what we want: a therapist
 * verified an hour after a deploy gets a working URL immediately instead of a
 * 404 until the next build.
 */
export async function generateStaticParams() {
  const therapists = await listPublicTherapists();
  return therapists.map((t) => ({ id: t.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const therapist = await getPublicTherapist(id);

  if (!therapist) {
    /* An unverified or unknown id must not be indexable — it 404s below, but
       a crawler that arrived from a stale link should be told plainly. */
    return { title: "Practitioner not found", robots: { index: false, follow: true } };
  }

  const url = `${siteUrl}/therapists/${therapist.id}`;
  const focus = therapist.specialties.slice(0, 3).join(", ");
  /*
   * The noun comes from what they are licensed to do, not from the route name.
   *
   * This read `is a licensed therapist` unconditionally, for every profile,
   * in the meta description AND in the JSON-LD `jobTitle` below. Both travel:
   * the description is the search snippet, and structured data is ingested as
   * a factual claim about a named person. A practitioner with no verified
   * licence was being published as a licensed clinician in the two places
   * hardest to retract.
   */
  const title = displayTitle(therapist.practitionerType);
  const qualifier =
    therapist.practitionerType === "licensed_therapist" ? "licensed " : "";
  const description = focus
    ? `${therapist.name} is a ${qualifier}${title} on Echo Health with ${therapist.experience} years in practice, working with ${focus.toLowerCase()}. Book an online session.`
    : `${therapist.name} is a ${qualifier}${title} on Echo Health with ${therapist.experience} years in practice. Book an online session.`;

  return {
    title: therapist.name,
    description,
    alternates: { canonical: url },
    openGraph: { type: "profile", url, siteName, title: therapist.name, description },
    twitter: { card: "summary_large_image", site: "@echohealth", title: therapist.name, description },
  };
}

export default async function TherapistProfilePage({ params }: Props) {
  const { id } = await params;
  const therapist = await getPublicTherapist(id);
  if (!therapist) notFound();

  const { name, bio, avatarUrl, experience, specialties, sessionDurationMinutes, timezone, practitionerType } = therapist;
  const scope = permittedScope(practitionerType);

  /*
   * `Person` with `knowsAbout`, not `Physician`.
   *
   * `Physician` in schema.org means a medical doctor, and the roster is
   * psychologists, counsellors and social workers — most of whom are not. It
   * would be the richer markup and it would be a false claim about someone's
   * credentials, which is a worse thing to publish than a plain `Person`.
   *
   * No `aggregateRating`: `therapists.rating` is nullable and nothing in the
   * product writes to it, so marking one up would be inventing a score.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteUrl}/therapists/${id}#person`,
    name,
    description: bio,
    url: `${siteUrl}/therapists/${id}`,
    /* Same rule as the description above: a claim search engines ingest must
       match the licence on file. Capitalised for display, from one source. */
    jobTitle:
      practitionerType === "licensed_therapist" ? "Licensed therapist" : "Wellness coach",
    knowsAbout: [...specialties],
    worksFor: { "@type": "MedicalOrganization", name: siteName, url: siteUrl },
    ...(avatarUrl ? { image: `${siteUrl}${avatarUrl}` } : {}),
  };

  /* Link sideways to the condition pages this clinician's own specialties
     name, so the profile feeds the topic cluster instead of dead-ending. */
  const matched = CONDITIONS.filter((c) =>
    specialties.some((s) => s.toLowerCase().includes(c.short.split(" ")[0]!))
  );
  const related = (matched.length > 0 ? matched : CONDITIONS.slice(0, 4)).map((c) => ({
    href: `/therapy-for/${c.slug}`,
    label: `Therapy for ${c.short}`,
  }));

  return (
    <>
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        trail={[
          { href: "/therapists", label: "Find a therapist" },
          { href: `/therapists/${id}`, label: name },
        ]}
      />

      <section className="bg-hero-soft px-4 pb-12 pt-4 sm:px-6 sm:pb-16">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <Avatar name={name} avatarUrl={avatarUrl} size={128} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl leading-tight tracking-tight text-stone-900 sm:text-4xl">
              {name}
            </h1>
            {/*
              * The badge is a statement about a licence, so it renders only
              * when there is one. It was unconditional — every profile claimed
              * "Licence verified by Echo Health" whether or not the person
              * held a verified licence in any jurisdiction we can advertise.
              *
              * A coach gets the honest alternative rather than nothing at all:
              * an unlabelled profile invites the reader to assume the badge was
              * merely missing.
              */}
            {practitionerType === "licensed_therapist" ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-100">
                <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />
                Licence verified by Echo Health
              </p>
            ) : (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-700 ring-1 ring-inset ring-stone-200">
                <Compass className="h-3.5 w-3.5" strokeWidth={2} />
                Wellness coach — not a licensed therapist
              </p>
            )}
            <p className="mt-4 text-[15px] text-stone-600">
              {experience} {experience === 1 ? "year" : "years"} in practice
            </p>
            <Link
              href="/get-started"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-white shadow-lg shadow-brand-900/15 transition-colors hover:bg-brand-700"
            >
              Work with {name.split(" ")[0]}
            </Link>
          </div>
        </div>
      </section>

      <Section>
        <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[1fr_17rem]">
          <div>
            <h2 className="font-display text-2xl tracking-tight text-stone-900">About {name.split(" ")[0]}</h2>
            {/* The bio is the clinician's own prose, stored as a single text
                column. Split on blank lines so paragraphing survives; React
                escapes each one, so no markup from the field can reach the
                page. */}
            <div className="mt-5 flex flex-col gap-4 text-[15px] leading-7 text-stone-600">
              {bio.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {specialties.length > 0 && (
              <>
                <h2 className="mt-12 font-display text-2xl tracking-tight text-stone-900">
                  Areas of focus
                </h2>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <li
                      key={s}
                      className="rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800 ring-1 ring-inset ring-brand-100"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/*
              * Scope, stated before booking rather than in the terms.
              *
              * `lib/practitioners.ts` holds both lists and its header explains
              * why `mayNot` carries equal weight: the coaching route is only
              * defensible if the boundary is something the reader is told, in
              * the place where they are deciding, rather than something they
              * could have found in a legal document. The lists are rendered
              * side by side at the same type size for that reason — putting
              * `mayNot` in a footnote would be the same claim made quietly.
              */}
            <h2 className="mt-12 font-display text-2xl tracking-tight text-stone-900">
              What {name.split(" ")[0]} can help with
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-stone-50 p-5">
                <h3 className="text-sm font-semibold text-stone-900">Can do</h3>
                <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-6 text-stone-600">
                  {scope.may.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-stone-50 p-5">
                <h3 className="text-sm font-semibold text-stone-900">Cannot do</h3>
                <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-6 text-stone-600">
                  {scope.mayNot.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <Minus className="mt-1 h-4 w-4 shrink-0 text-stone-400" strokeWidth={2.5} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-stone-500">
              In an emergency, or if you are at risk of harming yourself,{" "}
              <Link href="/crisis" className="font-semibold text-brand underline underline-offset-2">
                get help now
              </Link>{" "}
              — neither this profile nor Echo Health is a crisis service.
            </p>
          </div>

          <aside className="h-fit rounded-3xl bg-stone-50 p-6">
            <h2 className="text-sm font-semibold text-stone-900">Session details</h2>
            <dl className="mt-4 flex flex-col gap-4 text-sm">
              <Detail icon={Clock} label="Session length" value={`${sessionDurationMinutes} minutes`} />
              <Detail icon={Globe} label="Working hours" value={timezone.replace(/_/g, " ")} />
              <Detail icon={Video} label="Formats" value="Video, phone or messaging" />
              <Detail icon={CalendarClock} label="Cancellation" value="Free up to 24 hours before" />
              <Detail icon={MessageSquare} label="Between sessions" value="Secure in-app messaging" />
            </dl>
            <p className="mt-6 text-xs leading-5 text-stone-500">
              Not the right fit? Switching therapists is free and your unused
              session credits stay with you.
            </p>
          </aside>
        </div>
      </Section>

      <RelatedLinks title="What this therapist works with" links={related} />

      <CtaBand
        title={`Start with ${name.split(" ")[0]}`}
        body="Answer a few questions so we know what you're looking for, then pick a time that fits your week."
        label="Get started"
      />
    </>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={1.8} />
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</dt>
        <dd className="mt-0.5 text-stone-800">{value}</dd>
      </div>
    </div>
  );
}
