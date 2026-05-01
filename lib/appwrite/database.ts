// NOTE: Databases API is deprecated in SDK v24 in favour of TablesDB.
// The old API still works against the current server; migrate to TablesDB when ready.
import { ID, Query, Permission, Role, type Models } from "appwrite";
import { databases } from "./client";
import { appwriteConfig } from "./config";

const { databaseId, collections } = appwriteConfig;

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface Profile extends Models.Document {
  userId: string;
  name: string;
  email: string;
  goal?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Therapist extends Models.Document {
  userId: string;
  name: string;
  bio: string;
  specialties: string[];
  experience: number;
  avatarUrl?: string;
  rating?: number;
  onboardingComplete?: boolean;
  kycStatus?: "incomplete" | "pending" | "verified" | "rejected";
  licenseNumber?: string;
}

export interface TherapySession extends Models.Document {
  patientId: string;
  therapistId: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  scheduledAt: string;
  notes?: string;
  feedback?: string;
}

export interface Message extends Models.Document {
  sessionId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
}

// ─── Profile Helpers ─────────────────────────────────────────────────────────

export async function createProfile(
  data: Omit<Profile, keyof Models.Document>
): Promise<Profile> {
  return databases.createDocument<Profile>({
    databaseId,
    collectionId: collections.profiles,
    documentId: ID.unique(),
    data,
    permissions: [
      Permission.read(Role.user(data.userId)),
      Permission.update(Role.user(data.userId)),
      Permission.delete(Role.user(data.userId)),
      Permission.read(Role.label("admin")),
    ],
  });
}

export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const res = await databases.listDocuments<Profile>({
      databaseId,
      collectionId: collections.profiles,
      queries: [Query.equal("userId", userId), Query.limit(1)],
    });
    return res.documents[0] ?? null;
  } catch {
    return null;
  }
}

export async function updateProfile(
  documentId: string,
  data: Partial<Omit<Profile, keyof Models.Document>>
): Promise<Profile> {
  return databases.updateDocument<Profile>({
    databaseId,
    collectionId: collections.profiles,
    documentId,
    data,
  });
}

// ─── Therapist Helpers ───────────────────────────────────────────────────────

export async function listTherapists(limit = 20): Promise<Therapist[]> {
  const res = await databases.listDocuments<Therapist>({
    databaseId,
    collectionId: collections.therapists,
    queries: [Query.limit(limit)],
  });
  return res.documents;
}

export async function getTherapist(documentId: string): Promise<Therapist> {
  return databases.getDocument<Therapist>({
    databaseId,
    collectionId: collections.therapists,
    documentId,
  });
}

export async function getTherapistByUserId(userId: string): Promise<Therapist | null> {
  try {
    const res = await databases.listDocuments<Therapist>({
      databaseId,
      collectionId: collections.therapists,
      queries: [Query.equal("userId", userId), Query.limit(1)],
    });
    return res.documents[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Session Helpers ─────────────────────────────────────────────────────────

export async function createTherapySession(
  data: Omit<TherapySession, keyof Models.Document>
): Promise<TherapySession> {
  return databases.createDocument<TherapySession>({
    databaseId,
    collectionId: collections.sessions,
    documentId: ID.unique(),
    data,
    permissions: [
      Permission.read(Role.user(data.patientId)),
      Permission.update(Role.user(data.patientId)),
      Permission.read(Role.user(data.therapistId)),
      Permission.update(Role.user(data.therapistId)),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
    ],
  });
}

export async function listPatientSessions(
  patientId: string
): Promise<TherapySession[]> {
  const res = await databases.listDocuments<TherapySession>({
    databaseId,
    collectionId: collections.sessions,
    queries: [
      Query.equal("patientId", patientId),
      Query.orderDesc("scheduledAt"),
    ],
  });
  return res.documents;
}

export async function updateTherapySession(
  documentId: string,
  data: Partial<Omit<TherapySession, keyof Models.Document>>
): Promise<TherapySession> {
  return databases.updateDocument<TherapySession>({
    databaseId,
    collectionId: collections.sessions,
    documentId,
    data,
  });
}

// ─── Message Helpers ─────────────────────────────────────────────────────────

export async function sendMessage(
  data: Omit<Message, keyof Models.Document>
): Promise<Message> {
  return databases.createDocument<Message>({
    databaseId,
    collectionId: collections.messages,
    documentId: ID.unique(),
    data,
    permissions: [
      Permission.read(Role.user(data.senderId)),
      Permission.read(Role.user(data.receiverId)),
      Permission.read(Role.label("admin")),
    ],
  });
}

export async function listSessionMessages(
  sessionId: string
): Promise<Message[]> {
  const res = await databases.listDocuments<Message>({
    databaseId,
    collectionId: collections.messages,
    queries: [
      Query.equal("sessionId", sessionId),
      Query.orderAsc("createdAt"),
    ],
  });
  return res.documents;
}

export async function listDirectMessages(
  userId: string,
  therapistId: string,
  limit = 50
): Promise<Message[]> {
  const res = await databases.listDocuments<Message>({
    databaseId,
    collectionId: collections.messages,
    queries: [
      Query.or([
        Query.and([Query.equal("senderId", userId), Query.equal("receiverId", therapistId)]),
        Query.and([Query.equal("senderId", therapistId), Query.equal("receiverId", userId)]),
      ]),
      Query.orderAsc("createdAt"),
      Query.limit(limit),
    ],
  });
  return res.documents;
}

// ─── Mood Log Helpers ─────────────────────────────────────────────────────────

export interface MoodLog extends Models.Document {
  userId: string;
  score: number;          // 1–10
  emoji: string;
  tags: string[];
  note?: string;
  createdAt: string;
}

export async function createMoodLog(
  data: Omit<MoodLog, keyof Models.Document>
): Promise<MoodLog> {
  return databases.createDocument<MoodLog>({
    databaseId,
    collectionId: collections.moodLogs,
    documentId: ID.unique(),
    data,
    permissions: [
      Permission.read(Role.user(data.userId)),
      Permission.update(Role.user(data.userId)),
      Permission.delete(Role.user(data.userId)),
      Permission.read(Role.label("admin")),
    ],
  });
}

export async function listMoodLogs(userId: string, days = 30): Promise<MoodLog[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const res = await databases.listDocuments<MoodLog>({
    databaseId,
    collectionId: collections.moodLogs,
    queries: [
      Query.equal("userId", userId),
      Query.greaterThanEqual("createdAt", since.toISOString()),
      Query.orderAsc("createdAt"),
      Query.limit(days),
    ],
  });
  return res.documents;
}

// ─── Journal Entry Helpers ────────────────────────────────────────────────────

export interface JournalEntry extends Models.Document {
  userId: string;
  content: string;
  prompt?: string;
  createdAt: string;
}

export async function createJournalEntry(
  data: Omit<JournalEntry, keyof Models.Document>
): Promise<JournalEntry> {
  return databases.createDocument<JournalEntry>({
    databaseId,
    collectionId: collections.journalEntries,
    documentId: ID.unique(),
    data,
    permissions: [
      Permission.read(Role.user(data.userId)),
      Permission.update(Role.user(data.userId)),
      Permission.delete(Role.user(data.userId)),
      Permission.read(Role.label("admin")),
    ],
  });
}

export async function listJournalEntries(userId: string, limit = 20): Promise<JournalEntry[]> {
  const res = await databases.listDocuments<JournalEntry>({
    databaseId,
    collectionId: collections.journalEntries,
    queries: [
      Query.equal("userId", userId),
      Query.orderDesc("createdAt"),
      Query.limit(limit),
    ],
  });
  return res.documents;
}

export async function updateJournalEntry(
  documentId: string,
  data: Partial<Omit<JournalEntry, keyof Models.Document>>
): Promise<JournalEntry> {
  return databases.updateDocument<JournalEntry>({
    databaseId,
    collectionId: collections.journalEntries,
    documentId,
    data,
  });
}

// ─── Goal Helpers ─────────────────────────────────────────────────────────────

export interface GoalMilestone {
  title: string;
  completed: boolean;
}

export interface Goal extends Models.Document {
  userId: string;
  title: string;
  description?: string;
  milestones: string; // JSON-serialised GoalMilestone[]
  assignedBy: "self" | "therapist";
  completedAt?: string;
  createdAt: string;
}

export async function createGoal(
  data: Omit<Goal, keyof Models.Document>
): Promise<Goal> {
  return databases.createDocument<Goal>({
    databaseId,
    collectionId: collections.goals,
    documentId: ID.unique(),
    data,
    permissions: [
      Permission.read(Role.user(data.userId)),
      Permission.update(Role.user(data.userId)),
      Permission.delete(Role.user(data.userId)),
      Permission.read(Role.label("admin")),
    ],
  });
}

export async function listGoals(userId: string): Promise<Goal[]> {
  const res = await databases.listDocuments<Goal>({
    databaseId,
    collectionId: collections.goals,
    queries: [
      Query.equal("userId", userId),
      Query.orderDesc("createdAt"),
    ],
  });
  return res.documents;
}

export async function updateGoal(
  documentId: string,
  data: Partial<Omit<Goal, keyof Models.Document>>
): Promise<Goal> {
  return databases.updateDocument<Goal>({
    databaseId,
    collectionId: collections.goals,
    documentId,
    data,
  });
}

// ─── Session Feedback ─────────────────────────────────────────────────────────

export interface SessionFeedback extends Models.Document {
  sessionId: string;
  userId: string;
  rating: number;    // 1–5
  comment?: string;
  createdAt: string;
}

export async function submitSessionFeedback(
  data: Omit<SessionFeedback, keyof Models.Document>
): Promise<SessionFeedback> {
  return databases.createDocument<SessionFeedback>({
    databaseId,
    collectionId: collections.sessionFeedback,
    documentId: ID.unique(),
    data,
    permissions: [
      Permission.read(Role.user(data.userId)),
      Permission.read(Role.label("admin")),
    ],
  });
}

// ─── Clinical Note Helpers ───────────────────────────────────────────────────

export interface ClinicalNote extends Models.Document {
  patientId: string;
  therapistId: string;
  sessionId?: string;
  type: "soap" | "freeform";
  content: string; // JSON string for SOAP or raw text
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function createClinicalNote(
  data: Omit<ClinicalNote, keyof Models.Document>
): Promise<ClinicalNote> {
  return databases.createDocument<ClinicalNote>({
    databaseId,
    collectionId: collections.clinicalNotes,
    documentId: ID.unique(),
    data,
    permissions: [
      Permission.read(Role.label("therapist")),
      Permission.update(Role.label("therapist")),
      Permission.delete(Role.label("therapist")),
      Permission.read(Role.label("admin")),
    ],
  });
}

export async function listClinicalNotes(
  therapistId: string,
  patientId?: string
): Promise<ClinicalNote[]> {
  const queries = [Query.equal("therapistId", therapistId), Query.orderDesc("createdAt")];
  if (patientId) queries.push(Query.equal("patientId", patientId));

  const res = await databases.listDocuments<ClinicalNote>({
    databaseId,
    collectionId: collections.clinicalNotes,
    queries,
  });
  return res.documents;
}

export async function updateClinicalNote(
  documentId: string,
  data: Partial<Omit<ClinicalNote, keyof Models.Document>>
): Promise<ClinicalNote> {
  return databases.updateDocument<ClinicalNote>({
    databaseId,
    collectionId: collections.clinicalNotes,
    documentId,
    data,
  });
}

export async function deleteClinicalNote(documentId: string): Promise<{}> {
  return databases.deleteDocument({
    databaseId,
    collectionId: collections.clinicalNotes,
    documentId,
  });
}
