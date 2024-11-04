<script lang="ts">
  import { marked } from "marked";

  type MessagePart = { type: "text" | "timestamp"; content: string };
  type Message = { sender: string; parts: MessagePart[] };

  export let messages: Message[];
  export let onTimestampClick: (timestamp: string) => void;

  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  function parseMarkdown(text: string) {
    return marked(text);
  }
</script>

<div class="messages-wrapper">
  <div class="messages">
    {#each messages as message}
      <div class={`message ${message.sender.toLowerCase()}`}>
        <span class="sender-icon">{message.sender === "User" ? "👤" : "🤖"}</span>
        <span class="message-content">
          {#each message.parts as part}
            {#if part.type === "text"}
              {@html parseMarkdown(part.content)}
            {:else if part.type === "timestamp"}
              <button class="timestamp-link" on:click={() => onTimestampClick(part.content)}>
                {part.content}
              </button>
            {/if}
          {/each}
        </span>
      </div>
    {/each}
  </div>
</div>

<style>
  .messages-wrapper {
    flex-grow: 1;
    overflow-y: auto;
    padding: 10px;
  }

  .messages {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .message {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px;
    border-radius: 12px;
    max-width: 85%;
  }

  .message.user {
    background-color: #e6f2ff;
    margin-left: auto;
    border-bottom-right-radius: 4px;
  }

  .message.assistant {
    background-color: #f0f0f0;
    margin-right: auto;
    border-bottom-left-radius: 4px;
  }

  .timestamp-link {
    color: #0066cc;
    text-decoration: underline;
    cursor: pointer;
    background: none;
    border: none;
    font: inherit;
    padding: 0;
    margin: 0;
    margin-top: 0.2rem;
    margin-bottom: 0.4rem;
  }

  .timestamp-link:hover {
    color: #004499;
  }

  :global(.message-content h3) {
    margin-top: 1rem;
  }
</style>
