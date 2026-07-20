/**
 * Applies Echo Health branding to the Auth0 Universal Login screens.
 *
 * Universal Login is hosted by Auth0, so the sign-in and sign-up pages are not
 * React components in this repo — they are configured through the Management
 * API. This script is the source of truth for that configuration, so the styling
 * is reviewable and repeatable instead of being click-ops in a dashboard.
 *
 *   npx tsx scripts/auth0-branding.ts
 *
 * Requires `AUTH0_M2M_CLIENT_ID` / `AUTH0_M2M_CLIENT_SECRET` with the
 * `update:branding` and `read:branding` scopes. Idempotent — safe to re-run.
 *
 * Palette is taken from `app/globals.css` so the hosted pages match the app:
 *   brand  #1a9e90   cream #e6f6f4   sage #4bc96a   cyan #1bb8c8
 */

import { readFileSync } from "node:fs";

function env(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0 && !line.trimStart().startsWith("#")) {
        out[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
      }
    }
  } catch {
    // Fall back to process.env only.
  }
  return out;
}

const E = env();
const DOMAIN = E.AUTH0_DOMAIN;
const BASE_URL = E.APP_BASE_URL ?? "http://localhost:3000";

/**
 * Auth0 rejects any logo URL that is not HTTPS, so this is omitted entirely
 * during local development rather than sent and refused. Once `APP_BASE_URL` is
 * an HTTPS origin, re-running this script attaches the logo with no other change.
 *
 * Note the image is fetched by the visitor's browser, not by Auth0's servers, so
 * it must be reachable from the public internet — not just from your machine.
 */
const LOGO_URL = BASE_URL.startsWith("https://") ? `${BASE_URL}/echo-logo.png` : "";

const BRAND = "#1a9e90";
const CREAM = "#e6f6f4";
const SAGE = "#4bc96a";
const INK = "#1c1c1e";

async function token(): Promise<string> {
  const res = await fetch(`https://${DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: E.AUTH0_M2M_CLIENT_ID,
      client_secret: E.AUTH0_M2M_CLIENT_SECRET,
      audience: `https://${DOMAIN}/api/v2/`,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`token failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function api(path: string, method: string, body: unknown, bearer: string) {
  const res = await fetch(`https://${DOMAIN}/api/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text;
}

/** Tenant-level branding: the logo and accent used outside the theme. */
const branding = {
  ...(LOGO_URL ? { logo_url: LOGO_URL } : {}),
  colors: {
    primary: BRAND,
    page_background: CREAM,
  },
  font: {
    url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2",
  },
};

/**
 * Full Universal Login theme.
 *
 * Auth0 requires every field, so this is exhaustive rather than a patch. Shapes
 * mirror the app deliberately: pill buttons and a generously rounded card, to
 * match the `rounded-full` / `rounded-2xl` language used throughout the UI.
 */
const theme = {
  displayName: "Echo Health",
  borders: {
    // Auth0 caps these at 10 — they are not pixel values. The pill shape comes
    // from `buttons_style` rather than the radius.
    button_border_radius: 10,
    button_border_weight: 1,
    buttons_style: "pill",
    input_border_radius: 8,
    input_border_weight: 1,
    inputs_style: "rounded",
    show_widget_shadow: true,
    widget_border_weight: 0,
    widget_corner_radius: 20,
  },
  colors: {
    base_focus_color: BRAND,
    base_hover_color: BRAND,
    body_text: INK,
    error: "#d03c38",
    header: INK,
    icons: "#7a8a88",
    input_background: "#ffffff",
    input_border: "#cfe4e1",
    input_filled_text: INK,
    input_labels_placeholders: "#7a8a88",
    links_focused_components: BRAND,
    primary_button: BRAND,
    primary_button_label: "#ffffff",
    secondary_button_border: "#cfe4e1",
    secondary_button_label: INK,
    success: SAGE,
    widget_background: "#ffffff",
    widget_border: "#dcefec",
  },
  fonts: {
    body_text: { bold: false, size: 87.5 },
    buttons_text: { bold: true, size: 100 },
    font_url:
      "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2",
    input_labels: { bold: false, size: 100 },
    links: { bold: true, size: 87.5 },
    links_style: "normal",
    reference_text_size: 16,
    subtitle: { bold: false, size: 87.5 },
    title: { bold: true, size: 150 },
  },
  page_background: {
    background_color: CREAM,
    background_image_url: "",
    page_layout: "center",
  },
  widget: {
    header_text_alignment: "center",
    logo_height: 56,
    logo_position: "center",
    logo_url: LOGO_URL,
    social_buttons_layout: "bottom",
  },
};

/**
 * Copy overrides. Universal Login's defaults are generic ("Welcome", "Log in to
 * {clientName}"); these make the pages read like a health service rather than a
 * developer tool, and set expectations at the point of signup.
 */
const copy: Array<[string, Record<string, Record<string, string>>]> = [
  [
    "login",
    {
      login: {
        title: "Welcome back",
        description: "Sign in to continue your care.",
        buttonText: "Continue",
        footerLinkText: "Create one",
        footerText: "New to Echo Health?",
      },
    },
  ],
  [
    // The signup screen accepts a narrower key set than login — `footerLinkText`
    // is rejected here, so only the fields Auth0 documents for it are sent.
    "signup",
    {
      signup: {
        title: "Create your account",
        description: "Private, secure, and yours alone.",
        buttonText: "Create account",
      },
    },
  ],
];

async function main() {
  if (!DOMAIN || !E.AUTH0_M2M_CLIENT_ID || !E.AUTH0_M2M_CLIENT_SECRET) {
    throw new Error("AUTH0_DOMAIN / AUTH0_M2M_CLIENT_ID / AUTH0_M2M_CLIENT_SECRET required");
  }

  const bearer = await token();

  await api("/branding", "PATCH", branding, bearer);
  console.log("✓ branding (logo, primary colour, font)");

  // The theme is created once and updated thereafter; there is no upsert.
  const existing = await fetch(`https://${DOMAIN}/api/v2/branding/themes/default`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });

  if (existing.status === 404) {
    await api("/branding/themes", "POST", theme, bearer);
    console.log("✓ theme created");
  } else {
    const { themeId } = (await existing.json()) as { themeId: string };
    await api(`/branding/themes/${themeId}`, "PATCH", theme, bearer);
    console.log("✓ theme updated");
  }

  for (const [prompt, body] of copy) {
    await api(`/prompts/${prompt}/custom-text/en`, "PUT", body, bearer);
    console.log(`✓ copy: ${prompt}`);
  }

  console.log(
    LOGO_URL
      ? `\n✓ logo: ${LOGO_URL}`
      : "\n! logo skipped — Auth0 requires HTTPS. Set APP_BASE_URL to your " +
          "https:// origin and re-run to attach public/echo-logo.png."
  );
  console.log("Preview: Auth0 Dashboard → Branding → Universal Login → Try");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
