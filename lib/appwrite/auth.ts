"use client";

import { ID, OAuthProvider } from "appwrite";
import { account } from "./client";
import { createSession, signUpAction, deleteSession, createGoogleOAuthTokenAction } from "./actions";

const SITE_URL =
  globalThis.window === undefined
    ? (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
    : globalThis.window.location.origin;

/** Sign in with email + password. Returns the result from Server Action. */
export async function signIn(email: string, password: string) {
  // We perform login on the server to correctly capture the session secret
  // and set the httpOnly cookie.
  return await createSession(email, password);
}

/** Create a new account and immediately open a session. Returns the result from Server Action. */
export async function signUp(email: string, password: string, name: string, goal?: string) {
  return await signUpAction(email, password, name, goal);
}

/**
 * Send a password-recovery email.
 * `redirectUrl` is where Appwrite redirects after the user clicks the link.
 */
export async function sendPasswordReset(
  email: string,
  redirectUrl = `${SITE_URL}/reset-password`
) {
  return account.createRecovery({ email, url: redirectUrl });
}

/** Complete the password reset flow. */
export async function confirmPasswordReset(
  userId: string,
  secret: string,
  password: string
) {
  return account.updateRecovery({ userId, secret, password });
}

/** Returns the currently logged-in user, or null if not authenticated. */
export async function getCurrentUser() {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

/** Persist key/value pairs onto the Appwrite user preferences object. */
export async function updatePrefs(prefs: Record<string, string>) {
  return account.updatePrefs({ prefs });
}

/** Update the display name of the currently authenticated user. */
export async function updateProfile({ name }: { name: string }) {
  return account.updateName({ name });
}

/** Destroy the current session (log out). */
export async function signOut() {
  await deleteSession();
  // No need for client-side deleteSession since deleteSession action redirects
}

/**
 * Kick off Google OAuth — must be called from a browser click handler.
 * Uses Server Action to create the OAuth2 token URL and redirects the browser.
 */
export async function signInWithGoogle() {
  const url = await createGoogleOAuthTokenAction();
  window.location.assign(url);
}
