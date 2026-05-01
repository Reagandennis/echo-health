import { Client, Users, Databases, ID, Permission, Role } from "node-appwrite";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://appwrite.techgetafrica.com/v1";
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "69eb100d000c4cb0399c";
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "echo-data";
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID || "profiles";
const API_KEY = process.env.APPWRITE_API_KEY || "";

async function repairProfiles() {
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const users = new Users(client);
  const databases = new Databases(client);

  console.log("🔍 Checking for users without profiles...");

  try {
    const userList = await users.list();
    const profileList = await databases.listDocuments(DATABASE_ID, COLLECTION_ID);

    const profileUserIds = new Set(profileList.documents.map(p => p.userId));

    for (const user of userList.users) {
      if (!profileUserIds.has(user.$id)) {
        console.log(`➕ Creating missing profile for: ${user.name} (${user.email})`);
        
        await databases.createDocument(
          DATABASE_ID,
          COLLECTION_ID,
          ID.unique(),
          {
            userId: user.$id,
            name: user.name,
            email: user.email,
            createdAt: user.registration || new Date().toISOString(),
          },
          [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.read(Role.label("admin")),
            Permission.read(Role.label("therapist")),
          ]
        );
        console.log(`  ✅ Done for ${user.name}`);
      }
    }

    console.log("\n✨ Repair complete!");
  } catch (error) {
    console.error("❌ Repair failed:", error);
  }
}

repairProfiles();
