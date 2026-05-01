/**
 * lib/clinical/risk.ts
 * 
 * Utility functions for scanning text and data for clinical risk indicators.
 */

export type RiskLevel = "low" | "moderate" | "high";

export interface RiskIndicator {
  level: RiskLevel;
  keywords: string[];
  reason: string;
}

const HIGH_RISK_KEYWORDS = [
  "suicide", "suicidal", "kill myself", "end it all", "don't want to live",
  "better off dead", "self-harm", "cutting", "overdose", "plan to die",
  "goodbye", "final note", "no way out"
];

const MODERATE_RISK_KEYWORDS = [
  "hopeless", "pointless", "cant go on", "can't go on", "giving up",
  "crisis", "panic attack", "hurting myself", "scared of myself",
  "worthless", "severe depression", "nothing matters"
];

/**
 * Scans text for clinical risk keywords and returns a RiskLevel.
 */
export function analyzeRisk(text: string): RiskLevel {
  const normalized = text.toLowerCase();
  
  if (HIGH_RISK_KEYWORDS.some(k => normalized.includes(k))) {
    return "high";
  }
  
  if (MODERATE_RISK_KEYWORDS.some(k => normalized.includes(k))) {
    return "moderate";
  }
  
  return "low";
}

/**
 * Returns a human-readable explanation of the risk level.
 */
export function getRiskDescription(level: RiskLevel): string {
  switch (level) {
    case "high": return "Immediate clinical attention required. High probability of self-harm or suicidal ideation.";
    case "moderate": return "Moderate risk indicators detected. Monitor closely and review safety plan.";
    case "low": return "No specific acute risk indicators detected in recent data.";
  }
}

/**
 * Colors for risk levels
 */
export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "high": return "text-red-600 bg-red-100 border-red-200";
    case "moderate": return "text-amber-600 bg-amber-100 border-amber-200";
    case "low": return "text-emerald-600 bg-green-100 border-green-200";
  }
}
