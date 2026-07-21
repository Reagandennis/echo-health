import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import {
  getProfileByUserId,
  listMoodLogsForUser,
  listRiskAlertsForPatient,
} from "../../../_lib/queries";
import { RISK_SCANNER_DISCLOSURE } from "@/lib/clinical/risk";
import { AlertTriangle, Clock, Info, Activity } from "lucide-react";

/**
 * A client's risk record, built entirely from rows that exist.
 *
 * WHAT WAS DELETED AND WHY. This page used to render, under a real named
 * client's breadcrumb:
 *
 *   - "Overall Risk Score — 15 / 100 — Low risk". There is no risk-scoring
 *     pipeline in this codebase. The number was a literal in the JSX. It was
 *     identical for every client, because it was the same literal on every page
 *     load, so a genuinely high-risk client and a stable one both read "15/100 —
 *     Low risk".
 *   - A five-factor breakdown (Mood Stability 20, Session Engagement 10, Crisis
 *     Indicators 5, Medication Compliance 0, Social Support 15). None of these
 *     is measured anywhere. "Medication Compliance 0" is the starkest: this
 *     platform holds no medication data at all, and a reader would have taken
 *     that bar as a finding about a real person.
 *   - "Last Assessment — Apr 20, 2026 — 7 days ago". No assessment has ever
 *     been performed or recorded.
 *   - Three hardcoded alerts including "Expressed suicidal ideation in session
 *     notes", attributed to whichever client's page was open.
 *
 * Those are fabricated clinical assessments about identifiable people, and an
 * admin had no way to tell them from real ones. They are replaced by the two
 * things the database actually holds: `risk_alerts` filed against this patient,
 * and the mood scores the client self-reported. Where there is nothing, the page
 * says so rather than filling the space.
 *
 * No numeric risk score is computed here — deliberately. `analyzeRisk` returns
 * low/moderate/high and nothing else, and inventing a number from it would
 * recreate exactly the false precision this page was cleaned up to remove.
 */
export default async function RiskProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  // `[id]` is an Auth0 sub, not a uuid. Identity comes from `profiles` — the
  // Appwrite Users API this used to call holds no users any more.
  const client = await getProfileByUserId(id);
  if (!client) notFound();

  const [alerts, moods] = await Promise.all([
    listRiskAlertsForPatient(id),
    listMoodLogsForUser(id),
  ]);

  const unresolved = alerts.filter((a) => !a.resolved);
  const latestMood = moods[0]; // listMoodLogsForUser sorts newest first.

  return (
    <div>
      <AdminPageHeader
        title="Risk Profile"
        description={`Risk alerts and self-reported mood for ${client.name}.`}
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: client.name, href: `/admin/users/${id}` },
          { label: "Risk Profile" },
        ]}
      />

      {/*
        Provenance sits above the data, not in a footnote. An admin reading
        "HIGH" needs to know a keyword matcher produced it before they decide
        what to do about it — after they have acted is too late.
      */}
      <div className="flex items-start gap-3 p-4 mb-6 bg-amber-50 border border-amber-200 rounded-2xl">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <span className="font-bold">How these alerts are produced. </span>
          {RISK_SCANNER_DISCLOSURE}
        </div>
      </div>

      {/* Counts only — every one of these is a row count or a stored value. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div
          className={`rounded-2xl border p-5 ${
            unresolved.length > 0
              ? "bg-rose-50 border-rose-200"
              : "bg-stone-50 border-stone-200"
          }`}
        >
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-2">
            Unresolved alerts
          </p>
          <p
            className={`text-3xl font-bold ${
              unresolved.length > 0 ? "text-rose-700" : "text-stone-700"
            }`}
          >
            {unresolved.length}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {alerts.length} filed in total
          </p>
        </div>

        <div className="rounded-2xl border bg-stone-50 border-stone-200 p-5">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-2">
            Latest mood entry
          </p>
          <p className="text-3xl font-bold text-stone-700">
            {latestMood ? (
              <>
                <span className="mr-2">{latestMood.emoji}</span>
                {latestMood.score}
                <span className="text-lg text-stone-400">/10</span>
              </>
            ) : (
              <span className="text-stone-300">—</span>
            )}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {latestMood
              ? new Date(latestMood.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Never logged a mood"}
          </p>
        </div>

        <div className="rounded-2xl border bg-stone-50 border-stone-200 p-5">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-2">
            Mood entries on record
          </p>
          <p className="text-3xl font-bold text-stone-700">{moods.length}</p>
          <p className="text-xs text-stone-400 mt-1">
            Self-reported by the client
          </p>
        </div>
      </div>

      {/* Alert history */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mb-6">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-stone-800">Alert history</h3>
          {alerts.length > 0 && (
            <Link
              href="/admin/risk"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700"
            >
              Resolve alerts in Risk &amp; Crisis →
            </Link>
          )}
        </div>

        {alerts.length === 0 ? (
          /*
            Specific rather than reassuring. "No alerts" on a clinical page reads
            as "this person is fine", which is not what an empty table means —
            it means nothing has been flagged, by a scanner that only reads
            client messages and only knows a fixed word list.
          */
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-stone-600">
              No risk alerts have been filed for {client.name}.
            </p>
            <p className="text-xs text-stone-400 mt-2 max-w-md mx-auto leading-relaxed">
              Alerts appear here when the keyword scan matches a high-risk term in
              a message this client sends, or when an admin files one manually.
              An empty history is not a clinical finding — no assessment has been
              performed.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {alerts.map((alert) => (
              <div key={alert.$id} className="flex items-start gap-4 px-5 py-4">
                <div
                  className={`p-2 rounded-xl flex-shrink-0 ${
                    alert.severity === "critical"
                      ? "bg-rose-100"
                      : alert.severity === "high"
                        ? "bg-orange-100"
                        : "bg-amber-100"
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 ${
                      alert.severity === "critical"
                        ? "text-rose-600"
                        : alert.severity === "high"
                          ? "text-orange-600"
                          : "text-amber-600"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <AdminBadge label={alert.type} variant="neutral" />
                    <AdminBadge
                      label={alert.severity}
                      variant={
                        alert.severity === "critical" || alert.severity === "high"
                          ? "danger"
                          : "warning"
                      }
                    />
                    {alert.resolved && (
                      <AdminBadge label="Resolved" variant="success" />
                    )}
                  </div>
                  <p className="text-sm text-stone-800 break-words">
                    {alert.description}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-stone-400 mt-1">
                    <Clock className="w-3 h-3" />
                    {new Date(alert.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mood history — the one real longitudinal signal on this platform. */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">
            Self-reported mood
          </h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Entered by the client on their own dashboard. Not a clinical measure.
          </p>
        </div>

        {moods.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Activity className="w-6 h-6 mx-auto text-stone-300 mb-2" />
            <p className="text-sm font-medium text-stone-600">
              {client.name} has not logged any moods.
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Mood logging is optional, so this is common and says nothing about
              how the client is doing.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {moods.map((m) => (
              <div key={m.$id} className="flex items-start gap-4 px-5 py-3.5">
                <span className="text-2xl flex-shrink-0" aria-hidden="true">
                  {m.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-stone-800">
                      {m.score}/10
                    </span>
                    <span className="text-xs text-stone-400">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {m.note && (
                    <p className="text-sm text-stone-600 mt-1 break-words">
                      {m.note}
                    </p>
                  )}
                  {m.tags && m.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {m.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-500"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
