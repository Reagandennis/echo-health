import { z } from "zod";

// Reusable primitives
export const userIdSchema = z.string().min(1).max(128);
export const emailSchema = z.string().email().max(254);
export const safeTextSchema = z.string().min(1).max(4000);
export const shortTextSchema = z.string().min(1).max(256);

// /api/chat — public widget POST
export const chatMessageSchema = z.object({
  sessionId: z.string().min(8).max(128),
  name: shortTextSchema,
  email: emailSchema,
  text: safeTextSchema,
});

// /api/chat/reply — admin-only
export const chatReplySchema = z.object({
  sessionId: z.string().min(8).max(128),
  text: safeTextSchema,
  userEmail: emailSchema,
  userName: shortTextSchema,
});

// /api/user/set-role — self-service strictly limited to "client";
// "therapist" promotion happens only via admin KYC approval.
export const setRoleSchema = z.object({
  userId: userIdSchema,
  role: z.enum(["client", "therapist"]),
});

// /api/admin/therapist-kyc
export const kycReviewSchema = z.object({
  therapistDocId: z.string().min(1).max(128),
  action: z.enum(["approve", "reject"]),
});

// /api/promo
export const promoSchema = z.object({
  code: z.string().min(1).max(64),
  userId: userIdSchema,
});

// /api/video/session — narrow path allowlist, no arbitrary methods
const sessionIdPattern = "[a-zA-Z0-9_-]{1,128}";
const VIDEO_ENDPOINT_PATTERNS: ReadonlyArray<RegExp> = [
  /^\/sessions\/new$/,
  new RegExp(`^/sessions/${sessionIdPattern}/tracks/new$`),
  new RegExp(`^/sessions/${sessionIdPattern}/tracks/request$`),
  new RegExp(`^/sessions/${sessionIdPattern}/tracks/close$`),
  new RegExp(`^/sessions/${sessionIdPattern}/renegotiate$`),
];

const VIDEO_METHODS = ["GET", "POST", "PUT"] as const;

export const videoSessionSchema = z.object({
  endpoint: z
    .string()
    .min(1)
    .max(256)
    .refine(
      (v) => VIDEO_ENDPOINT_PATTERNS.some((re) => re.test(v)),
      "Endpoint not allowed"
    ),
  method: z.enum(VIDEO_METHODS).optional(),
  data: z.unknown().optional(),
});

// Helpers that turn a parse failure into a 400-friendly message
export function parseOrError<T>(schema: z.ZodType<T>, value: unknown):
  | { ok: true; data: T }
  | { ok: false; message: string } {
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  const path = first?.path?.join(".") ?? "input";
  return { ok: false, message: `${path}: ${first?.message ?? "invalid"}` };
}
