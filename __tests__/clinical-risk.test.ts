import { analyzeRisk, getRiskColor, getRiskDescription } from "@/lib/clinical/risk";

describe("clinical risk helpers", () => {
  it("flags high-risk language before moderate matches", () => {
    expect(analyzeRisk("I feel hopeless and want to kill myself")).toBe("high");
    expect(analyzeRisk("This is my final note, there is no way out")).toBe("high");
  });

  it("flags moderate-risk language when no high-risk keyword is present", () => {
    expect(analyzeRisk("I feel worthless and keep having panic attack symptoms")).toBe("moderate");
    expect(analyzeRisk("I can't go on like this")).toBe("moderate");
  });

  it("returns low risk when no configured keywords are present", () => {
    expect(analyzeRisk("I had a stressful day but I am safe tonight")).toBe("low");
  });

  it("maps descriptions and colors for every risk level", () => {
    expect(getRiskDescription("high")).toContain("Immediate clinical attention");
    expect(getRiskDescription("moderate")).toContain("Moderate risk indicators");
    expect(getRiskDescription("low")).toContain("No specific acute risk");

    expect(getRiskColor("high")).toContain("text-red-600");
    expect(getRiskColor("moderate")).toContain("text-amber-600");
    expect(getRiskColor("low")).toContain("text-emerald-600");
  });
});
