/**
 * @jest-environment node
 */
import {
  PRICE_TIERS,
  amountToChargeKes,
  assertPricingConfigured,
  describeRegionalBands,
  marketsInTier,
  platformMarginKes,
  priceTier,
  resolveMarket,
  tierForCountry,
  validatePricing,
  type PriceTier,
  type PriceTierId,
} from "@/lib/pricing";
import {
  PLAN_PRICES,
  PLAN_SESSIONS,
  PROMO_DISCOUNT_PERCENT,
  THERAPIST_REVENUE_SHARE,
  applyPromoDiscount,
  listPriceMinorPerSession,
} from "@/lib/constants";
import { MARKETS } from "@/lib/markets";

/**
 * Regional pricing — `lib/pricing.ts`.
 *
 * The four properties asserted here are the ones whose failure is a money bug
 * rather than a layout bug: the country is resolved from a header and never
 * from a client, the standard tier is the fallback on every unhappy path, a
 * band can only reduce a price, and no band can reach the therapist's payout.
 */

/** A request carrying only headers — the shape `resolveMarket` reads. */
function requestWith(headers: Record<string, string>): Request {
  return new Request("https://echopsychology.com/api/payments/initialize", {
    method: "POST",
    headers,
  });
}

describe("lib/pricing", () => {
  const originalTrust = process.env.TRUST_EDGE_COUNTRY_HEADER;

  /* Most assertions here are about what the resolver does with a header it IS
     allowed to believe, so the opt-in is on by default and switched off
     explicitly in the tests that are about the opt-in itself. */
  beforeEach(() => {
    process.env.TRUST_EDGE_COUNTRY_HEADER = "true";
  });

  afterAll(() => {
    if (originalTrust === undefined) delete process.env.TRUST_EDGE_COUNTRY_HEADER;
    else process.env.TRUST_EDGE_COUNTRY_HEADER = originalTrust;
  });

  // ── The shipped table ────────────────────────────────────────────────────

  describe("the shipped tier table", () => {
    it("is internally consistent", () => {
      expect(validatePricing()).toEqual([]);
      expect(() => assertPricingConfigured()).not.toThrow();
    });

    it("never prices a plan above its published list price", () => {
      // The invariant the whole design rests on: `/pricing` is static, so the
      // figure it publishes is the same for everybody and must be a ceiling.
      for (const tier of PRICE_TIERS) {
        for (const [plan, listKes] of Object.entries(PLAN_PRICES)) {
          expect(tier.prices[plan]).toBeLessThanOrEqual(listKes);
        }
      }
    });

    it("keeps Plus the cheapest per session in every band", () => {
      /*
       * `/pricing` prints "The lowest cost per session" on the Plus card and a
       * per-session row in the comparison table, both derived from these
       * numbers. A band that inverted the order would make the page state
       * something false about its own price list — which is the specific class
       * of bug the honesty rules in AGENTS.md exist for.
       */
      const perSession = (tier: PriceTier, plan: string) =>
        (tier.prices[plan] ?? 0) / Math.max(1, PLAN_SESSIONS[plan] ?? 1);

      for (const tier of PRICE_TIERS) {
        expect(perSession(tier, "plus")).toBeLessThan(perSession(tier, "individual"));
        expect(perSession(tier, "plus")).toBeLessThan(perSession(tier, "couples"));
      }
    });

    it("names only real ISO codes, each in at most one band", () => {
      const known = new Set(MARKETS.map((m) => m.iso));
      const seen = new Set<string>();

      for (const tier of PRICE_TIERS) {
        for (const code of tier.countries) {
          expect(known).toContain(code);
          expect(seen.has(code)).toBe(false);
          seen.add(code);
        }
      }
    });

    it("leaves the standard band without a country list, so it is the default", () => {
      expect(priceTier("standard").countries).toEqual([]);
    });
  });

  // ── The validator actually validates ─────────────────────────────────────

  describe("validatePricing", () => {
    const bands = (overrides: Partial<PriceTier>[]): PriceTier[] =>
      PRICE_TIERS.map((tier, i) => ({ ...tier, ...(overrides[i] ?? {}) }));

    it("refuses a band priced ABOVE the published list price", () => {
      const problems = validatePricing(
        bands([{}, { prices: { ...PRICE_TIERS[1]!.prices, individual: PLAN_PRICES.individual + 1 } }])
      );
      expect(problems.join("\n")).toMatch(/above the published/);
    });

    it("refuses a band that forgot a plan", () => {
      const withoutIndividual = Object.fromEntries(
        Object.entries(PRICE_TIERS[1]!.prices).filter(([plan]) => plan !== "individual")
      );
      const problems = validatePricing(bands([{}, { prices: withoutIndividual }]));
      expect(problems.join("\n")).toMatch(/has no price for plan "individual"/);
    });

    it("refuses a paid plan banded at zero, which would make it unbuyable", () => {
      const problems = validatePricing(
        bands([{}, { prices: { ...PRICE_TIERS[1]!.prices, individual: 0 } }])
      );
      expect(problems.join("\n")).toMatch(/unbuyable/);
    });

    it('catches "UK", which is not an ISO country code and would match nobody', () => {
      const problems = validatePricing(bands([{}, { countries: ["UK"] }]));
      expect(problems.join("\n")).toMatch(/"UK", which is not the ISO code/);
    });

    it("catches a country claimed by two bands", () => {
      const problems = validatePricing(bands([{}, { countries: ["UG"] }]));
      expect(problems.join("\n")).toMatch(/appears in both/);
    });

    it("catches countries enumerated on the standard band", () => {
      const problems = validatePricing(bands([{ countries: ["US"] }]));
      expect(problems.join("\n")).toMatch(/must not enumerate countries/);
    });
  });

  // ── Resolving the country, and falling back to standard ──────────────────

  describe("resolveMarket", () => {
    it("reads the Cloudflare edge header", () => {
      expect(resolveMarket(requestWith({ "cf-ipcountry": "UG" }))).toEqual({
        country: "UG",
        tier: "lowest",
        source: "edge-header",
      });
    });

    it("accepts the Vercel equivalent, since NextRequest.geo no longer exists", () => {
      expect(resolveMarket(requestWith({ "x-vercel-ip-country": "GH" })).tier).toBe("reduced");
    });

    it("upper-cases the header value rather than failing to match it", () => {
      expect(resolveMarket(requestWith({ "cf-ipcountry": "ug" })).tier).toBe("lowest");
    });

    it.each([
      ["no header at all", {}, "absent"],
      ["XX, which Cloudflare sends when it cannot geolocate", { "cf-ipcountry": "XX" }, "unusable"],
      ["T1, which Cloudflare sends for Tor traffic", { "cf-ipcountry": "T1" }, "unusable"],
      ["a malformed value", { "cf-ipcountry": "Kenya" }, "unusable"],
    ])("falls back to the standard tier on %s", (_label, headers, source) => {
      const resolved = resolveMarket(requestWith(headers as Record<string, string>));
      expect(resolved.tier).toBe("standard");
      expect(resolved.country).toBeNull();
      expect(resolved.source).toBe(source);
    });

    it("prices a country with no band at the standard tier", () => {
      // Every market outside the two discounted bands, plus the ~180 countries
      // with no market entry at all.
      expect(resolveMarket(requestWith({ "cf-ipcountry": "KE" })).tier).toBe("standard");
      expect(resolveMarket(requestWith({ "cf-ipcountry": "US" })).tier).toBe("standard");
      expect(resolveMarket(requestWith({ "cf-ipcountry": "FR" })).tier).toBe("standard");
    });

    it("IGNORES the header entirely when the operator has not vouched for it", () => {
      /*
       * The header is only as trustworthy as "nothing can reach this origin
       * except through our edge". Where that is not guaranteed, a client can
       * set it themselves — so an unset opt-in means everyone pays the standard
       * published price, which is the worst outcome a liar can engineer.
       */
      delete process.env.TRUST_EDGE_COUNTRY_HEADER;
      const resolved = resolveMarket(requestWith({ "cf-ipcountry": "UG" }));
      expect(resolved.tier).toBe("standard");
      expect(resolved.country).toBeNull();
      expect(resolved.source).toBe("edge-header-untrusted");
    });

    it("requires the opt-in to be exactly \"true\"", () => {
      for (const value of ["1", "TRUE", "yes", "true "]) {
        process.env.TRUST_EDGE_COUNTRY_HEADER = value;
        expect(resolveMarket(requestWith({ "cf-ipcountry": "UG" })).tier).toBe("standard");
      }
    });

    it("reads nothing but the country headers", () => {
      /*
       * The security core of the feature, asserted as a negative: every other
       * signal a browser controls must be inert. A `country` field in the body
       * is covered by the route test — this request carries none because the
       * resolver is never handed the body in the first place.
       */
      const resolved = resolveMarket(
        requestWith({
          "accept-language": "en-UG,sw;q=0.9",
          "x-forwarded-for": "197.232.0.1",
          "x-real-ip": "197.232.0.1",
          "user-agent": "Mozilla/5.0 (Uganda)",
          referer: "https://echopsychology.com/online-therapy/uganda",
          cookie: "country=UG",
          "x-country": "UG",
        })
      );
      expect(resolved.tier).toBe("standard");
      expect(resolved.source).toBe("absent");
    });
  });

  describe("tierForCountry", () => {
    it("maps every banded market to its band and everything else to standard", () => {
      expect(tierForCountry("NG")).toBe("reduced");
      expect(tierForCountry("TZ")).toBe("lowest");
      expect(tierForCountry("ZA")).toBe("standard");
      expect(tierForCountry(null)).toBe("standard");
      expect(tierForCountry("")).toBe("standard");
      expect(tierForCountry(undefined)).toBe("standard");
    });
  });

  // ── The charged amount ───────────────────────────────────────────────────

  describe("amountToChargeKes", () => {
    it("charges the published price at the standard tier", () => {
      const charge = amountToChargeKes({ plan: "individual", tier: "standard" });
      expect(charge).toMatchObject({
        listKes: PLAN_PRICES.individual,
        tierKes: PLAN_PRICES.individual,
        chargeKes: PLAN_PRICES.individual,
        effectiveDiscountPercent: 0,
      });
    });

    it("charges less at a discounted tier, and never more anywhere", () => {
      for (const tier of PRICE_TIERS) {
        for (const plan of ["individual", "plus", "couples"]) {
          const charge = amountToChargeKes({ plan, tier: tier.id })!;
          expect(charge.chargeKes).toBeLessThanOrEqual(charge.listKes);
          expect(charge.chargeKes).toBeGreaterThan(0);
          expect(Number.isInteger(charge.chargeKes)).toBe(true);
        }
      }

      expect(amountToChargeKes({ plan: "individual", tier: "lowest" })!.chargeKes).toBeLessThan(
        amountToChargeKes({ plan: "individual", tier: "standard" })!.chargeKes
      );
    });

    it("clamps a band that somehow exceeds the list price, rather than charging it", () => {
      // Defence in depth behind `validatePricing`: this is the line that
      // decides what a card is debited, so it enforces the ceiling itself.
      const rogue: PriceTier = {
        id: "lowest",
        label: "Rogue",
        prices: { ...priceTier("lowest").prices, individual: 99_999 },
        countries: ["UG"],
      };
      const spy = jest.spyOn(PRICE_TIERS, "find").mockReturnValue(rogue);
      try {
        expect(amountToChargeKes({ plan: "individual", tier: "lowest" })!.chargeKes).toBe(
          PLAN_PRICES.individual
        );
      } finally {
        spy.mockRestore();
      }
    });

    it("returns null for an unknown plan rather than a number", () => {
      expect(amountToChargeKes({ plan: "enterprise", tier: "standard" })).toBeNull();
      expect(amountToChargeKes({ plan: "", tier: "lowest" })).toBeNull();
    });

    describe("with a promo code", () => {
      it("does not stack a promo on a band — the client gets whichever is lower", () => {
        const promoOnList = applyPromoDiscount(PLAN_PRICES.individual, PROMO_DISCOUNT_PERCENT);
        const lowest = amountToChargeKes({ plan: "individual", tier: "lowest" })!.tierKes;

        const charge = amountToChargeKes({
          plan: "individual",
          tier: "lowest",
          promoPercent: PROMO_DISCOUNT_PERCENT,
        })!;

        expect(charge.chargeKes).toBe(Math.min(promoOnList, lowest));
        // Compounding them would be 0.55 × 0.50 of list, which is below the
        // therapist's accrual for the session. See the module comment.
        expect(charge.chargeKes).toBeGreaterThan(
          Math.round(lowest * (1 - PROMO_DISCOUNT_PERCENT / 100))
        );
      });

      it("keeps a promo on the LOWEST tier positive, integral and above the promo floor", () => {
        for (const plan of ["individual", "plus", "couples"]) {
          const charge = amountToChargeKes({ plan, tier: "lowest", promoPercent: 50 })!;
          expect(charge.chargeKes).toBeGreaterThan(0);
          expect(Number.isInteger(charge.chargeKes)).toBe(true);
          expect(charge.chargeKes).toBeGreaterThanOrEqual(
            applyPromoDiscount(charge.listKes, 50)
          );
          expect(charge.chargeKes).toBeLessThanOrEqual(charge.tierKes);
        }
      });

      it("cannot be driven negative, or to NaN, by a nonsensical percentage", () => {
        /*
         * `applyPromoDiscount` clamps to 0–100; this pins that the clamp still
         * holds once a band is in the arithmetic too. NaN is in the list
         * because it was not handled: `Math.min(100, Math.max(0, NaN))` is NaN,
         * which reached Paystack as `amount: NaN` — not a cheaper price, not a
         * price at all. It now falls back to charging the tier price.
         */
        for (const percent of [-50, 0, 101, 1000, Number.NaN, Number.POSITIVE_INFINITY]) {
          const charge = amountToChargeKes({
            plan: "individual",
            tier: "lowest",
            promoPercent: percent,
          })!;
          expect(Number.isInteger(charge.chargeKes)).toBe(true);
          expect(charge.chargeKes).toBeGreaterThanOrEqual(0);
          expect(charge.chargeKes).toBeLessThanOrEqual(charge.tierKes);
        }

        expect(
          amountToChargeKes({
            plan: "individual",
            tier: "lowest",
            promoPercent: Number.NaN,
          })!.chargeKes
        ).toBe(priceTier("lowest").prices.individual);
      });

      it("treats a 100% code as zero, which the payment route refuses, not as a negative", () => {
        const charge = amountToChargeKes({
          plan: "individual",
          tier: "lowest",
          promoPercent: 100,
        })!;
        expect(charge.chargeKes).toBe(0);
      });
    });
  });

  // ── The therapist's pay does not move ────────────────────────────────────

  describe("therapist accrual", () => {
    it("is measured from the list price, whatever the client's country", () => {
      /*
       * `payout_ledger.gross_minor` comes from this function and this function
       * takes a plan. There is no band, country or charged amount in its
       * signature, so a client in Kampala cannot reduce a Nairobi clinician's
       * fee — which is the whole point of `THERAPIST_PAID_ON_LIST_PRICE`.
       */
      for (const plan of ["individual", "plus", "couples"]) {
        const expected = Math.round(
          (PLAN_PRICES[plan]! * 100) / Math.max(1, PLAN_SESSIONS[plan] ?? 1)
        );
        expect(listPriceMinorPerSession(plan)).toBe(expected);
      }
    });

    it("pins the arity of listPriceMinorPerSession at one", () => {
      // Adding a second parameter is precisely how a regional price would reach
      // payroll, and the ledger stores the number as a fact at accrual time —
      // so the damage would be invisible and not retroactively fixable.
      expect(listPriceMinorPerSession.length).toBe(1);
    });

    it("accrues the same therapist share under every band", () => {
      for (const plan of ["individual", "plus", "couples"]) {
        const shares = PRICE_TIERS.map((tier) => {
          const charge = amountToChargeKes({ plan, tier: tier.id })!;
          return platformMarginKes(plan, charge.chargeKes)!.therapistKes;
        });
        expect(new Set(shares).size).toBe(1);
      }
    });

    it("reports the platform clearing less than the clinician at both discounted bands", () => {
      /*
       * Not a failure — a documented, deliberate cost of not financing regional
       * pricing out of clinician pay. Asserted so that the day someone changes
       * a band, the consequence shows up in a test rather than in a quarterly
       * review. Individual plan: therapist 40% of list = 800, platform keeps
       * 600 at `reduced` and 300 at `lowest`.
       */
      const therapistKes = Math.round(PLAN_PRICES.individual * THERAPIST_REVENUE_SHARE);

      const at = (tier: PriceTierId) =>
        platformMarginKes(
          "individual",
          amountToChargeKes({ plan: "individual", tier })!.chargeKes
        )!;

      expect(at("standard")).toMatchObject({ therapistKes, platformClearsLess: false });
      expect(at("reduced").platformClearsLess).toBe(true);
      expect(at("lowest").platformClearsLess).toBe(true);
      expect(at("lowest").platformKes).toBeLessThan(therapistKes);
    });

    it("returns null for an unknown plan instead of a margin of zero", () => {
      expect(platformMarginKes("enterprise", 1000)).toBeNull();
    });
  });

  // ── The public disclosure ────────────────────────────────────────────────

  describe("describeRegionalBands", () => {
    it("names every discounted band's countries and price, from the table", () => {
      const sentence = describeRegionalBands();

      for (const tier of PRICE_TIERS) {
        if (tier.countries.length === 0) continue;
        for (const market of marketsInTier(tier.id)) {
          expect(sentence).toContain(market.country);
        }
        expect(sentence).toContain(tier.prices.individual!.toLocaleString("en-US"));
      }
    });

    it("says nothing about the standard band, which is what the page already shows", () => {
      expect(describeRegionalBands()).not.toContain("Kenya");
    });
  });
});
