import type { ReactNode } from "react";

/**
 * The one banner shape the auth pages use for "something went wrong" and for
 * "here is what happens next".
 *
 * Five surfaces need it (sign-in, sign-up, forgot-password, reset-password and
 * the missing-configuration notice), and an auth page whose failures look
 * different from screen to screen reads as a broken product at exactly the
 * moment a user is deciding whether to trust one. It is a Server Component —
 * nothing here is interactive.
 *
 * `error` uses `role="alert"`, which interrupts a screen reader immediately;
 * `info` uses `role="status"`, which waits for a pause. A confirmation panel
 * that barges in is worse than one that doesn't, and a failed sign-in that
 * waits is worse than one that doesn't.
 */
export type AuthAlertTone = "error" | "info";

const TONES: Record<AuthAlertTone, string> = {
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-brand-100 bg-brand-50 text-brand-900",
};

export default function AuthAlert({
  tone = "error",
  title,
  children,
}: {
  readonly tone?: AuthAlertTone;
  readonly title?: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${TONES[tone]}`}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}
