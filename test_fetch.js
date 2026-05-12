async function run() {
  try {
    const response = await fetch("https://routerai.ru/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer sk-idWLIk8WBHJJiwn-Y2oyMNdW0ckjsfIa",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.6",
        messages: [{role: "user", content: "hi"}],
        stream: true
      })
    });
    console.log("Status:", response.status);
    console.log("Headers:", response.headers);
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log(decoder.decode(value, { stream: true }));
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
