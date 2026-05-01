"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient, createSessionClient } from "./server";
import { Client, Account } from "node-appwrite";
import { appwriteConfig } from "./config";
import { ID, Permission, Role } from "node-appwrite";

/** Helper to create a session client from a known secret (useful when cookies aren't ready) */
function createClientFromSecret(secret: string) {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId)
    .setSession(secret);

  return {
    get account() { return new Account(client); },
  };
}

/** Helper to create a clean, unauthenticated client for login */
function createGuestClient() {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId);

  return {
    get account() { return new Account(client); },
  };
}

export async function createSession(email: string, password: string) {
  const { account } = createGuestClient();

  try {
    const session = await account.createEmailPasswordSession(email, password);

    const cookieStore = await cookies();
    cookieStore.set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    // Use the secret directly instead of createSessionClient to avoid cookie race condition
    const { account: sessionAccount } = createClientFromSecret(session.secret);
    const user = await sessionAccount.get();

    // Plainify the object to avoid serialization errors in Next.js Server Actions
    const plainUser = JSON.parse(JSON.stringify(user));

    return { success: true, user: plainUser };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function syncSession(secret: string) {
  const cookieStore = await cookies();
  cookieStore.set("appwrite-session", secret, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: true,
  });
  return { success: true };
}

export async function signUpAction(email: string, password: string, name: string, goal?: string) {
  const { users, databases } = createAdminClient();
  const { account } = createGuestClient();

  try {
    const userId = ID.unique();
    await users.create(userId, email, undefined, password, name);
    
    // Create Profile Document
    await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.collections.profiles,
      ID.unique(),
      {
        userId: userId,
        name,
        email,
        goal,
        createdAt: new Date().toISOString(),
      },
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.read(Role.label("admin")),
        Permission.read(Role.label("therapist")),
      ]
    );

    const session = await account.createEmailPasswordSession(email, password);

    const cookieStore = await cookies();
    cookieStore.set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    // Use the secret directly
    const { account: sessionAccount } = createClientFromSecret(session.secret);
    const user = await sessionAccount.get();

    // Plainify the object to avoid serialization errors in Next.js Server Actions
    const plainUser = JSON.parse(JSON.stringify(user));

    return { success: true, user: plainUser };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteSession() {
  try {
    const { account } = await createSessionClient();
    await account.deleteSession({ sessionId: "current" });
  } catch (error) {
    // Ignore if session already invalid
  }

  const cookieStore = await cookies();
  cookieStore.delete("appwrite-session");

  redirect("/signin");
}
