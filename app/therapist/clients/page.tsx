"use client";

import { useEffect, useState } from "react";
import { listTherapistClientsAction, getTherapistByUserIdAction } from "@/app/actions/database";
import { Search, AlertTriangle, User, ArrowRight, Filter } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/app/components/UserProvider";

interface Profile {
  $id: string;
  userId: string;
  name: string;
  email: string;
  goal?: string;
  createdAt: string;
  therapistId: string;
}

const RISK_KEYWORDS = ["suicidal", "self-harm", "crisis", "hopeless", "can't go on"];

export default function ClientsPage() {
  const user = useUser();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const therapist = await getTherapistByUserIdAction(user.$id);
        if (therapist) {
          const res = await listTherapistClientsAction(therapist.$id);
          setProfiles(res as unknown as Profile[]);
        }
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, [user]);

  const filtered = profiles.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  );

  function hasRisk(p: Profile) {
    return RISK_KEYWORDS.some((k) => p.goal?.toLowerCase().includes(k));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Clients</h1>
          <p className="text-stone-500 text-sm mt-0.5">{profiles.length} total client{profiles.length === 1 ? "" : "s"}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
          <Filter size={14} /> Filter
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 text-sm text-stone-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 bg-white" />
      </div>

      {/* Risk banner */}
      {profiles.some(hasRisk) && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {profiles.filter(hasRisk).length} client(s) may have risk indicators. Review their profiles promptly.
          </p>
        </div>
      )}

      {/* Client list */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <User size={36} className="mx-auto text-stone-200 mb-3" />
            <p className="text-stone-400 text-sm">No clients found</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filtered.map((p) => (
              <Link key={p.$id} href={`/therapist/clients/${p.userId}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm shrink-0">
                  {p.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-stone-900 truncate">{p.name}</p>
                    {hasRisk(p) && (
                      <span className="flex items-center gap-1 bg-red-100 text-red-600 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">
                        <AlertTriangle size={10} /> Risk
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 truncate">{p.email}</p>
                </div>
                {p.goal && (
                  <span className="hidden sm:block text-xs text-stone-500 bg-stone-100 px-3 py-1 rounded-full truncate max-w-32 shrink-0">
                    {p.goal}
                  </span>
                )}
                <ArrowRight size={14} className="text-stone-300 group-hover:text-brand shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
