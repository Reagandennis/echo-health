import { ID, Permission, Role } from "appwrite";
import { databases } from "./client";
import { appwriteConfig } from "./config";

const { databaseId, collections } = appwriteConfig;

export interface Notification {
  userId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export async function createNotification(data: Notification) {
  return databases.createDocument({
    databaseId,
    collectionId: collections.notifications,
    documentId: ID.unique(),
    data,
    permissions: [
      Permission.read(Role.user(data.userId)),
      Permission.update(Role.user(data.userId)),
      Permission.read(Role.label("admin")),
    ],
  });
}
