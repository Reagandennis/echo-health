/**
 * @jest-environment node
 */
import { POST } from "@/app/api/promo/route";
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { AppwriteException } from "node-appwrite";

jest.mock("@/lib/appwrite/server", () => ({
  createAdminClient: jest.fn(),
  getLoggedInUser: jest.fn(),
}));

jest.mock("node-appwrite", () => ({
  AppwriteException: class AppwriteException extends Error {
    code: number;

    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  },
}));

const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<typeof getLoggedInUser>;

function jsonRequest(body: unknown) {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Parameters<typeof POST>[0];
}

describe("/api/promo", () => {
  const originalPromoCode = process.env.PROMO_CODE;
  const databases = {
    getCollection: jest.fn(),
    createCollection: jest.fn(),
    createStringAttribute: jest.fn(),
    createDatetimeAttribute: jest.fn(),
    getDocument: jest.fn(),
    createDocument: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PROMO_CODE = "WELCOME100";
    mockedCreateAdminClient.mockReturnValue({ databases } as unknown as ReturnType<typeof createAdminClient>);
    mockedGetLoggedInUser.mockResolvedValue({ $id: "user-1" });
    databases.getCollection.mockResolvedValue({});
    databases.getDocument.mockRejectedValue(new AppwriteException("Not found", 404));
    databases.createDocument.mockResolvedValue({ $id: "WELCOME100" });
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
    expect(databases.createDocument).not.toHaveBeenCalled();
  });

  it("redeems valid unused promo codes case-insensitively", async () => {
    const response = await POST(jsonRequest({ code: " welcome100 ", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(databases.createDocument).toHaveBeenCalledWith(
      expect.any(String),
      "promos",
      "WELCOME100",
      expect.objectContaining({ usedBy: "user-1" })
    );
  });

  it("returns conflict when a promo code was already redeemed", async () => {
    databases.getDocument.mockResolvedValue({ $id: "WELCOME100" });

    const response = await POST(jsonRequest({ code: "WELCOME100", userId: "user-1" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already been used");
  });
});
