import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SignInPage from "@/app/(auth)/signin/page";
import { capture } from "@/lib/analytics/client";
import { signIn } from "@/lib/auth/client";
import { hardNavigate } from "@/lib/auth/navigate";
import { describeMissingConfig } from "@/lib/supabase/env";

/**
 * The sign-in form, which now handles a password.
 *
 * ## Why this suite exists at all
 *
 * There are no Supabase keys in this environment, so the configured path
 * cannot be exercised by loading the page — and the branches that matter most
 * are exactly the ones that only happen when it IS configured: a rejected
 * password, and what leaves for analytics on the way. Stubbing
 * `lib/auth/client.ts` is the only way to assert those before keys arrive.
 *
 * The password assertion is the important one. Universal Login meant the app
 * never held a credential; it does now, so "the password does not appear in an
 * analytics property" has to be a test rather than a claim in a comment.
 */

let mockSearch = "";
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock("@/lib/analytics/client", () => ({ capture: jest.fn() }));

/* `window.location` is neither writable nor spy-able under jsdom, which is why
   the page navigates through this seam rather than calling `assign` inline. */
jest.mock("@/lib/auth/navigate", () => ({ hardNavigate: jest.fn() }));

jest.mock("@/lib/auth/client", () => ({ signIn: jest.fn() }));

jest.mock("@/lib/supabase/env", () => ({
  describeMissingConfig: jest.fn(() => ""),
}));

const mockedCapture = capture as jest.MockedFunction<typeof capture>;
const mockedSignIn = signIn as jest.MockedFunction<typeof signIn>;
const mockedMissingConfig = describeMissingConfig as jest.MockedFunction<
  typeof describeMissingConfig
>;
const assign = hardNavigate as jest.MockedFunction<typeof hardNavigate>;

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch = "";
  mockedMissingConfig.mockReturnValue("");
  mockedSignIn.mockResolvedValue({ ok: true });
});

describe("/signin", () => {
  it("says which variable is missing, and disables the form, when unconfigured", () => {
    mockedMissingConfig.mockReturnValue(
      "Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL is unset."
    );

    render(<SignInPage />);

    expect(screen.getByText(/NEXT_PUBLIC_SUPABASE_URL is unset/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  it("sends the credentials to Supabase and nowhere else", async () => {
    const user = userEvent.setup();
    render(<SignInPage />);

    await user.type(screen.getByLabelText(/Email/), "ada@example.com");
    await user.type(screen.getByLabelText(/Password/), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mockedSignIn).toHaveBeenCalledTimes(1));
    expect(mockedSignIn).toHaveBeenCalledWith("ada@example.com", "correct horse battery");

    /*
     * THE ONE THAT MATTERS. The intent event carries the method and nothing
     * else: no password (which would be a credential in a third-party store),
     * and no email (which would be "this address uses a mental-health
     * service"). Asserted by exact equality so a later addition has to come
     * back through this test.
     */
    expect(mockedCapture).toHaveBeenCalledWith("sign_in_started", { method: "password" });
    const captured = JSON.stringify(mockedCapture.mock.calls);
    expect(captured).not.toContain("correct horse battery");
    expect(captured).not.toContain("ada@example.com");
  });

  it("shows Supabase's ambiguous rejection verbatim and stays put", async () => {
    const user = userEvent.setup();
    // Supabase does not distinguish "no such account" from "wrong password",
    // and neither may we — clarifying it would make this form an oracle for
    // who has an account here.
    mockedSignIn.mockResolvedValue({ ok: false, message: "Invalid login credentials" });

    render(<SignInPage />);
    await user.type(screen.getByLabelText(/Email/), "ada@example.com");
    await user.type(screen.getByLabelText(/Password/), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid login credentials");
    expect(alert.textContent).not.toMatch(/no account|not found|wrong password/i);
    expect(assign).not.toHaveBeenCalled();
    // Re-enabled, so a typo is one keystroke from being fixed.
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("lands on /post-login, carrying the plan and a validated deep link", async () => {
    const user = userEvent.setup();
    mockSearch = "?plan=couples&next=%2Fdashboard%2Fsessions";

    render(<SignInPage />);
    await user.type(screen.getByLabelText(/Email/), "ada@example.com");
    await user.type(screen.getByLabelText(/Password/), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        "/post-login?plan=couples&next=%2Fdashboard%2Fsessions"
      )
    );
  });

  it("refuses to forward an off-origin next, rather than trusting the URL", async () => {
    const user = userEvent.setup();
    mockSearch = "?next=https%3A%2F%2Fevil.example%2Fsignin";

    render(<SignInPage />);
    await user.type(screen.getByLabelText(/Email/), "ada@example.com");
    await user.type(screen.getByLabelText(/Password/), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/post-login"));
  });

  it("translates a callback failure code into copy of our own", () => {
    mockSearch = "?error=link_expired";
    render(<SignInPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/link has expired/i);
  });

  it("falls back to the generic message for an unrecognised code", () => {
    // A hand-crafted `?error=` must not be able to put arbitrary text in a
    // banner on the page where someone is about to type a password.
    mockSearch = "?error=Your%20account%20is%20locked,%20call%200800-123";
    render(<SignInPage />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/couldn't finish signing you in/i);
    expect(alert).not.toHaveTextContent(/0800-123/);
  });
});
