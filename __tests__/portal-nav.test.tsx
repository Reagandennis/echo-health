import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home, Settings } from "lucide-react";
import NavList, { isActivePath } from "@/app/components/portal/NavList";
import MobileDrawer from "@/app/components/portal/MobileDrawer";
import { ClientTabBar } from "@/app/dashboard/_components/ClientNav";

let mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// SignOutButton (inside the "More" sheet) imports the Auth0 redirect helpers.
jest.mock("@/lib/auth/client", () => ({ signOut: jest.fn() }));

describe("isActivePath", () => {
  it("matches a section and its children, but not a sibling that shares a prefix", () => {
    expect(isActivePath("/dashboard/sessions", "/dashboard/sessions")).toBe(true);
    expect(isActivePath("/dashboard/sessions/abc", "/dashboard/sessions")).toBe(true);
    expect(isActivePath("/dashboard/sessionsx", "/dashboard/sessions")).toBe(false);
  });

  it("matches only the exact path for a section's home link", () => {
    expect(isActivePath("/dashboard", "/dashboard", true)).toBe(true);
    expect(isActivePath("/dashboard/goals", "/dashboard", true)).toBe(false);
  });
});

describe("NavList", () => {
  it("marks only the current page with aria-current", () => {
    mockPathname = "/dashboard/settings";
    render(
      <NavList
        sections={[
          {
            items: [
              { href: "/dashboard", label: "Home", icon: Home, exact: true },
              { href: "/dashboard/settings", label: "Settings", icon: Settings },
            ],
          },
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });
});

/**
 * The therapist and admin portals had no navigation at all below their sidebar
 * breakpoint. These cover the drawer that replaced that gap.
 */
describe("MobileDrawer", () => {
  it("opens from its trigger, moves focus inside, and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <MobileDrawer header={<span>Brand</span>} label="Navigation">
        <a href="#somewhere">Somewhere</a>
      </MobileDrawer>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close navigation" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes when a link inside it is followed", async () => {
    const user = userEvent.setup();
    render(
      <MobileDrawer header={<span>Brand</span>}>
        <a href="#somewhere">Somewhere</a>
      </MobileDrawer>
    );

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(screen.getByRole("link", { name: "Somewhere" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ClientTabBar", () => {
  it("labels every tab and reaches the remaining pages through More", async () => {
    mockPathname = "/dashboard/billing";
    const user = userEvent.setup();
    render(<ClientTabBar />);

    const bar = screen.getByRole("navigation", { name: "Primary" });
    for (const name of ["Home", "Sessions", "Messages", "Progress"]) {
      expect(within(bar).getByRole("link", { name })).toBeInTheDocument();
    }

    // Billing is not a tab, so it must be reachable — and shown as current — under More.
    await user.click(within(bar).getByRole("button", { name: "More" }));
    const sheet = screen.getByRole("dialog", { name: "More" });
    expect(within(sheet).getByRole("link", { name: "Billing" })).toHaveAttribute("aria-current", "page");
    for (const name of ["Goals", "Resources", "Settings"]) {
      expect(within(sheet).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(sheet).getByRole("link", { name: /Need urgent help/ })).toHaveAttribute("href", "/crisis");
  });
});
