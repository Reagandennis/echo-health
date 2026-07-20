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

  it("formats prices through the currency hook", () => {
    mockedUseCurrency.mockReturnValue({
      formatPrice: (amount: number) => `KES ${amount * 130}`,
      loading: false,
      currency: "KES",
    });

    render(<PriceTag usd={40} period="/ session" />);

    expect(screen.getByText("KES 5200")).toBeInTheDocument();
    expect(screen.getByText("/ session")).toBeInTheDocument();
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
