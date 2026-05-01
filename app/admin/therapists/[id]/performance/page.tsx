import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";

export default async function TherapistPerformancePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;
  const { databases } = createAdminClient();
  let t: Record<string, unknown>;
  try { t = await databases.getDocument(appwriteConfig.databaseId, appwriteConfig.collections.therapists, id) as unknown as Record<string, unknown>; } catch { notFound(); }

  const metrics = [
    { label: "Sessions Completed", value: "84", change: "+12 this month", trend: "up" },
    { label: "Client Retention Rate", value: "91%", change: "+2% vs last month", trend: "up" },
    { label: "Avg Session Rating", value: `${(t.rating as number) ?? "N/A"}/5`, change: "Based on 56 ratings", trend: "neutral" },
    { label: "No-Show Rate", value: "4%", change: "-1% vs last month", trend: "up" },
    { label: "Cancellation Rate", value: "8%", change: "Within target", trend: "neutral" },
    { label: "Response Time", value: "< 2h", change: "Avg message reply", trend: "neutral" },
  ];

  const bars = [
    { label: "Jan", value: 12 }, { label: "Feb", value: 15 }, { label: "Mar", value: 18 },
    { label: "Apr", value: 14 }, { label: "May", value: 20 }, { label: "Jun", value: 22 },
    { label: "Jul", value: 19 }, { label: "Aug", value: 24 }, { label: "Sep", value: 21 },
    { label: "Oct", value: 17 }, { label: "Nov", value: 16 }, { label: "Dec", value: 13 },
  ];
  const maxBar = Math.max(...bars.map((b) => b.value));

  return (
    <div>
      <AdminPageHeader
        title="Performance Dashboard"
        breadcrumbs={[{ label: "Therapists", href: "/admin/therapists" }, { label: t.name as string, href: `/admin/therapists/${id}` }, { label: "Performance" }]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900">{m.value}</p>
            <p className="text-xs text-stone-400 mt-1">{m.change}</p>
          </div>
        ))}
      </div>

      {/* Sessions over time bar chart */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-6">Monthly Sessions (2025)</h3>
        <div className="flex items-end gap-2 h-40">
          {bars.map((bar) => (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-stone-400">{bar.value}</span>
              <div
                className="w-full bg-teal-500 rounded-t-lg transition-all hover:bg-teal-600"
                style={{ height: `${(bar.value / maxBar) * 100}%`, minHeight: "4px" }}
              />
              <span className="text-[10px] text-stone-400">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
