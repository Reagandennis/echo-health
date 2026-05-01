"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@/app/components/UserProvider";
import { 
  getProfileByUserIdAction, 
  listGoalsAction, 
  listMoodLogsAction, 
  listPatientSessionsAction, 
  listClinicalNotesAction,
  getTherapistByUserIdAction
} from "@/app/actions/database";
import { 
  User, Target, FileText, ShieldAlert, Clock, ArrowLeft, 
  ChevronRight, Calendar, MessageCircle, Info, Paperclip,
  Download, Trash2, Plus, Loader2
} from "lucide-react";
import Link from "next/link";
import { analyzeRisk, getRiskDescription, getRiskColor, type RiskLevel } from "@/lib/clinical/risk";

interface Profile { $id: string; userId: string; name: string; email: string; goal?: string; createdAt: string; }
interface Goal { $id: string; title: string; status: string; createdAt: string; milestones: string; assignedBy: string; }
interface MoodLog { $id: string; score: number; emoji: string; note?: string; tags: string[]; createdAt: string; }
interface Session { $id: string; scheduledAt: string; status: string; notes?: string; }
interface ClinicalNote { $id: string; type: "soap" | "freeform"; content: string; createdAt: string; isPrivate: boolean; }

const TABS = ["Overview", "Timeline", "Goals", "Intake", "Files"] as const;
type Tab = typeof TABS[number];

export default function ClientDetailPage() {
  const user = useUser();
  const { clientId } = useParams<{ clientId: string }>();
  const [activeTab, setTab] = useState<Tab>("Overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [moods, setMoods] = useState<MoodLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("low");

  useEffect(() => {
    if (!clientId || !user?.$id) return;
    (async () => {
      try {
        const therapist = await getTherapistByUserIdAction(user.$id);
        if (!therapist) return;

        const [pProf, gList, mList, sList, nList] = await Promise.all([
          getProfileByUserIdAction(clientId),
          listGoalsAction(clientId),
          listMoodLogsAction(clientId, 30),
          listPatientSessionsAction(clientId),
          listClinicalNotesAction(therapist.$id, clientId),
        ]);
        
        setProfile(pProf as unknown as Profile);
        setGoals(gList as unknown as Goal[]);
        setMoods(mList as unknown as MoodLog[]);
        setSessions(sList as unknown as Session[]);
        setNotes(nList as unknown as ClinicalNote[]);

        // Analyze Risk
        const allText = [
          pProf?.goal ?? "",
          ...(mList as unknown as MoodLog[]).map(m => m.note ?? ""),
          ...(nList as unknown as ClinicalNote[]).map(n => n.content)
        ].join(" ");
        setRiskLevel(analyzeRisk(allText));

      } catch (error) {
        console.error("Fetch client detail error:", error);
      }
      setLoading(false);
    })();
  }, [clientId, user?.$id]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
    </div>
  );

  if (!profile) return (
    <div className="p-12 text-center">
      <p className="text-stone-500">Client profile not found.</p>
      <Link href="/therapist/clients" className="text-brand font-semibold mt-4 inline-block">Back to Clients</Link>
    </div>
  );

  const avgMood = moods.length ? (moods.reduce((a, m) => a + m.score, 0) / moods.length).toFixed(1) : "—";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Breadcrumbs & Risk Badge */}
      <div className="flex items-center justify-between">
        <Link href="/therapist/clients" className="flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-brand transition-colors">
          <ArrowLeft size={16} /> All Clients
        </Link>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${getRiskColor(riskLevel)}`}>
          <ShieldAlert size={14} />
          {riskLevel} Risk Detected
        </div>
      </div>

      {/* Profile Header */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 flex flex-col md:flex-row items-center gap-8">
        <div className="w-24 h-24 rounded-3xl bg-brand/10 text-brand flex items-center justify-center font-bold text-4xl shrink-0">
          {profile.name.charAt(0)}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold text-stone-900">{profile.name}</h1>
          <p className="text-stone-500">{profile.email}</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-4">
            <span className="text-xs font-semibold bg-stone-100 text-stone-600 px-3 py-1 rounded-full">Client since {new Date(profile.createdAt).toLocaleDateString()}</span>
            {profile.goal && <span className="text-xs font-semibold bg-brand/5 text-brand px-3 py-1 rounded-full">Goal: {profile.goal}</span>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-8 px-8 py-4 bg-stone-50 rounded-2xl border border-stone-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-stone-900">{sessions.length}</p>
            <p className="text-[10px] font-bold text-stone-400 uppercase">Sessions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-stone-900">{goals.length}</p>
            <p className="text-[10px] font-bold text-stone-400 uppercase">Goals</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-stone-900">{avgMood}</p>
            <p className="text-[10px] font-bold text-stone-400 uppercase">Avg Mood</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Tabs Sidebar */}
        <div className="lg:col-span-1 space-y-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === t 
                  ? "bg-brand text-white shadow-lg shadow-brand/20 translate-x-1" 
                  : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <div className="flex items-center gap-3">
                {t === "Overview" && <Info size={18} />}
                {t === "Timeline" && <Clock size={18} />}
                {t === "Goals" && <Target size={18} />}
                {t === "Intake" && <FileText size={18} />}
                {t === "Files" && <Paperclip size={18} />}
                {t}
              </div>
              <ChevronRight size={14} className={activeTab === t ? "opacity-100" : "opacity-0"} />
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="lg:col-span-3">
          {activeTab === "Overview" && <OverviewTab profile={profile} moods={moods} riskLevel={riskLevel} />}
          {activeTab === "Timeline" && <TimelineTab sessions={sessions} notes={notes} />}
          {activeTab === "Goals" && <GoalsTab goals={goals} />}
          {activeTab === "Intake" && <IntakeTab profile={profile} />}
          {activeTab === "Files" && <FilesTab />}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OverviewTab({ profile, moods, riskLevel }: { profile: Profile, moods: MoodLog[], riskLevel: RiskLevel }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Risk Alert */}
      {riskLevel !== "low" && (
        <div className={`p-5 rounded-2xl border flex items-start gap-4 ${getRiskColor(riskLevel)}`}>
          <ShieldAlert size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Clinical Risk Alert: {riskLevel.toUpperCase()}</p>
            <p className="text-xs mt-1 opacity-90">{getRiskDescription(riskLevel)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Mood */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-stone-800 text-sm">Recent Mood Logs</h3>
            <Link href="#" className="text-[10px] font-bold text-brand uppercase hover:underline">View All</Link>
          </div>
          <div className="space-y-4">
            {moods.slice(0, 5).map((m) => (
              <div key={m.$id} className="flex items-center gap-4">
                <span className="text-2xl shrink-0">{m.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-stone-800">{m.score}/10 — {m.tags.slice(0, 2).join(", ")}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{new Date(m.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {moods.length === 0 && <p className="text-xs text-stone-400 text-center py-4">No mood data available.</p>}
          </div>
        </div>

        {/* Clinical Summary */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="font-bold text-stone-800 text-sm mb-4">Initial Concern</h3>
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
            <p className="text-sm text-stone-600 leading-relaxed italic">
              &ldquo;{profile.goal || "No initial concern provided."}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ sessions, notes }: { sessions: Session[], notes: ClinicalNote[] }) {
  // Merge and sort timeline items
  const timeline = [
    ...sessions.map(s => ({ type: 'session' as const, date: s.scheduledAt, data: s })),
    ...notes.map(n => ({ type: 'note' as const, date: n.createdAt, data: n }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-stone-800 text-sm">Clinical Timeline</h3>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition-colors">
          <Plus size={14} /> New Note
        </button>
      </div>

      <div className="relative border-l-2 border-stone-100 ml-3 space-y-8">
        {timeline.map((item, idx) => (
          <div key={idx} className="relative pl-8">
            <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
              item.type === 'session' ? 'bg-brand' : 'bg-stone-900'
            }`} />
            
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-stone-400 uppercase">
                {new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 hover:border-stone-200 transition-colors group cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {item.type === 'session' ? <Calendar size={14} className="text-brand" /> : <FileText size={14} className="text-stone-900" />}
                    <p className="text-sm font-bold text-stone-800">
                      {item.type === 'session' ? `Therapy Session (#${item.data.$id.slice(-4)})` : `${(item.data as ClinicalNote).type.toUpperCase()} Note`}
                    </p>
                  </div>
                  {item.type === 'note' && (item.data as ClinicalNote).isPrivate && (
                    <span className="text-[9px] font-bold bg-stone-200 text-stone-500 px-2 py-0.5 rounded-full uppercase">Private</span>
                  )}
                </div>
                <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                  {item.type === 'session' ? (item.data as Session).status : (item.data as ClinicalNote).content}
                </p>
              </div>
            </div>
          </div>
        ))}
        {timeline.length === 0 && <p className="text-sm text-stone-400 text-center py-12">No activity recorded yet.</p>}
      </div>
    </div>
  );
}

function GoalsTab({ goals }: { goals: Goal[] }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-stone-800 text-sm">Treatment Goals</h3>
        <button className="text-xs font-bold text-brand hover:underline">+ New Goal</button>
      </div>
      <div className="grid gap-4">
        {goals.map((g) => (
          <div key={g.$id} className="bg-white rounded-2xl border border-stone-200 p-5 hover:border-brand/30 transition-colors group">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand/5 text-brand flex items-center justify-center shrink-0 mt-0.5">
                  <Target size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900">{g.title}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      g.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-brand/10 text-brand'
                    }`}>
                      {g.status}
                    </span>
                    <span className="text-[10px] text-stone-400 font-medium">Assigned by {g.assignedBy}</span>
                  </div>
                </div>
              </div>
              <button className="p-2 rounded-lg hover:bg-stone-50 opacity-0 group-hover:opacity-100 transition-all">
                <ChevronRight size={16} className="text-stone-400" />
              </button>
            </div>
          </div>
        ))}
        {goals.length === 0 && <p className="text-sm text-stone-400 text-center py-12">No goals have been set for this client.</p>}
      </div>
    </div>
  );
}

function IntakeTab({ profile }: { profile: Profile }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
          <FileText size={20} />
        </div>
        <div>
          <h3 className="font-bold text-stone-800 text-sm">Initial Intake Form</h3>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Submitted on {new Date(profile.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
      
      <div className="grid gap-8">
        <div className="space-y-2">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Primary Reason for Seeking Help</p>
          <p className="text-sm text-stone-700 leading-relaxed bg-stone-50 p-4 rounded-xl border border-stone-100">{profile.goal || "Not specified."}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Mental Health History</p>
            <p className="text-sm text-stone-500 italic">No history documented in intake.</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Current Medications</p>
            <p className="text-sm text-stone-500 italic">No medications documented.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilesTab() {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-8 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-stone-800 text-sm">Client Attachments</h3>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200 transition-colors">
          <Plus size={14} /> Upload File
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between p-4 rounded-xl border border-stone-100 hover:border-stone-200 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-800">Consent_Form_Signed.pdf</p>
              <p className="text-[10px] text-stone-400">1.2 MB · Uploaded May 12</p>
            </div>
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-2 hover:bg-stone-50 rounded-lg text-stone-400"><Download size={16} /></button>
            <button className="p-2 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={16} /></button>
          </div>
        </div>
        <p className="text-xs text-stone-400 text-center py-12 italic">Only PDF and image files are supported for clinical documentation.</p>
      </div>
    </div>
  );
}
