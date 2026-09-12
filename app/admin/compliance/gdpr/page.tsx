import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { ShieldAlert, Mail, ExternalLink } from "lucide-react";

/**
 * Data subject requests — what this page can honestly show.
 *
 * ## What was here
 *
 * A table of four data subject requests: `req_001` from "Liam O.", an erasure
 * request from "Amara L.", each with a submitted date, a 30-day deadline in
 * amber, and Process / Package buttons. Above it, four metric tiles reading
 * "Pending Requests 3", "Erasure Requests 1", "Consent Rate 94%" and "DPA
 * Agreements Signed".
 *
 * All of it was a literal in this file. There is no requests table in the
 * schema — `information_schema` has nothing request- or consent-shaped — so
 * none of those numbers could have come from anywhere, the buttons had no
 * handler, and "DPA Agreements: Signed" was an assertion about executed legal
 * agreements that this codebase knows nothing about.
 *
 * This is the same failure as the admin risk pages, which rendered hardcoded
 * scores and flags under real clients' names, and the `/cookies` toggles that
 * discarded consent. It is worse in one specific way: an administrator reading
 * "3 pending, deadline May 25" concludes the statutory clock is being tracked.
 * If a real request had arrived by email, this page actively reassured them it
 * was already in a queue.
 *
 * ## What it shows now
 *
 * The actual process, which `/privacy` §4 already describes to clients: email,
 * read by a person, with two erasure limits enforced by `ON DELETE RESTRICT`.
 * Pointing an admin at the real mechanism is worth more than a queue that does
 * not exist, and it does not need a migration to be true.
 *
 * Building the tracker is a reasonable thing to do — a `data_subject_requests`
 * table, RLS admitting admins only, an append-only event trail like
 * `kyc_review_events`, and a clock whose duration counsel confirms per market.
 * Until that exists this page must not imply it.
 */
export default async function DataSubjectRequestsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Data subject requests"
        description="How access, portability and erasure requests actually reach us."
        breadcrumbs={[
          { label: "Compliance", href: "/admin/compliance" },
          { label: "Data subject requests" },
        ]}
      />

      <div className="mb-8 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-sm leading-6 text-amber-900">
          <p className="font-semibold">There is no request queue in this system.</p>
          <p className="mt-1">
            Requests arrive by email and are handled by a person. Nothing on this
            page is tracking a deadline for you — if a request has come in, it is
            in the inbox, not here.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-stone-800">The process we publish</h3>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Clients are told to email{" "}
          <span className="font-medium text-stone-800">privacy@echohealth.app</span>, that
          a person will acknowledge the request, and what we can and cannot do.
          That commitment is in the privacy policy, so it is the one to honour.
        </p>

        <h3 className="mt-7 text-sm font-bold text-stone-800">
          Two limits on erasure that are real
        </h3>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Both are enforced by the database rather than by policy, so neither can
          be waived by agreeing to it:
        </p>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-stone-600 marker:text-stone-400">
          <li>
            <span className="font-medium text-stone-800">Clinical notes.</span>{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">ON DELETE RESTRICT</code>{" "}
            — a therapist&apos;s clinical record is not the client&apos;s to delete,
            and deleting the account would orphan it.
          </li>
          <li>
            <span className="font-medium text-stone-800">Financial records.</span>{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">payout_ledger</code>{" "}
            restricts on both sides — a payment to a clinician cannot be unmade by
            deleting the person who paid.
          </li>
        </ul>

        <h3 className="mt-7 text-sm font-bold text-stone-800">
          What a real tracker would need
        </h3>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-stone-600 marker:text-stone-400">
          <li>
            A <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">data_subject_requests</code>{" "}
            table with RLS admitting admins only.
          </li>
          <li>
            An append-only trail, in the shape of{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">kyc_review_events</code>,
            so a completed request is attributable and cannot be quietly edited.
          </li>
          <li>
            A response deadline confirmed by counsel for each market — Echo serves
            thirteen, and the applicable instrument differs between them. The
            figure previously shown here (30 days) was not sourced from anything.
          </li>
        </ul>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/privacy"
            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-3.5 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-200"
          >
            Read the published policy
            <ExternalLink className="h-3 w-3" />
          </Link>
          <a
            href="mailto:privacy@echohealth.app"
            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-3.5 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-200"
          >
            <Mail className="h-3 w-3" />
            privacy@echohealth.app
          </a>
        </div>
      </div>
    </div>
  );
}
