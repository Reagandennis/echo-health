import { Client, Account, Databases, Storage, Users } from "node-appwrite";
import { appwriteConfig } from "./config";
import { cookies } from "next/headers";
import { cache } from "react";

/** Admin client with full privileges (uses API Key) */
function createAdminClient() {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId)
    .setKey(process.env.APPWRITE_API_KEY ?? "");

  return {
    get account() { return new Account(client); },
    get databases() { return new Databases(client); },
    get storage() { return new Storage(client); },
    get users() { return new Users(client); },
  };
}

/** Session-based client for Server Components (uses user's cookie) */
async function createSessionClient() {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId);

  const cookieStore = await cookies();
  const session = cookieStore.get("appwrite-session");

  if (!session || !session.value) {
    throw new Error("No session found");
  }

  client.setSession(session.value);

  return {
    get account() { return new Account(client); },
    get databases() { return new Databases(client); },
  };
}

/** 
 * Fetches the logged-in user and returns a plain object.
 * Cached to prevent redundant network calls within the same request.
 */
export const getLoggedInUser = cache(async () => {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    
    // Crucial: Convert to plain object to avoid Next.js serialization errors 
    // when passing this user from Server Layouts to Client Providers.
    return JSON.parse(JSON.stringify(user));
  } catch {
    return null;
  }
});

export { createAdminClient, createSessionClient };
