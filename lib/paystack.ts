import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paystack API client — server-only.
 *
 * `PAYSTACK_SECRET_KEY` can charge cards, issue refunds and initiate transfers.
 * It must never be imported into a client component or exposed via a
 * `NEXT_PUBLIC_` variable. Only the public key (`pk_…`) is safe in the browser,
 * and this integration does not need it: Paystack hosts the checkout page.
 */

const BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not set");
  }
  return key;
}

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

/**
 * Convert whole currency units to the minor unit Paystack expects.
 *
 * THE ONLY PLACE THIS CONVERSION HAPPENS. Applying it twice charges 100× the
 * intended amount; forgetting it charges 1/100×. Both are silent — Paystack
 * accepts either as a valid integer — so it is centralised deliberately.
 */
export function toMinorUnits(whole: number): number {
  return Math.round(whole * 100);
}

/** Inverse, for display of amounts read back from Paystack or the ledger. */
export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

async function paystack<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const body = (await res.json()) as { status: boolean; message: string; data: T };

  if (!res.ok || !body.status) {
    throw new Error(`Paystack ${init.method ?? "GET"} ${path} failed: ${body.message}`);
  }
  return body.data;
}

// ─── Initialise ──────────────────────────────────────────────────────────────

export interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

/**
 * Start a transaction and get the hosted-checkout URL.
 *
 * `amountMinor` is computed server-side from `PLAN_PRICES` — never accepted from
 * the client. A client-supplied amount is a "pay one shilling for the top plan"
 * bug, and it is the single most common way payment integrations are exploited.
 */
export async function initializeTransaction(params: {
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeResult> {
  return paystack<InitializeResult>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountMinor,
      currency: params.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata ?? {},
    }),
  });
}

// ─── Verify ──────────────────────────────────────────────────────────────────

export interface VerifiedTransaction {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel?: string;
  paid_at?: string;
  metadata?: Record<string, unknown>;
  customer?: { email?: string };
}

/**
 * Ask Paystack what actually happened to a reference.
 *
 * The browser returning from checkout proves nothing — the redirect is
 * user-controlled and trivially forged. Entitlements are granted from THIS
 * response (or the equally-verified webhook), never from the callback URL.
 */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  return paystack<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

// ─── Webhook signature ───────────────────────────────────────────────────────

/**
 * Validate the `x-paystack-signature` header: HMAC-SHA512 of the RAW body,
 * keyed with the secret key.
 *
 * Two things matter here and both are easy to get wrong:
 *
 *  1. The RAW request body must be hashed — not a re-serialised object. Any
 *     JSON.parse/stringify round-trip can reorder keys or alter whitespace and
 *     the signature will never match.
 *  2. The comparison is `timingSafeEqual`, not `===`. A plain string compare
 *     returns early on the first differing byte, which leaks how much of a
 *     guessed signature was correct and makes forgery tractable.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = createHmac("sha512", secretKey()).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");

  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Reference with enough entropy that it cannot be guessed or enumerated. */
export function generateReference(): string {
  return `echo_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
