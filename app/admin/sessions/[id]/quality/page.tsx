import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";

export default async function SessionQualityPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  const metrics = [
    { label: "Overall Quality Score", value: "92/100", variant: "success" as const },
    { label: "Connection Latency", value: "42ms avg", variant: "success" as const },
    { label: "Video Drop Events", value: "0", variant: "success" as const },
    { label: "Audio Quality", value: "Excellent", variant: "success" as const },
    { label: "Session Duration", value: "52 min", variant: "neutral" as const },
    { label: "Reconnections", value: "0", variant: "success" as const },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Session Quality Metrics"
        breadcrumbs={[{ label: "Sessions", href: "/admin/sessions" }, { label: id.slice(0, 10) + "…", href: `/admin/sessions/${id}` }, { label: "Quality" }]}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-2">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900 mb-2">{m.value}</p>
            <AdminBadge label="Normal" variant={m.variant} />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-5">Connection Timeline</h3>
        <div className="relative h-24 bg-stone-50 rounded-xl overflow-hidden">
          <div className="absolute inset-0 flex items-end px-4 pb-4 gap-1">
            {Array.from({ length: 52 }, (_, i) => {
              const h = 40 + Math.random() * 60;
              return (
                <div key={i} className="flex-1 bg-teal-400 rounded-sm opacity-70" style={{ height: `${h}%` }} />
              );
            })}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-stone-200" />
        </div>
        <div className="flex justify-between text-xs text-stone-400 mt-2">
          <span>Session start</span>
          <span>Latency (ms)</span>
          <span>Session end</span>
        </div>
      </div>
    </div>
  );
}
