# Cloudflare: what sits in front of the origin, and why

The site is served from a single VM through a Cloudflare Tunnel
(`cloudflared/config.yml`). Two things are configured on the Cloudflare side
that the application depends on for performance, and neither is in code, so
they are written down here.

## 1. Cache the public pages at the edge

Every page under `app/(marketing)/` is statically rendered by Next.js and sent
with `Cache-Control: s-maxage=…` (five minutes on `/` and the therapist
directory, which read the database; a year on everything else). The origin
serves them from its own prerender cache in a few milliseconds.

**Cloudflare does not cache HTML unless told to**, so without a rule every
visitor on earth still crosses the tunnel to the VM for a page the edge could
serve from the nearest datacentre. `cf-cache-status: DYNAMIC` on
`https://echopsychology.com/pricing` means the rule is missing.

Create one Cache Rule (Caching → Cache Rules):

- **When:** URI Path matches regex
  `^/(|about|blog|careers|contact|cookies|couples-therapy|crisis|faq|get-started|guides|how-it-works|individual-therapy|online-therapy(/.*)?|organizations|press|pricing|privacy|reviews|teen-therapy|terms|therapist-jobs|therapists(/.*)?|therapy-for(/.*)?)$`
  — the same list as the public-route exclusion in `proxy.ts`. Add a public
  page there and here together.
- **Then:** Cache eligibility → *Eligible for cache*; Edge TTL → *Use cache-control
  header if present, bypass cache if not*.

Why only those paths: everything else is either per-user (the portals, `/api`,
Server Action POSTs) or already cached by Next's own immutable `/_next/static`
headers, which Cloudflare honours without a rule. Never make the rule broader
than the public list — a cached portal page would serve one person's data to
the next.

The five-minute pages revalidate on their own (`revalidate = 300`), so the edge
copy is never more than five minutes older than the origin's.

## 2. Answer the analytics path at the edge

`posthog-ingest-worker/` is a Cloudflare Worker that serves `/ingest/*` — the
first-party path browser analytics uses — directly from the edge, so analytics
traffic never reaches the VM. See the comment at the top of `worker.js`. Deploy
it with `npx wrangler deploy` from that directory; the Next.js rewrites remain
as the fallback if it is ever removed.
