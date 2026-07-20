/**
 * @jest-environment node
 */
import { POST } from "@/app/api/promo/route";
import { getLoggedInUser } from "@/lib/auth/session";
import { withCurrentUser } from "@/lib/db/session";
import { promos } from "@/lib/db/schema";
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
  const originalPromoCode = process.env.PROMO_CODE;

  /**
   * Stand-in for the Drizzle chain
   * `insert(promos).values(…).onConflictDoNothing(…).returning(…)`.
   *
   * `returning()` resolves to the inserted rows, or to `[]` when the primary key
   * already existed — which is exactly how the route distinguishes a fresh
   * redemption from a duplicate one, atomically and without a prior SELECT.
   */
  let returnedRows: { code: string }[];
  let insertedValues: Record<string, unknown> | undefined;
  let conflictTarget: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PROMO_CODE = "WELCOME100";
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "user-1" }));

    returnedRows = [{ code: "WELCOME100" }];
    insertedValues = undefined;
    conflictTarget = undefined;

    const tx = {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          insertedValues = values;
          return {
            onConflictDoNothing: (conflict: { target: unknown }) => {
              conflictTarget = conflict.target;
              return { returning: () => Promise.resolve(returnedRows) };
            },
          };
        },
      }),
    };

    mockedWithCurrentUser.mockImplementation(async (fn) => fn(tx as never));
  });

  afterAll(() => {
    if (originalPromoCode === undefined) {
      delete process.env.PROMO_CODE;
    } else {
      process.env.PROMO_CODE = originalPromoCode;
    }
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

  it("rejects invalid promo codes", async () => {
    const response = await POST(jsonRequest({ code: "wrong", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid promo code.");
    expect(mockedWithCurrentUser).not.toHaveBeenCalled();
  });

  it("redeems valid unused promo codes case-insensitively", async () => {
    const response = await POST(jsonRequest({ code: " welcome100 ", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // The code IS the primary key, so it is normalised before it becomes one.
    expect(insertedValues).toEqual(
      expect.objectContaining({ code: "WELCOME100", usedBy: "user-1" })
    );
    expect(conflictTarget).toBe(promos.code);
  });

  it("returns conflict when a promo code was already redeemed", async () => {
    // A primary-key conflict makes `onConflictDoNothing().returning()` empty.
    returnedRows = [];

    const response = await POST(jsonRequest({ code: "WELCOME100", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already been used");
  });
});
