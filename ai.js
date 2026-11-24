export const providers = {
  openai: {
    name: "OpenAI",
    models: ["gpt-4.1-mini", "gpt-5-mini", "gpt-5", "gpt-4.1"],
    catalog: "https://api.openai.com/v1/models",
    headers: key => ({ authorization: `Bearer ${key}` }),
    list(data) {
      return data.data.map(model => model.id).filter(id => {
        const base = id.startsWith("ft:") ? id.split(":")[1] : id;
        return /^(gpt-\d|chatgpt-|o[1-9](?:-|$))/.test(base)
          && !/-\b(audio|codex|image|instruct|realtime|search|transcribe|tts)\b/.test(base)
          && !/-pro(?:-|$)/.test(base);
      }).map(id => ({ id }));
    },
    request(model, systemPrompt, messages) {
      return {
        url: "https://api.openai.com/v1/chat/completions",
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
    models: ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-6"],
    catalog: "https://api.anthropic.com/v1/models",
    headers: key => ({
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    }),
    list(data) {
      return data.data.map(model => ({ id: model.id, name: model.display_name }));
    },
    nextPage(data) {
      return data.has_more && data.last_id ? ["after_id", data.last_id] : null;
    },
    request(model, systemPrompt, messages) {
      return {
        url: "https://api.anthropic.com/v1/messages",
        body: { model, system: systemPrompt, messages, max_tokens: 1800 }
      };
    },
    answer(data) {
      return data.content?.filter(part => part.type === "text").map(part => part.text).join("\n");
    }
  },
  gemini: {
    name: "Gemini",
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
    catalog: "https://generativelanguage.googleapis.com/v1beta/models",
    headers: key => ({ "x-goog-api-key": key }),
    list(data) {
      return (data.models ?? []).filter(model => model.name.startsWith("models/gemini-")
        && model.supportedGenerationMethods?.includes("generateContent")
        && !/-(audio|image|live|tts|computer-use|robotics|deep-research)(?:-|$)/.test(model.name)
      ).map(model => ({ id: model.name.slice("models/".length), name: model.displayName }));
    },
    nextPage(data) {
      return data.nextPageToken ? ["pageToken", data.nextPageToken] : null;
    },
    request(model, systemPrompt, messages) {
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
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
  const { url, body } = api.request(model, systemPrompt, messages);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...api.headers(key) },
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

export async function listModels(provider, key, signal) {
  const api = providers[provider];
  const url = new URL(api.catalog);
  const models = new Map();
  let nextPage;

  do {
    if (nextPage) url.searchParams.set(...nextPage);
    const response = await fetch(url.toString(), {
      headers: api.headers(key),
      credentials: "omit",
      redirect: "error",
      signal
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("Check your API key and its permissions.");
    }
    if (!response.ok) {
      throw new Error(`The model list could not be loaded (HTTP ${response.status}).`);
    }

    const data = await response.json();
    for (const model of api.list(data)) models.set(model.id, model);
    nextPage = api.nextPage?.(data);
  } while (nextPage);

  return [...models.values()];
}
