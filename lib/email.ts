import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_NAME = process.env.SMTP_SENDER_NAME ?? "Echo Health";
const SENDER_EMAIL = process.env.SMTP_SENDER_EMAIL ?? "onboarding@resend.dev";

export async function sendEmailNotification(to: string, name: string, message: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set. Skipping email.");
    return;
  }

  try {
    await resend.emails.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: [to],
      subject: "New Message from Echo Health Support",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #0f172a;">Hi ${name},</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #334155;">
            You have a new message from our support team:
          </p>
          <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #0f172a; margin: 20px 0; font-style: italic; color: #1e293b;">
            "${message}"
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
