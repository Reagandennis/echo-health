import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { getProfileByUserId } from "../../../_lib/queries";
import { Save } from "lucide-react";

/**
 * The form below is display-only — it has no action, no client component and no
 * submit handler, and never did. Name and email are prefilled from `profiles`;
 * the phone, account-status and admin-notes fields have no column to bind to.
 * Account status in particular is an Auth0 concern now, not a database one.
 */

export default async function ClientEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  const client = await getProfileByUserId(id);
  if (!client) notFound();

  return (
    <div>
      <AdminPageHeader
        title="Edit Client Profile"
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: client.name, href: `/admin/users/${id}` },
          { label: "Edit" },
        ]}
      />

      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
          {[
            { label: "Full Name", id: "name", type: "text", value: client.name },
            { label: "Email Address", id: "email", type: "email", value: client.email },
            { label: "Phone Number", id: "phone", type: "tel", value: "" },
          ].map((field) => (
            <div key={field.id}>
              <label htmlFor={field.id} className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">
                {field.label}
              </label>
              <input
                id={field.id}
                type={field.type}
                defaultValue={field.value}
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">
              Account Status
            </label>
            <select className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">
              Admin Notes
            </label>
            <textarea
              rows={3}
              placeholder="Internal notes about this client…"
              className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors">
              <Save className="w-4 h-4" /> Save Changes
            </button>
            <button className="px-5 py-2.5 text-sm font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
