"use client";

import { useState } from "react";
import { BookOpen, ExternalLink, Search, Plus, Trash2 } from "lucide-react";

interface Resource { id: string; title: string; url: string; category: string; description: string; }

const DEFAULT_RESOURCES: Resource[] = [
  { id: "1", title: "CBT Thought Record Worksheet", url: "https://www.therapistaid.com/therapy-worksheet/cbt-thought-record", category: "CBT", description: "Structured worksheet for challenging negative thoughts." },
  { id: "2", title: "5-4-3-2-1 Grounding Technique", url: "https://www.therapistaid.com/therapy-worksheet/grounding-techniques", category: "Anxiety", description: "Sensory grounding technique for panic and dissociation." },
  { id: "3", title: "PHQ-9 Scoring Guide", url: "https://www.phqscreeners.com/select-screener/36", category: "Assessment", description: "Official scoring and interpretation guide for PHQ-9." },
  { id: "4", title: "Mindfulness Body Scan (MP3)", url: "https://www.uclahealth.org/marc/body-scan-meditation", category: "Mindfulness", description: "UCLA MARC guided body scan audio." },
  { id: "5", title: "Sleep Hygiene Handout", url: "https://www.therapistaid.com/therapy-worksheet/sleep-hygiene", category: "Sleep", description: "Printable psychoeducation handout for clients." },
];

const CATEGORIES = ["All", "CBT", "Anxiety", "Assessment", "Mindfulness", "Sleep", "Trauma", "Other"];

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>(DEFAULT_RESOURCES);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", category: "Other", description: "" });

  const filtered = resources.filter((r) =>
    (cat === "All" || r.category === cat) &&
    (r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase()))
  );

  function add() {
    if (!form.title || !form.url) return;
    setResources((rs) => [...rs, { id: Date.now().toString(), ...form }]);
    setForm({ title: "", url: "", category: "Other", description: "" });
    setAdding(false);
  }

  function remove(id: string) { setResources((rs) => rs.filter((r) => r.id !== id)); }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Resources</h1>
        <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus size={14} /> Add resource
        </button>
      </div>

      {adding && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-stone-800">New Resource</h2>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
          <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="URL" className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short description" className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand bg-white">
            {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50">Cancel</button>
            <button onClick={add} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90">Add</button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search resources…" className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 bg-white" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${cat === c ? "bg-brand text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>{c}</button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="col-span-2 py-16 text-center">
            <BookOpen size={36} className="mx-auto text-stone-200 mb-3" />
            <p className="text-sm text-stone-400">No resources found</p>
          </div>
        ) : filtered.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-stone-900 text-sm leading-tight">{r.title}</p>
                <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full mt-1 inline-block">{r.category}</span>
              </div>
              <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0"><Trash2 size={13} className="text-red-400" /></button>
            </div>
            <p className="text-xs text-stone-500 flex-1">{r.description}</p>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
              <ExternalLink size={12} /> Open resource
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
