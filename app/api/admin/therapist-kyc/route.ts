import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getLoggedInUser } from "@/lib/auth/session";
import { withCurrentUser } from "@/lib/db/session";
import { kycDocuments, kycReviewEvents, profiles, therapists } from "@/lib/db/schema";
import { getPostHogClient } from "@/lib/posthog-server";
import { parseOrError, kycReviewSchema } from "@/lib/validation";
import {
  assignRole,
  getUserEmail,
  isManagementConfigured,
  removeRole,
} from "@/lib/supabase/management";
import { kycDocumentLabel, missingRequiredTypes, type KycDocumentType } from "@/lib/kyc";
import {
  sendKycApprovedEmail,
  sendKycChangesRequestedEmail,
  sendKycRejectedEmail,
} from "@/lib/email";

/**
 * Therapist credentialing review.
 *
 * WHAT THIS REPLACED. A single all-or-nothing flip: `{ therapistDocId, action }`
 * set `kyc_status` to verified or rejected, stamped a reviewer id across every
 * unreviewed document at once, and recorded nothing else. There was no reason
 * attached to a rejection, no way to accept four documents and query a fifth,
 * and no trail of who decided what. Worse, "approve" was purely a matter of
 * clicking it — both therapists in this database were verified against ZERO
 * documents, so the platform's claim to have checked a clinician's licence was
 * made against data that did not exist.
 *
 * The important property here is the approval guard: it is not possible to
 * approve a therapist who does not hold an ACCEPTED document of every required
 * type. That check lives on the server, not in the admin screen, because a
 * disabled button is a courtesy and this is a control.
 *
 * Ordering, which is load-bearing:
 *   1. Database work — status change AND the append-only `kyc_review_events` row
 *      — in ONE transaction, so a decision can never exist without its audit
 *      entry.
 *   2. Auth0 role change, deliberately OUTSIDE that transaction (see below).
 *   3. Email, after the commit, failure-tolerant.
 */

/** Decisions the therapist should be told about. A per-document call is interim. */
type TherapistLevelAction = "approve" | "reject" | "request_changes";

export async function POST(req: NextRequest) {
  try {
    const user = await getLoggedInUser();
    if (!user || !user.labels?.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /*
     * The schema validates both ids as uuids, so a malformed one is a 400 here
     * rather than a Postgres `invalid input syntax for type uuid` surfacing as a
     * 500 from the catch below. It also makes `note` REQUIRED on reject and
     * request_changes — a decision the therapist cannot act on is not one this
     * endpoint should be able to record.
     */
    const parsed = parseOrError(kycReviewSchema, await req.json());
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Invalid payload", detail: parsed.message },
        { status: 400 }
      );
    }
    const payload = parsed.data;
    const { therapistDocId } = payload;
    const note = "note" in payload ? payload.note : undefined;

    const reviewedAt = new Date();

    const outcome = await withCurrentUser(async (tx) => {
      const [therapist] = await tx
        .select({
          id: therapists.id,
          userId: therapists.userId,
          name: therapists.name,
        })
        .from(therapists)
        .where(eq(therapists.id, therapistDocId))
        .limit(1);

      if (!therapist) return { kind: "therapist_not_found" as const };

      /*
       * The address we will write to. `profiles` first because it is one indexed
       * read against a table we already trust; Auth0 is the fallback and happens
       * after the commit, since a therapist may never have had a `profiles` row
       * (they get a `therapists` row instead) and `therapists` has no email
       * column at all.
       */
      const [profile] = await tx
        .select({ email: profiles.email })
        .from(profiles)
        .where(eq(profiles.userId, therapist.userId))
        .limit(1);

      const profileEmail = profile?.email ?? null;

      // ── One document ──────────────────────────────────────────────────────
      if (payload.action === "review_document") {
        const [doc] = await tx
          .update(kycDocuments)
          .set({
            reviewStatus: payload.decision,
            reviewNote: payload.note ?? null,
            reviewedBy: user.$id,
            reviewedAt,
          })
          /*
           * Matching on therapist id as well as document id is not redundant
           * with RLS. RLS admits an admin to EVERY document, so without this an
           * admin could pass a document belonging to a different therapist and
           * have it silently reviewed under the wrong application — and the
           * audit row would then attribute it to a therapist who never uploaded
           * it.
           */
          .where(
            and(
              eq(kycDocuments.id, payload.documentId),
              eq(kycDocuments.therapistId, therapistDocId)
            )
          )
          .returning({ id: kycDocuments.id, docType: kycDocuments.docType });

        if (!doc) return { kind: "document_not_found" as const };

        await tx.insert(kycReviewEvents).values({
          therapistId: therapistDocId,
          actorId: user.$id,
          action: payload.decision === "accepted" ? "document_accepted" : "document_rejected",
          note: payload.note ?? null,
          documentId: doc.id,
        });

        return {
          kind: "document" as const,
          therapist,
          profileEmail,
          documentId: doc.id,
          docType: doc.docType,
          decision: payload.decision,
        };
      }

      // ── Whole application ─────────────────────────────────────────────────

      const docs = await tx
        .select({
          docType: kycDocuments.docType,
          reviewStatus: kycDocuments.reviewStatus,
        })
        .from(kycDocuments)
        .where(eq(kycDocuments.therapistId, therapistDocId));

      const acceptedTypes = docs
        .filter((d) => d.reviewStatus === "accepted")
        .map((d) => d.docType);

      if (payload.action === "approve") {
        /*
         * THE GUARD. Approval requires an accepted document of every required
         * type — not merely an uploaded one, and not "the reviewer saw the
         * screen". A document still `pending` has not been looked at, which is
         * exactly the state that produced two verified therapists with nothing
         * on file.
         *
         * Re-checked here rather than trusted from the admin UI: the UI can hide
         * the button, but this endpoint is reachable without it.
         */
        const missing = missingRequiredTypes(acceptedTypes);
        if (missing.length > 0) {
          return { kind: "missing_documents" as const, missing };
        }

        await tx
          .update(therapists)
          .set({
            kycStatus: "verified",
            kycReviewedAt: reviewedAt,
            kycReviewedBy: user.$id,
            // Cleared unless the reviewer left one: this column is shown to the
            // therapist, and a stale rejection note on a verified profile reads
            // as a contradiction of the approval that just landed.
            kycReviewNote: payload.note ?? null,
            updatedAt: reviewedAt,
          })
          .where(eq(therapists.id, therapistDocId));

        await tx.insert(kycReviewEvents).values({
          therapistId: therapistDocId,
          actorId: user.$id,
          action: "approved",
          note: payload.note ?? null,
        });

        return { kind: "approved" as const, therapist, profileEmail };
      }

      // reject | request_changes — the same `rejected` status, different letter.
      await tx
        .update(therapists)
        .set({
          kycStatus: "rejected",
          kycReviewedAt: reviewedAt,
          kycReviewedBy: user.$id,
          kycReviewNote: payload.note,
          updatedAt: reviewedAt,
        })
        .where(eq(therapists.id, therapistDocId));

      await tx.insert(kycReviewEvents).values({
        therapistId: therapistDocId,
        actorId: user.$id,
        action: payload.action === "reject" ? "rejected" : "changes_requested",
        note: payload.note,
      });

      /*
       * What the applicant has to redo: every required type without an accepted
       * document, plus anything explicitly rejected — including optional types,
       * because a rejected insurance certificate is still a rejected document
       * and omitting it would leave them guessing.
       */
      const outstanding = new Set<KycDocumentType>([
        ...missingRequiredTypes(acceptedTypes),
        ...docs.filter((d) => d.reviewStatus === "rejected").map((d) => d.docType),
      ]);

      return {
        kind: payload.action === "reject" ? ("rejected" as const) : ("changes_requested" as const),
        therapist,
        profileEmail,
        outstanding: [...outstanding],
      };
    });

    if (outcome.kind === "therapist_not_found") {
      return NextResponse.json({ error: "Therapist not found" }, { status: 404 });
    }

    if (outcome.kind === "document_not_found") {
      // Also the answer when the document belongs to a different therapist. Not
      // distinguished, so this cannot be used to probe which ids exist.
      return NextResponse.json(
        { error: "Document not found for this therapist" },
        { status: 404 }
      );
    }

    if (outcome.kind === "missing_documents") {
      const labels = outcome.missing.map(kycDocumentLabel);
      return NextResponse.json(
        {
          error:
            "Cannot approve: no accepted document for " +
            `${labels.join(", ")}. Review each required document before approving.`,
          missingDocumentTypes: outcome.missing,
          missingDocumentLabels: labels,
        },
        { status: 400 }
      );
    }

    // A per-document decision is an interim step: it changes nothing about the
    // therapist's access and sends no mail. Emailing on each one would put five
    // messages in an applicant's inbox for a single review sitting, none of
    // which tells them the thing they want to know.
    if (outcome.kind === "document") {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: user.$id,
        event: "therapist_kyc_document_reviewed",
        properties: {
          therapist_doc_id: therapistDocId,
          therapist_user_id: outcome.therapist.userId,
          document_id: outcome.documentId,
          doc_type: outcome.docType,
          decision: outcome.decision,
        },
      });
      await posthog.shutdown();

      return NextResponse.json({
        ok: true,
        action: "review_document",
        documentId: outcome.documentId,
        docType: outcome.docType,
        decision: outcome.decision,
      });
    }

    // Derived from the outcome rather than re-read from the payload, so the
    // reported action and the recorded one cannot drift apart.
    const therapistAction: TherapistLevelAction =
      outcome.kind === "approved"
        ? "approve"
        : outcome.kind === "rejected"
          ? "reject"
          : "request_changes";
    const kycStatus = outcome.kind === "approved" ? "verified" : "rejected";

    /*
     * Second half of an approval: grant the "therapist" role in Auth0.
     *
     * Deliberately NOT inside the transaction above. Auth0 is a separate system
     * with no shared rollback — if the role call failed after a commit we could
     * not undo it, and holding a database transaction open across a network call
     * to a third party would pin a connection from a pool of ~24.
     *
     * A failure here is reported rather than thrown: the KYC decision is already
     * durably recorded and the queue has cleared, so the correct outcome is a
     * successful review with an explicit warning that the role still needs
     * granting — not a 500 that makes the admin repeat a completed review.
     */
    let roleAssigned = false;
    let roleError: string | undefined;

    if (outcome.kind === "approved") {
      if (!isManagementConfigured()) {
        roleError =
          "Auth0 Management API credentials are not configured, so the " +
          "'therapist' role must be granted manually in the Auth0 dashboard.";
      } else {
        try {
          await assignRole(outcome.therapist.userId, "therapist");
          roleAssigned = true;
        } catch (err: unknown) {
          roleError = err instanceof Error ? err.message : "Failed to assign role";
          console.error("therapist-kyc role assignment failed:", err);
        }
      }
    } else if (isManagementConfigured()) {
      // Rejection revokes the role if the therapist previously held it, so a
      // later rejection actually removes access rather than only changing a label.
      try {
        await removeRole(outcome.therapist.userId, "therapist");
      } catch (err: unknown) {
        console.error("therapist-kyc role revocation failed:", err);
      }
    }

    /*
     * Notification, last and lowest-stakes. The decision is already committed, so
     * nothing below may throw: an exception here would report a finished review
     * as a failure and invite the admin to repeat it.
     */
    let recipient: string | null = outcome.profileEmail;
    if (!recipient && isManagementConfigured()) {
      try {
        recipient = await getUserEmail(outcome.therapist.userId);
      } catch (err: unknown) {
        console.error("therapist-kyc email lookup failed:", err);
      }
    }

    let emailSent = false;
    if (recipient) {
      try {
        if (outcome.kind === "approved") {
          emailSent = await sendKycApprovedEmail(recipient, outcome.therapist.name);
        } else if (outcome.kind === "rejected") {
          emailSent = await sendKycRejectedEmail(
            recipient,
            outcome.therapist.name,
            note ?? ""
          );
        } else {
          emailSent = await sendKycChangesRequestedEmail(
            recipient,
            outcome.therapist.name,
            note ?? "",
            outcome.outstanding.map(kycDocumentLabel)
          );
        }
      } catch (err: unknown) {
        // The senders already swallow their own failures; this is the backstop
        // for anything thrown before the send (a malformed address, say).
        console.error("therapist-kyc notification failed:", err);
      }
    }

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.$id,
      event: "therapist_kyc_reviewed",
      properties: {
        therapist_doc_id: therapistDocId,
        therapist_user_id: outcome.therapist.userId,
        action: therapistAction,
        kyc_status: kycStatus,
        role_assigned: roleAssigned,
        email_sent: emailSent,
      },
    });
    await posthog.shutdown();

    return NextResponse.json({
      ok: true,
      action: therapistAction,
      kycStatus,
      roleAssigned,
      emailSent,
      ...(roleAssigned
        ? {
            // The therapist's existing session still carries the old claim.
            notice:
              "Role granted. The therapist must sign out and back in before " +
              "gaining access — the roles claim is issued at login.",
          }
        : {}),
      ...(roleError ? { warning: `KYC ${kycStatus}, but: ${roleError}` } : {}),
      ...(recipient
        ? {}
        : {
            // Reported, not fatal: the review stands, but nobody has been told.
            emailWarning:
              `KYC ${kycStatus}, but no email address could be resolved for this ` +
              "therapist, so they have not been notified. Contact them directly.",
          }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
