/**
 * Browser-side wrapper around `POST /api/admin/therapist-kyc`.
 *
 * It exists so that every KYC control in the admin console reports failure the
 * same way. The component this replaced wrapped its fetch in an empty catch and
 * ignored the status code, so a refused approval and a successful one were
 * indistinguishable on screen: the button stopped spinning and nothing changed.
 * An admin whose approval was rejected for missing documents saw no reason, and
 * the most likely response to that is to click again.
 *
 * The server is the authority on whether a decision is allowed. It re-checks
 * that every required document type has been accepted and answers 400 with what
 * is missing. The UI's own gap check is a courtesy that saves a round-trip; this
 * module makes sure the server's answer is never the thing that gets dropped.
 */

export type KycDocumentDecision = "accepted" | "rejected";

export type KycReviewRequest =
  | { therapistDocId: string; action: "approve"; note?: string }
  /** `note` is required by the server — a rejection with no reason is not one. */
  | { therapistDocId: string; action: "reject"; note: string }
  | { therapistDocId: string; action: "request_changes"; note: string }
  | {
      therapistDocId: string;
      action: "review_document";
      documentId: string;
      decision: KycDocumentDecision;
      note?: string;
    };

export interface KycReviewResult {
  ok: boolean;
  /** Advisory shown on success — e.g. the therapist must re-authenticate. */
  notice?: string;
  /**
   * The decision stuck, but something adjacent did not. Plural because the
   * route reports the Auth0 role failure and the "we could not email them"
   * case in separate fields, and an admin needs to see both: each one is a
   * follow-up action that nothing else will remind them to take.
   */
  warnings: string[];
  /** Why the request was refused. Always set when `ok` is false. */
  error?: string;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * Turn whatever the server sent into something an admin can act on.
 *
 * Deliberately tolerant about the shape. This route is being rewritten
 * alongside this UI, and the useful half of a 400 — the list of documents still
 * missing — must survive whether it arrives as `error`, as `message`, or as a
 * `missing` array. The fallback still names the status code, because "Request
 * failed" with no number is not a bug report anyone can act on.
 */
function describeFailure(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const base = asString(b.error) ?? asString(b.message);
    // `detail` carries the zod message behind a bare "Invalid payload", which is
    // the only part of that response anyone can act on.
    const detail = asString(b.detail);
    const missing = [b.missingDocumentLabels, b.missing]
      .filter(Array.isArray)
      .flat()
      .filter((m): m is string => typeof m === "string");

    const parts = [base, detail].filter((p): p is string => Boolean(p));
    // The route's own message already names the outstanding documents; the list
    // is appended only when nothing else said what they were.
    if (!parts.length && missing.length) {
      parts.push(`Still required: ${missing.join(", ")}.`);
    }
    if (parts.length) return parts.join(" — ");
  }

  if (status === 401 || status === 403) {
    return "You are not authorised to make this decision. Your session may have expired — sign in again.";
  }
  return `The server refused this decision (HTTP ${status}) without saying why.`;
}

export async function submitKycReview(
  request: KycReviewRequest
): Promise<KycReviewResult> {
  let response: Response;
  try {
    response = await fetch("/api/admin/therapist-kyc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    // A network failure is NOT a rejection. Say so, because the difference
    // decides whether retrying is sensible.
    return {
      ok: false,
      warnings: [],
      error:
        "Could not reach the server. The decision was not recorded — check your connection and try again.",
    };
  }

  // A 500 can arrive as an HTML error page; `.json()` would throw on it.
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    return { ok: false, warnings: [], error: describeFailure(body, response.status) };
  }

  const b = (body ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    notice: asString(b.notice),
    warnings: [asString(b.warning), asString(b.emailWarning)].filter(
      (w): w is string => Boolean(w)
    ),
  };
}
