"use server";

import { createAdminClient, createSessionClient } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { ID, Permission, Role, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import type { TherapySession } from "@/lib/appwrite/database";

export async function uploadFileAction(formData: FormData) {
  const { storage } = createAdminClient();
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");
  
  const buffer = Buffer.from(await file.arrayBuffer());
  
  const uploaded = await storage.createFile(
    appwriteConfig.storageBucketId,
    ID.unique(),
    InputFile.fromBuffer(buffer, file.name)
  );
  
  const url = `${appwriteConfig.endpoint}/storage/buckets/${appwriteConfig.storageBucketId}/files/${uploaded.$id}/view?project=${appwriteConfig.projectId}`;
  
  return { id: uploaded.$id, url };
}

export async function createSessionAction(data: Omit<TherapySession, keyof import("node-appwrite").Models.Document>) {
  const { databases } = createAdminClient();
  
  const session = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.sessions,
    ID.unique(),
    data,
    [
      Permission.read(Role.user(data.patientId)),
      Permission.update(Role.user(data.patientId)),
      Permission.read(Role.user(data.therapistId)),
      Permission.update(Role.user(data.therapistId)),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
    ]
  );
  
  return JSON.parse(JSON.stringify(session));
}

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
  
  return JSON.parse(JSON.stringify(res.documents));
}

export async function listTherapistSessionsAction(therapistId: string) {
  const { databases } = await createSessionClient();
  
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.sessions,
    [
      Query.equal("therapistId", therapistId),
      Query.orderAsc("scheduledAt"),
    ]
  );
  
  return JSON.parse(JSON.stringify(res.documents));
}

export async function listMoodLogsAction(userId: string, days = 30) {
  const { databases } = await createSessionClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.moodLogs,
    [
      Query.equal("userId", userId),
      Query.greaterThanEqual("createdAt", since.toISOString()),
      Query.orderAsc("createdAt"),
      Query.limit(days),
    ]
  );
  
  return JSON.parse(JSON.stringify(res.documents));
}

export async function listGoalsAction(userId: string) {
  const { databases } = await createSessionClient();
  
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.goals,
    [
      Query.equal("userId", userId),
      Query.orderDesc("createdAt"),
    ]
  );
  
  return JSON.parse(JSON.stringify(res.documents));
}

export async function updateTherapySessionAction(documentId: string, data: Partial<Omit<TherapySession, keyof import("node-appwrite").Models.Document>>) {
  const { databases } = await createSessionClient();
  
  const session = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.sessions,
    documentId,
    data
  );
  
  return JSON.parse(JSON.stringify(session));
}

export async function getTherapistByUserIdAction(userId: string) {
  const { databases } = await createSessionClient();
  
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.therapists,
    [
      Query.equal("userId", userId),
      Query.limit(1),
    ]
  );
  
  return JSON.parse(JSON.stringify(res.documents[0] ?? null));
}

export async function listTherapistsAction(therapistId?: string) {
  const { databases } = createAdminClient();
  const queries = [Query.limit(100)];
  if (therapistId) {
    queries.push(Query.equal("$id", therapistId));
  }
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.therapists,
    queries
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function getTherapistAction(therapistId: string) {
  const { databases } = await createSessionClient();
  const res = await databases.getDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.therapists,
    therapistId
  );
  return JSON.parse(JSON.stringify(res));
}

export async function listTherapistDashboardStatsAction(therapistId: string) {
  const { databases } = await createSessionClient();
  
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString();
  
  const [allRes, todayRes, weekRes, pendingRes] = await Promise.all([
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.sessions, [Query.equal("therapistId", therapistId), Query.limit(1)]),
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.sessions, [Query.equal("therapistId", therapistId), Query.greaterThanEqual("scheduledAt", todayStart), Query.lessThan("scheduledAt", todayEnd), Query.orderAsc("scheduledAt")]),
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.sessions, [Query.equal("therapistId", therapistId), Query.greaterThanEqual("scheduledAt", todayStart), Query.lessThan("scheduledAt", weekEnd)]),
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.sessions, [Query.equal("therapistId", therapistId), Query.equal("status", "pending")]),
  ]);
  
  return JSON.parse(JSON.stringify({
    all: allRes.total,
    today: todayRes.documents,
    thisWeek: weekRes.total,
    pending: pendingRes.total
  }));
}

export async function listPendingTherapistSessionsAction(therapistId: string) {
  const { databases } = await createSessionClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.sessions,
    [
      Query.equal("therapistId", therapistId),
      Query.equal("status", "pending"),
      Query.orderAsc("scheduledAt"),
      Query.limit(10),
    ]
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function listNotificationsAction(userId: string) {
  const { databases } = await createSessionClient();
  
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.notifications,
    [
      Query.equal("userId", userId),
      Query.orderDesc("createdAt"),
      Query.limit(20),
    ]
  );
  
  return JSON.parse(JSON.stringify(res.documents));
}

export async function markNotificationAsReadAction(id: string) {
  const { databases } = await createSessionClient();
  
  const res = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.notifications,
    id,
    { read: true }
  );
  
  return JSON.parse(JSON.stringify(res));
}

export async function upsertTherapistProfileAction(userId: string, data: any) {
  const { databases } = createAdminClient();

  // Check existing
  const existing = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.therapists,
    [Query.equal("userId", userId)]
  );

  const payload = {
    ...data,
    kycStatus: "pending",
    onboardingComplete: true,
  };

  if (existing.total > 0) {
    const res = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.collections.therapists,
      existing.documents[0].$id,
      payload
    );
    return JSON.parse(JSON.stringify(res));
  } else {
    const res = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.collections.therapists,
      ID.unique(),
      payload,
      [
        Permission.read(Role.any()),
        Permission.update(Role.user(userId)),
        Permission.read(Role.label("admin")),
        Permission.update(Role.label("admin")),
      ]
    );
    return JSON.parse(JSON.stringify(res));
  }
}
export async function createNotificationAction(data: {
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "alert";
  link?: string;
}) {
  const { databases } = createAdminClient();
  const res = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.notifications,
    ID.unique(),
    {
      ...data,
      read: false,
      createdAt: new Date().toISOString(),
    }
  );
  return JSON.parse(JSON.stringify(res));
}

export async function assignTherapistToPatientAction(patientProfileId: string, therapistId: string) {
  const { databases } = createAdminClient();

  // 1. Update patient profile
  const profile = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.profiles,
    patientProfileId,
    { therapistId }
  );

  // 2. Get therapist info for notification
  const therapist = await databases.getDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.therapists,
    therapistId
  );

  // 3. Notify patient
  await createNotificationAction({
    userId: profile.userId,
    title: "New Therapist Assigned",
    message: `You've been matched with ${therapist.name}. You can now schedule your first session.`,
    type: "success",
    link: "/dashboard/sessions",
  });

  // 4. Notify therapist
  await createNotificationAction({
    userId: therapist.userId,
    title: "New Patient Assigned",
    message: `A new patient, ${profile.name}, has been assigned to you.`,
    type: "info",
    link: "/therapist/clients",
  });

  return JSON.parse(JSON.stringify(profile));
}

export async function listMatchedProfilesAction() {
  const { databases } = createAdminClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.profiles,
    [Query.isNotNull("therapistId"), Query.limit(50), Query.orderDesc("createdAt")]
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function listTherapistClientsAction(therapistId: string) {
  const { databases } = createAdminClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.profiles,
    [Query.equal("therapistId", therapistId), Query.limit(100)]
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function listMatchConflictsAction() {
  const { databases } = createAdminClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.matchConflicts,
    [Query.orderDesc("createdAt"), Query.limit(50)]
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function resolveMatchConflictAction(id: string) {
  const { databases } = createAdminClient();
  const res = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.matchConflicts,
    id,
    { resolved: true }
  );
  return JSON.parse(JSON.stringify(res));
}

export async function listRiskAlertsAction() {
  const { databases } = createAdminClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.riskAlerts,
    [Query.orderDesc("createdAt"), Query.limit(100)]
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function resolveRiskAlertAction(id: string) {
  const { databases } = createAdminClient();
  const res = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.riskAlerts,
    id,
    { resolved: true }
  );
  return JSON.parse(JSON.stringify(res));
}

export async function listProfilesAction() {
  const { databases } = createAdminClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.profiles,
    [Query.limit(100), Query.orderDesc("createdAt")]
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function listClinicalNotesAction(therapistId: string, patientId?: string) {
  const { databases } = await createSessionClient();
  const queries = [Query.equal("therapistId", therapistId), Query.orderDesc("createdAt")];
  if (patientId) queries.push(Query.equal("patientId", patientId));

  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.clinicalNotes,
    queries
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function createClinicalNoteAction(data: any) {
  const { databases } = await createSessionClient();
  const res = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.clinicalNotes,
    ID.unique(),
    data,
    [
      Permission.read(Role.user(data.therapistId)),
      Permission.update(Role.user(data.therapistId)),
      Permission.delete(Role.user(data.therapistId)),
      Permission.read(Role.label("admin")),
    ]
  );
  return JSON.parse(JSON.stringify(res));
}

export async function updateClinicalNoteAction(documentId: string, data: any) {
  const { databases } = await createSessionClient();
  const res = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.clinicalNotes,
    documentId,
    data
  );
  return JSON.parse(JSON.stringify(res));
}

export async function deleteClinicalNoteAction(documentId: string) {
  const { databases } = await createSessionClient();
  await databases.deleteDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.clinicalNotes,
    documentId
  );
  return { success: true };
}

export async function listDirectMessagesAction(userId: string, therapistId: string, limit = 50) {
  const { databases } = await createSessionClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.messages,
    [
      Query.or([
        Query.and([Query.equal("senderId", userId), Query.equal("receiverId", therapistId)]),
        Query.and([Query.equal("senderId", therapistId), Query.equal("receiverId", userId)]),
      ]),
      Query.orderAsc("createdAt"),
      Query.limit(limit),
    ]
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function sendMessageAction(data: any) {
  const { databases } = createAdminClient();
  const res = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.messages,
    ID.unique(),
    data,
    [
      Permission.read(Role.user(data.senderId)),
      Permission.read(Role.user(data.receiverId)),
      Permission.read(Role.label("admin")),
    ]
  );
  return JSON.parse(JSON.stringify(res));
}

export async function getSessionAction(sessionId: string) {
  const { databases } = await createSessionClient();
  const res = await databases.getDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.sessions,
    sessionId
  );
  return JSON.parse(JSON.stringify(res));
}

export async function getProfileByUserIdAction(userId: string) {
  const { databases } = await createSessionClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.profiles,
    [Query.equal("userId", userId), Query.limit(1)]
  );
  return JSON.parse(JSON.stringify(res.documents[0] ?? null));
}

export async function createMoodLogAction(data: any) {
  const { databases } = createAdminClient();
  const res = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.moodLogs,
    ID.unique(),
    data,
    [
      Permission.read(Role.user(data.userId)),
      Permission.update(Role.user(data.userId)),
      Permission.delete(Role.user(data.userId)),
      Permission.read(Role.label("admin")),
    ]
  );
  return JSON.parse(JSON.stringify(res));
}

export async function listJournalEntriesAction(userId: string, limit = 20) {
  const { databases } = await createSessionClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.journalEntries,
    [
      Query.equal("userId", userId),
      Query.orderDesc("createdAt"),
      Query.limit(limit),
    ]
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function createJournalEntryAction(data: any) {
  const { databases } = createAdminClient();
  const res = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.journalEntries,
    ID.unique(),
    data,
    [
      Permission.read(Role.user(data.userId)),
      Permission.update(Role.user(data.userId)),
      Permission.delete(Role.user(data.userId)),
      Permission.read(Role.label("admin")),
    ]
  );
  return JSON.parse(JSON.stringify(res));
}

export async function updateJournalEntryAction(documentId: string, data: any) {
  const { databases } = await createSessionClient();
  const res = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.journalEntries,
    documentId,
    data
  );
  return JSON.parse(JSON.stringify(res));
}

export async function deleteJournalEntryAction(documentId: string) {
  const { databases } = await createSessionClient();
  await databases.deleteDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.journalEntries,
    documentId
  );
  return { success: true };
}

export async function createGoalAction(data: any) {
  const { databases } = createAdminClient();
  const res = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.goals,
    ID.unique(),
    data,
    [
      Permission.read(Role.user(data.userId)),
      Permission.update(Role.user(data.userId)),
      Permission.delete(Role.user(data.userId)),
      Permission.read(Role.label("admin")),
    ]
  );
  return JSON.parse(JSON.stringify(res));
}

export async function updateGoalAction(documentId: string, data: any) {
  const { databases } = await createSessionClient();
  const res = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.goals,
    documentId,
    data
  );
  return JSON.parse(JSON.stringify(res));
}

export async function deleteGoalAction(documentId: string) {
  const { databases } = await createSessionClient();
  await databases.deleteDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.goals,
    documentId
  );
  return { success: true };
}

export async function updateProfileAction(documentId: string, data: any) {
  const { databases } = await createSessionClient();
  const res = await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.profiles,
    documentId,
    data
  );
  return JSON.parse(JSON.stringify(res));
}

export async function listAllMoodLogsAction(limit = 100) {
  const { databases } = await createSessionClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.moodLogs,
    [
      Query.orderDesc("createdAt"),
      Query.limit(limit),
    ]
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function listChatSessionsAction(limit = 50) {
  const { databases } = await createSessionClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.chatSessions,
    [
      Query.orderDesc("createdAt"),
      Query.limit(limit),
    ]
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function listChatMessagesAction(sessionId: string, limit = 100) {
  const { databases } = await createSessionClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.chatMessages,
    [
      Query.equal("sessionId", sessionId),
      Query.orderAsc("createdAt"),
      Query.limit(limit),
    ]
  );
  return JSON.parse(JSON.stringify(res.documents));
}

export async function sendChatReplyAction(sessionId: string, body: string) {
  const { databases } = await createSessionClient();
  const res = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.collections.chatMessages,
    ID.unique(),
    {
      sessionId,
      sender: "admin", // Assuming therapist acts as admin/support
      body,
      createdAt: new Date().toISOString(),
    }
  );
  return JSON.parse(JSON.stringify(res));
}
