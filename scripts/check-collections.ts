import { Client, Databases } from "node-appwrite";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://appwrite.techgetafrica.com/v1";
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "69eb100d000c4cb0399c";
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "echo-data";
const API_KEY = process.env.APPWRITE_API_KEY || "";

async function checkCollections() {
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const databases = new Databases(client);

  try {
    const res = await databases.listCollections(DATABASE_ID);
    console.log("Current Collections in database:", DATABASE_ID);
    res.collections.forEach(c => {
      console.log(`- ${c.name} (ID: ${c.$id})`);
    });
  } catch (error) {
    console.error("Error listing collections:", error);
  }
}

checkCollections();
