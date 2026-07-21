/**
 * lib/clinical/risk.ts
 *
 * Substring keyword matching over free text. That is the whole implementation —
 * see `analyzeRisk` below.
 *
 * WHAT THIS IS NOT. It is not a clinical assessment, not a validated screening
 * instrument, and not calibrated against any outcome. Nobody has measured its
 * sensitivity or specificity on this population. Concretely, it:
 *
 *   - fires on QUOTED and HISTORICAL speech ("last year I felt suicidal",
 *     "my brother said he wanted to kill himself", "we covered self-harm in
 *     group") because it has no notion of who is speaking or when;
 *   - fires on ordinary words that happen to be on the list — "goodbye" ends a
 *     perfectly cheerful message, and "cutting" appears in "cutting back on
 *     caffeine";
 *   - MISSES risk expressed in any words not on the list, including euphemism,
 *     metaphor, non-English text, and anything a person in distress phrases
 *     obliquely, which is most of how distress is actually phrased.
 *
 * So a "high" result means one string matched another string. It does not mean
 * a person is in danger, and a "low" result emphatically does not mean they are
 * safe. Anything that surfaces this output to a human MUST say so at the point
 * of display — `RISK_SCANNER_DISCLOSURE` exists for that and should be rendered
 * wherever a level is shown, so the reader can weigh the signal correctly.
 */

export type RiskLevel = "low" | "moderate" | "high";

/**
 * The provenance line rendered on every surface that displays a risk level.
 *
 * Kept here, beside the keyword lists it describes, so the description cannot
 * drift away from the implementation: if the matching strategy ever changes,
 * this string is in the diff.
 */
export const RISK_SCANNER_DISCLOSURE =
  "Flagged by keyword matching, not a clinical assessment. It has no validation " +
  "and no understanding of context — it fires on quoted or past-tense speech and " +
  "misses risk phrased in any words not on its list. Read the source before acting, " +
  "and do not treat the absence of a flag as evidence that a client is safe.";

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
 * Human-readable explanation of a risk level.
 *
 * WORDING IS DELIBERATE. The "high" case previously read "High probability of
 * self-harm or suicidal ideation" — a probability claim this function has no
 * basis whatsoever to make. Substring matching cannot estimate a probability,
 * and stating one invites a reader to treat the output as a measurement rather
 * than as the string comparison it is. Each case now describes what actually
 * happened (a keyword matched, or did not) and leaves the clinical judgement to
 * the clinician. The "low" case likewise says what it means: nothing matched,
 * which is not the same as nobody being at risk.
 */
export function getRiskDescription(level: RiskLevel): string {
  switch (level) {
    case "high": return "Immediate clinical attention warranted: the text matched a high-risk keyword. A keyword match is not a diagnosis — review the source before acting.";
    case "moderate": return "Moderate risk indicators matched in the text. Read the message in context; keyword matches are frequently false positives.";
    case "low": return "No specific acute risk keywords matched. This is not evidence that no risk is present — the scanner only knows its own word list.";
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
