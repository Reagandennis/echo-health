import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import {
  listClientMessages,
  type AdminMessageRow,
  type MessageParticipant,
} from "../../../_lib/queries";
import { AlertTriangle, ArrowRight, Inbox, Lock } from "lucide-react";

/**
 * One client's direct-message history, read from the `messages` table.
 *
 * WHAT THIS PAGE USED TO BE. Five hardcoded messages — `MOCK_MESSAGES` — shown
 * under a real client's real name. They were not a rough sketch of the feature;
 * they were an invented therapy conversation, and one of the invented lines was
 * "Sometimes I just feel like giving up on everything", tagged `flagged: true`,
 * with the panel header reading "1 flagged message". An administrator opening
 * this page saw what looked like a named patient expressing hopelessness and a
 * system that had already noticed. Every part of that was fiction.
 *
 * The file's own comment admitted the array was mock UI, which is better than
 * hiding it — but the comment is in the source and the transcript was on the
 * screen, and only one of those two things is read by the person acting on it.
 *
 * WHAT WENT WITH IT:
 *
 *   • The per-message `flagged` marker and the "N flagged message" pill. No
 *     column backs them and nothing writes them. `analyzeRisk` in
 *     `lib/clinical/risk.ts` exists but has never scored a stored message, so a
 *     flag rendered here could only ever have been decorative — on a screen
 *     where a flag means "this patient may be at risk".
 *
 *   • "All access is logged." It is not. See the disclosure banner below: this
 *     claim was false when it was written and removing it is the point, not an
 *     omission. Do not restore that sentence without first building the table
 *     that would make it true.
 *
 *   • The chat-bubble layout — client left in stone, therapist right in teal.
 *     That is the visual grammar of a messaging app and it invites reading a
 *     therapy transcript the way one skims a group chat. What replaces it is a
 *     record: uniform rows, explicit attribution on every line, full timestamps.
 *
 * WHAT IS DELIBERATELY MISSING. There is no 404 on a client with no `profiles`
 * row, unlike this page's siblings. `messages` is keyed by Auth0 sub and a sub
 * can hold messages with no profile attached, so refusing to render would hide
 * real records behind a missing display name. The subject is resolved where
 * possible and shown as their raw sub where not.
 */

/**
 * Timestamps are pinned to UTC and labelled.
 *
 * This is server-rendered, so an unqualified `toLocaleString` formats in the
 * SERVER's timezone — not the reader's, and not the participants' (clinicians
 * are in Africa/Nairobi, clients are worldwide). On a clinical record an
 * unlabelled wall-clock time is a fact nobody can safely use. The old mock
 * printed a bare "09:18" with no date at all.
 */
function formatTimestamp(value: Date) {
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * A participant, named where the database could name them and shown as a raw
 * Auth0 sub where it could not. "Unidentified" is stated rather than guessed —
 * attributing a line of a therapy transcript to the wrong person is the failure
 * this page most has to avoid.
 */
function ParticipantLabel({ who }: { who: MessageParticipant }) {
  if (!who.name) {
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-mono text-stone-500 truncate">{who.id}</span>
        <AdminBadge label="Unidentified" variant="warning" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="text-sm font-semibold text-stone-800 truncate">{who.name}</span>
      {who.role && (
        <AdminBadge
          label={who.role === "therapist" ? "Therapist" : "Client"}
          variant={who.role === "therapist" ? "teal" : "neutral"}
        />
      )}
    </span>
  );
}

function MessageRecord({ message }: { message: AdminMessageRow }) {
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
        <ParticipantLabel who={message.sender} />
        <ArrowRight className="w-3.5 h-3.5 text-stone-300 flex-shrink-0" />
        <ParticipantLabel who={message.receiver} />
        <span className="ml-auto text-[11px] font-mono text-stone-400 whitespace-nowrap">
          {formatTimestamp(message.createdAt)} UTC
        </span>
      </div>

      <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap break-words">
        {message.content}
      </p>

      <p className="mt-2 text-[11px] text-stone-400">
        {message.sessionId ? (
          <Link
            href={`/admin/sessions/${message.sessionId}/conversation`}
            className="font-mono hover:text-teal-600 transition-colors"
          >
            Session {message.sessionId.slice(0, 8)}…
          </Link>
        ) : (
          // Null `session_id` is meaningful, not missing data: it is how the
          // schema records a direct message that belongs to no appointment.
          "Direct message — not attached to a session"
        )}
      </p>
    </li>
  );
}

export default async function ClientMessagesPage({
  params,
}: {
  // Request-time API: a Promise in Next 16, not the plain object it was in 14.
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { id } = await params;
  const result = await listClientMessages(id);

  const subjectLabel = result.ok
    ? (result.data.subject.name ?? `${id.slice(0, 14)}…`)
    : `${id.slice(0, 14)}…`;

  return (
    <div>
      <AdminPageHeader
        title="Message record"
        description="Every direct message this client has sent or received, newest first."
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: subjectLabel, href: `/admin/users/${encodeURIComponent(id)}` },
          { label: "Messages" },
        ]}
      />

      {/* Restricted-access notice. Kept from the previous version; its claim
          about logging is not — see the separate disclosure below. */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
        <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Protected clinical communication
          </p>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            These are therapy messages between a client and their clinician, reproduced here in
            full. Read them only where a specific safety, compliance or support obligation
            requires it, and do not reproduce their contents outside authorised channels.
          </p>
        </div>
      </div>

      {/*
       * The honest version of the sentence this page used to carry.
       *
       * The old banner said "All access is logged." Nothing logs it. There is no
       * access-log table in this database; `kyc_review_events` is append-only
       * but records therapist credentialing decisions only. Saying so plainly is
       * safer than the reassuring falsehood, because an administrator who
       * believes they are being audited behaves differently from one who knows
       * they are not.
       */}
      <div className="flex items-start gap-3 bg-stone-50 border border-stone-200 rounded-2xl p-4 mb-6">
        <AlertTriangle className="w-5 h-5 text-stone-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-stone-700">This access is not recorded</p>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">
            The platform keeps no access log. Opening this page leaves no trace, and nothing in
            this system can later establish who read this conversation. The only append-only
            trail in the database is{" "}
            <span className="font-mono text-[11px]">kyc_review_events</span>, which covers
            therapist credentialing decisions and nothing else.
          </p>
        </div>
      </div>

      {!result.ok ? (
        /*
         * Load failure, kept visually and verbally distinct from "no messages".
         * `messages` is currently empty, so an outage and an empty history would
         * otherwise render the identical panel and the reader would have no way
         * to tell a clinical fact from a broken query.
         */
        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm px-5 py-12 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-stone-700">Messages could not be loaded</p>
          <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto leading-relaxed">
            The query failed. This is <strong className="font-semibold">not</strong> the same as
            this client having no messages — do not read it as one. The error was logged on the
            server; retry, and escalate if it persists.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-stone-800">
                {result.data.subject.name ?? "Unidentified account"}
              </h2>
              <p className="text-[11px] font-mono text-stone-400 truncate">
                {result.data.subject.id}
              </p>
            </div>
            <span className="text-[11px] text-stone-500 font-semibold whitespace-nowrap">
              {result.data.messages.length}{" "}
              {result.data.messages.length === 1 ? "message" : "messages"}
            </span>
          </div>

          {result.data.messages.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Inbox className="w-8 h-8 text-stone-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-stone-600">No messages on record</p>
              <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed">
                This client has neither sent nor received a direct message. The record is empty
                because nothing has been written to it, not because anything is hidden from this
                view.
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-stone-100">
                {result.data.messages.map((message) => (
                  <MessageRecord key={message.id} message={message} />
                ))}
              </ul>

              {/* Disclosed only when the cap was actually reached, so its absence
                  is itself information: the record above is complete. */}
              {result.data.truncated && (
                <p className="px-5 py-3 bg-stone-50 border-t border-stone-100 text-[11px] text-stone-500">
                  Showing the {result.data.limit} most recent messages. Older messages exist and
                  are not displayed — this record is incomplete.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
