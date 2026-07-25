/**
 * Property scrubbing for anything leaving the app for PostHog.
 *
 * Echo Health is a mental-health service, so the fact that a *specific person*
 * used it is itself sensitive — more so than the usual analytics calculus. Two
 * classes of leak are handled here, both of which were live before this module
 * existed:
 *
 *  1. **Record ids in URLs.** Dynamic segments land in `$current_url` /
 *     `$pathname` / `$referrer` verbatim. `/admin/therapists/<uuid>/credentials`
 *     was captured 10 times in the first month; `/therapist/clients/<clientId>`
 *     and `/dashboard/sessions/<sessionId>` are the same shape and would tie a
 *     patient record id to a person profile.
 *  2. **Identifiers in query strings.** `?email=`, `?token=`, and friends ride
 *     along into analytics and then into anything reading it.
 *
 * The scrub is deliberately structural rather than a denylist of known-bad
 * paths: a denylist silently stops covering a route the day someone adds one.
 */

/** Canonical UUID, the shape of every record id in this schema. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Auth0 subject ids (`auth0|…`, `google-oauth2|…`). These are the canonical
 * `user_id` in Postgres, so one in a URL is a direct handle on a person.
 * URL-encoded (`%7C`) as well as literal, because both forms occur in practice.
 */
const AUTH0_SUB = /(auth0|google-oauth2|windowslive|facebook)(\||%7C)[A-Za-z0-9-]+/gi;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi;

/** Long hex/base64ish runs — tokens, references, signatures. */
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g;

/**
 * Query params worth keeping. Everything else is dropped rather than scrubbed:
 * attribution is the only thing we read query strings for, and an allowlist
 * cannot be outflanked by a new param someone adds later.
 */
const KEEP_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "ref",
  "plan",
]);

/** Replace identifiers in a free-form string with stable placeholders. */
export function scrubIdentifiers(value: string): string {
  return value
    .replace(EMAIL, ":email")
    .replace(AUTH0_SUB, ":sub")
    .replace(UUID, ":id")
    .replace(LONG_TOKEN, ":token");
}

/**
 * Scrub a URL: identifiers out of the path, query reduced to the allowlist.
 *
 * Non-URL strings are returned scrubbed but otherwise untouched, so this is safe
 * to call on `$pathname` (a bare path) as well as `$current_url`.
 */
export function scrubUrl(raw: string): string {
  if (!raw) return raw;

  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    // Relative path (e.g. `$pathname`) — scrub the identifiers and return.
    const [path, query] = raw.split("?");
    const scrubbedPath = scrubIdentifiers(path);
    if (!query) return scrubbedPath;
    const kept = keepAllowedParams(new URLSearchParams(query));
    return kept ? `${scrubbedPath}?${kept}` : scrubbedPath;
  }

  url.pathname = scrubIdentifiers(url.pathname);
  url.hash = "";
  const kept = keepAllowedParams(url.searchParams);
  url.search = kept ? `?${kept}` : "";
  return url.toString();
}

function keepAllowedParams(params: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const [key, value] of params) {
    if (KEEP_PARAMS.has(key.toLowerCase())) out.append(key, scrubIdentifiers(value));
  }
  return out.toString();
}

/** Property keys whose values are URLs and therefore need path scrubbing. */
const URL_PROPS = [
  "$current_url",
  "$pathname",
  "$referrer",
  "$initial_current_url",
  "$initial_pathname",
  "$initial_referrer",
  "$session_entry_url",
  "$session_entry_pathname",
  "$session_entry_referrer",
];

/**
 * `sanitize_properties` hook for posthog-js — runs on EVERY client event,
 * including autocapture and `$pageview`, which are the ones that carry URLs we
 * never explicitly wrote.
 */
export function sanitizeProperties(
  properties: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...properties };

  for (const key of URL_PROPS) {
    const value = out[key];
    if (typeof value === "string") out[key] = scrubUrl(value);
  }

  // Autocapture serialises the clicked element's visible text. On clinical
  // screens that text is a client name, a note excerpt, or a message preview,
  // so it is dropped wholesale rather than scrubbed — there is no version of
  // "the text of a therapy note" that belongs in analytics.
  delete out.$el_text;
  if (Array.isArray(out.$elements)) {
    out.$elements = (out.$elements as Record<string, unknown>[]).map((el) => {
      const { text: _text, ...rest } = el ?? {};
      void _text;
      return rest;
    });
  }

  return out;
}
