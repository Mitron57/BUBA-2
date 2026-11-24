require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();

function getConfig() {
  if (provider === "anthropic") return {
    key: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || "claude-3-7-sonnet-latest"
  };
  if (provider === "gemini") return {
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
  };
  return {
    key: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini"
  };
}

app.get("/api/status", (_req, res) => {
  const config = getConfig();
  res.json({ provider, configured: Boolean(config.key), model: config.model });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Add a message before sending." });
    }
    const config = getConfig();
    if (!config.key) {
      return res.status(503).json({
        error: `The ${provider} API key is not configured yet. Add it to your .env file, then restart BUBA.`
      });
    }

    let answer = "";
    if (provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.key,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1800,
          system: systemPrompt || "You are a creative writing and roleplay assistant.",
          messages: messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Anthropic API request failed.");
      answer = (data.content || []).filter(x => x.type === "text").map(x => x.text).join("\n");
    } else if (provider === "gemini") {
      const contents = messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${encodeURIComponent(config.key)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt || "You are a creative writing and roleplay assistant." }] },
            contents,
            generationConfig: { temperature: 0.9, maxOutputTokens: 1800 }
          })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Gemini API request failed.");
      answer = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    } else {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.9,
          messages: [
            { role: "system", content: systemPrompt || "You are a creative writing and roleplay assistant." },
            ...messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
          ]
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "OpenAI API request failed.");
      answer = data.choices?.[0]?.message?.content || "";
    }
    res.json({ answer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Something went wrong." });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`BUBA is running at http://localhost:${port}`));