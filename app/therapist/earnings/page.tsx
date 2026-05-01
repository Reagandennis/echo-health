"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/components/UserProvider";
import { getTherapistByUserIdAction, listTherapistSessionsAction } from "@/app/actions/database";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DollarSign, TrendingUp, CreditCard, Loader2 } from "lucide-react";

interface Session { $id: string; scheduledAt: string; status: string; amount?: number; }

const SESSION_RATE = 75; // default $/session

function groupByMonth(sessions: Session[]) {
  const map: Record<string, number> = {};
  sessions.forEach((s) => {
    const key = new Date(s.scheduledAt).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    map[key] = (map[key] ?? 0) + (s.amount ?? SESSION_RATE);
  });
  return Object.entries(map).map(([month, earnings]) => ({ month, earnings }));
}

export default function EarningsPage() {
  const user = useUser();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const therapist = await getTherapistByUserIdAction(user.$id);
        if (!therapist) return;
        const res = await listTherapistSessionsAction(therapist.$id);
        setSessions(res as unknown as Session[]);
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, [user]);

  const completed = sessions.filter((s) => s.status === "completed");
  const totalEarnings = completed.reduce((a, s) => a + (s.amount ?? SESSION_RATE), 0);
  const thisMonth = completed.filter((s) => {
    const d = new Date(s.scheduledAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((a, s) => a + (s.amount ?? SESSION_RATE), 0);
  const chartData = groupByMonth(completed);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Earnings</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total earned", value: `$${totalEarnings.toLocaleString()}`, icon: DollarSign, color: "text-green-600 bg-green-50" },
          { label: "This month", value: `$${thisMonth.toLocaleString()}`, icon: TrendingUp, color: "text-brand bg-brand/10" },
          { label: "Sessions completed", value: completed.length.toString(), icon: CreditCard, color: "text-purple-600 bg-purple-50" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
              <c.icon size={18} />
            </div>
            <div>
              <p className="text-xl font-bold text-stone-900">{c.value}</p>
              <p className="text-xs text-stone-400">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <h2 className="font-semibold text-stone-800 mb-4">Monthly Earnings</h2>
        {chartData.length === 0 ? (
          <div className="py-12 text-center text-sm text-stone-400">No completed sessions yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#35858E" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#35858E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#a8a29e" }} />
              <YAxis tick={{ fontSize: 11, fill: "#a8a29e" }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }} formatter={(v) => [`$${v as number}`, "Earnings"]} />
              <Area type="monotone" dataKey="earnings" stroke="#35858E" strokeWidth={2} fill="url(#earningsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Session log */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-800">Completed Sessions</h2>
        </div>
        {completed.length === 0 ? (
          <div className="py-10 text-center text-sm text-stone-400">No completed sessions</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {completed.slice(0, 20).map((s) => (
              <div key={s.$id} className="flex items-center justify-between px-6 py-3 text-sm">
                <span className="text-stone-700">{new Date(s.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="font-semibold text-green-700">${s.amount ?? SESSION_RATE}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
