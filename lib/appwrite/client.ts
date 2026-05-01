"use client";

import { Client, Account, Databases, Storage, Realtime } from "appwrite";
import { appwriteConfig } from "./config";

const client = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId);

export const account  = new Account(client);
export const databases = new Databases(client);
export const storage  = new Storage(client);
export const realtime = new Realtime(client);

export { OAuthProvider } from "appwrite";
export default client;
