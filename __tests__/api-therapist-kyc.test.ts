/**
 * @jest-environment node
 *
 * The behaviour under test is a credentialing decision, so the assertions are
 * about what the platform is willing to CLAIM, not about which SQL was emitted.
 *
 * The load-bearing one is "refuses to approve a therapist whose required
 * documents have not been accepted". Before this endpoint was rebuilt, approval
 * was a flag flip with no preconditions at all — which is how both therapists in
 * the production database came to be marked verified against zero documents,
 * while the admin screen displayed hardcoded "Verified" badges for checks nobody
 * had performed.
 */
import { POST } from "@/app/api/admin/therapist-kyc/route";
import { getLoggedInUser } from "@/lib/auth/session";
import { withCurrentUser } from "@/lib/db/session";
import {
  assignRole,
  getUserEmail,
  isManagementConfigured,
  removeRole,
} from "@/lib/auth0-management";
import {
  sendKycApprovedEmail,
  sendKycChangesRequestedEmail,
  sendKycRejectedEmail,
} from "@/lib/email";
import { mockUser } from "@/test-utils/session";

jest.mock("@/lib/auth/session", () => ({
  getLoggedInUser: jest.fn(),
}));

jest.mock("@/lib/db/session", () => ({
  withCurrentUser: jest.fn(),
}));

jest.mock("@/lib/posthog-server", () => ({
  getPostHogClient: jest.fn(() => ({
    capture: jest.fn(),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mocked outright rather than left to environment detection: `next/jest` loads
// `.env.local`, so a real `AUTH0_M2M_CLIENT_ID` would otherwise send these tests
// at the live Management API.
jest.mock("@/lib/auth0-management", () => ({
  isManagementConfigured: jest.fn(() => false),
  assignRole: jest.fn().mockResolvedValue(undefined),
  removeRole: jest.fn().mockResolvedValue(undefined),
  getUserEmail: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/email", () => ({
  sendKycApprovedEmail: jest.fn().mockResolvedValue(true),
  sendKycRejectedEmail: jest.fn().mockResolvedValue(true),
  sendKycChangesRequestedEmail: jest.fn().mockResolvedValue(true),
}));

const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<typeof getLoggedInUser>;
const mockedWithCurrentUser = withCurrentUser as jest.MockedFunction<typeof withCurrentUser>;
const mockedIsConfigured = isManagementConfigured as jest.MockedFunction<
  typeof isManagementConfigured
>;
const mockedAssignRole = assignRole as jest.MockedFunction<typeof assignRole>;
const mockedRemoveRole = removeRole as jest.MockedFunction<typeof removeRole>;
const mockedGetUserEmail = getUserEmail as jest.MockedFunction<typeof getUserEmail>;
const mockedApprovedEmail = sendKycApprovedEmail as jest.MockedFunction<
  typeof sendKycApprovedEmail
>;
const mockedRejectedEmail = sendKycRejectedEmail as jest.MockedFunction<
  typeof sendKycRejectedEmail
>;
const mockedChangesEmail = sendKycChangesRequestedEmail as jest.MockedFunction<
  typeof sendKycChangesRequestedEmail
>;

const THERAPIST_ID = "11111111-2222-4333-8444-555555555555";
const DOCUMENT_ID = "99999999-8888-4777-8666-555555555555";

const THERAPIST_ROW = { id: THERAPIST_ID, userId: "therapist-user", name: "Asha Mwangi" };

/** Every type an approval requires, all accepted. The happy path. */
const COMPLETE_DOCS = [
  { docType: "government_id", reviewStatus: "accepted" },
  { docType: "professional_license", reviewStatus: "accepted" },
  { docType: "practising_certificate", reviewStatus: "accepted" },
  { docType: "qualification", reviewStatus: "accepted" },
];

function jsonRequest(body: unknown) {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Parameters<typeof POST>[0];
}

/**
 * Chainable, thenable stand-in for a Drizzle transaction.
 *
 * Every builder method returns the builder; each `await` consumes one entry from
 * `queue`. That is enough to drive the route's statements without coupling the
 * test to which chain shape each one happens to use, and it records the values
 * passed to `.set()` and `.values()` — which is what the assertions care about.
 */
function makeTx(queue: unknown[]) {
  const sets: Record<string, unknown>[] = [];
  const inserted: Record<string, unknown>[] = [];

  const builder: Record<string, unknown> = {
    select: () => builder,
    from: () => builder,
    where: () => builder,
    limit: () => builder,
    returning: () => builder,
    set: (values: Record<string, unknown>) => {
      sets.push(values);
      return builder;
    },
    values: (values: Record<string, unknown>) => {
      inserted.push(values);
      return builder;
    },
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(queue.length > 0 ? queue.shift() : []).then(resolve, reject),
  };

  const tx = {
    select: () => builder,
    update: () => builder,
    insert: () => builder,
  };

  return { tx, sets, inserted };
}

/**
 * Queue the reads a therapist-level action performs, in order:
 * therapist row → profile row → this therapist's documents.
 */
function therapistLevelTx(opts: {
  therapistRows?: unknown[];
  profileRows?: unknown[];
  docs?: unknown[];
}) {
  return makeTx([
    opts.therapistRows ?? [THERAPIST_ROW],
    opts.profileRows ?? [{ email: "asha@example.com" }],
    opts.docs ?? COMPLETE_DOCS,
  ]);
}

/** therapist row → profile row → the updated document. */
function documentLevelTx(opts: { therapistRows?: unknown[]; docRows?: unknown[] }) {
  return makeTx([
    opts.therapistRows ?? [THERAPIST_ROW],
    [{ email: "asha@example.com" }],
    opts.docRows ?? [{ id: DOCUMENT_ID, docType: "government_id" }],
  ]);
}

function useTx(harness: ReturnType<typeof makeTx>) {
  mockedWithCurrentUser.mockImplementation(async (fn) => fn(harness.tx as never));
  return harness;
}

describe("/api/admin/therapist-kyc", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "admin-1", labels: ["admin"] }));
    mockedIsConfigured.mockReturnValue(false);
    mockedGetUserEmail.mockResolvedValue(null);
    mockedApprovedEmail.mockResolvedValue(true);
    mockedRejectedEmail.mockResolvedValue(true);
    mockedChangesEmail.mockResolvedValue(true);
    useTx(therapistLevelTx({}));
  });

  // ── Access and payload shape ───────────────────────────────────────────────

  it("requires an admin user", async () => {
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "user-1", labels: ["client"] }));

    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mockedWithCurrentUser).not.toHaveBeenCalled();
  });

  it("rejects an unknown action", async () => {
    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "delete_everything" })
    );

    expect(response.status).toBe(400);
    expect(mockedWithCurrentUser).not.toHaveBeenCalled();
  });

  it("rejects a therapistDocId that is not a uuid before it reaches Postgres", async () => {
    // Postgres raises `invalid input syntax for type uuid` on a malformed id,
    // which would surface as a 500 rather than the 400 this deserves.
    const response = await POST(jsonRequest({ therapistDocId: "not-a-uuid", action: "approve" }));

    expect(response.status).toBe(400);
    expect(mockedWithCurrentUser).not.toHaveBeenCalled();
  });

  it("refuses a rejection that carries no reason", async () => {
    // A rejection with no note is one the therapist cannot act on and the
    // platform cannot defend later, so it is not a recordable decision.
    const response = await POST(jsonRequest({ therapistDocId: THERAPIST_ID, action: "reject" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid payload");
    expect(mockedWithCurrentUser).not.toHaveBeenCalled();
  });

  it("refuses a whitespace-only reason", async () => {
    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "reject", note: "   " })
    );

    expect(response.status).toBe(400);
    expect(mockedWithCurrentUser).not.toHaveBeenCalled();
  });

  it("refuses a request_changes that carries no note", async () => {
    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "request_changes" })
    );

    expect(response.status).toBe(400);
    expect(mockedWithCurrentUser).not.toHaveBeenCalled();
  });

  it("404s when no therapist row matches", async () => {
    useTx(therapistLevelTx({ therapistRows: [] }));

    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" })
    );

    expect(response.status).toBe(404);
  });

  // ── The approval guard ─────────────────────────────────────────────────────

  it("refuses to approve when a required document has not been accepted", async () => {
    // Uploaded is not reviewed. A `pending` practising certificate is one nobody
    // has looked at, and approving over it is exactly the failure this endpoint
    // exists to make impossible.
    const harness = useTx(
      therapistLevelTx({
        docs: [
          { docType: "government_id", reviewStatus: "accepted" },
          { docType: "professional_license", reviewStatus: "accepted" },
          { docType: "practising_certificate", reviewStatus: "pending" },
          { docType: "qualification", reviewStatus: "rejected" },
        ],
      })
    );

    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.missingDocumentTypes).toEqual([
      "practising_certificate",
      "qualification",
    ]);
    // Named in the message, so the admin does not have to guess what is missing.
    expect(body.error).toMatch(/Current practising certificate/);
    expect(body.error).toMatch(/Highest qualification/);

    // Nothing was written and no role was granted: the refusal is total.
    expect(harness.sets).toHaveLength(0);
    expect(harness.inserted).toHaveLength(0);
    expect(mockedAssignRole).not.toHaveBeenCalled();
    expect(mockedApprovedEmail).not.toHaveBeenCalled();
  });

  it("refuses to approve a therapist with no documents at all", async () => {
    // The exact state both production therapists were verified in.
    const harness = useTx(therapistLevelTx({ docs: [] }));

    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.missingDocumentTypes).toEqual([
      "government_id",
      "professional_license",
      "practising_certificate",
      "qualification",
    ]);
    expect(harness.sets).toHaveLength(0);
  });

  it("does not require the optional document types", async () => {
    // `insurance` is deliberately optional — requiring it would exclude
    // qualified Kenyan practitioners who do not carry indemnity cover.
    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" })
    );

    expect(response.status).toBe(200);
  });

  // ── Approve ────────────────────────────────────────────────────────────────

  it("approves, records the audit event, and reports the ungrantable role", async () => {
    const harness = useTx(therapistLevelTx({}));

    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.kycStatus).toBe("verified");
    expect(harness.sets[0]).toEqual(
      expect.objectContaining({
        kycStatus: "verified",
        kycReviewedBy: "admin-1",
        kycReviewedAt: expect.any(Date),
      })
    );

    // The decision and its audit row are written in the same transaction, so a
    // status change can never exist without a record of who made it.
    expect(harness.inserted[0]).toEqual(
      expect.objectContaining({
        therapistId: THERAPIST_ID,
        actorId: "admin-1",
        action: "approved",
      })
    );

    // Granting the "therapist" role is an Auth0 Management API call with no
    // configured credentials, so approval is HALF complete and says so rather
    // than implying the therapist now has access.
    expect(body.roleAssigned).toBe(false);
    expect(body.warning).toMatch(/Auth0/i);
  });

  it("grants the Auth0 role on approval and says a re-login is required", async () => {
    mockedIsConfigured.mockReturnValue(true);

    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" })
    );
    const body = await response.json();

    expect(mockedAssignRole).toHaveBeenCalledWith("therapist-user", "therapist");
    expect(body.roleAssigned).toBe(true);
    // The roles claim is minted at login, so an approved therapist with a live
    // session is still refused by the portal until they sign back in.
    expect(body.notice).toMatch(/sign out and back in/i);
  });

  it("emails the approved therapist", async () => {
    await POST(jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" }));

    expect(mockedApprovedEmail).toHaveBeenCalledWith("asha@example.com", "Asha Mwangi");
  });

  it("still reports success when the role assignment fails", async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedAssignRole.mockRejectedValue(new Error("Auth0 role \"therapist\" does not exist"));

    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" })
    );
    const body = await response.json();

    // The KYC decision is already committed. A 500 here would make a completed
    // review look failed and invite the admin to repeat it.
    expect(response.status).toBe(200);
    expect(body.roleAssigned).toBe(false);
    expect(body.warning).toMatch(/does not exist/);
  });

  // ── Reject ─────────────────────────────────────────────────────────────────

  it("rejects with the reviewer's reason and revokes the role", async () => {
    mockedIsConfigured.mockReturnValue(true);
    const harness = useTx(therapistLevelTx({}));

    const response = await POST(
      jsonRequest({
        therapistDocId: THERAPIST_ID,
        action: "reject",
        note: "The practising certificate expired in March.",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kycStatus).toBe("rejected");
    expect(harness.sets[0]).toEqual(
      expect.objectContaining({
        kycStatus: "rejected",
        kycReviewNote: "The practising certificate expired in March.",
      })
    );
    expect(harness.inserted[0]).toEqual(expect.objectContaining({ action: "rejected" }));

    // A rejection has to actually remove access, not just relabel it.
    expect(mockedRemoveRole).toHaveBeenCalledWith("therapist-user", "therapist");
    expect(mockedRejectedEmail).toHaveBeenCalledWith(
      "asha@example.com",
      "Asha Mwangi",
      "The practising certificate expired in March."
    );
  });

  // ── Request changes ────────────────────────────────────────────────────────

  it("requests changes as a rejected status but a different letter", async () => {
    const harness = useTx(
      therapistLevelTx({
        docs: [
          { docType: "government_id", reviewStatus: "rejected" },
          { docType: "professional_license", reviewStatus: "accepted" },
          { docType: "practising_certificate", reviewStatus: "accepted" },
          { docType: "qualification", reviewStatus: "accepted" },
          { docType: "insurance", reviewStatus: "rejected" },
        ],
      })
    );

    const response = await POST(
      jsonRequest({
        therapistDocId: THERAPIST_ID,
        action: "request_changes",
        note: "Your ID scan is cropped — please resend the whole page.",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    // There is no separate enum value for this; the distinction lives in the
    // audit trail and in what the therapist is told.
    expect(body.kycStatus).toBe("rejected");
    expect(body.action).toBe("request_changes");
    expect(harness.inserted[0]).toEqual(
      expect.objectContaining({ action: "changes_requested" })
    );

    // Told in human labels, and including the rejected OPTIONAL document — the
    // applicant should not have to work out that `insurance` still needs redoing.
    expect(mockedChangesEmail).toHaveBeenCalledWith(
      "asha@example.com",
      "Asha Mwangi",
      "Your ID scan is cropped — please resend the whole page.",
      expect.arrayContaining([
        "Government ID",
        "Professional indemnity insurance",
      ])
    );
    expect(mockedRejectedEmail).not.toHaveBeenCalled();
  });

  // ── Per-document review ────────────────────────────────────────────────────

  it("accepts a single document without touching the therapist's status", async () => {
    const harness = useTx(documentLevelTx({}));

    const response = await POST(
      jsonRequest({
        therapistDocId: THERAPIST_ID,
        action: "review_document",
        documentId: DOCUMENT_ID,
        decision: "accepted",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.decision).toBe("accepted");
    expect(harness.sets[0]).toEqual(
      expect.objectContaining({ reviewStatus: "accepted", reviewedBy: "admin-1" })
    );
    expect(harness.inserted[0]).toEqual(
      expect.objectContaining({ action: "document_accepted", documentId: DOCUMENT_ID })
    );

    // No status change, no role change, and no email — a per-document decision
    // is interim, and mailing on each one would send five messages for a single
    // review sitting.
    expect(body.kycStatus).toBeUndefined();
    expect(mockedAssignRole).not.toHaveBeenCalled();
    expect(mockedRemoveRole).not.toHaveBeenCalled();
    expect(mockedApprovedEmail).not.toHaveBeenCalled();
    expect(mockedRejectedEmail).not.toHaveBeenCalled();
    expect(mockedChangesEmail).not.toHaveBeenCalled();
  });

  it("records a rejected document with its reason", async () => {
    const harness = useTx(documentLevelTx({}));

    const response = await POST(
      jsonRequest({
        therapistDocId: THERAPIST_ID,
        action: "review_document",
        documentId: DOCUMENT_ID,
        decision: "rejected",
        note: "Expired — this certificate ran out in March.",
      })
    );

    expect(response.status).toBe(200);
    expect(harness.sets[0]).toEqual(
      expect.objectContaining({
        reviewStatus: "rejected",
        reviewNote: "Expired — this certificate ran out in March.",
      })
    );
    expect(harness.inserted[0]).toEqual(
      expect.objectContaining({ action: "document_rejected" })
    );
  });

  it("refuses to reject a document without a reason", async () => {
    const response = await POST(
      jsonRequest({
        therapistDocId: THERAPIST_ID,
        action: "review_document",
        documentId: DOCUMENT_ID,
        decision: "rejected",
      })
    );

    expect(response.status).toBe(400);
    expect(mockedWithCurrentUser).not.toHaveBeenCalled();
  });

  it("404s when the document does not belong to this therapist", async () => {
    // The UPDATE matches on therapist id as well as document id, so a document
    // belonging to someone else is indistinguishable from one that is absent.
    useTx(documentLevelTx({ docRows: [] }));

    const response = await POST(
      jsonRequest({
        therapistDocId: THERAPIST_ID,
        action: "review_document",
        documentId: DOCUMENT_ID,
        decision: "accepted",
      })
    );

    expect(response.status).toBe(404);
  });

  // ── Notification is never allowed to fail a review ─────────────────────────

  it("falls back to Auth0 when the therapist has no profile row", async () => {
    // Therapists get a `therapists` row, not necessarily a `profiles` one, and
    // `therapists` has no email column — so Auth0 is the only directory that
    // covers everyone.
    mockedIsConfigured.mockReturnValue(true);
    mockedGetUserEmail.mockResolvedValue("asha@auth0.example");
    useTx(therapistLevelTx({ profileRows: [] }));

    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" })
    );
    const body = await response.json();

    expect(mockedGetUserEmail).toHaveBeenCalledWith("therapist-user");
    expect(mockedApprovedEmail).toHaveBeenCalledWith("asha@auth0.example", "Asha Mwangi");
    expect(body.emailWarning).toBeUndefined();
  });

  it("completes the review and warns when no address can be resolved", async () => {
    useTx(therapistLevelTx({ profileRows: [] }));

    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kycStatus).toBe("verified");
    expect(body.emailSent).toBe(false);
    expect(body.emailWarning).toMatch(/not been notified/i);
  });

  it("completes the review when the mail transport throws", async () => {
    mockedApprovedEmail.mockRejectedValue(new Error("Resend is down"));

    const response = await POST(
      jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" })
    );
    const body = await response.json();

    // The decision is durably recorded before the email is attempted. Throwing
    // here would report a completed review as a failure.
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.emailSent).toBe(false);
  });
});
