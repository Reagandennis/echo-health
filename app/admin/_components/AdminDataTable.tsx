"use client";

import { useState, ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import AdminEmptyState from "./AdminEmptyState";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface AdminDataTableProps<T extends { id?: string; $id?: string }> {
  columns: Column<T>[];
  data: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  rowHref?: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export default function AdminDataTable<T extends { id?: string; $id?: string }>({
  columns,
  data,
  emptyTitle,
  emptyDescription,
  onRowClick,
}: AdminDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = (a as Record<string, unknown>)[sortKey];
    const bVal = (b as Record<string, unknown>)[sortKey];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp = String(aVal).localeCompare(String(bVal));
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-stone-500 whitespace-nowrap ${
                    col.sortable ? "cursor-pointer hover:text-stone-700 select-none" : ""
                  } ${col.className ?? ""}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="flex flex-col">
                        <ChevronUp
                          className={`w-2.5 h-2.5 -mb-0.5 ${
                            sortKey === col.key && sortDir === "asc"
                              ? "text-teal-500"
                              : "text-stone-300"
                          }`}
                        />
                        <ChevronDown
                          className={`w-2.5 h-2.5 ${
                            sortKey === col.key && sortDir === "desc"
                              ? "text-teal-500"
                              : "text-stone-300"
                          }`}
                        />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <AdminEmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={(row as Record<string, unknown>)["$id"] as string ?? (row as Record<string, unknown>)["id"] as string ?? i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`transition-colors ${
                    onRowClick
                      ? "cursor-pointer hover:bg-teal-50/50"
                      : "hover:bg-stone-50/50"
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-5 py-4 text-sm text-stone-700 ${col.className ?? ""}`}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
