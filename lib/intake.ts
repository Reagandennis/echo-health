/**
 * The public intake questionnaire.
 *
 * Kept out of the component so the routing logic below can be unit tested
 * without rendering anything, and so a clinician can review the wording
 * without reading JSX.
 *
 * ## What this is NOT
 *
 * It is not an assessment. Nothing here is scored, no answer produces a
 * severity, and no answer is stored as a clinical fact. It is a matching and
 * routing form: it decides which plan to recommend and what the matching team
 * is told. `lib/clinical/risk.ts` is deliberately not called on it and must
 * not be — a substring scanner firing on a dropdown label would file crisis
 * alerts against everyone who ticked "grief".
 *
 * ## Answers are never sent to analytics
 *
 * See the note on `INTAKE_*` in `lib/analytics/events.ts`. What someone says
 * they are struggling with is health information about a person who becomes
 * identifiable two screens later at sign-up. Step numbers go to PostHog; the
 * answers go to our own database behind RLS, or nowhere.
 */

export type QuestionId =
  | "who"
  | "age"
  | "focus"
  | "experience"
  | "preferences"
  | "availability"
  | "format";

export interface Choice {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

export interface Question {
  readonly id: QuestionId;
  readonly title: string;
  readonly help?: string;
  readonly multi?: boolean;
  /** Multi-select questions can be skipped; single-select ones cannot. */
  readonly optional?: boolean;
  readonly choices: readonly Choice[];
}

export const QUESTIONS: readonly Question[] = [
  {
    id: "who",
    title: "Who is this therapy for?",
    help: "This decides the kind of session we book and who needs to be on the call.",
    choices: [
      { value: "self",   label: "Just me",           hint: "One-to-one sessions" },
      { value: "couple", label: "My partner and me", hint: "You join the same session" },
      { value: "teen",   label: "My teenager",       hint: "Ages 13–17, started by a parent or guardian" },
    ],
  },
  {
    id: "age",
    title: "How old are you?",
    help: "Therapists work with different age groups, so this narrows the match.",
    choices: [
      { value: "under18", label: "Under 18" },
      { value: "18-24",   label: "18–24" },
      { value: "25-34",   label: "25–34" },
      { value: "35-44",   label: "35–44" },
      { value: "45-54",   label: "45–54" },
      { value: "55+",     label: "55 or older" },
    ],
  },
  {
    id: "focus",
    title: "What would you like to work on?",
    help: "Choose as many as apply — or none, if you would rather talk it through first.",
    multi: true,
    optional: true,
    choices: [
      { value: "anxiety",       label: "Anxiety or worry" },
      { value: "depression",    label: "Low mood or depression" },
      { value: "stress",        label: "Stress or burnout" },
      { value: "relationships", label: "Relationships" },
      { value: "trauma",        label: "Trauma or a difficult past" },
      { value: "grief",         label: "Grief or loss" },
      { value: "self-esteem",   label: "Confidence and self-esteem" },
      { value: "sleep",         label: "Sleep" },
      { value: "work",          label: "Work or studies" },
      { value: "unsure",        label: "I'm not sure yet" },
    ],
  },
  {
    id: "experience",
    title: "Have you been in therapy before?",
    help: "There is no right answer — it just helps your therapist know where to start.",
    choices: [
      { value: "never",   label: "No, this would be my first time" },
      { value: "past",    label: "Yes, in the past" },
      { value: "current", label: "Yes, I'm seeing someone now" },
    ],
  },
  {
    id: "preferences",
    title: "Anything that matters in who you're matched with?",
    help: "We'll do our best. Skip it if you have no preference.",
    multi: true,
    optional: true,
    choices: [
      { value: "female",  label: "A woman therapist" },
      { value: "male",    label: "A man therapist" },
      { value: "swahili", label: "Speaks Kiswahili" },
      { value: "faith",   label: "Comfortable discussing faith" },
      { value: "lgbtq",   label: "LGBTQ+ affirming" },
      { value: "older",   label: "An older, very experienced therapist" },
    ],
  },
  {
    id: "availability",
    title: "When could you usually meet?",
    help: "Sessions are 50 minutes. Therapists keep hours in East Africa Time (GMT+3).",
    multi: true,
    optional: true,
    choices: [
      { value: "weekday-morning",   label: "Weekday mornings" },
      { value: "weekday-afternoon", label: "Weekday afternoons" },
      { value: "weekday-evening",   label: "Weekday evenings" },
      { value: "weekend",           label: "Weekends" },
      { value: "flexible",          label: "I'm flexible" },
    ],
  },
  {
    id: "format",
    title: "How would you rather meet?",
    help: "You can change this at any time — it is not locked in.",
    choices: [
      { value: "video",     label: "Video call", hint: "The most common choice" },
      { value: "phone",     label: "Phone call", hint: "Audio only, no camera" },
      { value: "messaging", label: "Messaging",  hint: "Write between sessions" },
      { value: "unsure",    label: "Not sure yet" },
    ],
  },
];

export type Answers = Partial<Record<QuestionId, string[]>>;

/**
 * Which plan to recommend.
 *
 * Only `who` genuinely determines this — a couple needs the joint-session
 * plan, and everyone else is choosing between one session and two. Plus is
 * recommended to people not currently in therapy because two sessions is the
 * point at which a first session has a follow-up; someone already seeing a
 * therapist is more likely to be trying one session to compare.
 *
 * Deliberately NOT a function of `focus`. Recommending a more expensive plan
 * to someone who ticked "depression" prices care by how unwell a person says
 * they are, which is indefensible whatever it does to revenue.
 */
export function recommendPlan(answers: Answers): "individual" | "plus" | "couples" {
  if (answers.who?.[0] === "couple") return "couples";
  if (answers.experience?.[0] === "current") return "individual";
  return "plus";
}

/**
 * An under-18 answering for themselves.
 *
 * Echo cannot contract with a minor and cannot treat one without a guardian,
 * so this is a stop with an explanation rather than a silent disqualification
 * discovered at checkout. The teen route exists — it just has to be started by
 * the parent, which is what the screen offers.
 */
export function needsGuardian(answers: Answers): boolean {
  return answers.who?.[0] === "self" && answers.age?.[0] === "under18";
}

/** A parent booking for their teenager is not asked their own age. */
export function visibleQuestions(answers: Answers): readonly Question[] {
  if (answers.who?.[0] === "teen") return QUESTIONS.filter((q) => q.id !== "age");
  return QUESTIONS;
}

/** Where an answered quiz hands off. `plan` survives the Auth0 round trip. */
export function signupHref(answers: Answers): string {
  return `/signup?plan=${recommendPlan(answers)}`;
}

/**
 * Key for the browser-side handoff.
 *
 * `sessionStorage` rather than a query string: the answers include what
 * somebody wants therapy for, and a query string ends up in browser history,
 * in the Referer header on the next outbound request, and — because the
 * redirect target is Auth0 — in a third party's access logs. The recommended
 * plan is the only thing that travels in the URL, and it is not health
 * information.
 */
export const INTAKE_STORAGE_KEY = "echo.intake.v1";
