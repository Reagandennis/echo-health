"use server";

import { createSessionClient } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { Query } from "node-appwrite";
import type { TherapySession } from "@/lib/appwrite/database";

/**
 * List all sessions for the current logged-in patient.
 */
export async function listPatientSessionsAction(patientId: string) {
  const { databases } = await createSessionClient();
  
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.sessions,
    [
      Query.equal("patientId", patientId),
      Query.orderDesc("scheduledAt"),
    ]
  );
  
  return JSON.parse(JSON.stringify(res.documents)) as TherapySession[];
}

/**
 * Update a therapy session (e.g., cancelling or adding feedback).
 */
export async function updateTherapySessionAction(
  documentId: string, 
  data: Partial<Omit<TherapySession, keyof import("node-appwrite").Models.Document>>
) {
  const { databases } = await createSessionClient();
  
  const session = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.sessions,
    documentId,
    data
  );
  
  return JSON.parse(JSON.stringify(session)) as TherapySession;
}
