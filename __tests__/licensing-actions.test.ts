/**
 * @jest-environment node
 *
 * Per-jurisdiction licences (migration 0018) — the claims side.
 *
 * ## What these assert, and what they deliberately cannot
 *
 * `therapist_licences_guard` is the real control. It raises
 * `insufficient_privilege` on a therapist who writes `status`, `verification`
 * or any review column, and `check_violation` on a US or Canadian licence with
 * no subdivision. That is enforced in Postgres, and this suite mocks
 * `@/lib/db/session` — so every policy and the whole trigger could be dropped
 * and these tests would still pass. `scripts/verify-kyc-security.ts` is the
 * file that checks the guard itself against a real database, for the same
 * reason `verify-risk-pipeline.ts` exists — it carries the licence cases
 * alongside the credentialing ones, because both guard the same approval.
 *
 * What IS checkable here is the thing the guard turns into an untranslated
 * Postgres error: whether this application code ever sends a column the
 * database would refuse. A payload carrying `verification` does not merely get
 * rejected — it raises, and a raise inside the transaction rolls the licence
 * back with it, so one stray field loses the applicant's whole submission. So
 * the assertions are on the WRITES the actions emit:
 *
 *   - an applicant's insert carries `status: 'incomplete'` and no verdict column,
 *     even when the caller explicitly asks for `verified`;
 *   - the only transition they make is `incomplete`/`rejected` → `pending`;
 *   - a sub-national jurisdiction with no subdivision never reaches the database;
 *   - an admin's approval writes `verification`, `reviewed_at` and `reviewed_by`,
 *     and only a mode the jurisdiction actually admits.
 */
import {
  reviewLicenceAction,
  submitLicenceForReviewAction,
  upsertTherapistLicenceAction,
} from "@/app/actions/licensing";
import { getLoggedInUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/session";
import { mockUser } from "@/test-utils/session";

jest.mock("@/lib/auth/session", () => ({
  getLoggedInUser: jest.fn(),
}));

jest.mock("@/lib/db/session", () => ({
  withUser: jest.fn(),
}));

jest.mock("@/lib/posthog-server", () => ({
  getPostHogClient: jest.fn(() => ({
    capture: jest.fn(),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<
  typeof getLoggedInUser
>;
const mockedWithUser = withUser as jest.MockedFunction<typeof withUser>;

const THERAPIST_USER = "auth0|licence-applicant";
const THERAPIST_ID = "11111111-2222-4333-8444-555555555555";
const LICENCE_ID = "99999999-8888-4777-8666-555555555555";
const ADMIN_USER = "auth0|licence-reviewer";

/**
 * Minimal stand-in for a Drizzle transaction.
 *
 * Chainable and thenable: every builder method returns `this`, and each `await`
 * consumes one entry from `queue`. Same idiom as
 * `__tests__/therapist-dashboard-kyc.test.ts`, extended to RECORD the payload
 * of each write — `values(...)` and `set(...)` are the objects these tests are
 * about, since the question is which columns the action sends.
 */
interface RecordedCall {
  kind: "select" | "insert" | "update" | "delete";
  values?: Record<string, unknown>;
  set?: Record<string, unknown>;
}

function makeTx(queue: unknown[]) {
  const calls: RecordedCall[] = [];
  const last = () => calls[calls.length - 1];

  const builder: Record<string, unknown> = {
    select() {
      calls.push({ kind: "select" });
      return builder;
    },
    insert() {
      calls.push({ kind: "insert" });
      return builder;
    },
    update() {
      calls.push({ kind: "update" });
      return builder;
    },
    delete() {
      calls.push({ kind: "delete" });
      return builder;
    },
    values(v: Record<string, unknown>) {
      last().values = v;
      return builder;
    },
    set(v: Record<string, unknown>) {
      last().set = v;
      return builder;
    },
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    returning: () => builder,
    innerJoin: () => builder,
    leftJoin: () => builder,
    then(resolve: (value: unknown) => void) {
      resolve(queue.shift() ?? []);
    },
  };

  return { tx: builder, calls };
}

/**
 * Drive an action against `queue`.
 *
 * The cast is confined to this line: the real `withUser` hands `fn` a fully
 * typed Drizzle transaction, and `tx` is a deliberate stub.
 */
function drive(queue: unknown[]) {
  const { tx, calls } = makeTx(queue);
  mockedWithUser.mockImplementation(((
    _user: unknown,
    fn: (t: unknown) => Promise<unknown>
  ) => fn(tx)) as unknown as typeof withUser);
  return calls;
}

const THERAPIST_ROW = { id: THERAPIST_ID, userId: THERAPIST_USER };

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetLoggedInUser.mockResolvedValue(
    mockUser({ $id: THERAPIST_USER, labels: ["therapist"] })
  );
});

describe("upsertTherapistLicenceAction — an applicant cannot claim a verdict", () => {
  it("always inserts at status 'incomplete', even when the caller asks for 'verified'", async () => {
    const calls = drive([
      [THERAPIST_ROW], // getTherapistDocForUser
      [], // no existing licence for this jurisdiction
      [], // the insert
      [], // selectMyLicences
    ]);

    await upsertTherapistLicenceAction({
      jurisdiction: "united-kingdom",
      regulator: "HCPC",
      licenceNumber: "PYL12345",
      /*
       * The hostile half of the payload. `licenceUpsertSchema` has no such
       * fields, so zod strips them — and the action builds its `values` from
       * the parsed data, never from the raw input. Were any of these to reach
       * Postgres, `therapist_licences_guard` would raise and the whole
       * transaction would roll back.
       */
      status: "verified",
      verification: "named_regulator",
      reviewedBy: "auth0|not-a-reviewer",
      reviewNote: "Approved by me, myself.",
    });

    const insert = calls.find((c) => c.kind === "insert");
    expect(insert?.values).toMatchObject({
      therapistId: THERAPIST_ID,
      jurisdiction: "united-kingdom",
      status: "incomplete",
    });
    /* Absent, not merely falsy: `verification: undefined` in a Drizzle
       `values()` is dropped, but asserting on presence catches a future spread
       of the payload that would reintroduce it. */
    expect(insert?.values).not.toHaveProperty("verification");
    expect(insert?.values).not.toHaveProperty("reviewedAt");
    expect(insert?.values).not.toHaveProperty("reviewedBy");
    expect(insert?.values).not.toHaveProperty("reviewNote");
  });

  it("refuses to edit a licence that is already verified", async () => {
    const calls = drive([
      [THERAPIST_ROW],
      [
        {
          id: LICENCE_ID,
          therapistId: THERAPIST_ID,
          jurisdiction: "kenya",
          subdivision: null,
          status: "verified",
        },
      ],
    ]);

    /*
     * The guard does NOT cover this: it protects the verdict columns, not
     * `licence_number`. Without this check a clinician could have Kenya
     * approved and then swap the registration number under the verified badge.
     */
    await expect(
      upsertTherapistLicenceAction({
        jurisdiction: "kenya",
        licenceNumber: "SWAPPED-AFTER-APPROVAL",
      })
    ).rejects.toThrow(/verified/i);

    expect(calls.some((c) => c.kind === "update")).toBe(false);
  });

  it("refuses to edit a licence under review", async () => {
    drive([
      [THERAPIST_ROW],
      [
        {
          id: LICENCE_ID,
          therapistId: THERAPIST_ID,
          jurisdiction: "kenya",
          subdivision: null,
          status: "pending",
        },
      ],
    ]);

    await expect(
      upsertTherapistLicenceAction({ jurisdiction: "kenya", licenceNumber: "X" })
    ).rejects.toThrow(/under review/i);
  });

  it("answers 'Forbidden' for another therapist's licence, because the SELECT policy is USING (true)", async () => {
    drive([
      [THERAPIST_ROW],
      [
        {
          id: LICENCE_ID,
          /* A different owner. RLS hides nothing on this read — the public
             directory has to see licences — so the application check is the
             only thing between the caller and someone else's row. */
          therapistId: "22222222-3333-4444-8555-666666666666",
          jurisdiction: "kenya",
          subdivision: null,
          status: "incomplete",
        },
      ],
    ]);

    await expect(
      upsertTherapistLicenceAction({ id: LICENCE_ID, jurisdiction: "kenya" })
    ).rejects.toThrow("Forbidden");
  });
});

describe("upsertTherapistLicenceAction — sub-national jurisdictions", () => {
  it.each(["united-states", "canada"])(
    "rejects a %s licence with no state or province, before it reaches the database",
    async (jurisdiction) => {
      const calls = drive([[THERAPIST_ROW], [], [], []]);

      await expect(
        upsertTherapistLicenceAction({ jurisdiction, licenceNumber: "LPC-1" })
      ).rejects.toThrow(/state or province/i);

      /* Nothing was attempted. The trigger would also refuse this with
         `check_violation`, but that reaches the applicant as a raw Postgres
         message about a constraint they have never heard of. */
      expect(calls).toHaveLength(0);
    }
  );

  it("accepts a US licence that names its state", async () => {
    const calls = drive([[THERAPIST_ROW], [], [], []]);

    await upsertTherapistLicenceAction({
      jurisdiction: "united-states",
      subdivision: "California",
      licenceNumber: "PSY12345",
    });

    expect(calls.find((c) => c.kind === "insert")?.values).toMatchObject({
      jurisdiction: "united-states",
      subdivision: "California",
      status: "incomplete",
    });
  });

  it("refuses a subdivision on a nationally-licensed jurisdiction", async () => {
    /*
     * Rejected rather than silently dropped. `therapist_licences_unique` spans
     * `subdivision` and Postgres treats NULLs as distinct, so "kenya/null" and
     * "kenya/Nairobi" would be two accepted rows for one licence, with nothing
     * downstream able to say which was authoritative.
     */
    drive([[THERAPIST_ROW]]);

    await expect(
      upsertTherapistLicenceAction({
        jurisdiction: "kenya",
        subdivision: "Nairobi",
      })
    ).rejects.toThrow(/licenses nationally/i);
  });

  it("refuses a jurisdiction with no entry in lib/licensing.ts", async () => {
    drive([[THERAPIST_ROW]]);

    await expect(
      upsertTherapistLicenceAction({ jurisdiction: "atlantis" })
    ).rejects.toThrow(/licensing requirements/i);
  });
});

describe("submitLicenceForReviewAction — the one transition an applicant may make", () => {
  it("moves an incomplete licence to pending and clears the stale review note", async () => {
    const calls = drive([
      [THERAPIST_ROW],
      [
        {
          id: LICENCE_ID,
          therapistId: THERAPIST_ID,
          jurisdiction: "kenya",
          subdivision: null,
          status: "incomplete",
        },
      ],
      [{ id: LICENCE_ID, jurisdiction: "kenya", subdivision: null }],
    ]);

    const submitted = await submitLicenceForReviewAction(LICENCE_ID);

    expect(submitted).toEqual([
      { id: LICENCE_ID, jurisdiction: "kenya", subdivision: null },
    ]);

    const update = calls.find((c) => c.kind === "update");
    expect(update?.set).toMatchObject({ status: "pending", reviewNote: null });
    /* `review_note` → NULL while moving to `pending` is the ONE review column
       the guard lets an applicant write. Setting a value, or touching
       reviewed_at/reviewed_by, raises. */
    expect(update?.set).not.toHaveProperty("verification");
    expect(update?.set).not.toHaveProperty("reviewedAt");
    expect(update?.set).not.toHaveProperty("reviewedBy");
  });

  it("resubmits a rejected licence", async () => {
    const calls = drive([
      [THERAPIST_ROW],
      [
        {
          id: LICENCE_ID,
          therapistId: THERAPIST_ID,
          jurisdiction: "kenya",
          subdivision: null,
          status: "rejected",
        },
      ],
      [{ id: LICENCE_ID, jurisdiction: "kenya", subdivision: null }],
    ]);

    await submitLicenceForReviewAction(LICENCE_ID);
    expect(calls.find((c) => c.kind === "update")?.set).toMatchObject({
      status: "pending",
    });
  });

  it.each(["pending", "verified"])(
    "will not resubmit a %s licence",
    async (status) => {
      const calls = drive([
        [THERAPIST_ROW],
        [
          {
            id: LICENCE_ID,
            therapistId: THERAPIST_ID,
            jurisdiction: "kenya",
            subdivision: null,
            status,
          },
        ],
      ]);

      await expect(submitLicenceForReviewAction(LICENCE_ID)).rejects.toThrow(
        /already/i
      );
      expect(calls.some((c) => c.kind === "update")).toBe(false);
    }
  );

  it("refuses to submit an application with no jurisdiction at all", async () => {
    /*
     * The server-side half of the onboarding gate. A clinician listed to
     * clients in thirteen countries with nothing on file about where they may
     * practise is the state this whole feature exists to end, so the disabled
     * button is not the only thing preventing it.
     */
    drive([[THERAPIST_ROW], []]);

    await expect(submitLicenceForReviewAction()).rejects.toThrow(
      /at least one jurisdiction/i
    );
  });

  it("submits every submittable licence in one statement when given no id", async () => {
    const calls = drive([
      [THERAPIST_ROW],
      [
        { id: "a", therapistId: THERAPIST_ID, jurisdiction: "kenya", subdivision: null, status: "incomplete" },
        { id: "b", therapistId: THERAPIST_ID, jurisdiction: "united-kingdom", subdivision: null, status: "rejected" },
        { id: "c", therapistId: THERAPIST_ID, jurisdiction: "south-africa", subdivision: null, status: "verified" },
      ],
      [
        { id: "a", jurisdiction: "kenya", subdivision: null },
        { id: "b", jurisdiction: "united-kingdom", subdivision: null },
      ],
    ]);

    const submitted = await submitLicenceForReviewAction();

    expect(submitted.map((s) => s.id)).toEqual(["a", "b"]);
    /* One UPDATE, not one per licence: each `withUser` is a connection
       checkout and an identity round-trip, and the Azure tier allows ~24. */
    expect(calls.filter((c) => c.kind === "update")).toHaveLength(1);
  });
});

describe("reviewLicenceAction — only an admin, and only an honest conclusion", () => {
  function asAdmin() {
    mockedGetLoggedInUser.mockResolvedValue(
      mockUser({ $id: ADMIN_USER, labels: ["admin"] })
    );
  }

  const pendingLicence = (overrides: Record<string, unknown> = {}) => ({
    id: LICENCE_ID,
    therapistId: THERAPIST_ID,
    jurisdiction: "united-kingdom",
    subdivision: null,
    status: "pending",
    submittedAt: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  });

  it("records verification, reviewed_at and reviewed_by on an approval", async () => {
    asAdmin();
    const calls = drive([
      [pendingLicence()],
      [
        {
          status: "verified",
          verification: "named_regulator",
          jurisdiction: "united-kingdom",
          subdivision: null,
        },
      ],
      [], // kyc_review_events insert
      [{ userId: THERAPIST_USER }], // the licence owner, for the notification
      [], // notifications insert
    ]);

    const result = await reviewLicenceAction({
      licenceId: LICENCE_ID,
      action: "approve",
      verification: "named_regulator",
      note: "Register checked 12 Sep.",
    });

    expect(result.status).toBe("verified");
    expect(result.verification).toBe("named_regulator");

    const update = calls.find((c) => c.kind === "update");
    expect(update?.set).toMatchObject({
      status: "verified",
      verification: "named_regulator",
      reviewedBy: ADMIN_USER,
    });
    expect(update?.set?.reviewedAt).toBeInstanceOf(Date);

    /* The append-only trail. `kyc_review_events` predates this table and has no
       licence column, so the jurisdiction has to be in the note or the entry
       cannot be read back later. */
    const event = calls.find((c) => c.kind === "insert");
    expect(event?.values).toMatchObject({
      therapistId: THERAPIST_ID,
      actorId: ADMIN_USER,
      action: "licence_approved",
    });
    expect(String(event?.values?.note)).toContain("United Kingdom");
  });

  it("refuses 'named_regulator' for a case-by-case jurisdiction", async () => {
    asAdmin();
    /*
     * THE ASSERTION THIS SUITE EXISTS FOR. Echo has not established which body
     * regulates psychotherapy in Uganda — `lib/licensing.ts` says so in as many
     * words. Recording `named_regulator` would have the platform telling a
     * client it confirmed a registration against a register it never
     * identified. The reviewer UI does not offer the option; this is what makes
     * the UI not the control.
     */
    const calls = drive([[pendingLicence({ jurisdiction: "uganda" })]]);

    await expect(
      reviewLicenceAction({
        licenceId: LICENCE_ID,
        action: "approve",
        verification: "named_regulator",
      })
    ).rejects.toThrow(/not established which body regulates/i);

    expect(calls.some((c) => c.kind === "update")).toBe(false);
  });

  it("accepts 'case_by_case' for a case-by-case jurisdiction", async () => {
    asAdmin();
    const calls = drive([
      [pendingLicence({ jurisdiction: "uganda" })],
      [
        {
          status: "verified",
          verification: "case_by_case",
          jurisdiction: "uganda",
          subdivision: null,
        },
      ],
      [],
      [{ userId: THERAPIST_USER }],
      [],
    ]);

    await reviewLicenceAction({
      licenceId: LICENCE_ID,
      action: "approve",
      verification: "case_by_case",
    });

    expect(calls.find((c) => c.kind === "update")?.set).toMatchObject({
      verification: "case_by_case",
    });
  });

  it("refuses to approve a US licence that names no state", async () => {
    asAdmin();
    const calls = drive([
      [
        pendingLicence({
          jurisdiction: "united-states",
          subdivision: null,
        }),
      ],
    ]);

    await expect(
      reviewLicenceAction({
        licenceId: LICENCE_ID,
        action: "approve",
        verification: "sub_national",
      })
    ).rejects.toThrow(/state or province/i);

    expect(calls.some((c) => c.kind === "update")).toBe(false);
  });

  it("leaves `verification` untouched on a rejection", async () => {
    asAdmin();
    const calls = drive([
      [pendingLicence()],
      [
        {
          status: "rejected",
          verification: "case_by_case",
          jurisdiction: "united-kingdom",
          subdivision: null,
        },
      ],
      [],
      [{ userId: THERAPIST_USER }],
      [],
    ]);

    await reviewLicenceAction({
      licenceId: LICENCE_ID,
      action: "reject",
      note: "The number given does not appear on the HCPC register.",
    });

    const update = calls.find((c) => c.kind === "update");
    expect(update?.set).toMatchObject({ status: "rejected" });
    /* A rejection confirms nothing, so stamping a mode on one would put
       "verified against the HCPC register" beside a refusal. */
    expect(update?.set).not.toHaveProperty("verification");
  });

  it("will not decide a licence nobody submitted", async () => {
    asAdmin();
    const calls = drive([[pendingLicence({ status: "incomplete" })]]);

    await expect(
      reviewLicenceAction({
        licenceId: LICENCE_ID,
        action: "approve",
        verification: "named_regulator",
      })
    ).rejects.toThrow(/not been submitted/i);

    expect(calls.some((c) => c.kind === "update")).toBe(false);
  });

  it("refuses a non-admin outright, before any query", async () => {
    const calls = drive([]);

    await expect(
      reviewLicenceAction({
        licenceId: LICENCE_ID,
        action: "approve",
        verification: "named_regulator",
      })
    ).rejects.toThrow("Forbidden");

    expect(calls).toHaveLength(0);
  });

  it("requires a reason on a rejection", async () => {
    asAdmin();
    drive([]);

    await expect(
      reviewLicenceAction({ licenceId: LICENCE_ID, action: "reject" })
    ).rejects.toThrow();
  });
});
