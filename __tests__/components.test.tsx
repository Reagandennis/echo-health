import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Mail } from "lucide-react";
import AdminBadge, {
  kycBadge,
  riskBadge,
  sessionStatusBadge,
} from "@/app/admin/_components/AdminBadge";
import type { Models } from "appwrite";
import AuthInput from "@/app/components/AuthInput";
import PriceTag from "@/app/components/PriceTag";
import { UserProvider, useUser } from "@/app/components/UserProvider";
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
      <UserProvider user={{ $id: "user-1", email: "ada@example.com" } as unknown as Models.User<Models.Preferences>}>
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
