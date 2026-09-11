import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}

export default function AdminPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-stone-500 mb-2">
            <Link href="/admin" className="hover:text-brand-700 transition-colors">
              Admin
            </Link>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 flex-shrink-0 text-stone-400" />
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-brand-700 transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  // The current page. Was stone-300 on a near-white page — 1.5:1,
                  // effectively invisible.
                  <span aria-current="page" className="font-medium text-stone-700">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {description && (
          <p className="text-sm text-stone-500 mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
