<script>
</script>

<div class="yt-sidebar-apiKeySection">
  <label for="yt-sidebar-apiKey">OpenAI API Key:</label>
  <input
    type="password"
    id="yt-sidebar-apiKey"
    placeholder="Enter your API key"
  />
  <button id="yt-sidebar-saveApiKey">Save Key</button>
  <p id="yt-sidebar-status"></p>
</div>

<style>
  .yt-sidebar-apiKeySection {
    display: block;
    padding: 10px;
    border-bottom: 1px solid #ddd;
  }

  :global(.dark-mode) .yt-sidebar-apiKeySection {
    border-bottom-color: #444;
  }

  #yt-sidebar-apiKey {
    width: 100%;
    padding: 10px;
    margin-bottom: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  :global(.dark-mode) #yt-sidebar-apiKey {
    background-color: #303030;
    color: #fff;
    border-color: #444;
  }

  #yt-sidebar-saveApiKey {
    width: 100%;
    padding: 10px;
    background-color: #4caf50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
