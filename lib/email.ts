import { Resend } from "resend";

const SENDER_NAME = process.env.SMTP_SENDER_NAME ?? "Echo Health";

/**
 * Resend's shared testing sender.
 *
 * It is a usable default for local development and a GUARANTEED FAILURE in
 * production: Resend only delivers mail from this address to the API key
 * owner's own account address. Every other recipient is refused with a 403.
 *
 * That failure mode is the dangerous kind here. `sendKyc*Email` deliberately
 * swallows transport errors — a KYC decision is already durably recorded by the
 * time mail is attempted, and throwing would make a completed review look
 * failed. So the send fails, the review succeeds, and the therapist is never
 * told. `assertSenderIsDeliverable()` below exists to make that impossible to
 * discover only from a support ticket.
 */
const RESEND_TEST_SENDER = "onboarding@resend.dev";

const SENDER_EMAIL = process.env.SMTP_SENDER_EMAIL ?? RESEND_TEST_SENDER;

let cached: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

/** Whether outbound mail can reach a recipient who is not the account owner. */
export function isEmailDeliverable(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && SENDER_EMAIL !== RESEND_TEST_SENDER;
}

let warnedAboutSender = false;

/**
 * Logs once if the configuration can send to the account owner but nobody else.
 *
 * Called before each send rather than at module load, because Next evaluates
 * this module in contexts (build, route collection) where a warning is noise.
 * Once per process is enough to be seen in logs without drowning them.
 */
function warnIfUndeliverable(recipient: string) {
  if (SENDER_EMAIL !== RESEND_TEST_SENDER || warnedAboutSender) return;
  warnedAboutSender = true;
  console.warn(
    `[email] SMTP_SENDER_EMAIL is unset, so mail is being sent from ` +
      `${RESEND_TEST_SENDER}. Resend only delivers from that address to the API ` +
      `key owner's own account, so this send to ${recipient} will almost ` +
      `certainly be refused. Set SMTP_SENDER_EMAIL to an address on a domain ` +
      `verified in your Resend account.`
  );
}

/**
 * HTML-escape an arbitrary string for safe interpolation into a server-rendered
 * HTML email body. Prevents stored-content from carrying e.g. `<a href="…">`
 * payloads when an attacker controls `name` or `message`.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmailNotification(to: string, name: string, message: string) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY is not set. Skipping email.");
    return;
  }

  warnIfUndeliverable(to);

  const safeName = escapeHtml(name);
  const safeMessage = escapeHtml(message);

  try {
    await resend.emails.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: [to],
      subject: "New Message from Echo Health Support",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #0f172a;">Hi ${safeName},</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #334155;">
            You have a new message from our support team:
          </p>
          <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #0f172a; margin: 20px 0; font-style: italic; color: #1e293b;">
            "${safeMessage}"
          </div>
          <p style="font-size: 14px; color: #64748b;">
            You can reply directly by opening the chat widget on our website.
          </p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            &copy; ${new Date().getFullYear()} Echo Health. All rights reserved.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

// ─── KYC credentialing mail ──────────────────────────────────────────────────
//
// These are sent from `/api/admin/therapist-kyc` AFTER the review transaction
// has committed. Every one of them therefore describes a decision that is
// already durable — which is why none of them throw. An exception here would
// propagate into a route that has finished its work, and the admin would see a
// completed review reported as a failure and do it again.
//
// The tone is deliberate. A credentialing decision is read by a clinician whose
// livelihood is on the other side of it, usually within a minute of a
// notification. Terse status-machine copy ("Status: REJECTED") is cheap to write
// and awful to receive, and it generates a support thread every time because it
// never says what to do next.

const APP_URL = (
  process.env.APP_BASE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://echohealth.app"
).replace(/\/$/, "");

/** Where an applicant goes to upload or re-upload documents. */
const KYC_URL = `${APP_URL}/onboarding/therapist`;

/**
 * The shared frame. Matches `sendEmailNotification` so the two do not look like
 * they came from different companies.
 */
function layout(headline: string, bodyHtml: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a;">${headline}</h2>
      ${bodyHtml}
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        &copy; ${new Date().getFullYear()} Echo Health. All rights reserved.
      </p>
    </div>
  `;
}

function paragraph(html: string): string {
  return `<p style="font-size: 16px; line-height: 1.6; color: #334155;">${html}</p>`;
}

/** A reviewer's words, visually separated from ours so it is clear who wrote them. */
function quote(safeHtml: string): string {
  return `<div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #0f172a; margin: 20px 0; color: #1e293b;">${safeHtml}</div>`;
}

function button(href: string, label: string): string {
  return `<p style="margin: 24px 0;"><a href="${href}" style="background-color: #0f172a; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 15px; display: inline-block;">${label}</a></p>`;
}

/**
 * Single exit point for KYC mail.
 *
 * No-ops when `RESEND_API_KEY` is unset (email is optional in development — a
 * missing key is a configuration choice, not an error) and swallows transport
 * failures for the reason at the top of this section. Returns whether anything
 * was actually sent, so a caller that wants to tell the admin "the decision is
 * recorded but we could not notify them" has something to check.
 */
async function sendKycEmail(
  to: string,
  subject: string,
  html: string,
  kind: string
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn(`RESEND_API_KEY is not set. Skipping ${kind} email to ${to}.`);
    return false;
  }

  warnIfUndeliverable(to);

  try {
    await resend.emails.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: [to],
      subject,
      html,
    });
    return true;
  } catch (error) {
    // Logged with the sender, because the overwhelmingly likely cause of a
    // rejection here is an unverified `from` domain rather than anything about
    // the recipient — and the error alone does not say which address was used.
    console.error(`Failed to send ${kind} email to ${to} from ${SENDER_EMAIL}:`, error);
    return false;
  }
}

/**
 * Acknowledgement that an application arrived.
 *
 * Its job is to stop the applicant wondering whether the upload worked, and to
 * set the expectation that a person — not a script — reads the documents, so
 * that a two-day wait reads as diligence rather than as something being broken.
 */
export async function sendKycSubmittedEmail(to: string, name: string): Promise<boolean> {
  const safeName = escapeHtml(name);

  return sendKycEmail(
    to,
    "We've received your Echo Health application",
    layout(
      `Thank you, ${safeName}`,
      [
        paragraph(
          "Your credentials have been received and your application is now in the review queue."
        ),
        paragraph(
          "A member of our clinical team reviews every document by hand, including checking " +
            "your registration against the issuing body's register. That takes a little time, " +
            "and it is the reason patients can trust who they are talking to on Echo Health."
        ),
        paragraph(
          "We will email you as soon as there is a decision. If we need anything clearer or " +
            "any document is missing, we will write and tell you exactly what — you do not " +
            "need to do anything in the meantime."
        ),
        button(KYC_URL, "View your application"),
      ].join("")
    ),
    "KYC submitted"
  );
}

/**
 * Approval.
 *
 * The sign-out sentence is NOT boilerplate and must not be trimmed. The
 * `therapist` role is minted into the ID token at login and then lives in the
 * session cookie, so an approved therapist whose browser still holds the old
 * session is refused by the portal they were just told they can use. Without
 * this instruction that reads as "the approval didn't work", and the predictable
 * next step is a support ticket rather than a re-login.
 */
export async function sendKycApprovedEmail(to: string, name: string): Promise<boolean> {
  const safeName = escapeHtml(name);

  return sendKycEmail(
    to,
    "You're verified on Echo Health",
    layout(
      `Congratulations, ${safeName}`,
      [
        paragraph(
          "Your credentials have been reviewed and approved. Your profile is live in the " +
            "therapist directory and you can start accepting clients."
        ),
        quote(
          "<strong>One thing to do first: sign out and sign back in.</strong><br />" +
            "Your access permissions are issued when you log in, so the session you are " +
            "signed into right now still has the old ones. Until you sign out and back in, " +
            "the therapist portal will keep turning you away — that is expected, and it is " +
            "fixed by a single re-login rather than by anything on your side."
        ),
        button(`${APP_URL}/auth/logout`, "Sign out and back in"),
        paragraph(
          "Once you are back in, set your availability so clients can book with you. " +
            "Welcome to Echo Health — we are glad to have you."
        ),
      ].join("")
    ),
    "KYC approved"
  );
}

/**
 * Rejection.
 *
 * `reason` is the reviewer's note and is the ONLY explanation the applicant
 * receives, so it is quoted verbatim rather than summarised. The copy around it
 * exists to make the note actionable: what happened, why, and that resubmitting
 * is a normal thing to do rather than an appeal against a closed door.
 */
export async function sendKycRejectedEmail(
  to: string,
  name: string,
  reason: string
): Promise<boolean> {
  const safeName = escapeHtml(name);
  const safeReason = escapeHtml(reason);

  return sendKycEmail(
    to,
    "An update on your Echo Health application",
    layout(
      `Hello ${safeName}`,
      [
        paragraph(
          "We have finished reviewing your application, and we are not able to approve it " +
            "as it stands. We know that is disappointing to read, so here is exactly why:"
        ),
        quote(safeReason),
        paragraph(
          "This is not a permanent decision and it is not a judgement of you as a clinician. " +
            "Most applications we decline are declined over a document — an expired " +
            "certificate, a name that does not match, a scan we could not read — and are " +
            "approved on the second attempt."
        ),
        paragraph(
          "You can address the points above and resubmit whenever you are ready. Your " +
            "existing documents are still on file, so you only need to replace the ones " +
            "mentioned."
        ),
        button(KYC_URL, "Update and resubmit"),
        paragraph(
          "If you believe we have got this wrong, or the reason above is not clear, reply " +
            "to this email and a person will look at it again."
        ),
      ].join("")
    ),
    "KYC rejected"
  );
}

/**
 * "Almost there — these specific documents need redoing."
 *
 * Distinct from a rejection on purpose. The status underneath is the same
 * (`rejected`, because there is no separate enum value), but the situation is
 * not, and copy that treats them identically turns a five-minute fix into
 * someone believing they were turned down.
 *
 * `missingLabels` are the human labels from `lib/kyc.ts` (e.g. "Government ID"),
 * not the enum values — the applicant should not have to decode
 * `practising_certificate`.
 */
export async function sendKycChangesRequestedEmail(
  to: string,
  name: string,
  note: string,
  missingLabels: string[]
): Promise<boolean> {
  const safeName = escapeHtml(name);
  const safeNote = escapeHtml(note);

  const list =
    missingLabels.length > 0
      ? `<ul style="font-size: 16px; line-height: 1.6; color: #334155;">${missingLabels
          .map((label) => `<li>${escapeHtml(label)}</li>`)
          .join("")}</ul>`
      : "";

  return sendKycEmail(
    to,
    "We need a few more things for your Echo Health application",
    layout(
      `Hello ${safeName}`,
      [
        paragraph(
          "We have reviewed your application and we are nearly there — we just need you to " +
            "resend some of your documents before we can approve you."
        ),
        paragraph("<strong>Here is what our reviewer said:</strong>"),
        quote(safeNote),
        ...(list
          ? [paragraph("<strong>Documents to provide or replace:</strong>"), list]
          : []),
        paragraph(
          "Everything else you sent has been accepted and is still on file — you only need " +
            "to deal with the items above. Once you resubmit, your application goes straight " +
            "back to the same reviewer."
        ),
        button(KYC_URL, "Upload the documents"),
        paragraph("If anything above is unclear, reply to this email and we will explain."),
      ].join("")
    ),
    "KYC changes requested"
  );
}
