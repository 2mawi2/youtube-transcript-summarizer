export type OpenAIMessage = {
  role: string;
  content: string;
};

export class OpenAIWrapper {
  constructor(private apiKey: string) {}

  async generateStreamResponse(context: OpenAIMessage[]) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: context,
        max_tokens: 3000,
        temperature: 0.1,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error(`Missing api response body: ${response.status}`);
    }

    return response.body?.getReader();
  }

  async generateResponse(messages: OpenAIMessage[]) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: 3000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }
}

export async function getApiKey(): Promise<{ openaiApiKey: string }> {
  return await chrome.storage.sync.get(["openaiApiKey"]);
}

export async function saveApiKey(apiKey: string) {
  await chrome.storage.sync.set({ openaiApiKey: apiKey });
}
