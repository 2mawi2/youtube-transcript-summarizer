<script lang="ts">
  export let chatInput: string;
  export let onSendMessage: () => void;
</script>

<div class="input-container">
  <input
    type="text"
    name="chat"
    bind:value={chatInput}
    on:keydown={(e) => e.key === "Enter" && onSendMessage()}
    placeholder="Type your message here..."
  />
  <button on:click={onSendMessage}>Send</button>
</div>

<style>
  .input-container {
    display: flex;
    padding: 10px;
    border-top: 1px solid #ddd;
  }

  input[type="text"] {
    flex-grow: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-right: 10px;
    font-size: 14px;
  }

  button {
    padding: 10px 16px;
    background-color: #4caf50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
