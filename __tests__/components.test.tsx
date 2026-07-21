import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Mail } from "lucide-react";
import AdminBadge, {
  kycBadge,
  riskBadge,
  sessionStatusBadge,
} from "@/app/admin/_components/AdminBadge";
import { mockUser } from "@/test-utils/session";
import AuthInput from "@/app/components/AuthInput";
import PriceTag from "@/app/components/PriceTag";
import { UserProvider, useUser, useSession } from "@/app/components/UserProvider";
import { useCurrency } from "@/lib/useCurrency";

jest.mock("@/lib/useCurrency", () => ({
  useCurrency: jest.fn(),
}));

const mockedUseCurrency = useCurrency as jest.MockedFunction<typeof useCurrency>;

describe("small shared components", () => {
  beforeEach(() => {
    mockedUseCurrency.mockReset();
  });

  it("toggles password inputs between hidden and visible text", async () => {
    const user = userEvent.setup();
    render(<AuthInput id="password" label="Password" type="password" />);

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("renders labels, required markers, icons, and errors for auth inputs", () => {
    render(
      <AuthInput
        id="email"
        label="Email"
        icon={Mail}
        required
        error="Email is required"
      />
    );

    expect(screen.getByLabelText(/Email/)).toBeRequired();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });

  it("provides the current user through UserProvider", () => {
    function Consumer() {
      const user = useUser();
      return <span>{user?.email ?? "guest"}</span>;
    }

    render(
      <UserProvider user={mockUser({ $id: "user-1", email: "ada@example.com" })}>
        <Consumer />
      </UserProvider>
    );

    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  it("shows the base price exactly when no conversion applies", () => {
    mockedUseCurrency.mockReturnValue({
      formatPrice: (amount: number) => `KES ${amount}`,
      formatExact: (amount: number) => `KES ${amount}`,
      isConverted: false,
      loading: false,
      currency: "KES",
      baseCurrency: "KES",
    });

    render(<PriceTag amount={8900} period="/ session" />);

    // No "≈" and no charge notice: this IS the amount that will be charged.
    expect(screen.getByText("KES 8900")).toBeInTheDocument();
    expect(screen.queryByText(/Charged in/)).not.toBeInTheDocument();
  });

  it("marks a converted price as approximate and still shows the charge amount", () => {
    mockedUseCurrency.mockReturnValue({
      formatPrice: (amount: number) => `$${Math.round(amount * 0.0077)}`,
      formatExact: (amount: number) => `KES ${amount}`,
      isConverted: true,
      loading: false,
      currency: "USD",
      baseCurrency: "KES",
    });

    render(<PriceTag amount={8900} period="/ session" />);

    // Quoting a converted figure without saying so — and without showing what is
    // actually charged — is what produces chargebacks.
    expect(screen.getByText(/≈/)).toBeInTheDocument();
    expect(screen.getByText(/KES 8900/)).toBeInTheDocument();
  });

  /**
   * Regression guard for a blank price.
   *
   * `formatPrice` used to return "…" while two third-party lookups (ipapi.co,
   * then open.er-api.com) resolved, and PriceTag dimmed it to `opacity-40`. On a
   * Kenyan mobile connection that made the single most important element on the
   * pricing page a faded ellipsis for up to a couple of seconds — for visitors
   * whose price needed no lookup at all, since KES is the base currency.
   */
  it("renders the base price at full opacity while detection is still in flight", () => {
    mockedUseCurrency.mockReturnValue({
      formatPrice: (amount: number) => `KES ${amount}`,
      formatExact: (amount: number) => `KES ${amount}`,
      isConverted: false,
      loading: true,
      currency: "KES",
      baseCurrency: "KES",
    });

    render(<PriceTag amount={6500} period="per session" />);

    const price = screen.getByText("KES 6500");
    expect(price).toBeInTheDocument();
    expect(screen.queryByText("…")).not.toBeInTheDocument();
    expect(price.className).not.toMatch(/opacity-40/);
  });

  /**
   * The size used to be hard-coded as `text-4xl` in the base className while
   * callers passed a competing size through `priceClass`. Tailwind resolves
   * conflicting utilities by stylesheet order rather than class-string order, so
   * `text-4xl` won regardless and checkout's `text-2xl` was silently ignored.
   */
  it("lets the caller own the price font size", () => {
    mockedUseCurrency.mockReturnValue({
      formatPrice: (amount: number) => `KES ${amount}`,
      formatExact: (amount: number) => `KES ${amount}`,
      isConverted: false,
      loading: false,
      currency: "KES",
      baseCurrency: "KES",
    });

    render(<PriceTag amount={6500} sizeClass="text-2xl" />);

    const price = screen.getByText("KES 6500");
    expect(price.className).toContain("text-2xl");
    expect(price.className).not.toMatch(/text-4xl/);
  });

  it("renders admin badge helper mappings", () => {
    render(
      <>
        <AdminBadge label="Custom" variant="info" dot />
        {kycBadge("verified")}
        {sessionStatusBadge("in-progress")}
        {riskBadge("critical")}
      </>
    );

    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });
});

/**
 * Regression guard for a redirect loop.
 *
 * `user` is null both while /api/me is in flight and when signed out. A
 * consumer that reads `!user` as "signed out" redirects a valid session to the
 * login page, which returns it here — forever. `loading` is what distinguishes
 * the two, so it must be true before the fetch resolves and false after.
 */
describe("UserProvider hydration state", () => {
  function Probe() {
    const { user, loading } = useSession();
    return <span data-testid="probe">{loading ? "loading" : user ? user.email : "anon"}</span>;
  }

  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch;
  });

  it("reports loading while hydrating, never a premature null", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    global.fetch = jest.fn(
      () => new Promise((resolve) => { resolveFetch = resolve; })
    ) as unknown as typeof fetch;

    render(
      <UserProvider hydrate>
        <Probe />
      </UserProvider>
    );

    // Before /api/me resolves: must NOT look signed out.
    expect(screen.getByTestId("probe")).toHaveTextContent("loading");

    resolveFetch({
      ok: true,
      json: async () => ({ user: mockUser({ email: "ada@example.com" }) }),
    });

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
  });

  it("does not report loading when a server-supplied user is passed", () => {
    render(
      <UserProvider user={mockUser({ email: "server@example.com" })}>
        <Probe />
      </UserProvider>
    );

    // A Server Layout already resolved this; there is nothing to wait for.
    expect(screen.getByTestId("probe")).toHaveTextContent("server@example.com");
  });

  it("clears loading even when the hydration fetch fails", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;

    render(
      <UserProvider hydrate>
        <Probe />
      </UserProvider>
    );

    // Stuck on "loading" would hang every consumer gated on it — worse than
    // showing signed-out.
    expect(await screen.findByText("anon")).toBeInTheDocument();
  });
});
