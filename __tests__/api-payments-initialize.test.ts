/**
 * @jest-environment node
 */
import { POST } from "@/app/api/payments/initialize/route";
import { getLoggedInUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/session";
import { initializeTransaction, toMinorUnits } from "@/lib/paystack";
import { PLAN_PRICES, PROMO_DISCOUNT_PERCENT, applyPromoDiscount } from "@/lib/constants";
import { priceTier } from "@/lib/pricing";
import { mockUser } from "@/test-utils/session";
import type { NextRequest } from "next/server";

jest.mock("@/lib/auth/session", () => ({
  getLoggedInUser: jest.fn(),
}));

jest.mock("@/lib/db/session", () => ({
  withUser: jest.fn(),
}));

/**
 * Only the network edges of the Paystack client are replaced. `toMinorUnits`
 * and `generateReference` stay real, because the whole subject of this suite is
 * the integer that arrives at `initializeTransaction` — stubbing the conversion
 * that produces it would assert nothing.
 */
jest.mock("@/lib/paystack", () => ({
  ...jest.requireActual("@/lib/paystack"),
  isPaystackConfigured: () => true,
  initializeTransaction: jest.fn(async () => ({
    authorization_url: "https://checkout.paystack.com/abc",
    access_code: "abc",
    reference: "echo_test_ref",
  })),
}));

const mockCapture = jest.fn();
jest.mock("@/lib/posthog-server", () => ({
  getPostHogClient: jest.fn(() => ({
    capture: mockCapture,
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<typeof getLoggedInUser>;
const mockedWithUser = withUser as jest.MockedFunction<typeof withUser>;
const mockedInitialize = initializeTransaction as jest.MockedFunction<typeof initializeTransaction>;

/**
 * Payment initialisation — `POST /api/payments/initialize`.
 *
 * This is the file that proves the security property regional pricing turns on:
 * **the amount sent to Paystack cannot be influenced by anything the browser
 * supplies.** The route accepts a plan id and a promo code; the country comes
 * from an edge header, and the price is computed from those two server-side
 * facts alone.
 */
describe("/api/payments/initialize", () => {
  const originalTrust = process.env.TRUST_EDGE_COUNTRY_HEADER;

  /** Rows the mocked transaction hands back for the promo lookups. */
  let promoRow: Record<string, unknown> | null;
  let redemptionRows: { paymentReference: string | null }[];
  /** What the route recorded in `payments` before redirecting. */
  let insertedPayment: Record<string, unknown> | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TRUST_EDGE_COUNTRY_HEADER = "true";
    process.env.APP_BASE_URL = "https://echopsychology.com";

    promoRow = null;
    redemptionRows = [{ paymentReference: null }];
    insertedPayment = undefined;

    /*
     * One `tx` double for both statements the route issues: the promo
     * definition (`select()` with no projection) and the held redemption
     * (`select({ paymentReference })`). Mirrors the pattern in
     * `__tests__/api-promo.test.ts`.
     */
    const tx = {
      select: (fields?: Record<string, unknown>) => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve(
                fields && "paymentReference" in fields
                  ? redemptionRows
                  : promoRow
                    ? [promoRow]
                    : []
              ),
          }),
        }),
      }),
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          insertedPayment = values;
          return Promise.resolve([]);
        },
      }),
    };

    mockedWithUser.mockImplementation(async (_user, fn) => fn(tx as never));
  });

  afterAll(() => {
    if (originalTrust === undefined) delete process.env.TRUST_EDGE_COUNTRY_HEADER;
    else process.env.TRUST_EDGE_COUNTRY_HEADER = originalTrust;
  });

  /**
   * Each case pays as its own user: `rateLimit` keys on the user id and holds
   * its buckets in module memory that survives `clearAllMocks`, so tests
   * sharing an id would eventually 429 on each other — a failure that looks
   * like a route bug and is not one.
   */
  function payAs(
    userId: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
  ) {
    mockedGetLoggedInUser.mockResolvedValue(
      mockUser({ $id: userId, email: `${userId}@example.com` })
    );

    const req = {
      url: "https://echopsychology.com/api/payments/initialize",
      json: jest.fn().mockResolvedValue(body),
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
      },
    } as unknown as NextRequest;

    return POST(req);
  }

  /** The integer actually handed to Paystack. */
  function chargedMinor(): number {
    expect(mockedInitialize).toHaveBeenCalledTimes(1);
    return mockedInitialize.mock.calls[0]![0].amountMinor;
  }

  it("charges the published price when no country is known", async () => {
    const response = await payAs("no-country", { plan: "individual" });

    expect(response.status).toBe(200);
    expect(chargedMinor()).toBe(toMinorUnits(PLAN_PRICES.individual));
    expect(await response.json()).toMatchObject({
      amount: PLAN_PRICES.individual,
      listPrice: PLAN_PRICES.individual,
      priceTier: "standard",
      currency: "KES",
    });
  });

  it("charges the regional band for a country the edge reports", async () => {
    const response = await payAs("ug-client", { plan: "individual" }, { "cf-ipcountry": "UG" });
    const body = await response.json();

    const banded = priceTier("lowest").prices.individual!;
    expect(chargedMinor()).toBe(toMinorUnits(banded));
    expect(body).toMatchObject({ amount: banded, priceTier: "lowest" });
    // The published price still travels alongside it, so a receipt can show
    // what was paid against what is advertised.
    expect(body.listPrice).toBe(PLAN_PRICES.individual);
    expect(body.amount).toBeLessThan(body.listPrice);
  });

  // ── The security property ────────────────────────────────────────────────

  describe("the amount cannot be influenced by the browser", () => {
    it("ignores a country supplied in the request body", async () => {
      /*
       * The single most important assertion in this file. If the charged amount
       * were derived from anything in the body, a visitor would pick their own
       * price — and `lib/useCurrency.ts` detects a country in the BROWSER, from
       * `ipapi.co`, which is why the route must never grow a body field for it.
       */
      const response = await payAs("body-liar", {
        plan: "individual",
        country: "UG",
        tier: "lowest",
        priceTier: "lowest",
        market: "uganda",
      });

      expect(response.status).toBe(200);
      expect(chargedMinor()).toBe(toMinorUnits(PLAN_PRICES.individual));
      expect((await response.json()).priceTier).toBe("standard");
    });

    it("ignores an amount, a price and a discount supplied in the request body", async () => {
      const response = await payAs("amount-liar", {
        plan: "individual",
        amount: 1,
        amountMinor: 100,
        price: 1,
        listPrice: 1,
        tierPrice: 1,
        discountPercent: 99,
      });

      expect(response.status).toBe(200);
      expect(chargedMinor()).toBe(toMinorUnits(PLAN_PRICES.individual));
      expect((await response.json()).discountPercent).toBe(0);
    });

    it("ignores locale, IP and referer headers, which a client also controls", async () => {
      await payAs(
        "header-liar",
        { plan: "individual" },
        {
          "accept-language": "en-UG,sw;q=0.9",
          "x-forwarded-for": "197.232.0.1",
          "x-real-ip": "197.232.0.1",
          referer: "https://echopsychology.com/online-therapy/uganda",
          cookie: "country=UG; tier=lowest",
        }
      );

      expect(chargedMinor()).toBe(toMinorUnits(PLAN_PRICES.individual));
    });

    it("ignores even the edge header where the deployment has not vouched for it", async () => {
      // On a directly-reachable origin `cf-ipcountry` IS client-controlled, so
      // the opt-in is the difference between a geo signal and a self-service
      // discount. Unset, everyone pays the published price.
      delete process.env.TRUST_EDGE_COUNTRY_HEADER;

      const response = await payAs("untrusted", { plan: "individual" }, { "cf-ipcountry": "UG" });

      expect(chargedMinor()).toBe(toMinorUnits(PLAN_PRICES.individual));
      expect((await response.json()).priceTier).toBe("standard");
    });

    it("records the charged amount on the payment row it will be reconciled against", async () => {
      /*
       * The webhook refuses to grant an entitlement unless Paystack's amount
       * equals `payments.amount_minor`. If a band were applied in one place and
       * not the other, every regional purchase would be recorded as an
       * "amount mismatch" and silently grant nothing.
       */
      await payAs("recorded", { plan: "plus" }, { "cf-ipcountry": "GH" });

      const banded = priceTier("reduced").prices.plus!;
      expect(insertedPayment).toMatchObject({
        plan: "plus",
        amountMinor: toMinorUnits(banded),
        currency: "KES",
        status: "pending",
      });
      expect(chargedMinor()).toBe(insertedPayment!.amountMinor);
    });
  });

  // ── Promos on top of a band ──────────────────────────────────────────────

  describe("with a promo code", () => {
    beforeEach(() => {
      promoRow = {
        code: "WELCOME50",
        discount: null,
        expiresAt: null,
        disabled: false,
      };
    });

    it("does not stack the code on the band — the lower of the two is charged", async () => {
      const response = await payAs(
        "promo-lowest",
        { plan: "individual", promoCode: "welcome50" },
        { "cf-ipcountry": "UG" }
      );

      const promoOnList = applyPromoDiscount(PLAN_PRICES.individual, PROMO_DISCOUNT_PERCENT);
      const banded = priceTier("lowest").prices.individual!;

      expect(chargedMinor()).toBe(toMinorUnits(Math.min(promoOnList, banded)));

      const body = await response.json();
      expect(body.amount).toBeGreaterThan(0);
      // Compounding would charge below the therapist's accrual for the session.
      expect(body.amount).toBeGreaterThanOrEqual(promoOnList);
      expect(body.tierPrice).toBe(banded);
      expect(body.discountPercent).toBe(PROMO_DISCOUNT_PERCENT);
    });

    it("still discounts off the published price for a standard-tier client", async () => {
      await payAs("promo-standard", { plan: "individual", promoCode: "WELCOME50" });

      expect(chargedMinor()).toBe(
        toMinorUnits(applyPromoDiscount(PLAN_PRICES.individual, PROMO_DISCOUNT_PERCENT))
      );
    });

    it("refuses a 100% code rather than sending a zero charge", async () => {
      promoRow = { ...(promoRow as object), discount: 100 };

      const response = await payAs(
        "promo-free",
        { plan: "individual", promoCode: "WELCOME50" },
        { "cf-ipcountry": "UG" }
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/does not require payment/);
      expect(mockedInitialize).not.toHaveBeenCalled();
    });
  });

  // ── Analytics ────────────────────────────────────────────────────────────

  it("captures the band and its source, and never the resolved country", async () => {
    await payAs("analytics", { plan: "individual" }, { "cf-ipcountry": "TZ" });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    const properties = mockCapture.mock.calls[0]![0].properties;

    expect(properties).toMatchObject({
      plan: "individual",
      list_price_kes: PLAN_PRICES.individual,
      tier_price_kes: priceTier("lowest").prices.individual,
      amount_kes: priceTier("lowest").prices.individual,
      price_tier: "lowest",
      tier_source: "edge-header",
    });

    /*
     * A two-letter country against a stable pseudonymous id, on a mental-health
     * platform, is one join from "this individual, in this country, is in
     * therapy". The band label answers every revenue question without it.
     */
    expect(JSON.stringify(properties)).not.toContain("TZ");
    for (const key of Object.keys(properties)) {
      expect(key).not.toMatch(/country/i);
    }
  });

  // ── Pre-existing guards, still standing ─────────────────────────────────

  it("requires an authenticated user", async () => {
    mockedGetLoggedInUser.mockResolvedValue(null);
    const response = await POST({
      url: "https://echopsychology.com/api/payments/initialize",
      json: jest.fn(),
      headers: { get: () => null },
    } as unknown as NextRequest);

    expect(response.status).toBe(401);
    expect(mockedInitialize).not.toHaveBeenCalled();
  });

  it("rejects an unknown plan", async () => {
    const response = await payAs("unknown-plan", { plan: "enterprise" });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Unknown plan");
    expect(mockedInitialize).not.toHaveBeenCalled();
  });

  it("rejects the free plan before it reaches a payment processor", async () => {
    const response = await payAs("free-plan", { plan: "free" });

    expect(response.status).toBe(400);
    expect(mockedInitialize).not.toHaveBeenCalled();
  });
});
