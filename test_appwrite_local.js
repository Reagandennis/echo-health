const { Client, Account } = require("node-appwrite");

async function test() {
  const client = new Client()
    .setEndpoint("https://appwrite.techgetafrica.com/v1")
    .setProject("69eb100d000c4cb0399c")
    .setKey("standard_4a7b870ed308db985b06f31d01b38562b7f46e84aa598d2f2d5edbfa5029f919ffa6947763f0ebab45b599726a19f63d17cba4170b358b350eff94dd6ff8d54f8c7fb6c3c14ca79fd5530bb5f78edfb69481c802523ba41d0be43f395e82cd40a36c619cb80b709e33fbcae9c542dddf261de447526b1cf919efe1e979e5a0d3");

  const account = new Account(client);

  try {
    const session = await account.createEmailPasswordSession("reaganprezzo@gmail.com", "Coder@5607");
    console.log("Session created. Secret:", session.secret);
    
    const client2 = new Client()
      .setEndpoint("https://appwrite.techgetafrica.com/v1")
      .setProject("69eb100d000c4cb0399c")
      .setSession(session.secret);
      
    const account2 = new Account(client2);
    const user = await account2.get();
    console.log("SUCCESS! User retrieved:", user.$id);
  } catch (e) {
    console.error("ERROR CAUGHT:", e.message);
  }
}
test();
