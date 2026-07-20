import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import { getProfileByUserId, listAdminVisibleNotes } from "../../../_lib/queries";
import { FileText, Clock, EyeOff } from "lucide-react";

/**
 * Unlike its sibling sub-pages, this one is now backed by real data: the mock
 * array it used to render was a stand-in for the `clinical_notes` table, which
 * exists and carries every field the layout needs. Private notes are excluded
 * in the query (see `listAdminVisibleNotes`), not merely hidden in the markup.
 */
export default async function ClientNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  const client = await getProfileByUserId(id);
  if (!client) notFound();

  const { notes, privateCount } = await listAdminVisibleNotes(id);

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

      {privateCount > 0 && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
          <EyeOff className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            {privateCount} private note(s) are hidden. Private notes are visible only to the authoring therapist.
          </p>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="text-center py-20 text-stone-400 text-sm">
          No admin-visible notes for this client.
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.$id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold">
                    {note.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{note.authorName}</p>
                    <div className="flex items-center gap-1 text-xs text-stone-400">
                      <Clock className="w-3 h-3" />
                      {note.createdAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
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
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
