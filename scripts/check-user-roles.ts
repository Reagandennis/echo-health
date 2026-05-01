import { Client, Users } from "node-appwrite";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://appwrite.techgetafrica.com/v1";
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "69eb100d000c4cb0399c";
const API_KEY = process.env.APPWRITE_API_KEY || "";

async function checkUserRoles() {
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const users = new Users(client);

  try {
    const userList = await users.list();
    console.log("Current Users and their Labels:");
    userList.users.forEach(u => {
      console.log(`- ${u.name} (${u.email}): [${(u.labels || []).join(", ")}]`);
    });
  } catch (error) {
    console.error("Error listing users:", error);
  }
}

checkUserRoles();
