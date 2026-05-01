"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/components/UserProvider";
import { getTherapistByUserIdAction, listAllMoodLogsAction } from "@/app/actions/database";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ClipboardList, TrendingUp, Loader2 } from "lucide-react";

interface MoodLog { $id: string; score: number; note?: string; userId: string; createdAt: string; }

// PHQ-9 questions
const PHQ9 = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things",
  "Moving or speaking so slowly; or being fidgety / restless",
  "Thoughts that you would be better off dead",
];

const GAD7 = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid, as if something awful might happen",
];

function scoreLabel(score: number, max: number) {
  const pct = score / max;
  if (pct < 0.25) return { label: "Minimal", color: "text-green-600 bg-green-50" };
  if (pct < 0.5) return { label: "Mild", color: "text-yellow-600 bg-yellow-50" };
  if (pct < 0.75) return { label: "Moderate", color: "text-orange-600 bg-orange-50" };
  return { label: "Severe", color: "text-red-600 bg-red-50" };
}

export default function AssessmentsPage() {
  const user = useUser();
  const [moods, setMoods] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [phq9Answers, setPhq9Answers] = useState<number[]>(new Array(9).fill(0) as number[]);
  const [gad7Answers, setGad7Answers] = useState<number[]>(new Array(7).fill(0) as number[]);
  const [activeTab, setActiveTab] = useState<"Mood" | "PHQ-9" | "GAD-7">("Mood");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const therapist = await getTherapistByUserIdAction(user.$id);
        if (!therapist) return;
        const res = await listAllMoodLogsAction(30);
        setMoods(res as unknown as MoodLog[]);
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, [user]);

  function setPhq9(i: number, v: number) { setPhq9Answers((a) => { const n = [...a]; n[i] = v; return n; }); }
  function setGad7(i: number, v: number) { setGad7Answers((a) => { const n = [...a]; n[i] = v; return n; }); }

  const phq9Score = phq9Answers.reduce((a, b) => a + b, 0);
  const gad7Score = gad7Answers.reduce((a, b) => a + b, 0);

  const chartData = moods.map((m) => ({
    date: new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: m.score,
  }));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Assessments</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {(["Mood", "PHQ-9", "GAD-7"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === "Mood" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-brand" />
            <h2 className="font-semibold text-stone-800">Client Mood Trends</h2>
          </div>
          {chartData.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-400">No mood data logged yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a8a29e" }} />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: "#a8a29e" }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }} />
                <Bar dataKey="score" fill="#35858E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {activeTab === "PHQ-9" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-brand" />
              <h2 className="font-semibold text-stone-800">PHQ-9 Depression Scale</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-stone-900">{phq9Score}/27</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${scoreLabel(phq9Score, 27).color}`}>{scoreLabel(phq9Score, 27).label}</span>
            </div>
          </div>
          <div className="space-y-4">
            {PHQ9.map((q, i) => (
              <div key={q} className="space-y-2">
                <p className="text-sm text-stone-700">{i + 1}. {q}</p>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((v) => (
                    <button key={v} onClick={() => setPhq9(i, v)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${phq9Answers[i] === v ? "bg-brand text-white border-brand" : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"}`}>
                      {["Not at all", "Several days", "More than half", "Nearly every day"][v]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "GAD-7" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-brand" />
              <h2 className="font-semibold text-stone-800">GAD-7 Anxiety Scale</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-stone-900">{gad7Score}/21</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${scoreLabel(gad7Score, 21).color}`}>{scoreLabel(gad7Score, 21).label}</span>
            </div>
          </div>
          <div className="space-y-4">
            {GAD7.map((q, i) => (
              <div key={q} className="space-y-2">
                <p className="text-sm text-stone-700">{i + 1}. {q}</p>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((v) => (
                    <button key={v} onClick={() => setGad7(i, v)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${gad7Answers[i] === v ? "bg-brand text-white border-brand" : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"}`}>
                      {["Not at all", "Several days", "More than half", "Nearly every day"][v]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
