export const providers = {
  openai: {
    name: "OpenAI",
    model: "gpt-4.1-mini",
    request(key, model, systemPrompt, messages) {
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: { authorization: `Bearer ${key}` },
        body: {
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages]
        }
      };
    },
    answer(data) {
      return data.choices?.[0]?.message?.content;
    }
  },
  anthropic: {
    name: "Anthropic",
    model: "claude-haiku-4-5",
    request(key, model, systemPrompt, messages) {
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: { model, system: systemPrompt, messages, max_tokens: 1800 }
      };
    },
    answer(data) {
      return data.content?.filter(part => part.type === "text").map(part => part.text).join("\n");
    }
  },
  gemini: {
    name: "Gemini",
    model: "gemini-2.5-flash",
    request(key, model, systemPrompt, messages) {
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        headers: { "x-goog-api-key": key },
        body: {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map(message => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }]
          })),
          generationConfig: { temperature: 0.9, maxOutputTokens: 1800 }
        }
      };
    },
    answer(data) {
      return data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
    }
  }
};

export async function requestAnswer({ provider, key, model }, systemPrompt, messages) {
  const api = providers[provider];
  const { url, headers, body } = api.request(key, model, systemPrompt, messages);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    credentials: "omit",
    redirect: "error",
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`${api.name} denied access. Check your API key and its permissions.`);
    }
    if (response.status === 429 || response.status === 402) {
      throw new Error(`${api.name} rejected the request. Check your usage limits and billing.`);
    }
    if (response.status === 400 || response.status === 404) {
      throw new Error(`${api.name} rejected the request. Check the model in API settings (HTTP ${response.status}).`);
    }
    throw new Error(`${api.name} request failed (HTTP ${response.status}).`);
  }

  return api.answer(await response.json());
}
