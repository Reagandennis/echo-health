require('dotenv').config({ path: '.env.local' });
const { Client, Account, ID } = require("node-appwrite");

async function test() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const account = new Account(client);

  try {
    const email = "testuser" + Date.now() + "@example.com";
    const pass = "password123!";
    
    // Create session (no user creation needed since I'm just creating the session?)
    // Actually need to create user first
    const users = require("node-appwrite").Users;
    const usersClient = new users(client);
    await usersClient.create(ID.unique(), email, undefined, pass, "Test User");
    
    const session = await account.createEmailPasswordSession(email, pass);
    console.log("Session created. Secret is:", session.secret);
  } catch (e) {
    console.error("ERROR CAUGHT:", e.message);
  }
}
test();
