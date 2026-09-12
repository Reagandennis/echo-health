/**
 * @jest-environment node
 *
 * TEMPORARY probe — runs the real actions against the live local database with
 * the guard in place. Deleted after running; not part of the suite.
 */
import {
  listMyLicencesAction,
  reviewLicenceAction,
  submitLicenceForReviewAction,
  upsertTherapistLicenceAction,
} from "@/app/actions/licensing";
import { getLoggedInUser } from "@/lib/auth/session";
import { mockUser } from "@/test-utils/session";
import { sql } from "@/lib/db";

jest.mock("@/lib/auth/session", () => ({ getLoggedInUser: jest.fn() }));
jest.mock("@/lib/posthog-server", () => ({
  getPostHogClient: jest.fn(() => ({
    capture: jest.fn(),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mocked = getLoggedInUser as jest.MockedFunction<typeof getLoggedInUser>;
const THERAPIST = "auth0|seed-therapist-1";
const ADMIN = "auth0|live-probe-admin";

const asTherapist = () =>
  mocked.mockResolvedValue(mockUser({ $id: THERAPIST, labels: ["therapist"] }));
const asAdmin = () =>
  mocked.mockResolvedValue(mockUser({ $id: ADMIN, labels: ["admin"] }));

jest.setTimeout(60_000);

afterAll(async () => {
  await sql`DELETE FROM notifications WHERE title LIKE 'Licence%'`;
  await sql`DELETE FROM kyc_review_events WHERE actor_id = ${ADMIN}`;
  await sql`DELETE FROM therapist_licences WHERE jurisdiction <> 'kenya'`;
  await sql.end();
});

it("walks the whole applicant → reviewer flow against the real database", async () => {
  asTherapist();

  // ── existing state: the backfilled Kenyan licence ────────────────────────
  const before = await listMyLicencesAction();
  console.log("LIVE existing:", JSON.stringify(before));
  expect(before.some((l) => l.jurisdiction === "kenya")).toBe(true);

  // ── 1. a hostile payload lands at `incomplete` anyway ────────────────────
  const after = await upsertTherapistLicenceAction({
    jurisdiction: "united-kingdom",
    regulator: "Health and Care Professions Council (HCPC)",
    licenceNumber: "PYL-LIVE-PROBE",
    expiresAt: "2027-03-31",
    status: "verified",
    verification: "named_regulator",
    reviewedBy: "auth0|not-a-reviewer",
    reviewNote: "Approved by me",
  });
  const uk = after.find((l) => l.jurisdiction === "united-kingdom")!;
  console.log("LIVE inserted:", JSON.stringify(uk));
  expect(uk.status).toBe("incomplete");
  expect(uk.verification).toBe("case_by_case");
  expect(uk.reviewedAt).toBeNull();
  expect(uk.reviewNote).toBeNull();

  // ── 2. a sub-national jurisdiction with no subdivision ───────────────────
  await expect(
    upsertTherapistLicenceAction({
      jurisdiction: "united-states",
      licenceNumber: "PSY-LIVE-PROBE",
    })
  ).rejects.toThrow(/state or province/i);

  // ...and with one, it saves
  const withState = await upsertTherapistLicenceAction({
    jurisdiction: "united-states",
    subdivision: "California",
    licenceNumber: "PSY-LIVE-PROBE",
  });
  const us = withState.find((l) => l.jurisdiction === "united-states")!;
  console.log("LIVE us:", JSON.stringify(us));
  expect(us.subdivision).toBe("California");

  // ── 3. incomplete → pending ──────────────────────────────────────────────
  const submitted = await submitLicenceForReviewAction(uk.id);
  console.log("LIVE submitted:", JSON.stringify(submitted));
  const pending = (await listMyLicencesAction()).find((l) => l.id === uk.id)!;
  expect(pending.status).toBe("pending");
  expect(pending.submittedAt).not.toBeNull();

  // ── 4. a licence under review is no longer the applicant's to edit ───────
  await expect(
    upsertTherapistLicenceAction({ id: uk.id, jurisdiction: "united-kingdom", licenceNumber: "SWAP" })
  ).rejects.toThrow(/under review/i);

  // ── 5. nor is a verified one ─────────────────────────────────────────────
  await expect(
    upsertTherapistLicenceAction({ jurisdiction: "kenya", licenceNumber: "SWAP" })
  ).rejects.toThrow(/verified/i);

  // ── 6. an admin approves ─────────────────────────────────────────────────
  asAdmin();
  const verdict = await reviewLicenceAction({
    licenceId: uk.id,
    action: "approve",
    verification: "named_regulator",
    note: "Register checked; registration current.",
  });
  console.log("LIVE verdict:", JSON.stringify(verdict));
  expect(verdict.status).toBe("verified");

  const [row] = await sql`
    SELECT status, verification, reviewed_by, reviewed_at, review_note
    FROM therapist_licences WHERE id = ${uk.id}`;
  console.log("LIVE stored row:", JSON.stringify(row));
  expect(row.status).toBe("verified");
  expect(row.verification).toBe("named_regulator");
  expect(row.reviewed_by).toBe(ADMIN);
  expect(row.reviewed_at).not.toBeNull();

  const events = await sql`
    SELECT action, note FROM kyc_review_events WHERE actor_id = ${ADMIN}`;
  console.log("LIVE trail:", JSON.stringify(events));
  expect(events).toHaveLength(1);

  // ── 7. case-by-case cannot be recorded as regulator-verified ─────────────
  asTherapist();
  const ugRows = await upsertTherapistLicenceAction({
    jurisdiction: "uganda",
    regulator: "Ministry of Health registration",
  });
  const ug = ugRows.find((l) => l.jurisdiction === "uganda")!;
  await submitLicenceForReviewAction(ug.id);

  asAdmin();
  await expect(
    reviewLicenceAction({
      licenceId: ug.id,
      action: "approve",
      verification: "named_regulator",
    })
  ).rejects.toThrow(/not established which body regulates/i);

  // ...but case_by_case is accepted
  const ugVerdict = await reviewLicenceAction({
    licenceId: ug.id,
    action: "approve",
    verification: "case_by_case",
  });
  console.log("LIVE uganda verdict:", JSON.stringify(ugVerdict));
  expect(ugVerdict.verification).toBe("case_by_case");

  // ── 8. a therapist cannot delete, and an admin cannot delete a verdict ──
  await expect(
    (await import("@/app/actions/licensing")).deleteLicenceAction(uk.id)
  ).rejects.toThrow(/cannot be deleted/i);
});
