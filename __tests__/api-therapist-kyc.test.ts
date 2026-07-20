/**
 * @jest-environment node
 */
import { POST } from "@/app/api/admin/therapist-kyc/route";
import { getLoggedInUser } from "@/lib/auth/session";
import { withCurrentUser } from "@/lib/db/session";
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

const THERAPIST_ID = "11111111-2222-4333-8444-555555555555";

function jsonRequest(body: unknown) {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Parameters<typeof POST>[0];
}

describe("/api/admin/therapist-kyc", () => {
  /** Rows the therapist UPDATE ... RETURNING resolves to. Empty means "no such row". */
  let therapistRows: { id: string; userId: string }[];
  let updates: { set: Record<string, unknown> }[];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "admin-1", labels: ["admin"] }));

    therapistRows = [{ id: THERAPIST_ID, userId: "therapist-user" }];
    updates = [];

    /*
     * Stand-in for two Drizzle statements:
     *   update(therapists).set(…).where(…).returning(…)   → therapistRows
     *   update(kycDocuments).set(…).where(…)              → awaited directly
     * so `where()` must be both awaitable and carry `returning`.
     */
    const tx = {
      update: () => ({
        set: (set: Record<string, unknown>) => {
          updates.push({ set });
          return {
            where: () => ({
              returning: () => Promise.resolve(therapistRows),
              then: (resolve: (v: unknown) => unknown) =>
                Promise.resolve([]).then(resolve),
            }),
          };
        },
      }),
    };

    mockedWithCurrentUser.mockImplementation(async (fn) => fn(tx as never));
  });

  it("requires an admin user", async () => {
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "user-1", labels: ["client"] }));

    const response = await POST(jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mockedWithCurrentUser).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(jsonRequest({ therapistDocId: "", action: "approve" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid payload");
  });

  it("rejects a therapistDocId that is not a uuid before it reaches Postgres", async () => {
    // Postgres raises `invalid input syntax for type uuid` on a malformed id,
    // which would surface as a 500 rather than the 400 this deserves.
    const response = await POST(jsonRequest({ therapistDocId: "not-a-uuid", action: "approve" }));

    expect(response.status).toBe(400);
    expect(mockedWithCurrentUser).not.toHaveBeenCalled();
  });

  it("404s when no therapist row matches", async () => {
    therapistRows = [];

    const response = await POST(jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" }));

    expect(response.status).toBe(404);
  });

  it("approves KYC and reports that the role could not be granted", async () => {
    const response = await POST(jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.kycStatus).toBe("verified");
    expect(updates[0].set).toEqual(expect.objectContaining({ kycStatus: "verified" }));

    // Granting the "therapist" role is an Auth0 Management API call with no
    // configured credentials, so approval is HALF complete and says so rather
    // than implying the therapist now has access.
    expect(body.roleAssigned).toBe(false);
    expect(body.warning).toMatch(/Auth0/i);
  });

  it("stamps the KYC document review trail on approval", async () => {
    await POST(jsonRequest({ therapistDocId: THERAPIST_ID, action: "approve" }));

    // Second UPDATE targets kyc_documents. Appwrite had no review trail at all.
    expect(updates[1].set).toEqual(
      expect.objectContaining({ reviewedBy: "admin-1", reviewedAt: expect.any(Date) })
    );
  });

  it("rejects KYC without emitting a role warning", async () => {
    const response = await POST(jsonRequest({ therapistDocId: THERAPIST_ID, action: "reject" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kycStatus).toBe("rejected");
    expect(body.warning).toBeUndefined();
  });
});
