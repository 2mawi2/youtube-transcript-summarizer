<script lang="ts">
  import { onMount } from "svelte";
  import { adjustYouTubeLayout, fetchVideoData, getVideoId, seekToTimestamp } from "$/lib/youtube.ts";
  import { getApiKey, OpenAIWrapper, saveApiKey, type OpenAIMessage } from "$/lib/openai.ts";
  import TopBar from "./components/TopBar.svelte";
  import ApiKeySection from "./components/ApiKeySection.svelte";
  import ChatMessages from "./components/ChatMessages.svelte";
  import ChatInput from "./components/ChatInput.svelte";
  import LoadingSpinner from "./components/LoadingSpinner.svelte";

  type MessagePart = { type: "text" | "timestamp"; content: string };
  type Message = { sender: string; parts: MessagePart[] };

  // State
  let lastVideoId = $state(getVideoId());
  let isSummarizing = $state(false);
  let conversationHistory = $state<OpenAIMessage[]>([]);
  let messages = $state<Message[]>([]);
  let chatInput = $state("");
  let apiKeyInput = $state("");
  let statusMessage = $state("");
  let isLoading = $state(false);
  let isApiKeySectionVisible = $state(false);
  let isChatContainerVisible = $state(false);

  // Video change detection
  let videoCheckInterval = $state<number>();

  onMount(() => {
    videoCheckInterval = setInterval(() => {
      const currentVideoId = getVideoId();
      if (currentVideoId !== lastVideoId) {
        lastVideoId = currentVideoId;
        refreshSidebarContent();
      }
    }, 1000);

    checkApiKey();

    return () => {
      clearInterval(videoCheckInterval);
      adjustYouTubeLayout(0);
    };
  });

  async function handleSendMessage() {
    if (!chatInput.trim()) return;

    appendMessage("User", chatInput);
    chatInput = "";

    try {
      const { openaiApiKey } = await getApiKey();
      if (!openaiApiKey) {
        throw new Error("API Key not found.");
      }

      const openAI = new OpenAIWrapper(openaiApiKey);
      const fullContext = [...conversationHistory];

      const reader = await openAI.generateStreamResponse(fullContext);
      let assistantMessage = "";

      appendMessage("Assistant", "");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder("utf-8").decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.replace(/^data: /, "").trim();
            if (data === "[DONE]") {
              updateConversation("assistant", assistantMessage);
              return;
            }
            if (data) {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantMessage += content;
                  updateLastMessage(assistantMessage);
                }
              } catch (error) {
                console.error("Error parsing stream chunk:", error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      appendMessage("Assistant", "Error fetching response.");
    }
  }

  async function handleSaveApiKey() {
    if (!apiKeyInput.trim()) {
      statusMessage = "API Key cannot be empty.";
      return;
    }

    await saveApiKey(apiKeyInput);
    statusMessage = "API Key Saved.";
    apiKeyInput = "";
    checkApiKey();
  }

  async function startSummarization() {
    if (isSummarizing) return;
    isSummarizing = true;
    isLoading = true;
    clearMessages();

    try {
      const { openaiApiKey } = await getApiKey();
      if (!openaiApiKey) {
        throw new Error("API Key not found.");
      }

      const videoData = await fetchVideoData();
      if (!videoData || videoData.transcript === "Transcript not available.") {
        appendMessage("Assistant", "Transcript not available.");
        return;
      }

      const { title, description, transcript } = videoData;

      initializeConversation(transcript, title, description);
      const openAI = new OpenAIWrapper(openaiApiKey);
      const reader = await openAI.generateStreamResponse(conversationHistory);
      let assistantMessage = "";

      appendMessage("Assistant", "");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder("utf-8").decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(5);
            if (data === "[DONE]") {
              updateConversation("assistant", assistantMessage);
              break;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantMessage += content;
                updateLastMessage(assistantMessage);
              }
            } catch (error) {
              console.error("Error parsing stream data:", error);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      appendMessage("Assistant", "Error fetching summary.", false);
    } finally {
      isSummarizing = false;
      isLoading = false;
      isChatContainerVisible = true;
    }
  }

  async function checkApiKey() {
    const { openaiApiKey } = await getApiKey();
    if (openaiApiKey) {
      statusMessage = "API Key Loaded.";
      await startSummarization();
    } else {
      statusMessage = "Please enter your OpenAI API Key.";
    }
  }

  function refreshSidebarContent() {
    clearMessages();
    conversationHistory = [];
    isSummarizing = false;
    checkApiKey();
  }

  function clearMessages() {
    messages = [];
    conversationHistory = [];
  }

  async function appendMessage(sender: string, message: string, addToHistory = true) {
    isChatContainerVisible = true;

    if (message) {
      const parts: MessagePart[] = [];
      const timestampRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
      let lastIndex = 0;
      let match;

      while ((match = timestampRegex.exec(message)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: "text", content: message.slice(lastIndex, match.index) });
        }
        parts.push({ type: "timestamp", content: match[1] });
        lastIndex = match.index + match[1].length;
      }

      if (lastIndex < message.length) {
        parts.push({ type: "text", content: message.slice(lastIndex) });
      }

      messages = [...messages, { sender, parts }];
    } else {
      messages = [...messages, { sender, parts: [] }];
    }

    if (addToHistory) {
      const role = sender.toLowerCase() === "assistant" ? "assistant" : "user";
      conversationHistory = [...conversationHistory, { role, content: message }];
    }
  }

  function updateLastMessage(content: string) {
    if (messages.length > 0) {
      const updatedMessages = [...messages];
      const lastMessage = updatedMessages[updatedMessages.length - 1];
      const parts: MessagePart[] = [];
      const timestampRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
      let lastIndex = 0;
      let match;

      while ((match = timestampRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
        }
        parts.push({ type: "timestamp", content: match[1] });
        lastIndex = match.index + match[1].length;
      }

      if (lastIndex < content.length) {
        parts.push({ type: "text", content: content.slice(lastIndex) });
      }

      lastMessage.parts = parts;
      messages = updatedMessages;
    }
  }

  function initializeConversation(transcript: string, title: string, description: string) {
    const content = `
Generate a highly useful and user-friendly summary of the following YouTube video:
Title: ${title}
Description: ${description}
Transcript:
${transcript}
`;

    conversationHistory = [
      {
        role: "system",
        content: `As an AI assistant, your task is to generate a highly useful and user-friendly summary of the following YouTube video. Please adhere to these guidelines:

1. **Initial Brief Summary**:
   - **Start with a brief summary** of **1 to 3 sentences**.
   - This summary should **explain the main point and outcome of the video**, including any relevant **background** information.
   - **Provide a direct and explicit answer** to any questions or catchphrases in the video title **in a separate, prominent sentence immediately after the brief summary**.
     - *Example*: If the title is "How Long Can I Live in a Luxury Resort For Free?", include a sentence like "The host demonstrates that it's possible to stay in a luxury resort for free for up to seven days using reward points and travel hacks."

2. **Structured Summary with Headings**:
   - Organize the rest of the summary into sections with **clear and brief headings**.
   - **Headings should be no longer than 3 words**.
   - **Avoid redundancy** between headings and descriptions.
   - Add three ### before the heading.

3. **Content Focus**:
   - **Do not include a conclusion or closing remarks**.
   - **Avoid any section titled "Conclusion"**.
   - Highlight key points and important information that deliver the most value to the user.
   - **Focus on delivering answers and insights without requiring the user to watch the entire video**.
   - Use timestamps in the format **(hh:mm:ss)** to reference specific moments in the video.

4. **Timestamps**:
   - Include **accurate timestamps** under each heading.
   - Only include the timestamp in the separate line. Do not wrap it in brackets.
   - Ensure timestamps correspond to the relevant sections in the video.

5. **Style and Tone**:
   - Write in **clear, neutral language** using the **third person**.
   - Use **complete sentences** in descriptions.
   - **Do not include emojis**, symbols, or unnecessary characters.

6. **Formatting**:
   - Begin with the initial brief summary and the direct answer to the title's question, followed by the structured summary with headings.
   - **Do not include any introductory text or summary headline** before the brief summary.
   - Maintain consistent formatting throughout the summary.

Proceed to generate the summary based on the provided content, ensuring it is as informative and accessible as possible for users, and addresses the specified guidelines.`,
      },
      {
        role: "user",
        content: content,
      },
    ];
  }

  function updateConversation(role: string, content: string) {
    conversationHistory = [...conversationHistory, { role, content }];
  }

  function handleTimestampClick(timestamp: string) {
    seekToTimestamp(timestamp);
  }

  function handleClose() {
    const sidebarElement = document.getElementById("yt-side-bar");
    if (sidebarElement) {
      sidebarElement.remove();
      adjustYouTubeLayout(0);
    }
  }
</script>

<div class="sidebar">
  <TopBar onClose={handleClose} onConfigClick={() => (isApiKeySectionVisible = !isApiKeySectionVisible)} />

  {#if isApiKeySectionVisible}
    <ApiKeySection bind:apiKeyInput {statusMessage} onSaveApiKey={handleSaveApiKey} />
  {/if}

  {#if isLoading && messages.length === 0}
    <LoadingSpinner />
  {/if}

  {#if isChatContainerVisible}
    <div class="chat-container">
      <ChatMessages {messages} onTimestampClick={handleTimestampClick} />
      <ChatInput bind:chatInput onSendMessage={handleSendMessage} />
    </div>
  {/if}
</div>

<style>
  :global(#content) {
    margin-right: 450px;
  }

  .sidebar {
    width: 450px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #ffffff;
    color: #333333;
    transition: transform 0.3s ease;
    font-family: Arial, sans-serif;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 2147483646;
    box-shadow: -5px 0 10px rgba(0, 0, 0, 0.2);
    font-size: 16px;
    overflow: auto;
  }

  .chat-container {
    display: flex;
    flex-direction: column;
    height: calc(100% - 50px);
  }
</style>
