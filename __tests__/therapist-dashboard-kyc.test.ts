/**
 * @jest-environment node
 *
 * Regression test for a bug that made an approved therapist redo their KYC.
 *
 * `getTherapistDashboardAction` resolved the caller's therapist row through a
 * helper that projects only `{ id, userId }` — a deliberately narrow projection,
 * because its other callers are ownership checks and the row carries
 * `license_number` and `kyc_status` behind a publicly-readable policy.
 *
 * The dashboard then read `therapist.kycStatus` off that result. It was always
 * `undefined`, and the component's `?? "incomplete"` fallback rendered that as a
 * definite "you have not submitted your KYC", with a link inviting a verified
 * clinician to start over. Postgres said `verified` the whole time, so nothing
 * in the admin UI or the database hinted at a problem.
 *
 * The test therefore asserts on the CONTRACT that was broken — that the action
 * returns the status it is asked for — rather than on the SQL that happens to
 * implement it.
 */
import { getTherapistDashboardAction } from "@/app/actions/database";
import { getLoggedInUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/session";
import { mockUser } from "@/test-utils/session";

jest.mock("@/lib/auth/session", () => ({
  getLoggedInUser: jest.fn(),
}));

jest.mock("@/lib/db/session", () => ({
  withUser: jest.fn(),
}));

const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<typeof getLoggedInUser>;
const mockedWithUser = withUser as jest.MockedFunction<typeof withUser>;

const THERAPIST_ROW = {
  id: "11111111-2222-4333-8444-555555555555",
  userId: "google-oauth2|103286891021426863669",
  name: "Reagan Owiti",
  kycStatus: "verified",
  onboardingComplete: true,
};

/**
 * Minimal stand-in for a Drizzle transaction.
 *
 * The builder is chainable and thenable: every builder method returns `this`,
 * and each `await` consumes one entry from `queue`. That is enough to drive the
 * action's four sequential reads without depending on which chain shape each
 * one uses.
 *
 * `selections` records the object passed to each `.select(...)`, so a test can
 * assert which COLUMNS were requested — the thing that actually went wrong.
 */
function makeTx(queue: unknown[]) {
  const selections: Array<Record<string, unknown> | undefined> = [];

  const builder: Record<string, unknown> = {
    select(fields?: Record<string, unknown>) {
      selections.push(fields);
      return builder;
    },
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then(resolve: (value: unknown) => void) {
      resolve(queue.shift() ?? []);
    },
  };

  return { tx: builder, selections };
}

describe("getTherapistDashboardAction — KYC status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetLoggedInUser.mockResolvedValue(
      mockUser({ $id: THERAPIST_ROW.userId, labels: ["therapist"] })
    );
  });

  function runWith(therapistRows: unknown[]) {
    const { tx, selections } = makeTx([
      therapistRows,                                  // therapist lookup
      [{ all: 0, thisWeek: 0, pending: 0 }],          // counts
      [],                                             // today
      [],                                             // pending
    ]);

    // Cast because the real `withUser` hands `fn` a fully-typed Drizzle
    // transaction and `tx` above is a deliberate stub. The cast is confined to
    // this line rather than loosening the mock's declared type.
    mockedWithUser.mockImplementation(((
      _user: unknown,
      fn: (t: unknown) => Promise<unknown>
    ) => fn(tx)) as unknown as typeof withUser);

    return { result: getTherapistDashboardAction(), selections };
  }

  it("returns the stored kycStatus, so a verified therapist is not asked to redo KYC", async () => {
    const { result } = runWith([THERAPIST_ROW]);
    const { therapist } = await result;

    expect(therapist).not.toBeNull();
    // The assertion that fails against the old implementation: the field was
    // absent, so this read `undefined` and the UI substituted "incomplete".
    expect(therapist?.kycStatus).toBe("verified");
  });

  it("asks the database for kyc_status in the same query that finds the row", async () => {
    const { result, selections } = runWith([THERAPIST_ROW]);
    await result;

    // A row can only carry a status the query selected. Asserting on the
    // projection catches the regression even if a future refactor stops the
    // fixture above from being representative.
    expect(selections[0]).toHaveProperty("kycStatus");
  });

  it("still reports no therapist when the caller has no therapist row", async () => {
    const { result } = runWith([]);
    const { therapist, stats } = await result;

    // The genuinely-not-a-therapist case must stay distinguishable from the
    // bug: null therapist, not a therapist with a defaulted status.
    expect(therapist).toBeNull();
    expect(stats).toBeNull();
  });

  it.each(["incomplete", "pending", "rejected"] as const)(
    "passes through a %s status unchanged",
    async (status) => {
      const { result } = runWith([{ ...THERAPIST_ROW, kycStatus: status }]);
      const { therapist } = await result;
      expect(therapist?.kycStatus).toBe(status);
    }
  );
});
