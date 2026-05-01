import { Client, Users } from "node-appwrite";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://appwrite.techgetafrica.com/v1";
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "69eb100d000c4cb0399c";
const API_KEY = process.env.APPWRITE_API_KEY || "";

async function setClientRole() {
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const users = new Users(client);

  try {
    const email = "reaganowiti8@gmail.com";
    const userList = await users.list();
    const target = userList.users.find(u => u.email === email);

    if (target) {
      console.log(`Setting 'client' label for ${target.name}...`);
      await users.updateLabels(target.$id, ["client"]);
      console.log("✅ Done!");
    } else {
      console.log("❌ User not found.");
    }
  } catch (error) {
    console.error("❌ Failed:", error);
  }
}

setClientRole();
