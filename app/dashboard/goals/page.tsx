"use client";

import { useEffect, useState } from "react";
import { Plus, X, CheckCircle2, Circle, ChevronDown, ChevronUp, Target } from "lucide-react";
import { 
  listGoalsAction, 
  createGoalAction, 
  updateGoalAction 
} from "@/app/actions/database";
import type { Goal, GoalMilestone } from "@/lib/appwrite/database";
import { useUser } from "@/app/components/UserProvider";

function parseMilestones(raw: string): GoalMilestone[] {
  try { return JSON.parse(raw) as GoalMilestone[]; }
  catch { return []; }
}

function GoalCard({ goal, onUpdate }: { readonly goal: Goal; readonly onUpdate: (g: Goal) => void }) {
  const [expanded, setExpanded] = useState(false);
  const milestones = parseMilestones(goal.milestones);
  const done = milestones.filter((m) => m.completed).length;
  const pct = milestones.length ? Math.round((done / milestones.length) * 100) : 0;
  const isComplete = !!goal.completedAt;

  async function toggleMilestone(idx: number) {
    const updated = milestones.map((m, i) => i === idx ? { ...m, completed: !m.completed } : m);
    const allDone = updated.every((m) => m.completed);
    try {
      const g = await updateGoalAction(goal.$id, {
        milestones: JSON.stringify(updated),
        completedAt: allDone ? new Date().toISOString() : null,
      });
      onUpdate(g);
    } catch (error) {
      console.error("Update goal error:", error);
    }
  }

  return (
    <div className={`bg-white rounded-2xl border p-5 ${isComplete ? "border-emerald-200" : "border-brand/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isComplete ? "bg-emerald-50" : "bg-brand/8"}`}>
            {isComplete
              ? <CheckCircle2 size={17} className="text-emerald-500" />
              : <Target size={17} className="text-brand" />}
          </div>
          <div>
            <p className={`text-sm font-bold ${isComplete ? "text-emerald-700 line-through" : "text-brand"}`}>{goal.title}</p>
            {goal.description && <p className="text-xs text-brand/45 mt-0.5">{goal.description}</p>}
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${goal.assignedBy === "therapist" ? "bg-brand/10 text-brand" : "bg-cream text-brand/60"}`}>
                {goal.assignedBy === "therapist" ? "Therapist assigned" : "Self-set"}
              </span>
              {milestones.length > 0 && (
                <span className="text-xs text-brand/35">{done}/{milestones.length} steps</span>
              )}
            </div>
          </div>
        </div>
        {milestones.length > 0 && (
          <button onClick={() => setExpanded((v) => !v)} className="text-brand/40 hover:text-brand transition-colors mt-1" aria-label="Toggle milestones">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>
      {/* Progress bar */}
      {milestones.length > 0 && (
        <div className="mt-3">
          <div className="w-full bg-cream rounded-full h-1.5">
            <div className="bg-brand h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-brand/35 mt-1">{pct}% complete</p>
        </div>
      )}
      {/* Milestones */}
      {expanded && milestones.length > 0 && (
        <div className="mt-4 space-y-2">
          {milestones.map((m, i) => (
            <button key={m.title} onClick={() => void toggleMilestone(i)}
              className="w-full flex items-center gap-3 text-left group">
              {m.completed
                ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                : <Circle size={16} className="text-brand/25 group-hover:text-brand/50 transition-colors shrink-0" />}
              <span className={`text-sm ${m.completed ? "text-brand/40 line-through" : "text-brand/75"}`}>{m.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddGoalModal({ onClose, onSaved, userId }: {
  readonly onClose: () => void;
  readonly onSaved: (g: Goal) => void;
  readonly userId: string;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc]   = useState("");
  const [milestones, setMilestones] = useState<{ id: string; text: string }[]>([{ id: "ms-0", text: "" }]);
  const [saving, setSaving] = useState(false);

  function addMilestone() { setMilestones((p) => [...p, { id: crypto.randomUUID(), text: "" }]); }
  function updateMilestone(id: string, v: string) {
    setMilestones((p) => p.map((x) => x.id === id ? { ...x, text: v } : x));
  }
  function removeMilestone(id: string) {
    setMilestones((p) => p.filter((x) => x.id !== id));
  }

  async function handleSave() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const ms: GoalMilestone[] = milestones.filter((m) => m.text.trim()).map((m) => ({ title: m.text, completed: false }));
      const g = await createGoalAction({
        userId,
        title,
        description: desc,
        milestones: JSON.stringify(ms),
        assignedBy: "self",
        createdAt: new Date().toISOString(),
      });
      onSaved(g);
    } catch (error) {
      console.error("Create goal error:", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog open className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent m-0 max-w-none max-h-none w-full h-full">
      <button type="button" className="absolute inset-0 w-full h-full bg-brand/20 backdrop-blur-sm cursor-default" onClick={onClose} aria-label="Close" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-brand">New goal</h2>
          <button onClick={onClose} className="text-brand/40 hover:text-brand transition-colors" aria-label="Close"><X size={17} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="goal-title" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">Goal</label>
            <input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Reduce anxiety in social situations"
              className="w-full rounded-xl border border-brand/15 px-3 py-2.5 text-sm text-brand placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
          <div>
            <label htmlFor="goal-desc" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">
              Description <span className="normal-case font-normal text-brand/35">(optional)</span>
            </label>
            <textarea id="goal-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
              placeholder="Why is this goal important to you?"
              className="w-full rounded-xl border border-brand/15 px-3 py-2.5 text-sm text-brand placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-brand/60 uppercase tracking-wide">Milestones</span>
              <button type="button" onClick={addMilestone} className="text-xs text-brand hover:text-brand/70 transition-colors flex items-center gap-1">
                <Plus size={11} /> Add step
              </button>
            </div>
            <div className="space-y-2">
              {milestones.map((m) => (
                <div key={m.id} className="flex gap-2">
                  <input value={m.text} onChange={(e) => updateMilestone(m.id, e.target.value)}
                    placeholder="Step description"
                    className="flex-1 rounded-xl border border-brand/15 px-3 py-2 text-sm text-brand placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/30" />
                  <button type="button" onClick={() => removeMilestone(m.id)} aria-label="Remove step"
                    className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors text-red-400">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => void handleSave()} disabled={!title.trim() || saving}
            className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? "Saving…" : "Create goal"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function GoalsPage() {
  const user = useUser();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "completed">("active");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const g = await listGoalsAction(user.$id).catch(() => [] as Goal[]);
        setGoals(g);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  function onGoalSaved(g: Goal) { setGoals((prev) => [g, ...prev]); setShowAdd(false); }
  function onGoalUpdated(g: Goal) { setGoals((prev) => prev.map((x) => x.$id === g.$id ? g : x)); }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-7 h-7 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  const active    = goals.filter((g) => !g.completedAt);
  const completed = goals.filter((g) => !!g.completedAt);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {showAdd && user && <AddGoalModal userId={user.$id} onClose={() => setShowAdd(false)} onSaved={onGoalSaved} />}

      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-xl font-bold text-brand">Goals</h1>
          <p className="text-sm text-brand/45 mt-0.5">{active.length} active · {completed.length} completed</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-brand/90 transition-colors">
          <Plus size={14} /> New goal
        </button>
      </div>

      <div className="flex gap-1 bg-white rounded-2xl border border-brand/10 p-1.5 mb-5">
        {(["active", "completed"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors
              ${tab === t ? "bg-brand text-white" : "text-brand/50 hover:text-brand hover:bg-cream"}`}>
            {t} ({t === "active" ? active.length : completed.length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 rounded-full border-2 border-brand border-t-transparent animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {(tab === "active" ? active : completed).length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand/8 flex items-center justify-center mb-3">
                <Target size={20} className="text-brand/30" />
              </div>
              <p className="text-sm text-brand/50">No {tab} goals</p>
              {tab === "active" && (
                <button onClick={() => setShowAdd(true)}
                  className="mt-4 flex items-center gap-2 bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-brand/90 transition-colors">
                  <Plus size={14} /> Set your first goal
                </button>
              )}
            </div>
          ) : (
            (tab === "active" ? active : completed).map((g) => (
              <GoalCard key={g.$id} goal={g} onUpdate={onGoalUpdated} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
