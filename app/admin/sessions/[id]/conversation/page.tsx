import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge, { sessionStatusBadge } from "../../../_components/AdminBadge";
import {
  getSessionConversation,
  type AdminMessageRow,
  type MessageParticipant,
} from "../../../_lib/queries";
import { AlertTriangle, ArrowRight, Inbox, Lock, SearchX } from "lucide-react";

/**
 * The message transcript for one therapy session, read from the `messages`
 * table filtered on `session_id`.
 *
 * WHAT THIS PAGE USED TO BE. Four hardcoded messages — `MOCK_MSGS` — rendered
 * as a conversation between "Client" and "Therapist" for whatever session id
 * was in the URL. The same four lines appeared for every session on the
 * platform: an invented client reporting that they felt less anxious and were
 * sleeping better, and an invented therapist congratulating them on their
 * progress. Reassuring, plausible, and about nobody.
 *
 * That is worse than it sounds on a page reachable from "View Conversation" on
 * the session detail screen. An administrator checking why a session was
 * reported, or reviewing a clinician's conduct, would have read four lines of
 * fabricated evidence attached to a real appointment and drawn a conclusion
 * from it. Fabricated *good news* is not the harmless direction of this error.
 *
 * WHAT WENT WITH IT:
 *
 *   • The `flagged` field and its rose highlight. No column backs it, nothing
 *     writes it, and `analyzeRisk` has never scored a stored message.
 *
 *   • "All access is logged." False — see the disclosure banner below. Removing
 *     the sentence is the correction; do not restore it without building the
 *     table that would make it true.
 *
 *   • The chat-bubble layout, and the bare "10:02 AM" timestamps that carried
 *     no date. A transcript is a record and is presented as one here: uniform
 *     rows, attribution on every line, full UTC timestamps.
 *
 *   • The assumption that the session exists. The old page never looked. It
 *     rendered its four messages for any id at all, including ids belonging to
 *     no session — so "this session had a nice conversation" was displayed for
 *     sessions that had never existed.
 */

/**
 * Pinned to UTC and labelled, for the reason given at length in the sibling
 * page: this renders on the server, so an unqualified `toLocaleString` prints
 * the server's wall clock — neither the reader's nor the participants'.
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

/** Named where the database could name them; raw Auth0 sub where it could not. */
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
    </li>
  );
}

export default async function SessionConversationPage({
  params,
}: {
  // Request-time API: a Promise in Next 16, not the plain object it was in 14.
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { id } = await params;
  const result = await getSessionConversation(id);

  return (
    <div>
      <AdminPageHeader
        title="Session transcript"
        description="Messages exchanged on this session, oldest first."
        breadcrumbs={[
          { label: "Sessions", href: "/admin/sessions" },
          { label: `${id.slice(0, 10)}…`, href: `/admin/sessions/${id}` },
          { label: "Transcript" },
        ]}
      />

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

      {/* The honest replacement for "All access is logged." — see the file note. */}
      <div className="flex items-start gap-3 bg-stone-50 border border-stone-200 rounded-2xl p-4 mb-6">
        <AlertTriangle className="w-5 h-5 text-stone-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-stone-700">This access is not recorded</p>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">
            The platform keeps no access log. Opening this page leaves no trace, and nothing in
            this system can later establish who read this transcript. The only append-only trail
            in the database is <span className="font-mono text-[11px]">kyc_review_events</span>,
            which covers therapist credentialing decisions and nothing else.
          </p>
        </div>
      </div>

      {!result.ok ? (
        /*
         * Load failure. Held apart from both "no such session" and "no messages"
         * — on a table that is currently empty those three would otherwise be
         * one indistinguishable blank panel.
         */
        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm px-5 py-12 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-stone-700">Transcript could not be loaded</p>
          <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto leading-relaxed">
            The query failed. This is <strong className="font-semibold">not</strong> the same as
            this session having no messages — do not read it as one. The error was logged on the
            server; retry, and escalate if it persists.
          </p>
        </div>
      ) : !result.data.session ? (
        /*
         * No such session. Rendered in the page frame rather than via
         * `notFound()` so the two banners above stay visible: an operator who
         * followed a stale link should still see what this screen is and what it
         * does not record.
         */
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-12 text-center">
          <SearchX className="w-8 h-8 text-stone-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-stone-600">No such session</p>
          <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed">
            No session exists with the id{" "}
            <span className="font-mono text-[11px] text-stone-500 break-all">{id}</span>. It may
            have been deleted, or the link may be wrong.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          {/* Who this transcript is between, so the lines below are never read
              without knowing whose they are. */}
          <div className="px-5 py-4 border-b border-stone-100 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ParticipantLabel who={result.data.session.patient} />
                <span className="text-xs text-stone-300">and</span>
                {result.data.session.therapist.name ? (
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-semibold text-stone-800 truncate">
                      {result.data.session.therapist.name}
                    </span>
                    <AdminBadge label="Therapist" variant="teal" />
                  </span>
                ) : (
                  /* `therapist_id` is a `therapists.id`, so a null name means the
                     therapist row is gone — the session FK is ON DELETE RESTRICT,
                     so this should be unreachable, and is shown rather than
                     papered over if it ever is not. */
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-mono text-stone-500 truncate">
                      {result.data.session.therapist.therapistId}
                    </span>
                    <AdminBadge label="Therapist record missing" variant="warning" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400">
                {result.data.session.sessionType} ·{" "}
                {formatTimestamp(result.data.session.scheduledAt)} UTC
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {sessionStatusBadge(result.data.session.status)}
              <span className="text-[11px] text-stone-500 font-semibold whitespace-nowrap">
                {result.data.thread.messages.length}{" "}
                {result.data.thread.messages.length === 1 ? "message" : "messages"}
              </span>
            </div>
          </div>

          {result.data.thread.messages.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Inbox className="w-8 h-8 text-stone-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-stone-600">No messages on this session</p>
              <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed">
                This session exists but nothing was written to its message thread. Sessions are
                conducted over video, so an empty transcript is ordinary — it does not mean the
                session did not happen, and it is not evidence of anything.
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-stone-100">
                {result.data.thread.messages.map((message) => (
                  <MessageRecord key={message.id} message={message} />
                ))}
              </ul>

              {/* At the bottom because the list is chronological: the cap drops
                  the END of the conversation, which is what this is warning about. */}
              {result.data.thread.truncated && (
                <p className="px-5 py-3 bg-stone-50 border-t border-stone-100 text-[11px] text-stone-500">
                  Showing the first {result.data.thread.limit} messages. This conversation
                  continues beyond what is displayed — this transcript is incomplete.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
