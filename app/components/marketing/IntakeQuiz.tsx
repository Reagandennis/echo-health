"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { capture } from "@/lib/analytics/client";
import { ArrowLeft, ArrowRight, Check, LifeBuoy, Lock, ShieldCheck } from "lucide-react";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import {
  INTAKE_STORAGE_KEY,
  needsGuardian,
  recommendPlan,
  visibleQuestions,
  type Answers,
  type Question,
} from "@/lib/intake";
import { PLAN_LABELS, PLAN_PRICES, PLAN_SESSIONS, PLAN_CURRENCY } from "@/lib/constants";

/**
 * The intake questionnaire.
 *
 * One question per screen, because the alternative — a single long form — is
 * what a person in a bad week closes. Everything about this component is in
 * service of the same thing: keep the next action obvious and small.
 *
 * ## Three constraints that are not style choices
 *
 * 1. **No answer reaches PostHog.** Captures carry `step` and `total` only.
 *    See `INTAKE_*` in `lib/analytics/events.ts`.
 * 2. **The crisis route is visible on every screen.** This form asks people
 *    about trauma and low mood; a proportion of the people answering it should
 *    be calling a helpline instead, and they must not have to find one.
 * 3. **Nothing is submitted anywhere until sign-up.** The answers live in this
 *    component and in `sessionStorage`. Nobody has agreed to anything yet.
 */

const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: PLAN_CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);

export default function IntakeQuiz() {
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  const questions = useMemo(() => visibleQuestions(answers), [answers]);
  const total = questions.length;
  const question = questions[index];

  useEffect(() => {
    capture(ANALYTICS_EVENTS.INTAKE_STARTED);
  }, []);

  /*
   * Restore a half-finished quiz, and honour a pre-seeded first answer.
   *
   * `?for=self|couple|teen` comes from the home page's three hero cards. The
   * card IS the first question, so arriving with it already answered should
   * skip question one rather than ask it again — which is the whole reason the
   * hero is three cards instead of one button.
   *
   * Read from `window.location.search` rather than `useSearchParams`, matching
   * the pattern in `app/(auth)/signup/page.tsx`: `useSearchParams` would force
   * this component behind a Suspense boundary, and the value is only ever
   * needed in the browser.
   */
  /*
   * `react-hooks/set-state-in-effect` is disabled here deliberately, and this
   * is the one place in the component where that is defensible.
   *
   * The rule's advice — derive it during render, or set state from a
   * subscription callback — cannot apply: `sessionStorage` and
   * `window.location` do not exist while this renders on the server, and a
   * lazy `useState` initialiser that read them would produce a first client
   * render that disagrees with the server HTML. That is a hydration mismatch,
   * which is a worse bug than one extra render.
   *
   * Reading a value out of an external store on mount is the case effects are
   * actually for. It runs once, and the render it triggers happens before the
   * user can have interacted with anything.
   */
  /* eslint-disable react-hooks/set-state-in-effect -- see the note above */
  useEffect(() => {
    let restored: Answers = {};
    try {
      const saved = sessionStorage.getItem(INTAKE_STORAGE_KEY);
      if (saved) restored = JSON.parse(saved) as Answers;
    } catch {
      /* Private mode, or storage disabled. Starting fresh is a fine outcome —
         this is a convenience, never the source of truth. */
    }

    const seed = new URLSearchParams(window.location.search).get("for");
    /* Validated against the real option values: an unknown `?for=` must fall
       through to asking the question, never seed a fact nothing can read. */
    if (seed === "self" || seed === "couple" || seed === "teen") {
      restored = { ...restored, who: [seed] };
      setIndex(1);
    }

    if (Object.keys(restored).length > 0) setAnswers(restored);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = useCallback((next: Answers) => {
    setAnswers(next);
    try {
      sessionStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* See above. */
    }
  }, []);

  const advance = useCallback(() => {
    capture(ANALYTICS_EVENTS.INTAKE_STEP_COMPLETED, { step: index + 1, total });
    if (index + 1 >= total) {
      setDone(true);
      capture(ANALYTICS_EVENTS.INTAKE_COMPLETED, { plan: recommendPlan(answers) });
    } else {
      setIndex(index + 1);
    }
  }, [index, total, answers]);

  function choose(q: Question, value: string) {
    if (q.multi) {
      const current = answers[q.id] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      persist({ ...answers, [q.id]: next });
      return; /* Multi-select waits for Continue — tapping must not navigate. */
    }
    persist({ ...answers, [q.id]: [value] });
    /* Single-select advances on tap. One tap instead of two, ×7 screens. */
    capture(ANALYTICS_EVENTS.INTAKE_STEP_COMPLETED, { step: index + 1, total });
    if (index + 1 >= total) {
      setDone(true);
      capture(ANALYTICS_EVENTS.INTAKE_COMPLETED, {
        plan: recommendPlan({ ...answers, [q.id]: [value] }),
      });
    } else {
      setIndex(index + 1);
    }
  }

  function back() {
    if (done) {
      setDone(false);
      setIndex(total - 1);
      return;
    }
    setIndex(Math.max(0, index - 1));
  }

  if (done && needsGuardian(answers)) return <GuardianStop onBack={back} />;
  if (done) return <Recommendation answers={answers} onBack={back} />;

  const selected = answers[question.id] ?? [];
  const canContinue = question.optional || selected.length > 0;
  const progress = Math.round((index / total) * 100);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <Progress step={index + 1} total={total} percent={progress} />

      <div className="mt-10">
        <h1 className="font-display text-2xl leading-snug tracking-tight text-stone-900 sm:text-3xl">
          {question.title}
        </h1>
        {question.help && (
          <p className="mt-3 text-[15px] leading-7 text-stone-600">{question.help}</p>
        )}
        {question.multi && (
          <p className="mt-2 text-sm text-stone-500">Select all that apply.</p>
        )}
      </div>

      {/*
        A list of buttons, not a radio group.
        A single-select answer here navigates immediately, which is a button's
        semantics and not a radio's — a radio that moves you to another screen
        on arrow-key focus is a trap for keyboard users. Multi-select uses
        `aria-pressed` to report state.
      */}
      <ul className="mt-8 flex flex-col gap-3">
        {question.choices.map((choice) => {
          const on = selected.includes(choice.value);
          return (
            <li key={choice.value}>
              <button
                type="button"
                onClick={() => choose(question, choice.value)}
                aria-pressed={question.multi ? on : undefined}
                className={`flex min-h-14 w-full items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-colors ${
                  on
                    ? "border-brand-600 bg-brand-50"
                    : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center transition-colors ${
                    question.multi ? "rounded-md" : "rounded-full"
                  } ${on ? "bg-brand-600 text-white" : "border-2 border-stone-300 bg-white"}`}
                >
                  {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-stone-900">{choice.label}</span>
                  {choice.hint && (
                    <span className="mt-0.5 block text-sm text-stone-500">{choice.hint}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={back}
          disabled={index === 0}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Only multi-select screens need this — single-select advances on tap. */}
        {question.multi && (
          <button
            type="button"
            onClick={advance}
            disabled={!canContinue}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-7 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
          >
            {selected.length === 0 ? "Skip" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <CrisisNote />
    </div>
  );
}

/* ── Chrome ──────────────────────────────────────────────────────────────── */

function Progress({
  step,
  total,
  percent,
}: {
  readonly step: number;
  readonly total: number;
  readonly percent: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-stone-500">
        <span>
          Question {step} of {total}
        </span>
        <span>About {Math.max(1, total - step + 1)} min left</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Questionnaire progress"
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-200"
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/**
 * On every screen, not just the first.
 *
 * A form that asks about trauma and low mood will be answered by people who
 * need a helpline rather than a booking next week, and the moment they realise
 * that is not predictable — so the exit cannot be on one screen only.
 */
function CrisisNote() {
  return (
    <p className="mt-12 flex items-start gap-2.5 rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">
      <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
      <span>
        If you need help right now, this form is not the fastest route.{" "}
        <Link href="/crisis" className="font-semibold text-brand-700 underline underline-offset-2">
          See verified crisis lines
        </Link>{" "}
        or call 999.
      </span>
    </p>
  );
}

/* ── Terminal screens ────────────────────────────────────────────────────── */

/**
 * Under 18 and answering for themselves.
 *
 * Worth being careful with the wording. This is a person who has just spent
 * two minutes asking for help and is being told no, so it says what they *can*
 * do — which is get a parent to start the same process — and it carries the
 * crisis links rather than dropping them at a dead end.
 */
function GuardianStop({ onBack }: { readonly onBack: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-12 sm:px-6">
      <h1 className="font-display text-2xl tracking-tight text-stone-900 sm:text-3xl">
        We&apos;ll need a parent or guardian to start this with you
      </h1>
      <p className="mt-5 text-[17px] leading-8 text-stone-600">
        Echo&apos;s therapists can work with people aged 13–17, but a parent or
        guardian has to set up the account and give consent first. That is a
        legal requirement, not a judgement about whether you need support — you
        do, and asking was the right thing to do.
      </p>
      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-semibold text-stone-900">What to do next</h2>
        <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-[15px] leading-7 text-stone-600 marker:text-stone-400">
          <li>Ask a parent or guardian to open Echo and start the teen route.</li>
          <li>They create the account and give consent; you take part in the sessions.</li>
          <li>What you say to your therapist stays between you, within the usual safety limits they will explain.</li>
        </ol>
        <Link
          href="/teen-therapy"
          className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Show them how teen therapy works
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6 rounded-2xl border-2 border-brand-200 bg-brand-50 p-6">
        <h2 className="font-semibold text-brand-900">If you need someone today</h2>
        <p className="mt-2 text-[15px] leading-7 text-brand-900/80">
          Childline Kenya answers on <strong>116</strong>, free, 24 hours a day, for
          anyone under 18. You do not need a parent to call.
        </p>
        <Link
          href="/crisis"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-brand-800 ring-1 ring-inset ring-brand-200 transition-colors hover:bg-brand-100"
        >
          More crisis lines
        </Link>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-8 inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Change my answer
      </button>
    </div>
  );
}

function Recommendation({
  answers,
  onBack,
}: {
  readonly answers: Answers;
  readonly onBack: () => void;
}) {
  const plan = recommendPlan(answers);
  const sessions = PLAN_SESSIONS[plan];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-12 sm:px-6">
      <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 ring-1 ring-inset ring-brand-200">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
        All done
      </span>
      <h1 className="mt-6 font-display text-3xl leading-tight tracking-tight text-stone-900 sm:text-4xl">
        Here&apos;s what we&apos;d suggest
      </h1>
      <p className="mt-5 text-[17px] leading-8 text-stone-600">
        Based on your answers, the <strong className="text-stone-900">{PLAN_LABELS[plan]}</strong>{" "}
        plan fits best — {sessions === 1 ? "one 50-minute session" : `${sessions} 50-minute sessions`} at{" "}
        {money(PLAN_PRICES[plan])}, paid once. Create your account and we&apos;ll
        introduce you to a therapist who matches what you told us.
      </p>

      {/*
        What we will NOT do here is print the answers back as a summary card.
        This screen is frequently reached on a shared or borrowed phone, and a
        list reading "anxiety, trauma, grief" sitting on screen after the
        person walks away is a disclosure they did not choose to make.
      */}
      <div className="mt-9 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
        <h2 className="font-semibold text-stone-900">What happens next</h2>
        <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-[15px] leading-7 text-stone-600 marker:text-stone-400">
          <li>Create your account — name, email, password. Nothing you answered here is shared yet.</li>
          <li>Confirm the plan and pay once with M-Pesa, card or bank transfer.</li>
          <li>We introduce you to a matched therapist and you pick a time that works.</li>
        </ol>
        <Link
          href={`/signup?plan=${plan}`}
          className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-7 text-sm font-semibold text-white shadow-lg shadow-brand-900/15 transition-colors hover:bg-brand-700"
        >
          Create my account
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 flex items-center justify-center gap-4 text-xs text-stone-500">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" strokeWidth={2} /> Encrypted in transit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} /> Credits never expire
          </span>
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Change an answer
        </button>
        <Link
          href="/pricing"
          className="inline-flex min-h-11 items-center px-4 text-sm font-medium text-stone-600 underline underline-offset-4 transition-colors hover:text-brand-700"
        >
          Compare all plans
        </Link>
      </div>

      <CrisisNote />
    </div>
  );
}
