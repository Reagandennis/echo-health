"use client";

/**
 * Leave for `path` with a full document request.
 *
 * ## Why not `router.push`
 *
 * Every caller is a page that has just written session cookies through the
 * Supabase browser client — sign-in, sign-up, and setting a new password. A
 * client-side navigation asks the server for an RSC payload, and the router may
 * serve that from its own cache: a payload rendered while this tab still had no
 * session. `/post-login` would then read "signed out" and bounce straight back
 * to `/signin`, which looks exactly like the credentials having been rejected.
 *
 * A document request cannot be served from that cache. It also passes through
 * `proxy.ts`, which is what refreshes and rotates the session cookies, so the
 * first authenticated render happens with cookies the server has already
 * validated.
 *
 * It is a separate module (rather than an inline `window.location.assign`) for
 * one further reason: `window.location` is not writable or spy-able under
 * jsdom, so an inline call makes the success path of all three forms
 * untestable. This is the seam.
 */
export function hardNavigate(path: string): void {
  window.location.assign(path);
}
