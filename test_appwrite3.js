const { Client, Account, ID } = require("node-appwrite");

async function test() {
  const client = new Client()
    .setEndpoint("https://appwrite.techgetafrica.com/v1")
    .setProject("69eb100d000c4cb0399c");

  const account = new Account(client);

  try {
    const email = "testuser" + Date.now() + "@example.com";
    const pass = "password123!";
    await account.create(ID.unique(), email, pass, "Test User");
    const session = await account.createEmailPasswordSession(email, pass);
    console.log("Full session object:", session);
  } catch (e) {
    console.error("ERROR CAUGHT:", e.message);
  }
}
test();
