/**
 * @jest-environment node
 */
import { POST } from "@/app/api/promo/route";
import { getLoggedInUser } from "@/lib/auth/session";
import { withCurrentUser } from "@/lib/db/session";
import { PROMO_DISCOUNT_PERCENT } from "@/lib/constants";
import { promos } from "@/lib/db/schema";
import { mockUser } from "@/test-utils/session";

jest.mock("@/lib/auth/session", () => ({
  getLoggedInUser: jest.fn(),
}));

jest.mock("@/lib/db/session", () => ({
  withCurrentUser: jest.fn(),
}));

/**
 * Shared across calls so the captured event can be asserted on. The factory only
 * dereferences `mockCapture` when `getPostHogClient()` is *called*, which is
 * after module init, so the hoisting of `jest.mock` is not a problem.
 */
const mockCapture = jest.fn();

jest.mock("@/lib/posthog-server", () => ({
  getPostHogClient: jest.fn(() => ({
    capture: mockCapture,
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<
  typeof getLoggedInUser
>;
const mockedWithCurrentUser = withCurrentUser as jest.MockedFunction<
  typeof withCurrentUser
>;

function jsonRequest(body: unknown) {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: { get: jest.fn(() => null) },
  } as unknown as Parameters<typeof POST>[0];
}

describe("/api/promo", () => {

  /**
   * Stand-in for the Drizzle chains the route uses.
   *
   * Two different SELECTs run against two different tables, so the mock keys off
   * which table `from()` was handed:
   *
   *   promos             — does the code exist, is it live, what discount?
   *   promo_redemptions  — does this user already hold or own it?
   *
   * The `promos` table is the source of truth: there is no `PROMO_CODE`
   * environment variable any more, so `promoRow = null` is how a non-existent
   * code is expressed.
   */
  let promoRow: Record<string, unknown> | null;
  let redemptionRows: { paymentReference: string | null }[];
  let redeemedCount: number;
  let insertedValues: Record<string, unknown> | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "user-1" }));

    promoRow = {
      code: "WELCOME100",
      discount: null,
      redemptionLimit: null,
      expiresAt: null,
      disabled: false,
    };
    redemptionRows = [];
    redeemedCount = 0;
    insertedValues = undefined;

    const tx = {
      // Dispatches on which table `from()` receives, and on whether the caller
      // asked for a count — the three shapes the route actually issues.
      select: (fields?: Record<string, unknown>) => ({
        from: (table: unknown) => ({
          where: (() => {
            const isCount = Boolean(fields && "count" in fields);
            const rows = isCount
              ? [{ count: redeemedCount }]
              : table === promos
                ? promoRow
                  ? [promoRow]
                  : []
                : redemptionRows;

            // The count query is awaited straight off `.where()`; the others
            // chain `.limit()` first.
            const result = Promise.resolve(rows) as Promise<unknown> & {
              limit: () => Promise<unknown>;
            };
            result.limit = () => Promise.resolve(rows);
            return () => result;
          })(),
        }),
      }),
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          insertedValues = values;
          return { onConflictDoNothing: () => Promise.resolve([]) };
        },
      }),
    };

    mockedWithCurrentUser.mockImplementation(async (fn) => fn(tx as never));
  });

  it("requires an authenticated user", async () => {
    mockedGetLoggedInUser.mockResolvedValue(null);

    const response = await POST(jsonRequest({ code: "WELCOME100", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("forbids redeeming a code for a different user", async () => {
    const response = await POST(jsonRequest({ code: "WELCOME100", userId: "user-2" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("rejects codes with no row in the promos table", async () => {
    promoRow = null;

    const response = await POST(jsonRequest({ code: "wrong", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid promo code.");
  });

  it("gives a disabled code the same error as a missing one", async () => {
    // Distinguishing them would let someone enumerate which codes exist.
    promoRow = { ...(promoRow as object), disabled: true };

    const response = await POST(jsonRequest({ code: "WELCOME100", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid promo code.");
  });

  it("rejects an expired code", async () => {
    promoRow = { ...(promoRow as object), expiresAt: new Date(Date.now() - 86_400_000) };

    const response = await POST(jsonRequest({ code: "WELCOME100", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("expired");
  });

  it("uses the code's own discount rather than the platform default", async () => {
    promoRow = { ...(promoRow as object), discount: 25 };

    const response = await POST(jsonRequest({ code: "WELCOME100", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.discountPercent).toBe(25);
  });

  it("rejects a code that has hit its redemption limit", async () => {
    promoRow = { ...(promoRow as object), redemptionLimit: 5 };
    redeemedCount = 5;

    const response = await POST(jsonRequest({ code: "WELCOME100", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("redemption limit");
  });

  it("accepts a valid unused code case-insensitively and claims it provisionally", async () => {
    const response = await POST(jsonRequest({ code: " welcome100 ", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // Null discount on the row falls back to the platform default.
    expect(body.discountPercent).toBe(PROMO_DISCOUNT_PERCENT);
    expect(insertedValues).toEqual(
      expect.objectContaining({ code: "WELCOME100", userId: "user-1" })
    );
  });

  it("still accepts a code held but not yet spent, so an abandoned checkout does not burn it", async () => {
    redemptionRows = [{ paymentReference: null }];

    const response = await POST(jsonRequest({ code: "WELCOME100", userId: "user-1" }));

    expect(response.status).toBe(200);
    // Already claimed — no second insert.
    expect(insertedValues).toBeUndefined();
  });

  it("rejects a code already spent on a completed payment", async () => {
    redemptionRows = [{ paymentReference: "echo_123_abc" }];

    const response = await POST(jsonRequest({ code: "WELCOME100", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already used");
  });

  describe("analytics", () => {
    /**
     * Each test posts as its own user.
     *
     * `rateLimit` keys on the user id and holds its buckets in module-level
     * memory that survives `clearAllMocks`, so tests sharing "user-1" would
     * eventually 429 on each other — a failure that looks like a route bug and
     * is not one.
     */
    async function postAs(userId: string, code = "WELCOME100") {
      mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: userId }));
      return POST(jsonRequest({ code, userId }));
    }

    /**
     * The event NAME is asserted deliberately. This route emitted
     * `promo_code_applied` while every event actually ingested was
     * `promo_code_redeemed` — one action under two names, which splits a funnel
     * in half and makes both halves look like a drop-off. Renaming it back is
     * only worth anything if it stays renamed.
     */
    it("captures promo_code_redeemed, not promo_code_applied", async () => {
      await postAs("analytics-name");

      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "promo_code_redeemed",
          // Auth0 sub, never an email or a name.
          distinctId: "analytics-name",
          properties: expect.objectContaining({
            code: "WELCOME100",
            discount_percent: PROMO_DISCOUNT_PERCENT,
          }),
        })
      );
    });

    it("marks a first claim as fresh and a re-validated hold as not", async () => {
      await postAs("analytics-fresh");
      expect(mockCapture.mock.calls[0][0].properties.fresh_claim).toBe(true);

      // Checkout re-posts the held code on every visit; counting those as new
      // redemptions would inflate the number by however many times the page was
      // reloaded.
      mockCapture.mockClear();
      redemptionRows = [{ paymentReference: null }];

      await postAs("analytics-held");
      expect(mockCapture.mock.calls[0][0].properties.fresh_claim).toBe(false);
    });

    it("captures nothing when the code was rejected", async () => {
      promoRow = null;

      await postAs("analytics-rejected", "nope");

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("still succeeds when PostHog throws", async () => {
      // The claim is already committed by this point. An analytics outage must
      // not report a successful redemption as a 500 and send the user off to
      // re-enter a code they already hold.
      mockCapture.mockImplementationOnce(() => {
        throw new Error("posthog unreachable");
      });

      const response = await postAs("analytics-throws");
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });
});
