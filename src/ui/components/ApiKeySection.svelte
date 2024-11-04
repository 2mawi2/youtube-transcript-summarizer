<script lang="ts">
  export let apiKeyInput: string;
  export let statusMessage: string;
  export let onSaveApiKey: () => void;
</script>

<div class="api-key-section">
  <input type="text" bind:value={apiKeyInput} placeholder="Enter OpenAI API Key" />
  <button on:click={onSaveApiKey}>Save API Key</button>
  <div class="status">{statusMessage}</div>
</div>

<style>
  .api-key-section {
    padding: 10px;
  }

  input[type="text"] {
    width: 100%;
    padding: 10px;
    margin-bottom: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  button {
    padding: 10px 16px;
    background-color: #4caf50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .status {
    margin-top: 10px;
    text-align: center;
  }
</style>
