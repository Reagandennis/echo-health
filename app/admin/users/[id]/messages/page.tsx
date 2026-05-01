import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { ShieldAlert, Flag } from "lucide-react";

const MOCK_MESSAGES = [
  { id: "1", from: "Client", content: "I've been feeling really overwhelmed lately...", time: "2026-04-22T09:15:00Z", flagged: false },
  { id: "2", from: "Therapist", content: "I hear you. Let's talk through this together. Can you tell me more about what's been triggering these feelings?", time: "2026-04-22T09:18:00Z", flagged: false },
  { id: "3", from: "Client", content: "Sometimes I just feel like giving up on everything.", time: "2026-04-22T09:22:00Z", flagged: true },
  { id: "4", from: "Therapist", content: "Thank you for sharing that with me. Are you having thoughts of harming yourself?", time: "2026-04-22T09:25:00Z", flagged: false },
  { id: "5", from: "Client", content: "No, not like that. I just mean I'm exhausted.", time: "2026-04-22T09:27:00Z", flagged: false },
];

export default async function ClientMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;
  const { users } = createAdminClient();
  let client;
  try { client = await users.get(id); } catch { notFound(); }

  return (
    <div>
      <AdminPageHeader
        title="Messages (Restricted View)"
        description="Read-only admin view. Flagged messages are highlighted."
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: client.name, href: `/admin/users/${id}` },
          { label: "Messages" },
        ]}
      />

      {/* Warning banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Restricted Access</p>
          <p className="text-xs text-amber-600 mt-0.5">
            This view is for compliance and safety review only. All access is logged.
            Do not share the contents of these messages outside authorised channels.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-800">Conversation Thread</h3>
          <span className="text-[11px] bg-rose-100 text-rose-700 px-2 py-1 rounded-full font-semibold">
            1 flagged message
          </span>
        </div>
        <div className="p-5 space-y-4">
          {MOCK_MESSAGES.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl p-4 ${
                msg.flagged
                  ? "bg-rose-50 border border-rose-200"
                  : msg.from === "Client"
                  ? "bg-stone-50 border border-stone-100"
                  : "bg-teal-50 border border-teal-100"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  msg.from === "Client" ? "text-stone-500" : "text-teal-600"
                }`}>
                  {msg.from}
                </span>
                <div className="flex items-center gap-2">
                  {msg.flagged && (
                    <span className="flex items-center gap-1 text-[11px] text-rose-600 font-semibold">
                      <Flag className="w-3 h-3" /> Flagged
                    </span>
                  )}
                  <span className="text-[11px] text-stone-400">
                    {new Date(msg.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
              <p className="text-sm text-stone-800">{msg.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
