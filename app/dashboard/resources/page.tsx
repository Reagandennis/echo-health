"use client";

import { useState } from "react";
import { BookOpen, Video, FileText, Dumbbell, ExternalLink, Sparkles } from "lucide-react";
import { RESOURCE_ARTICLES } from "@/lib/constants";

const TYPE_ICONS: Record<string, React.ElementType> = {
  article:   BookOpen,
  video:     Video,
  worksheet: FileText,
  exercise:  Dumbbell,
  guide:     BookOpen,
};

const ALL_TAGS = Array.from(new Set(RESOURCE_ARTICLES.map((r) => r.tag)));

export default function ResourcesPage() {
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const visible = RESOURCE_ARTICLES.filter((r) => {
    const matchTag  = !filterTag || r.tag === filterTag;
    const matchText = !search || r.title.toLowerCase().includes(search.toLowerCase());
    return matchTag && matchText;
  });

  const therapistPicks = RESOURCE_ARTICLES.filter((r) => r.therapistPick);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-brand">Resources</h1>
        <p className="text-sm text-brand/45 mt-0.5">Articles, exercises, and tools curated for your wellness journey.</p>
      </div>

      {/* Therapist picks */}
      <div className="bg-brand rounded-2xl p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={14} className="text-white/70" />
          <span className="text-xs font-bold text-white/70 uppercase tracking-wide">Therapist picks</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {therapistPicks.map((r) => {
            const Icon = TYPE_ICONS[r.type] ?? BookOpen;
            return (
              <div key={r.id} className="bg-white/10 hover:bg-white/20 rounded-xl p-4 cursor-pointer transition-colors group">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/60 uppercase mb-1">{r.tag}</p>
                    <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{r.title}</p>
                    <p className="text-xs text-white/40 mt-1">{r.readTime}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resources…"
          className="flex-1 bg-white rounded-xl border border-brand/15 px-4 py-2.5 text-sm text-brand placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterTag(null)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${filterTag ? "bg-white border border-brand/15 text-brand/60 hover:border-brand/30" : "bg-brand text-white"}`}>
            All
          </button>
          {ALL_TAGS.map((t) => (
            <button key={t} onClick={() => setFilterTag(t === filterTag ? null : t)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${filterTag === t ? "bg-brand text-white" : "bg-white border border-brand/15 text-brand/60 hover:border-brand/30"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-sm text-brand/40">No resources match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visible.map((r) => {
            const Icon = TYPE_ICONS[r.type] ?? BookOpen;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-brand/10 p-5 hover:border-brand/25 transition-colors group cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand/8 flex items-center justify-center shrink-0 group-hover:bg-brand/15 transition-colors">
                    <Icon size={17} className="text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-brand/40 uppercase tracking-wide">{r.tag}</span>
                      {r.therapistPick && (
                        <span className="text-[10px] font-semibold bg-brand/10 text-brand px-2 py-0.5 rounded-full">Therapist pick</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-brand leading-snug group-hover:text-brand/80 transition-colors">{r.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-brand/35">{r.readTime}</span>
                      <ExternalLink size={12} className="text-brand/25 group-hover:text-brand/50 transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
