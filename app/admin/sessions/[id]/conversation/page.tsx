import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { ShieldAlert, Flag } from "lucide-react";

const MOCK_MSGS = [
  { from: "Client", content: "I've been feeling much better since our last session.", flagged: false, time: "10:02 AM" },
  { from: "Therapist", content: "That's wonderful to hear! What specific changes have you noticed?", flagged: false, time: "10:04 AM" },
  { from: "Client", content: "I feel less anxious at work and I've been sleeping better.", flagged: false, time: "10:06 AM" },
  { from: "Therapist", content: "Excellent progress. Let's continue building on the techniques we discussed.", flagged: false, time: "10:08 AM" },
];

export default async function SessionConversationPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  return (
    <div>
      <AdminPageHeader
        title="Conversation Review"
        description="Read-only restricted view of session messages."
        breadcrumbs={[{ label: "Sessions", href: "/admin/sessions" }, { label: id.slice(0, 10) + "…", href: `/admin/sessions/${id}` }, { label: "Conversation" }]}
      />

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700">
          <strong>Restricted access.</strong> This conversation is visible for compliance and safety review only. All access is logged.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
        {MOCK_MSGS.map((msg, i) => (
          <div key={i} className={`rounded-xl p-4 ${msg.flagged ? "bg-rose-50 border border-rose-200" : msg.from === "Client" ? "bg-stone-50" : "bg-teal-50"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${msg.from === "Therapist" ? "text-teal-600" : "text-stone-500"}`}>{msg.from}</span>
              <div className="flex items-center gap-2">
                {msg.flagged && <span className="flex items-center gap-1 text-[11px] text-rose-600 font-semibold"><Flag className="w-3 h-3" /> Flagged</span>}
                <span className="text-[11px] text-stone-400">{msg.time}</span>
              </div>
            </div>
            <p className="text-sm text-stone-800">{msg.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
