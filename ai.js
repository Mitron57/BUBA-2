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
          stream: true,
          messages: [{ role: "system", content: systemPrompt }, ...messages]
        }
      };
    },
    delta(data) {
      const delta = data.choices?.[0]?.delta;
      return delta?.content ?? delta?.refusal;
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
        body: { model, system: systemPrompt, messages, max_tokens: 1800, stream: true }
      };
    },
    delta(data) {
      if (data.type === "content_block_start" && data.content_block.type === "text") {
        return data.content_block.text;
      }
      if (data.type === "content_block_delta" && data.delta.type === "text_delta") {
        return data.delta.text;
      }
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
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
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
    delta(data) {
      return data.candidates?.[0]?.content?.parts
        ?.filter(part => !part.thought).map(part => part.text ?? "").join("");
    }
  }
};

export async function* streamAnswer({ provider, key, model }, systemPrompt, messages) {
  const api = providers[provider];
  const { url, body } = api.request(model, systemPrompt, messages);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream", ...api.headers(key) },
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

  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error(`${api.name} did not return a streaming response.`);
  }

  let geminiFinished = false;
  for await (const event of readEventStream(response.body)) {
    if (event === "[DONE]" && provider === "openai") return;

    const data = JSON.parse(event);
    if (data.error || data.type === "error") {
      throw new Error(`${api.name} returned an error while generating the response.`);
    }
    if (provider === "anthropic" && data.type === "message_stop") return;
    if (provider === "gemini") {
      if (data.promptFeedback?.blockReason) throw new Error("Gemini blocked this request.");
      geminiFinished ||= Boolean(data.candidates?.[0]?.finishReason);
    }

    const text = api.delta(data);
    if (text) yield text;
  }

  if (!geminiFinished) {
    throw new Error(`${api.name} closed the connection before completing the response.`);
  }
}

async function* readEventStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let data = [];
  let ended = false;

  try {
    while (!ended) {
      const { value, done } = await reader.read();
      ended = done;
      const input = pending + decoder.decode(value, { stream: !done });
      // Preserve a trailing CR until the next chunk tells us whether it is part of CRLF.
      const splitAt = !done && input.endsWith("\r") ? -1 : input.length;
      const lines = input.slice(0, splitAt).split(/\r\n|[\r\n]/);
      pending = lines.pop() + input.slice(splitAt);

      for (const line of lines) {
        if (line === "") {
          if (data.length) yield data.join("\n");
          data = [];
        } else if (line.startsWith("data:")) {
          data.push(line.slice(5).replace(/^ /, ""));
        }
      }
    }
  } finally {
    if (!ended) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function listModels(provider, key, signal) {
  const api = providers[provider];
  const url = new URL(api.catalog);
  const models = new Map();
  let nextPage;

  do {
    if (nextPage) url.searchParams.set(...nextPage);
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: api.headers(key),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal
    });

    const googleError = provider === "gemini" && response.status === 400
      ? await response.json().catch(() => null)
      : null;
    if (googleError?.error?.details?.some(detail => detail.reason === "API_KEY_INVALID")) {
      throw new Error("Google rejected this API key. Check the Gemini API key in Google AI Studio.");
    }
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
