<script lang="ts">
  export let onClose: () => void;
  export let onConfigClick: () => void;
</script>

<div class="top-bar">
  <button class="toggle-button" on:click={onClose}>&#9776;</button>
  <button class="title">YTTD</button>
  <button class="config-icon" on:click={onConfigClick}>&#9881;</button>
</div>

<style>
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background-color: #f1f1f1;
    border-bottom: 1px solid #ddd;
  }

  .toggle-button,
  .config-icon,
  .title {
    border: none;
    background: none;
  }

  .toggle-button,
  .config-icon {
    font-size: 26px;
    cursor: pointer;
    color: #555;
  }

  .title {
    font-size: 22px;
    font-weight: bold;
  }
</style>
