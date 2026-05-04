const { Client, Account, ID } = require("node-appwrite");

async function test() {
  const client = new Client()
    .setEndpoint("https://appwrite.techgetafrica.com/v1")
    .setProject("69eb100d000c4cb0399c");

  const account = new Account(client);

  try {
    const email = "testuser" + Date.now() + "@example.com";
    const pass = "password123!";
    
    console.log("Creating user:", email);
    await account.create(ID.unique(), email, pass, "Test User");
    
    console.log("Creating session...");
    const session = await account.createEmailPasswordSession(email, pass);
    console.log("Session created. Secret:", session.secret);
    
    const client2 = new Client()
      .setEndpoint("https://appwrite.techgetafrica.com/v1")
      .setProject("69eb100d000c4cb0399c")
      .setSession(session.secret);
      
    const account2 = new Account(client2);
    console.log("Calling get()...");
    const user = await account2.get();
    console.log("SUCCESS! User retrieved:", user.$id);
  } catch (e) {
    console.error("ERROR CAUGHT:", e.message);
  }
}
test();
