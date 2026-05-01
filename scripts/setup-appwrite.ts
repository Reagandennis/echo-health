/**
 * scripts/setup-appwrite.ts
 *
 * One-time script to create all Appwrite collections + attributes in the
 * `echo-data` database.
 *
 * Usage:
 *   APPWRITE_API_KEY=<key> npx tsx scripts/setup-appwrite.ts
 *
 * Requires: node-appwrite, tsx (or ts-node)
 *   npm install --save-dev tsx
 */

import {
  Client,
  Databases,
  DatabasesIndexType,
  Permission,
  Role,
} from "node-appwrite";

// ─── Config ───────────────────────────────────────────────────────────────────

const ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
  "https://appwrite.techgetafrica.com/v1";
const PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "69eb100d000c4cb0399c";
const DATABASE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "echo-data";
const API_KEY = process.env.APPWRITE_API_KEY ?? "";

if (!API_KEY) {
  console.error("❌  APPWRITE_API_KEY env var is required.");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const db = new Databases(client);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeCreate<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    const result = await fn();
    console.log(`  ✅  ${label}`);
    return result;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : JSON.stringify(err);
    if (message.includes("already exists") || message.includes("409")) {
      console.log(`  ⏭   ${label} (already exists)`);
    } else {
      console.error(`  ❌  ${label}: ${message}`);
    }
    return null;
  }
}

// ─── Collections ──────────────────────────────────────────────────────────────

async function createProfiles() {
  console.log("\n📁  profiles");
  await safeCreate("collection", () =>
    db.createCollection(DATABASE_ID, "profiles", "Profiles", [
      Permission.read(Role.label("admin")),
      Permission.read(Role.label("therapist")),
      Permission.create(Role.users()),
      Permission.update(Role.label("admin")),
    ], true) // documentSecurity: true
  );

  for (const [key, required, size] of [
    ["userId", true, 36],
    ["name", true, 128],
    ["email", true, 254],
    ["goal", false, 256],
    ["therapistId", false, 36],
    ["avatarUrl", false, 2048],
    ["createdAt", true, 32],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () =>
      db.createStringAttribute(DATABASE_ID, "profiles", key, size, required)
    );
  }

  await safeCreate("index: userId", () =>
    db.createIndex(DATABASE_ID, "profiles", "idx_userId", DatabasesIndexType.Key, [
      "userId",
    ])
  );
}

async function createTherapists() {
  console.log("\n📁  therapists");
  await safeCreate("collection", () =>
    db.createCollection(DATABASE_ID, "therapists", "Therapists", [
      Permission.read(Role.any()),
      Permission.create(Role.label("admin")),
      Permission.update(Role.label("admin")),
    ], true) // documentSecurity: true
  );

  for (const [key, required, size] of [
    ["userId", true, 36],
    ["name", true, 128],
    ["bio", true, 2000],
    ["avatarUrl", false, 2048],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () =>
      db.createStringAttribute(DATABASE_ID, "therapists", key, size, required)
    );
  }

  await safeCreate("attr: experience", () =>
    db.createIntegerAttribute(DATABASE_ID, "therapists", "experience", true, 0, 50)
  );

  await safeCreate("attr: rating", () =>
    db.createFloatAttribute(DATABASE_ID, "therapists", "rating", false, 0, 5)
  );

  await safeCreate("attr: specialties", () =>
    db.createStringAttribute(
      DATABASE_ID,
      "therapists",
      "specialties",
      64,
      false,
      undefined,
      true // array
    )
  );

  await safeCreate("attr: kycStatus", () =>
    db.createEnumAttribute(
      DATABASE_ID,
      "therapists",
      "kycStatus",
      ["incomplete", "pending", "verified", "rejected"],
      false,
      "incomplete"
    )
  );

  await safeCreate("attr: licenseNumber", () =>
    db.createStringAttribute(DATABASE_ID, "therapists", "licenseNumber", 64, false)
  );

  await safeCreate("attr: licenseUrl", () =>
    db.createStringAttribute(DATABASE_ID, "therapists", "licenseUrl", 2048, false)
  );

  await safeCreate("attr: onboardingComplete", () =>
    db.createBooleanAttribute(DATABASE_ID, "therapists", "onboardingComplete", false, false)
  );
}

async function createSessions() {
  console.log("\n📁  sessions");
  await safeCreate("collection", () =>
    db.createCollection(
      DATABASE_ID,
      "sessions",
      "Sessions",
      [
        Permission.read(Role.label("admin")),
        Permission.create(Role.users()),
        Permission.update(Role.label("admin")),
      ],
      true // documentSecurity: true
    )
  );

  for (const [key, required, size] of [
    ["patientId", true, 36],
    ["therapistId", true, 36],
    ["scheduledAt", true, 32],
    ["notes", false, 4000],
    ["feedback", false, 2000],
    ["therapistTracks", false, 1000], // Cloudflare track IDs (JSON)
    ["patientTracks", false, 1000],   // Cloudflare track IDs (JSON)
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () =>
      db.createStringAttribute(DATABASE_ID, "sessions", key, size, required)
    );
  }

  await safeCreate("attr: status", () =>
    db.createEnumAttribute(
      DATABASE_ID,
      "sessions",
      "status",
      ["pending", "confirmed", "completed", "cancelled"],
      true  // required — no default (Appwrite 1.9 disallows default on required enums)
    )
  );

  await safeCreate("index: patientId", () =>
    db.createIndex(DATABASE_ID, "sessions", "idx_patientId", DatabasesIndexType.Key, [
      "patientId",
    ])
  );

  await safeCreate("index: therapistId", () =>
    db.createIndex(DATABASE_ID, "sessions", "idx_therapistId", DatabasesIndexType.Key, [
      "therapistId",
    ])
  );
}

async function createMessages() {
  console.log("\n📁  messages");
  await safeCreate("collection", () =>
    db.createCollection(
      DATABASE_ID,
      "messages",
      "Messages",
      [
        Permission.read(Role.label("admin")),
        Permission.create(Role.users()),
      ],
      true // documentSecurity: true
    )
  );

  for (const [key, required, size] of [
    ["sessionId", true, 36],
    ["senderId", true, 36],
    ["receiverId", true, 36],
    ["content", true, 4000],
    ["createdAt", true, 32],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () =>
      db.createStringAttribute(DATABASE_ID, "messages", key, size, required)
    );
  }

  await safeCreate("index: sessionId", () =>
    db.createIndex(DATABASE_ID, "messages", "idx_sessionId", DatabasesIndexType.Key, [
      "sessionId",
    ])
  );
}

async function createChatMessages() {
  console.log("\n📁  chat_messages");
  await safeCreate("collection", () =>
    db.createCollection(
      DATABASE_ID,
      "chat_messages",
      "Chat Messages",
      [
        Permission.read(Role.any()),
        Permission.read(Role.label("admin")),
        Permission.create(Role.any()),
        Permission.update(Role.label("admin")),
        Permission.delete(Role.label("admin")),
      ],
      true // documentSecurity on
    )
  );

  for (const [key, required, size] of [
    ["sessionId", true, 64],
    ["name", true, 128],
    ["email", true, 256],
    ["role", true, 16],
    ["text", true, 4096],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () =>
      db.createStringAttribute(DATABASE_ID, "chat_messages", key, size, required)
    );
  }

  await safeCreate("index: sessionId", () =>
    db.createIndex(DATABASE_ID, "chat_messages", "idx_sessionId", DatabasesIndexType.Key, [
      "sessionId",
    ])
  );
}

async function createChatSessions() {
  console.log("\n📁  chat_sessions");
  await safeCreate("collection", () =>
    db.createCollection(
      DATABASE_ID,
      "chat_sessions",
      "Chat Sessions",
      [
        Permission.read(Role.label("admin")),
        Permission.create(Role.any()),
        Permission.update(Role.label("admin")),
        Permission.delete(Role.label("admin")),
      ],
      true // documentSecurity on
    )
  );

  for (const [key, required, size] of [
    ["sessionId", true, 64],
    ["name", true, 128],
    ["email", true, 256],
    ["lastMessage", false, 4096],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () =>
      db.createStringAttribute(DATABASE_ID, "chat_sessions", key, size, required)
    );
  }

  await safeCreate("attr: lastActive", () =>
    db.createDatetimeAttribute(DATABASE_ID, "chat_sessions", "lastActive", true)
  );

  await safeCreate("attr: isOnline", () =>
    db.createBooleanAttribute(DATABASE_ID, "chat_sessions", "isOnline", false)
  );

  await safeCreate("index: sessionId", () =>
    db.createIndex(DATABASE_ID, "chat_sessions", "idx_sessionId", DatabasesIndexType.Key, [
      "sessionId",
    ])
  );

  await safeCreate("index: lastActive", () =>
    db.createIndex(DATABASE_ID, "chat_sessions", "idx_lastActive", DatabasesIndexType.Key, [
      "lastActive",
    ])
  );
}

async function createMoodLogs() {
  console.log("\n📁  mood_logs");
  await safeCreate("collection", () =>
    db.createCollection(DATABASE_ID, "mood_logs", "Mood Logs", [
      Permission.read(Role.label("admin")),
      Permission.create(Role.users()),
    ], true)
  );
  for (const [key, req, size] of [
    ["userId", true, 36],
    ["emoji", true, 16],
    ["note", false, 1000],
    ["createdAt", true, 32],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () => db.createStringAttribute(DATABASE_ID, "mood_logs", key, size, req));
  }
  await safeCreate("attr: score", () => db.createIntegerAttribute(DATABASE_ID, "mood_logs", "score", true, 1, 10));
  await safeCreate("attr: tags", () => db.createStringAttribute(DATABASE_ID, "mood_logs", "tags", 64, false, undefined, true));
}

async function createGoals() {
  console.log("\n📁  goals");
  await safeCreate("collection", () =>
    db.createCollection(DATABASE_ID, "goals", "Goals", [
      Permission.read(Role.label("admin")),
      Permission.create(Role.users()),
    ], true)
  );
  for (const [key, req, size] of [
    ["userId", true, 36],
    ["title", true, 256],
    ["description", false, 1000],
    ["milestones", true, 4000], // JSON
    ["completedAt", false, 32],
    ["createdAt", true, 32],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () => db.createStringAttribute(DATABASE_ID, "goals", key, size, req));
  }
  await safeCreate("attr: assignedBy", () => db.createEnumAttribute(DATABASE_ID, "goals", "assignedBy", ["self", "therapist"], true));
}

async function createJournalEntries() {
  console.log("\n📁  journal_entries");
  await safeCreate("collection", () =>
    db.createCollection(DATABASE_ID, "journal_entries", "Journal Entries", [
      Permission.read(Role.label("admin")),
      Permission.create(Role.users()),
    ], true)
  );
  for (const [key, req, size] of [
    ["userId", true, 36],
    ["content", true, 5000],
    ["prompt", false, 500],
    ["createdAt", true, 32],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () => db.createStringAttribute(DATABASE_ID, "journal_entries", key, size, req));
  }
}

async function createPromos() {
  console.log("\n📁  promos");
  await safeCreate("collection", () =>
    db.createCollection(DATABASE_ID, "promos", "Promo Codes", [
      Permission.read(Role.label("admin")),
    ], false)
  );
  await safeCreate("attr: usedBy", () => db.createStringAttribute(DATABASE_ID, "promos", "usedBy", 36, true));
  await safeCreate("attr: usedAt", () => db.createDatetimeAttribute(DATABASE_ID, "promos", "usedAt", true));
}

async function createNotifications() {
  console.log("\n📁  notifications");
  await safeCreate("collection", () =>
    db.createCollection(DATABASE_ID, "notifications", "Notifications", [
      Permission.read(Role.label("admin")),
      Permission.create(Role.users()),
    ], true)
  );
  for (const [key, req, size] of [
    ["userId", true, 36],
    ["title", true, 128],
    ["message", true, 512],
    ["type", true, 32], // session, message, risk
    ["link", false, 256],
    ["createdAt", true, 32],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () => db.createStringAttribute(DATABASE_ID, "notifications", key, size, req));
  }
  await safeCreate("attr: read", () => db.createBooleanAttribute(DATABASE_ID, "notifications", "read", false, false));
}

async function createClinicalNotes() {
  const collectionId = process.env.NEXT_PUBLIC_APPWRITE_CLINICAL_NOTES_COLLECTION_ID ?? "clinical_notes";
  console.log(`\n📁  ${collectionId}`);
  await safeCreate("collection", () =>
    db.createCollection(DATABASE_ID, collectionId, "Clinical Notes", [
      Permission.read(Role.label("admin")),
      Permission.read(Role.label("therapist")),
      Permission.create(Role.label("therapist")),
      Permission.update(Role.label("therapist")),
      Permission.delete(Role.label("therapist")),
    ], true)
  );
  for (const [key, req, size] of [
    ["patientId", true, 36],
    ["therapistId", true, 36],
    ["sessionId", false, 36],
    ["type", true, 16], // soap, freeform
    ["content", true, 4000], // JSON string for SOAP or raw text
    ["createdAt", true, 32],
    ["updatedAt", true, 32],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () => db.createStringAttribute(DATABASE_ID, collectionId, key, size, req));
  }
  await safeCreate("attr: isPrivate", () => db.createBooleanAttribute(DATABASE_ID, collectionId, "isPrivate", false, true));
}

async function createSessionFeedback() {
  const collectionId = process.env.NEXT_PUBLIC_APPWRITE_SESSION_FEEDBACK_COLLECTION_ID ?? "session_feedback";
  console.log(`\n📁  ${collectionId}`);
  await safeCreate("collection", () =>
    db.createCollection(DATABASE_ID, collectionId, "Session Feedback", [
      Permission.read(Role.label("admin")),
      Permission.create(Role.users()),
    ], true)
  );
  for (const [key, req, size] of [
    ["sessionId", true, 36],
    ["userId", true, 36],
    ["comment", false, 1000],
    ["createdAt", true, 32],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () => db.createStringAttribute(DATABASE_ID, collectionId, key, size, req));
  }
  await safeCreate("attr: rating", () => db.createIntegerAttribute(DATABASE_ID, collectionId, "rating", true, 1, 5));
}

async function createMatchConflicts() {
  const collectionId = "match_conflicts";
  console.log(`\n📁  ${collectionId}`);
  await safeCreate("collection", () =>
    db.createCollection(DATABASE_ID, collectionId, "Match Conflicts", [
      Permission.read(Role.label("admin")),
      Permission.create(Role.label("admin")),
      Permission.update(Role.label("admin")),
    ], true)
  );
  for (const [key, req, size] of [
    ["patientId", true, 36],
    ["fromTherapistId", false, 36],
    ["toTherapistId", false, 36],
    ["reason", true, 1000],
    ["severity", true, 16], // low, medium, high
    ["createdAt", true, 32],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () => db.createStringAttribute(DATABASE_ID, collectionId, key, size, req));
  }
  await safeCreate("attr: resolved", () => db.createBooleanAttribute(DATABASE_ID, collectionId, "resolved", false, false));
}

async function createRiskAlerts() {
  const collectionId = "risk_alerts";
  console.log(`\n📁  ${collectionId}`);
  await safeCreate("collection", () =>
    db.createCollection(DATABASE_ID, collectionId, "Risk Alerts", [
      Permission.read(Role.label("admin")),
      Permission.create(Role.label("admin")),
      Permission.update(Role.label("admin")),
      Permission.create(Role.label("therapist")), // Therapists can flag
    ], true)
  );
  for (const [key, req, size] of [
    ["patientId", true, 36],
    ["type", true, 16], // crisis, mood, engagement, flag
    ["description", true, 1000],
    ["severity", true, 16], // critical, high, medium
    ["createdAt", true, 32],
  ] as [string, boolean, number][]) {
    await safeCreate(`attr: ${key}`, () => db.createStringAttribute(DATABASE_ID, collectionId, key, size, req));
  }
  await safeCreate("attr: resolved", () => db.createBooleanAttribute(DATABASE_ID, collectionId, "resolved", false, false));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀  Setting up Appwrite collections in database:", DATABASE_ID);

  await createProfiles();
  await createTherapists();
  await createSessions();
  await createMessages();
  await createChatMessages();
  await createChatSessions();
  await createMoodLogs();
  await createGoals();
  await createJournalEntries();
  await createPromos();
  await createNotifications();
  await createClinicalNotes();
  await createSessionFeedback();
  await createMatchConflicts();
  await createRiskAlerts();

  console.log("\n🎉  Done!\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
