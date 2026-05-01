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
    <div className="flex flex-col gap-5 rounded-2xl border border-cream/70 bg-white p-8 shadow-sm hover:shadow-md transition-shadow">
      {/* Stars */}
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} className="w-4 h-4 text-brand" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>

      {/* Quote */}
      <p className="text-brand/75 leading-7 text-sm flex-1">
        &ldquo;{quote}&rdquo;
      </p>

      {/* Author */}
      <div className="flex items-center gap-3 pt-2 border-t border-cream/50">
        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-brand">{name}</p>
          <p className="text-xs text-brand/50">{detail}</p>
        </div>
      </div>
    </div>
  );
}
