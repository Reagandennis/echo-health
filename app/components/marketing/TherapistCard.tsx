import Image from "next/image";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import type { DirectoryTherapist } from "@/lib/directory";

/**
 * One therapist in the public directory.
 *
 * The photo is the clinician's own upload, served by `/api/avatar/[id]` and
 * run through `next/image` — that route hands back the raw `bytea` at whatever
 * size it was uploaded (up to 10 MB), so putting a bare `<img>` here would
 * drop a multi-megabyte original into a 96px slot. Going through the optimiser
 * is not a nicety on this page: the directory renders a grid of them.
 *
 * Initials are the fallback rather than a stock silhouette. A generic stranger
 * beside a real name reads as a stock photo of that person, which is the exact
 * failure this directory replaced.
 */
export default function TherapistCard({ therapist }: { readonly therapist: DirectoryTherapist }) {
  const { id, name, bio, avatarUrl, experience, specialties } = therapist;
  const href = `/therapists/${id}`;

  return (
    <article className="group flex flex-col rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-stone-200/70 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <Avatar name={name} avatarUrl={avatarUrl} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-stone-900">
            {/* The whole card is not a link: a card-wide anchor swallows the
                specialty chips below and gives screen readers one enormous
                link name. The heading carries the link; the card carries the
                hover state via `group`. */}
            <Link href={href} className="transition-colors hover:text-brand-700">
              {name}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-brand-700">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Licence verified
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {experience} {experience === 1 ? "year" : "years"} in practice
          </p>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-stone-600">{bio}</p>

      {specialties.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {specialties.slice(0, 4).map((s) => (
            <li
              key={s}
              className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-100"
            >
              {s}
            </li>
          ))}
          {specialties.length > 4 && (
            <li className="px-1 py-1 text-xs font-medium text-stone-500">
              +{specialties.length - 4} more
            </li>
          )}
        </ul>
      )}

      <Link
        href={href}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition-colors hover:bg-brand-50"
      >
        View profile
      </Link>
    </article>
  );
}

export function Avatar({
  name,
  avatarUrl,
  size = 64,
}: {
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly size?: number;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={`${name}, therapist at Echo Health`}
        width={size}
        height={size}
        className="shrink-0 rounded-2xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .filter((part) => /[a-z]/i.test(part[0] ?? ""))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-2xl bg-brand-100 font-semibold text-brand-800"
    >
      {initials || "?"}
    </span>
  );
}
