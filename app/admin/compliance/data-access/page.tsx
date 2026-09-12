import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { ShieldAlert, ExternalLink } from "lucide-react";

/**
 * Admin access to client data — what is and is not recorded.
 *
 * ## What was here, and why it was the worst page in the admin portal
 *
 * Eight rows of an audit log: "Admin" viewed "Daniel T."'s **full profile** for
 * "Risk investigation"; "Sarah M."'s **messages** for "Compliance review";
 * "Priya V."'s messages for "Safety flag review". Each with an IP and a
 * timestamp. Above the table, in a blue notice:
 *
 *   > All admin access to client personal data is automatically logged. This
 *   > log is immutable and available for regulatory audit.
 *
 * Every row was a literal in this file, and all three claims in that notice
 * were false. Nothing logs admin reads; there is no such table in the schema;
 * nothing is immutable because nothing is written.
 *
 * The invented rows are the same class of failure as the hardcoded risk scores
 * once shown under real clients' names — but an audit log of data access is the
 * document you hand a regulator, and the notice explicitly offered it for that.
 * Fabricated entries describing who read whose therapy messages, and for what
 * stated purpose, is not a placeholder. It is also a deterrence claim: an
 * administrator told their access is recorded behaves as though it is.
 *
 * ## What it shows now
 *
 * The truth, plus the one audit trail that genuinely exists and is genuinely
 * immutable — `kyc_review_events`, where admins cannot UPDATE or DELETE. That
 * is asserted by policy AND checked against a live database by
 * `scripts/verify-kyc-security.ts`, which is why it can be stated here.
 *
 * Read-logging is buildable: a table written by `withSystem`, INSERT-only for
 * admins as `risk_alerts` and `kyc_review_events` already are. It is not built,
 * so this page says so.
 */
export default async function DataAccessLogPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Admin access to client data"
        description="What is recorded when an administrator reads client data, and what is not."
        breadcrumbs={[
          { label: "Compliance", href: "/admin/compliance" },
          { label: "Admin access" },
        ]}
      />

      <div className="mb-8 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-sm leading-6 text-amber-900">
          <p className="font-semibold">Admin reads of client data are not logged.</p>
          <p className="mt-1">
            This page previously showed an access log and described it as
            immutable and available for regulatory audit. No such log exists —
            the entries were fabricated. Do not rely on one existing, and do not
            offer one in response to a request.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-stone-800">
          What restricts admin access today
        </h3>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Access control, not access logging. Row-level security decides what an
          administrator can read at all, and two of those decisions are worth
          knowing:
        </p>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-stone-600 marker:text-stone-400">
          <li>
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">journal_entries</code>{" "}
            is <span className="font-medium text-stone-800">author-only</span>. There
            is no admin read path — an administrator claiming the admin role still
            sees zero rows, which is verified against a live database rather than
            assumed.
          </li>
          <li>
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">clinical_notes</code>{" "}
            is readable by the authoring therapist and admins,{" "}
            <span className="font-medium text-stone-800">never the patient</span>.
          </li>
        </ul>

        <h3 className="mt-7 text-sm font-bold text-stone-800">
          The audit trail that does exist
        </h3>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">kyc_review_events</code>{" "}
          records credentialing decisions and is append-only: admins are granted
          INSERT and SELECT, and <span className="font-medium text-stone-800">not</span>{" "}
          UPDATE or DELETE. An approval cannot be rewritten or removed after the
          fact, including by the person who made it. That property is checked by{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
            scripts/verify-kyc-security.ts
          </code>{" "}
          against a real database, which is the only reason it is stated as fact
          on this page.
        </p>

        <h3 className="mt-7 text-sm font-bold text-stone-800">
          What read-logging would need
        </h3>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-stone-600 marker:text-stone-400">
          <li>
            A table written under{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">withSystem</code>,
            INSERT-only for admins, in the shape of the two append-only tables
            above.
          </li>
          <li>
            A decision about what counts as a read. Logging every query would
            record a therapist opening their own calendar; logging none of them is
            where we are now.
          </li>
          <li>
            A retention period, since the log is itself a record of who looked at
            whose mental-health data.
          </li>
        </ul>

        <Link
          href="/admin/compliance"
          className="mt-7 inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-3.5 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-200"
        >
          Back to compliance
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
