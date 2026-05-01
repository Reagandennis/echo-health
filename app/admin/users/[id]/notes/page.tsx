import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import { FileText, Clock, EyeOff } from "lucide-react";

const MOCK_NOTES = [
  {
    id: "1",
    author: "Dr. Patel",
    date: "2026-04-18T10:00:00Z",
    type: "soap",
    isPrivate: false,
    summary: "Client expressed progress in managing anxiety triggers. Homework: breathing exercises 2x daily.",
  },
  {
    id: "2",
    author: "Dr. Patel",
    date: "2026-04-11T10:00:00Z",
    type: "freeform",
    isPrivate: false,
    summary: "Discussed childhood experiences relating to abandonment. Client showed emotional resilience.",
  },
  {
    id: "3",
    author: "Dr. Patel",
    date: "2026-04-04T10:00:00Z",
    type: "soap",
    isPrivate: true,
    summary: "[Private note — not visible to admin]",
  },
];

export default async function ClientNotesPage({
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

  const visibleNotes = MOCK_NOTES.filter((n) => !n.isPrivate);

  return (
    <div>
      <AdminPageHeader
        title="Clinical Notes"
        description="Admin-visible notes only. Private therapist notes are excluded."
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: client.name, href: `/admin/users/${id}` },
          { label: "Notes" },
        ]}
      />

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
        <EyeOff className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          {MOCK_NOTES.length - visibleNotes.length} private note(s) are hidden. Private notes are visible only to the authoring therapist.
        </p>
      </div>

      <div className="space-y-4">
        {visibleNotes.map((note) => (
          <div key={note.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold">
                  {note.author.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">{note.author}</p>
                  <div className="flex items-center gap-1 text-xs text-stone-400">
                    <Clock className="w-3 h-3" />
                    {new Date(note.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <AdminBadge label={note.type.toUpperCase()} variant="info" />
                <AdminBadge label="Admin Visible" variant="teal" />
              </div>
            </div>
            <div className="flex items-start gap-2 bg-stone-50 rounded-xl p-4">
              <FileText className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-stone-700 leading-relaxed">{note.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
