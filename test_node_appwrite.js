const { Client, Account } = require("node-appwrite");

async function test() {
  const client = new Client()
    .setEndpoint("https://appwrite.techgetafrica.com/v1")
    .setProject("69eb100d000c4cb0399c");

  const account = new Account(client);

  try {
    const session = await account.createEmailPasswordSession("test@example.com", "password123");
    console.log("Session created:", session.secret);
    
    // Now create a NEW client using the secret
    const client2 = new Client()
      .setEndpoint("https://appwrite.techgetafrica.com/v1")
      .setProject("69eb100d000c4cb0399c")
      .setSession(session.secret);
      
    const account2 = new Account(client2);
    const user = await account2.get();
    console.log("User retrieved:", user.$id);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
