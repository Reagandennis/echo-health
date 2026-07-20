import type { SessionUser } from "@/lib/auth/session";

/**
 * Build a `SessionUser` for tests.
 *
 * Lives outside `__tests__/` on purpose: `next/jest`'s default `testMatch`
 * treats every file under `__tests__/` as a suite, and a helper module there
 * would fail with "your test suite must contain at least one test".
 */
export function mockUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    $id: "user-1",
    name: "Test User",
    email: "test@example.com",
    labels: [],
    prefs: {},
    emailVerification: true,
    ...overrides,
  };
}
