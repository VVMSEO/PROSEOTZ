import http from 'http';
import https from 'https';

async function test() {
  const url = "https://routerai.ru/api/v1/chat/completions";
  console.log("Testing URL: ", url);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Bearer sk-qbf6ACgy2tmghGMBdty2uA3lWSHY98w7",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.6",
        messages: [{ role: "user", content: "Hello" }]
      }),
      redirect: 'manual' // see if it gives 301
    });

    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log("Response:", text.slice(0, 200));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
