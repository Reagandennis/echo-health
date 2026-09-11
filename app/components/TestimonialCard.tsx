import { Quote } from "lucide-react";

interface TestimonialCardProps {
  readonly quote: string;
  readonly name: string;
  readonly detail: string;
  readonly initials: string;
  readonly color: string; // tailwind bg class for avatar
}

export default function TestimonialCard({
  quote,
  name,
  detail,
  initials,
  color,
}: TestimonialCardProps) {
  return (
    <figure className="flex flex-col gap-5 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 transition-shadow hover:shadow-md">
      <Quote aria-hidden="true" className="h-7 w-7 text-brand-300" strokeWidth={1.5} />

      <blockquote className="flex-1 text-[15px] leading-7 text-stone-700">
        &ldquo;{quote}&rdquo;
      </blockquote>

      <figcaption className="flex items-center gap-3 border-t border-stone-100 pt-5">
        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-900">{name}</p>
          <p className="text-xs text-stone-500">{detail}</p>
        </div>
      </figcaption>
    </figure>
  );
}
