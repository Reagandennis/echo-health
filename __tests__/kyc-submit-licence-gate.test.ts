/**
 * @jest-environment node
 *
 * `submitKycForReviewAction` must refuse a therapist with no jurisdiction.
 *
 * ## The hole this closes
 *
 * The onboarding wizard calls `submitLicenceForReviewAction` before it calls
 * this, and that action refuses a therapist holding no licences. So the wizard
 * path was gated — but a server action is an HTTP endpoint, and any
 * authenticated therapist can call this one directly. Skipping the wizard's
 * first call reached `pending` with nothing on file about where the clinician
 * may practise, an admin approved what looked like a complete application, and
 * the result was a verified therapist visible to clients in thirteen countries
 * with no jurisdiction recorded — the exact state migration 0018 exists to end.
 *
 * ## Why the assertion is on the WRITE and not the return value
 *
 * The refusal has to happen before the UPDATE, not after it. A check that ran
 * afterwards would still throw, the caller would still see an error, and the
 * row would already be `pending` — so asserting only on the thrown message
 * would pass against a broken implementation. Every case below therefore also
 * asserts that `tx.update` was never reached.
 *
 * This suite mocks `@/lib/db/session`, so it says nothing about RLS or the
 * `therapist_licences_guard` trigger; `scripts/verify-kyc-security.ts` is what
 * checks those against a real database.
 */
import { submitKycForReviewAction } from "@/app/actions/database";
import { getLoggedInUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/session";
import { mockUser } from "@/test-utils/session";
import { REQUIRED_KYC_TYPES } from "@/lib/kyc";

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

const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<typeof getLoggedInUser>;
const mockedWithUser = withUser as jest.MockedFunction<typeof withUser>;

const THERAPIST_USER = "auth0|kyc-submitter";
const THERAPIST_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

/**
 * Every document type the action requires, so only the licence gate is under
 * test. Derived from `REQUIRED_KYC_TYPES` rather than typed out: a hand-written
 * list silently stops being complete the moment a required type is added, and
 * every case here would then fail on the documents gate instead of exercising
 * the licence one.
 */
const ALL_DOCS = REQUIRED_KYC_TYPES.map((docType) => ({ docType }));

/**
 * Chainable, thenable stand-in for a Drizzle transaction.
 *
 * `reads` is consumed one entry per `await` on a SELECT chain. `updates`
 * records each `.set(...)` payload — empty means the UPDATE never ran, which is
 * the assertion that actually matters here.
 */
function makeTx(reads: unknown[]) {
  const updates: Array<Record<string, unknown>> = [];

  const selectChain: Record<string, unknown> = {
    from: () => selectChain,
    where: () => selectChain,
    limit: () => selectChain,
    then(resolve: (value: unknown) => void) {
      resolve(reads.shift() ?? []);
    },
  };

  const updateChain: Record<string, unknown> = {
    set(values: Record<string, unknown>) {
      updates.push(values);
      return updateChain;
    },
    where: () => updateChain,
    returning: () => Promise.resolve([{ kycStatus: "pending", kycSubmittedAt: new Date() }]),
  };

  const tx: Record<string, unknown> = {
    select: () => selectChain,
    update: () => updateChain,
    insert: () => ({ values: () => Promise.resolve([]) }),
  };

  return { tx, updates };
}

function run(reads: unknown[]) {
  const { tx, updates } = makeTx(reads);
  mockedWithUser.mockImplementation(((
    _user: unknown,
    fn: (t: unknown) => Promise<unknown>
  ) => fn(tx)) as unknown as typeof withUser);
  return { result: submitKycForReviewAction(), updates };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetLoggedInUser.mockResolvedValue(
    mockUser({ $id: THERAPIST_USER, labels: ["therapist"] })
  );
});

describe("submitKycForReviewAction — the licence gate", () => {
  it("refuses a therapist with no licence at all, and does not write", async () => {
    const { result, updates } = run([
      [{ id: THERAPIST_ID, kycStatus: "incomplete" }],
      ALL_DOCS,
      [{ count: 0 }],
    ]);

    await expect(result).rejects.toThrow(/at least one jurisdiction/i);
    // The row must still be `incomplete`. A check placed after the UPDATE would
    // throw the same error having already moved the application to review.
    expect(updates).toHaveLength(0);
  });

  it("refuses even when every required document is present", async () => {
    /*
     * The documents gate and the licence gate are independent. Complete
     * paperwork was previously sufficient, which is what made the bypass easy:
     * the application looked finished to the reviewer.
     */
    const { result, updates } = run([
      [{ id: THERAPIST_ID, kycStatus: "incomplete" }],
      ALL_DOCS,
      [{ count: 0 }],
    ]);

    await expect(result).rejects.toThrow(/at least one jurisdiction/i);
    expect(updates).toHaveLength(0);
  });

  it("treats a missing count row as no licences rather than as permission", async () => {
    /*
     * `count(*)` always returns a row, so `[]` should be impossible. It is
     * asserted anyway because the failure direction matters: `!licences` must
     * refuse, not fall through. An `undefined` destructured from an empty
     * result is exactly how an aggregate read fails when a future refactor
     * changes the query shape.
     */
    const { result, updates } = run([
      [{ id: THERAPIST_ID, kycStatus: "incomplete" }],
      ALL_DOCS,
      [],
    ]);

    await expect(result).rejects.toThrow(/at least one jurisdiction/i);
    expect(updates).toHaveLength(0);
  });

  it("allows submission once a jurisdiction is on file", async () => {
    const { result, updates } = run([
      [{ id: THERAPIST_ID, kycStatus: "incomplete" }],
      ALL_DOCS,
      [{ count: 1 }],
    ]);

    await expect(result).resolves.toMatchObject({ kycStatus: "pending" });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ kycStatus: "pending" });
  });

  it("accepts a licence that is still incomplete", async () => {
    /*
     * Deliberately a presence check, not a status check: the reviewer assesses
     * the licence and the application together, so requiring a *verified*
     * licence first would deadlock — a licence cannot be verified before anyone
     * reviews it.
     */
    const { result } = run([
      [{ id: THERAPIST_ID, kycStatus: "incomplete" }],
      ALL_DOCS,
      [{ count: 2 }],
    ]);

    await expect(result).resolves.toMatchObject({ kycStatus: "pending" });
  });

  it("still reports a missing document before reaching the licence check", async () => {
    /*
     * Order matters for the message, not for security: an applicant missing
     * both should be told about the documents they were just uploading rather
     * than about a step further back in the wizard.
     */
    const { result, updates } = run([
      [{ id: THERAPIST_ID, kycStatus: "incomplete" }],
      [{ docType: REQUIRED_KYC_TYPES[0] }],
      [{ count: 0 }],
    ]);

    await expect(result).rejects.toThrow(/Still required/i);
    expect(updates).toHaveLength(0);
  });
});
