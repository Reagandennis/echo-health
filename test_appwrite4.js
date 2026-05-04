const { Client, Account, ID } = require("node-appwrite");

async function test() {
  const client = new Client()
    .setEndpoint("https://appwrite.techgetafrica.com/v1")
    .setProject("69eb100d000c4cb0399c");
    
  // ADD API KEY IF WE HAVE ONE, wait I don't have the API key in the script!
  // I need to read it from .env
}
