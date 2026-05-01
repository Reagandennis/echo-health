"use client";

import { useState } from "react";
import { Plus, Target, BookOpen, CheckCircle, Clock, Trash2 } from "lucide-react";

interface Goal { id: string; title: string; category: string; status: "not-started" | "in-progress" | "completed"; }
interface Homework { id: string; task: string; dueDate: string; completed: boolean; }

const CATEGORIES = ["Anxiety", "Depression", "CBT", "Mindfulness", "Relationships", "Trauma", "Sleep", "Other"];

export default function TreatmentPage() {
  const [goals, setGoals] = useState<Goal[]>([
    { id: "1", title: "Reduce weekly panic attacks from 5 to 1", category: "Anxiety", status: "in-progress" },
    { id: "2", title: "Practice daily grounding exercises", category: "Mindfulness", status: "not-started" },
  ]);
  const [homework, setHomework] = useState<Homework[]>([
    { id: "1", task: "Complete thought record worksheet", dueDate: "2025-08-01", completed: false },
  ]);
  const [newGoal, setNewGoal] = useState({ title: "", category: "Anxiety" });
  const [newHw, setNewHw] = useState({ task: "", dueDate: "" });
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showHwForm, setShowHwForm] = useState(false);

  function addGoal() {
    if (!newGoal.title.trim()) return;
    setGoals((g) => [...g, { id: Date.now().toString(), title: newGoal.title, category: newGoal.category, status: "not-started" }]);
    setNewGoal({ title: "", category: "Anxiety" });
    setShowGoalForm(false);
  }

  function addHw() {
    if (!newHw.task.trim()) return;
    setHomework((h) => [...h, { id: Date.now().toString(), task: newHw.task, dueDate: newHw.dueDate, completed: false }]);
    setNewHw({ task: "", dueDate: "" });
    setShowHwForm(false);
  }

  function cycleStatus(id: string) {
    setGoals((g) => g.map((goal) => {
      if (goal.id !== id) return goal;
      const next: Record<string, Goal["status"]> = { "not-started": "in-progress", "in-progress": "completed", "completed": "not-started" };
      return { ...goal, status: next[goal.status] };
    }));
  }

  function deleteGoal(id: string) { setGoals((gs) => gs.filter((x) => x.id !== id)); }
  function toggleHw(id: string) { setHomework((hw) => hw.map((x) => x.id === id ? { ...x, completed: !x.completed } : x)); }
  function deleteHw(id: string) { setHomework((hw) => hw.filter((x) => x.id !== id)); }

  const STATUS_STYLE: Record<Goal["status"], string> = {
    "not-started": "bg-stone-100 text-stone-500",
    "in-progress": "bg-brand/10 text-brand",
    "completed": "bg-green-100 text-green-700",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-stone-900">Treatment Plan</h1>

      {/* Goals */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-brand" />
            <h2 className="text-lg font-semibold text-stone-800">Therapeutic Goals</h2>
          </div>
          <button onClick={() => setShowGoalForm((v) => !v)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={14} /> Add goal
          </button>
        </div>
        {showGoalForm && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3 shadow-sm">
            <input value={newGoal.title} onChange={(e) => setNewGoal((g) => ({ ...g, title: e.target.value }))} placeholder="Goal description…"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <select value={newGoal.category} onChange={(e) => setNewGoal((g) => ({ ...g, category: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand bg-white">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowGoalForm(false)} className="px-4 py-2 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50">Cancel</button>
              <button onClick={addGoal} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90">Add</button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {goals.map((g) => (
            <div key={g.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 flex items-center gap-4">
              <button onClick={() => cycleStatus(g.id)} className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${STATUS_STYLE[g.status]}`}>{g.status.replace("-", " ")}</button>
              <p className="flex-1 text-sm text-stone-800">{g.title}</p>
              <span className="text-xs text-stone-400 bg-stone-50 px-2 py-0.5 rounded-full">{g.category}</span>
              <button onClick={() => deleteGoal(g.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={13} className="text-red-400" /></button>
            </div>
          ))}
          {goals.length === 0 && <p className="text-sm text-stone-400 py-4 text-center">No goals added yet</p>}
        </div>
      </section>

      {/* Homework */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand" />
            <h2 className="text-lg font-semibold text-stone-800">Homework Assignments</h2>
          </div>
          <button onClick={() => setShowHwForm((v) => !v)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={14} /> Assign
          </button>
        </div>
        {showHwForm && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3 shadow-sm">
            <input value={newHw.task} onChange={(e) => setNewHw((h) => ({ ...h, task: e.target.value }))} placeholder="Task description…"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input type="date" value={newHw.dueDate} onChange={(e) => setNewHw((h) => ({ ...h, dueDate: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand bg-white" />
            <div className="flex gap-2">
              <button onClick={() => setShowHwForm(false)} className="px-4 py-2 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50">Cancel</button>
              <button onClick={addHw} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90">Assign</button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {homework.map((h) => (
            <div key={h.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 flex items-center gap-4">
              <button onClick={() => toggleHw(h.id)}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${h.completed ? "bg-green-500 border-green-500" : "border-stone-300"}`}>
                {h.completed && <CheckCircle size={12} className="text-white" />}
              </button>
              <p className={`flex-1 text-sm ${h.completed ? "line-through text-stone-400" : "text-stone-800"}`}>{h.task}</p>
              {h.dueDate && (
                <span className="flex items-center gap-1 text-xs text-stone-400">
                  <Clock size={11} /> {new Date(h.dueDate).toLocaleDateString()}
                </span>
              )}
              <button onClick={() => deleteHw(h.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={13} className="text-red-400" /></button>
            </div>
          ))}
          {homework.length === 0 && <p className="text-sm text-stone-400 py-4 text-center">No homework assigned yet</p>}
        </div>
      </section>
    </div>
  );
}
