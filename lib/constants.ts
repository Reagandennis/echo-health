// ─── Plan allowances ──────────────────────────────────────────────────────────
export const PLAN_SESSIONS: Record<string, number> = {
  individual: 4,
  plus: 8,
  couples: 4,
  free: 1,
};

export const PLAN_LABELS: Record<string, string> = {
  individual: "Individual",
  plus: "Plus",
  couples: "Couples",
  free: "Free Trial",
};

export const PLAN_PRICES: Record<string, number> = {
  individual: 69,
  plus: 99,
  couples: 109,
  free: 0,
};

// ─── Emergency hotlines ───────────────────────────────────────────────────────
export const EMERGENCY_HOTLINES = [
  { name: "National Suicide Prevention Lifeline", number: "988", type: "call", country: "US", available: "24/7" },
  { name: "Crisis Text Line", number: "741741", type: "text", textKeyword: "HOME", country: "US", available: "24/7" },
  { name: "SAMHSA National Helpline", number: "1-800-662-4357", type: "call", country: "US", available: "24/7" },
  { name: "Trevor Project (LGBTQ+)", number: "1-866-488-7386", type: "call", country: "US", available: "24/7" },
  { name: "Veterans Crisis Line", number: "988", type: "call", note: "Press 1", country: "US", available: "24/7" },
  { name: "International Crisis Centres", number: "https://www.iasp.info/resources/Crisis_Centres/", type: "web", country: "Global", available: "Online" },
] as const;

// ─── Resource library ─────────────────────────────────────────────────────────
export const RESOURCE_ARTICLES = [
  { id: "r1", title: "Understanding Anxiety: Signs, Symptoms & Coping Strategies", tag: "Anxiety", type: "article", readTime: "5 min", date: "Apr 20, 2026", therapistPick: true },
  { id: "r2", title: "How to Prepare for Your First Therapy Session", tag: "Getting Started", type: "article", readTime: "4 min", date: "Apr 15, 2026", therapistPick: false },
  { id: "r3", title: "The Science Behind Mindfulness & Mental Health", tag: "Mindfulness", type: "article", readTime: "6 min", date: "Apr 10, 2026", therapistPick: true },
  { id: "r4", title: "Couples Therapy: When to Seek Help & What to Expect", tag: "Relationships", type: "article", readTime: "5 min", date: "Apr 5, 2026", therapistPick: false },
  { id: "r5", title: "CBT Thought Record Worksheet", tag: "CBT", type: "worksheet", readTime: "10 min exercise", date: "Mar 30, 2026", therapistPick: true },
  { id: "r6", title: "5-Minute Body Scan Meditation", tag: "Mindfulness", type: "exercise", readTime: "5 min", date: "Mar 25, 2026", therapistPick: false },
  { id: "r7", title: "Understanding the PHQ-9 Depression Scale", tag: "Education", type: "article", readTime: "3 min", date: "Mar 20, 2026", therapistPick: false },
  { id: "r8", title: "Sleep Hygiene Guide for Mental Wellness", tag: "Habits", type: "guide", readTime: "7 min", date: "Mar 15, 2026", therapistPick: true },
];

// ─── Mood emoji scale ─────────────────────────────────────────────────────────
export const MOOD_EMOJIS = [
  { score: 1, emoji: "😞", label: "Very low" },
  { score: 2, emoji: "😔", label: "Low" },
  { score: 3, emoji: "😕", label: "Below average" },
  { score: 4, emoji: "😐", label: "Neutral" },
  { score: 5, emoji: "🙂", label: "Okay" },
  { score: 6, emoji: "😊", label: "Good" },
  { score: 7, emoji: "😄", label: "Great" },
  { score: 8, emoji: "😁", label: "Very good" },
  { score: 9, emoji: "🤩", label: "Excellent" },
  { score: 10, emoji: "🌟", label: "Amazing" },
] as const;

export const MOOD_TAGS = [
  "Anxious", "Calm", "Tired", "Energetic", "Sad", "Happy", "Stressed",
  "Grateful", "Irritable", "Focused", "Overwhelmed", "Hopeful",
];

// ─── Placeholder therapist (until matching feature ships) ──────────────────────
export const PLACEHOLDER_THERAPIST_ID = "therapist-placeholder-001";
