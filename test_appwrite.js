async function test() {
  const endpoint = "https://appwrite.techgetafrica.com/v1";
  const projectId = "69eb100d000c4cb0399c";
  
  // Try to create session
  const res = await fetch(`${endpoint}/account/sessions/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": projectId,
    },
    body: JSON.stringify({
      email: "test@example.com",
      password: "password123"
    })
  });
  
  const data = await res.json();
  console.log("Create Session Response:", data);
}
test();
