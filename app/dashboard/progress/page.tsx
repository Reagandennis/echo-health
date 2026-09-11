"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Plus, X, BookOpen, Pencil, Trash2,
} from "lucide-react";
import {
  listMoodLogsAction,
  createMoodLogAction,
  listJournalEntriesAction,
  createJournalEntryAction,
  updateJournalEntryAction,
  deleteJournalEntryAction
} from "@/app/actions/database";
import type { MoodLog, JournalEntry } from "@/lib/types/documents";
import { MOOD_EMOJIS, MOOD_TAGS } from "@/lib/constants";
import { useUser } from "@/app/components/UserProvider";

// PERF: defer the recharts chunk (8.5 MB + d3 transitives) so it isn't pulled
// into the dashboard's initial bundle / Turbopack compile graph.
const MoodChart = dynamic(() => import("./_components/MoodChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[180px] flex items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
    </div>
  ),
});

const JOURNAL_PROMPTS = [
  "What am I grateful for today?",
  "What challenged me this week and what did I learn?",
  "Describe a moment this week where you felt calm.",
  "What is one small step I can take toward my goal tomorrow?",
  "How have my relationships felt lately?",
];

// ─── Mood check-in modal ──────────────────────────────────────────────────────
function MoodModal({
  onClose,
  onSaved,
  userId,
}: {
  readonly onClose: () => void;
  readonly onSaved: (log: MoodLog) => void;
  readonly userId: string;
}) {
  const [score, setScore] = useState(0);
  const [tags, setTags]   = useState<string[]>([]);
  const [note, setNote]   = useState("");
  const [saving, setSaving] = useState(false);

  function toggleTag(t: string) {
    setTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  async function handleSave() {
    if (score === 0 || saving) return;
    setSaving(true);
    try {
      const emoji = MOOD_EMOJIS.find((m) => m.score === score)?.emoji ?? "😐";
      const log = await createMoodLogAction({
        userId,
        score,
        emoji,
        tags,
        note,
        createdAt: new Date().toISOString(),
      });
      onSaved(log);
    } catch (error) {
      console.error("Create mood log error:", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog open className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent m-0 max-w-none max-h-none w-full h-full">
      <button type="button" className="absolute inset-0 w-full h-full bg-brand/20 backdrop-blur-sm cursor-default" onClick={onClose} aria-label="Close" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-brand">How are you feeling?</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-brand transition-colors" aria-label="Close"><X size={17} /></button>
        </div>
        {/* Emoji grid */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {MOOD_EMOJIS.map(({ score: s, emoji, label }) => (
            <button type="button" key={s} onClick={() => setScore(s)}
              title={label}
              className={`flex flex-col items-center p-2 rounded-xl transition-all ${score === s ? "bg-brand/10 scale-110 ring-2 ring-brand" : "hover:bg-cream"}`}>
              <span className="text-2xl">{emoji}</span>
              <span className="text-[9px] text-stone-500 mt-0.5">{s}</span>
            </button>
          ))}
        </div>
        {/* Tags */}
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">How does it feel?</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {MOOD_TAGS.map((t) => (
            <button type="button" key={t} onClick={() => toggleTag(t)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors
                ${tags.includes(t) ? "bg-brand text-white border-brand" : "border-brand/15 text-stone-500 hover:border-brand/30"}`}>
              {t}
            </button>
          ))}
        </div>
        {/* Note */}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="Optional note…"
          className="w-full rounded-xl border border-brand/15 px-3 py-2.5 text-sm text-brand placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none mb-4" />
        <button onClick={() => void handleSave()} disabled={score === 0 || saving}
          className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? "Saving…" : "Log mood"}
        </button>
      </div>
    </dialog>
  );
}

// ─── Journal modal ────────────────────────────────────────────────────────────
function JournalModal({
  entry,
  onClose,
  onSaved,
  userId,
}: {
  readonly entry: JournalEntry | null;
  readonly onClose: () => void;
  readonly onSaved: (e: JournalEntry) => void;
  readonly userId: string;
}) {
  const [randomPrompt] = useState(
    () => JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)]
  );
  const [content, setContent] = useState(entry?.content ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      const saved = entry
        ? await updateJournalEntryAction(entry.$id, { content })
        : await createJournalEntryAction({
            userId,
            content,
            prompt: randomPrompt,
            createdAt: new Date().toISOString(),
          });
      onSaved(saved);
    } catch (error) {
      console.error("Save journal entry error:", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog open className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent m-0 max-w-none max-h-none w-full h-full">
      <button type="button" className="absolute inset-0 w-full h-full bg-brand/20 backdrop-blur-sm cursor-default" onClick={onClose} aria-label="Close" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-brand">{entry ? "Edit entry" : "New journal entry"}</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-brand transition-colors" aria-label="Close"><X size={17} /></button>
        </div>
        {!entry && (
          <p className="text-sm text-stone-500 italic mb-4 bg-cream rounded-xl px-4 py-3">
            💭 Prompt: {randomPrompt}
          </p>
        )}
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8}
          placeholder="Write freely…"
          className="w-full rounded-xl border border-brand/15 px-4 py-3 text-sm text-brand placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-brand/20 text-brand text-sm font-semibold py-2.5 rounded-full hover:bg-cream transition-colors">
            Cancel
          </button>
          <button onClick={() => void handleSave()} disabled={!content.trim() || saving}
            className="flex-1 bg-brand text-white text-sm font-semibold py-2.5 rounded-full hover:bg-brand/90 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save entry"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const user = useUser();
  const [moodLogs, setMoodLogs]     = useState<MoodLog[]>([]);
  const [journal, setJournal]       = useState<JournalEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showMood, setShowMood]     = useState(false);
  const [journalModal, setJournalModal] = useState<JournalEntry | null | "new">(null);
  const [tab, setTab]               = useState<"mood" | "journal">("mood");
  const [range, setRange]           = useState<7 | 30>(7);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [moods, entries] = await Promise.all([
          listMoodLogsAction(user.$id, 30).catch(() => [] as MoodLog[]),
          listJournalEntriesAction(20).catch(() => [] as JournalEntry[]),
        ]);
        setMoodLogs(moods);
        setJournal(entries);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function handleDeleteJournal(id: string) {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      await deleteJournalEntryAction(id);
      setJournal((prev) => prev.filter((e) => e.$id !== id));
    } catch (error) {
      console.error("Delete journal error:", error);
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-7 h-7 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  function onMoodSaved(log: MoodLog) {
    // `createdAt` is a real Date since the Postgres migration — it was an ISO
    // string compared with localeCompare, which now throws (Date has no such method).
    setMoodLogs((prev) =>
      [...prev, log].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    );
    setShowMood(false);
  }

  function onJournalSaved(entry: JournalEntry) {
    setJournal((prev) => {
      const exists = prev.findIndex((e) => e.$id === entry.$id);
      if (exists !== -1) { const c = [...prev]; c[exists] = entry; return c; }
      return [entry, ...prev];
    });
    setJournalModal(null);
  }

  // Build chart data from mood logs
  const since = new Date(); since.setDate(since.getDate() - range);
  const filtered = moodLogs.filter((m) => new Date(m.createdAt) >= since);
  const chartData = filtered.map((m) => ({
    date: new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: m.score,
    emoji: m.emoji,
  }));

  const avgScore = filtered.length
    ? (filtered.reduce((s, m) => s + m.score, 0) / filtered.length).toFixed(1)
    : "—";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {showMood && user && (
        <MoodModal userId={user.$id} onClose={() => setShowMood(false)} onSaved={onMoodSaved} />
      )}
      {journalModal !== null && user && (
        <JournalModal
          entry={journalModal === "new" ? null : journalModal}
          userId={user.$id}
          onClose={() => setJournalModal(null)}
          onSaved={onJournalSaved}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-xl font-bold text-brand">Progress</h1>
          <p className="text-sm text-stone-500 mt-0.5">Track your mood, journal, and mental health trends.</p>
        </div>
        <button onClick={() => setShowMood(true)}
          className="flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-brand/90 transition-colors">
          <Plus size={14} /> Log mood
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-2xl border border-brand/10 p-1.5 mb-6">
        {(["mood", "journal"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors capitalize
              ${tab === t ? "bg-brand text-white" : "text-stone-500 hover:text-brand hover:bg-cream"}`}>
            {t === "mood" ? "Mood Tracker" : "Journal"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 rounded-full border-2 border-brand border-t-transparent animate-spin" /></div>
      ) : tab === "mood" ? (
        <>
          {/* Mood summary */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Entries logged", value: String(filtered.length) },
              { label: `Avg mood (${range}d)`,  value: avgScore },
              { label: "Latest",        value: moodLogs.at(-1)?.emoji ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-2xl border border-brand/10 p-4 text-center">
                <p className="text-xl font-bold text-brand">{value}</p>
                <p className="text-xs text-stone-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-2xl border border-brand/10 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-brand uppercase tracking-wide">Mood trend</span>
              <div className="flex gap-1">
                {([7, 30] as const).map((r) => (
                  <button key={r} onClick={() => setRange(r)}
                    className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${range === r ? "bg-brand text-white" : "text-stone-500 hover:bg-cream"}`}>
                    {r}d
                  </button>
                ))}
              </div>
            </div>
            {chartData.length < 2 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <p className="text-sm text-stone-500">Log at least 2 moods to see a trend.</p>
                <button onClick={() => setShowMood(true)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-brand bg-brand/10 px-3 py-2 rounded-full hover:bg-brand/15 transition-colors">
                  <Plus size={11} /> Log now
                </button>
              </div>
            ) : (
              <MoodChart data={chartData} />
            )}
          </div>

          {/* Recent entries */}
          <div className="space-y-2">
            {filtered.slice().reverse().slice(0, 7).map((m) => (
              <div key={m.$id} className="bg-white rounded-2xl border border-brand/10 p-4 flex items-center gap-4">
                <span className="text-2xl">{m.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand">{m.score}/10</span>
                    {(m.tags?.length ?? 0) > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {(m.tags ?? []).slice(0, 3).map((t) => (
                          <span key={t} className="text-[10px] bg-brand/8 text-stone-500 px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {m.note && <p className="text-xs text-stone-500 mt-0.5 truncate">{m.note}</p>}
                </div>
                <span className="text-xs text-stone-400 shrink-0">
                  {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Journal tab */
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => setJournalModal("new")}
              className="flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-brand/90 transition-colors">
              <Plus size={14} /> New entry
            </button>
          </div>
          {journal.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand/8 flex items-center justify-center mb-3">
                <BookOpen size={20} className="text-stone-400" />
              </div>
              <p className="text-sm text-stone-500">No journal entries yet</p>
              <button onClick={() => setJournalModal("new")}
                className="mt-4 flex items-center gap-2 bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-brand/90 transition-colors">
                <Plus size={14} /> Write your first entry
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {journal.map((e) => (
                <div key={e.$id} className="bg-white rounded-2xl border border-brand/10 p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-xs text-stone-400">
                      {new Date(e.createdAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setJournalModal(e)} aria-label="Edit entry"
                        className="w-7 h-7 rounded-lg bg-cream hover:bg-brand/10 flex items-center justify-center transition-colors">
                        <Pencil size={12} className="text-stone-500" />
                      </button>
                      <button onClick={() => handleDeleteJournal(e.$id)} aria-label="Delete entry"
                        className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors">
                        <Trash2 size={12} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                  {e.prompt && <p className="text-xs text-stone-500 italic mb-2">💭 {e.prompt}</p>}
                  <p className="text-sm text-stone-600 leading-relaxed line-clamp-3">{e.content}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
