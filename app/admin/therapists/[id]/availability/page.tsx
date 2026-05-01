import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS = ["8:00", "9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const AVAILABLE: Record<string, string[]> = {
  Mon: ["9:00", "10:00", "14:00", "15:00"],
  Tue: ["9:00", "10:00", "11:00"],
  Wed: ["14:00", "15:00", "16:00"],
  Thu: ["9:00", "10:00", "11:00", "14:00"],
  Fri: ["9:00", "10:00"],
  Sat: [], Sun: [],
};

export default async function TherapistAvailabilityPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;
  const { databases } = createAdminClient();
  let t: Record<string, unknown>;
  try { t = await databases.getDocument(appwriteConfig.databaseId, appwriteConfig.collections.therapists, id) as unknown as Record<string, unknown>; } catch { notFound(); }

  return (
    <div>
      <AdminPageHeader
        title="Availability Overview"
        description="Weekly schedule — read-only admin view."
        breadcrumbs={[{ label: "Therapists", href: "/admin/therapists" }, { label: t.name as string, href: `/admin/therapists/${id}` }, { label: "Availability" }]}
      />
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center min-w-[600px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400 w-20">Time</th>
                {DAYS.map((d) => (
                  <th key={d} className="px-2 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {SLOTS.map((slot) => (
                <tr key={slot} className="hover:bg-stone-50/50">
                  <td className="px-4 py-2.5 text-xs text-stone-400 font-medium">{slot}</td>
                  {DAYS.map((day) => {
                    const avail = AVAILABLE[day]?.includes(slot);
                    return (
                      <td key={day} className="px-2 py-2.5">
                        <div className={`h-6 rounded-lg mx-auto w-full max-w-[60px] ${avail ? "bg-teal-100 border border-teal-300" : "bg-stone-50 border border-stone-100"}`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-stone-100 flex items-center gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-teal-100 border border-teal-300" /><span>Available</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-stone-50 border border-stone-100" /><span>Unavailable</span></div>
        </div>
      </div>
    </div>
  );
}
