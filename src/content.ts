import { mount } from "svelte";
import Sidebar from "$/ui/Sidebar.svelte";

// Chrome message listener
chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
  if (request.action === "toggleSidebar") {
    toggleSidebar();
  }
});

function toggleSidebar() {
  let target = document.getElementById("yt-side-bar");
  if (target == null) {
    target = document.createElement("div");
    target.id = "yt-side-bar";
    document.body.append(target);
    mount(Sidebar, { target });
  } else {
    target.remove();
  }
}
