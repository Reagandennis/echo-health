"use client";

/**
 * Client-side auth entry points (Auth0 Universal Login).
 *
 * Replaces the Appwrite `lib/appwrite/auth.ts` facade. Every function here is a
 * browser navigation rather than an API call: with Universal Login the app never
 * handles credentials itself, so there is no `signIn(email, password)` anymore.
 * The routes below are mounted by the Auth0 SDK in `proxy.ts`.
 */

/**
 * Default post-login destination.
 *
 * Not a real page the user lingers on: `/post-login` is a server component
 * that reads the fresh session and forwards by role (admin / therapist / client
 * / no-role-yet). The Auth0 callback only knows the `returnTo` it was handed, so
 * the role branch has to happen after the redirect rather than during it.
 */
const POST_LOGIN_RETURN_TO = "/post-login";

/** Send the user to Auth0 to log in. */
export function signIn(returnTo = POST_LOGIN_RETURN_TO) {
  window.location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}

/** Send the user to Auth0 with the sign-up screen pre-selected. */
export function signUp(returnTo = POST_LOGIN_RETURN_TO) {
  window.location.assign(
    `/auth/login?screen_hint=signup&returnTo=${encodeURIComponent(returnTo)}`
  );
}

/**
 * Log in with Google.
 *
 * `connection` tells Auth0 to skip the login page and go straight to the Google
 * IdP. Requires the google-oauth2 connection to be enabled for this application
 * in the Auth0 dashboard.
 */
export function signInWithGoogle(returnTo = POST_LOGIN_RETURN_TO) {
  window.location.assign(
    `/auth/login?connection=google-oauth2&returnTo=${encodeURIComponent(returnTo)}`
  );
}

/** Clear the session and redirect to Auth0 logout. */
export function signOut() {
  window.location.assign("/auth/logout");
}

/**
 * Password reset is handled entirely by Auth0 Universal Login — the "Forgot
 * password?" link on the hosted login page triggers Auth0's own reset email.
 * The former `sendPasswordReset` / `confirmPasswordReset` pair (which used
 * Appwrite's `createRecovery` / `updateRecovery`) no longer exists.
 */
export function goToPasswordReset() {
  window.location.assign("/auth/login");
}
