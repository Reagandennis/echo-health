import { FileSearch } from "lucide-react";

interface AdminEmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export default function AdminEmptyState({
  title = "No results found",
  description = "Try adjusting your filters or search terms.",
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
        <FileSearch className="w-7 h-7 text-stone-400" />
      </div>
      <h3 className="text-base font-semibold text-stone-700 mb-1">{title}</h3>
      <p className="text-sm text-stone-400 max-w-xs">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
