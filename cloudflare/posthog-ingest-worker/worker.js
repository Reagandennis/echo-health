/**
 * PostHog ingest proxy, at the edge.
 *
 * The app serves `/ingest/*` through the `rewrites()` in `next.config.ts`, so
 * that browser analytics goes to a first-party path (ad blockers drop requests
 * to `*.posthog.com`). That works, but it means EVERY analytics event from
 * EVERY visitor — pageviews, autocapture clicks, exception reports, and the
 * posthog-js script itself — is a request through the Cloudflare Tunnel into
 * the 2-vCPU VM, which forwards it to PostHog and relays the reply. None of it
 * needs the application.
 *
 * Deployed on the route `echopsychology.com/ingest/*`, this Worker answers
 * those requests at the edge instead. The Next.js rewrites stay as they are:
 * nothing in the app changes, and if the Worker is ever removed the origin
 * silently takes over again.
 *
 * Behaviour mirrors the rewrites exactly:
 *   /ingest/static/*  -> https://us-assets.i.posthog.com/static/*
 *   /ingest/array/*   -> https://us-assets.i.posthog.com/array/*
 *   /ingest/*         -> https://us.i.posthog.com/*
 *
 * Deploy:  cd cloudflare/posthog-ingest-worker && npx wrangler deploy
 * (The route in wrangler.toml needs the zone on the same Cloudflare account
 * as the tunnel.)
 */

const API_HOST = "us.i.posthog.com";
const ASSET_HOST = "us-assets.i.posthog.com";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/ingest/")) {
      return new Response("Not found", { status: 404 });
    }

    const rest = url.pathname.slice("/ingest".length); // keeps the leading "/"
    const isAsset = rest.startsWith("/static/") || rest.startsWith("/array/");
    const upstream = new URL(rest + url.search, `https://${isAsset ? ASSET_HOST : API_HOST}`);

    /*
     * Forward the request as-is apart from the host. posthog-js sends the
     * visitor's user agent and cookies for its own origin only (none reach
     * here cross-origin), and the body is the event batch. The proxied
     * `cf-connecting-ip` is what PostHog uses for GeoIP, same as it did when
     * the origin forwarded it.
     */
    const headers = new Headers(request.headers);
    headers.set("host", upstream.host);

    const init = {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "follow",
    };

    const response = await fetch(upstream, init);

    /* Static assets (the posthog-js bundle) change rarely and are versioned by
       PostHog; let the edge cache them so repeat visitors never fetch twice. */
    if (isAsset && response.ok) {
      const cached = new Response(response.body, response);
      cached.headers.set("Cache-Control", "public, max-age=3600");
      return cached;
    }

    return response;
  },
};
