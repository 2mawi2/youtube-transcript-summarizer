// Global variables
let lastVideoId = getVideoId();
let isSummarizing = false;
let conversationHistory = [];

// Element references (initialized later)
let LoadingElement;
let ChatContainer;
let MessagesContainer;
let ChatInput;
let SendMessageButton;
let StatusElement;
let SaveApiKeyButton;
let ApiKeyInput;
let ConfigIcon;
let ToggleButton;
let ApiKeySection;

// Function to detect video changes
setInterval(() => {
    const currentVideoId = getVideoId();
    if (currentVideoId !== lastVideoId) {
        lastVideoId = currentVideoId;
        onVideoIdChange();
    }
}, 1000);

function onVideoIdChange() {
    // Reinitialize the extension
    if (document.getElementById('yt-transcript-sidebar')) {
        // If the sidebar is open, refresh its content
        refreshSidebarContent();
    }
}

function getVideoId() {
    const url = new URL(window.location.href);
    return url.searchParams.get('v');
}

function seekToTimestamp(timestamp) {
    const timeParts = timestamp.split(':').map(Number);
    let seconds = 0;
    if (timeParts.length === 3) {
        seconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
    } else if (timeParts.length === 2) {
        seconds = timeParts[0] * 60 + timeParts[1];
    } else {
        seconds = timeParts[0];
    }
    const video = document.querySelector('video');
    if (video) {
        video.currentTime = seconds;
        video.play();
    }
}

function compareTracks(track1, track2) {
    const langCode1 = track1.languageCode;
    const langCode2 = track2.languageCode;

    if (langCode1 === 'en' && langCode2 !== 'en') {
        return -1; // English comes first
    } else if (langCode1 !== 'en' && langCode2 === 'en') {
        return 1; // English comes first
    } else if (track1.kind !== 'asr' && track2.kind === 'asr') {
        return -1; // Non-ASR comes first
    } else if (track1.kind === 'asr' && track2.kind !== 'asr') {
        return 1; // Non-ASR comes first
    }

    return 0; // Preserve order if both have the same priority
}

// Chrome message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleSidebar') {
        toggleSidebar();
    }
});

// Sidebar functions

function toggleSidebar() {
    const sidebar = document.getElementById('yt-transcript-sidebar');
    if (sidebar) {
        sidebar.remove();
        adjustYouTubeLayout(0); // Reset YouTube layout
    } else {
        injectSidebar();
    }
}

function injectSidebar() {
    // Check if sidebar already exists
    if (document.getElementById('yt-transcript-sidebar')) {
        // Sidebar already exists
        refreshSidebarContent();
        return;
    }

    // Create the sidebar container
    const sidebar = document.createElement('div');
    sidebar.id = 'yt-transcript-sidebar';
    // Set sidebar styles
    sidebar.style.position = 'fixed';
    sidebar.style.top = '0';
    sidebar.style.right = '0';
    sidebar.style.width = '450px';
    sidebar.style.height = '100%';
    sidebar.style.zIndex = '2147483646'; // One less than the masthead
    sidebar.style.boxShadow = '-5px 0 10px rgba(0,0,0,0.2)';
    sidebar.style.overflow = 'auto';
    sidebar.style.display = 'flex';
    sidebar.style.flexDirection = 'column';
    sidebar.style.transition = 'transform 0.3s ease';

    // Adjust YouTube layout
    adjustYouTubeLayout(450); // Use the same width as the sidebar

    // Append the sidebar to the body before adding content
    document.body.appendChild(sidebar);

    // Fetch and inject the HTML content
    fetch(chrome.runtime.getURL('sidebar.html'))
        .then(response => response.text())
        .then(html => {
            sidebar.innerHTML = html;

            // Fetch and inject the CSS styles
            fetch(chrome.runtime.getURL('sidebar.css'))
                .then(response => response.text())
                .then(css => {
                    const style = document.createElement('style');
                    style.textContent = css;
                    document.head.appendChild(style);

                    // Apply dark mode if needed
                    applyDarkMode();

                    // Initialize the sidebar AFTER the DOM elements are added
                    initializeSidebar();
                })
                .catch(error => console.error('Error loading sidebar CSS:', error));
        })
        .catch(error => console.error('Error loading sidebar HTML:', error));
}

// Dark mode detection and application
function applyDarkMode() {
    const bodyClasses = document.body.classList;
    const isDarkMode = bodyClasses.contains('dark');

    const sidebar = document.getElementById('yt-transcript-sidebar');
    if (sidebar && isDarkMode) {
        sidebar.classList.add('dark-mode');
    }
}

function initializeSidebar() {
    // Assign variables after the sidebar has been injected
    LoadingElement = () => document.getElementById('yt-sidebar-loading');
    ChatContainer = () => document.getElementById('yt-sidebar-chatContainer');
    MessagesContainer = () => document.getElementById('yt-sidebar-messages');
    ChatInput = () => document.getElementById('yt-sidebar-chatInput');
    SendMessageButton = () => document.getElementById('yt-sidebar-sendMessage');
    StatusElement = () => document.getElementById('yt-sidebar-status');
    SaveApiKeyButton = () => document.getElementById('yt-sidebar-saveApiKey');
    ApiKeyInput = () => document.getElementById('yt-sidebar-apiKey');
    ConfigIcon = () => document.getElementById('yt-sidebar-configIcon');
    ToggleButton = () => document.getElementById('yt-sidebar-toggleButton');
    ApiKeySection = () => document.getElementById('yt-sidebar-apiKeySection');

    // Ensure that the elements are available before adding event listeners
    if (!StatusElement()) {
        console.error('StatusElement not found.');
        return;
    }

    // Event listeners and functions
    SaveApiKeyButton().addEventListener('click', () => {
        const apiKey = ApiKeyInput().value.trim();
        if (apiKey) {
            chrome.storage.sync.set({ openaiApiKey: apiKey }, () => {
                StatusElement().textContent = 'API Key Saved.';
                ApiKeyInput().value = '';
                checkApiKey();
            });
        } else {
            StatusElement().textContent = 'API Key cannot be empty.';
        }
    });

    ConfigIcon().addEventListener('click', () => {
        ApiKeySection().classList.toggle('visible');
    });

    ToggleButton().addEventListener('click', () => {
        toggleSidebar();
    });

    ChatInput().addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            SendMessageButton().click();
        }
    });

    SendMessageButton().addEventListener('click', async () => {
        const message = ChatInput().value.trim();
        if (!message) return;

        appendMessage('User', message);
        ChatInput().value = '';

        try {
            const { openaiApiKey } = await fetchApiKey();
            if (!openaiApiKey) {
                throw new Error('API Key not found.');
            }

            const openAI = new OpenAIWrapper(openaiApiKey);
            const fullContext = [...conversationHistory];

            console.log("the full context is", fullContext);

            const reader = await openAI.generateStreamResponse(fullContext);
            let assistantMessage = '';
            let buffer = '';

            // Append an empty assistant message
            appendMessage('Assistant', '', false);
            const lastMessageElement = MessagesContainer().lastElementChild;
            const textSpan = lastMessageElement.querySelector('span:last-child');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += new TextDecoder("utf-8").decode(value);
                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.replace(/^data: /, '').trim();
                        if (data === '[DONE]') {
                            updateConversation('assistant', assistantMessage);
                            return;
                        }
                        if (data) {
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content;
                                if (content) {
                                    assistantMessage += content;

                                    // Update the message content with timestamp links
                                    updateAssistantMessageContent(textSpan, assistantMessage);

                                    MessagesContainer().scrollTop = MessagesContainer().scrollHeight;
                                }
                            } catch (error) {
                                console.error('Error parsing stream chunk:', error, 'Data:', data);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error(error);
            appendMessage('Assistant', 'Error fetching response.');
        }
    });

    // Now call checkApiKey after everything is initialized
    checkApiKey();
}

function refreshSidebarContent() {
    // Re-initialize the sidebar elements
    initializeSidebar();

    // Clear previous state
    clearMessages();
    conversationHistory = [];
    isSummarizing = false;

    // Restart summarization for the new video
    checkApiKey();
}

// Function definitions

async function startSummarization() {
    if (isSummarizing) return;
    isSummarizing = true;

    clearMessages();
    ChatContainer().style.display = 'none';
    toggleLoading(true); // Show loading spinner initially

    try {
        const { openaiApiKey } = await fetchApiKey();
        if (!openaiApiKey) {
            throw new Error('API Key not found.');
        }

        const videoData = await fetchVideoData();
        if (!videoData || videoData.transcript === 'Transcript not available.') {
            appendMessage('Assistant', 'Transcript not available.');
            return;
        }

        const { title, description, transcript } = videoData;

        initializeConversation(transcript, title, description);

        const openAI = new OpenAIWrapper(openaiApiKey);
        const reader = await openAI.generateStreamResponse(conversationHistory);

        // Initialize assistant message
        let assistantMessage = '';
        toggleLoading(false); // Hide loading spinner before appending the first message
        appendMessage('Assistant', '', false);
        const lastMessageElement = MessagesContainer().lastElementChild;
        const textSpan = lastMessageElement.querySelector('span.message-content');

        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop();

            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('data: ')) {
                    const data = line.slice('data: '.length);
                    if (data === '[DONE]') {
                        updateConversation('assistant', assistantMessage);
                        break;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            assistantMessage += content;
                            updateAssistantMessageContent(textSpan, assistantMessage);
                            MessagesContainer().scrollTop = MessagesContainer().scrollHeight;
                        }
                    } catch (error) {
                        console.error('Error parsing stream data:', error);
                    }
                }
            }
        }
    } catch (error) {
        console.error(error);
        toggleLoading(false); // Hide loading spinner in case of error
        appendMessage('Assistant', 'Error fetching summary.', false);
    } finally {
        isSummarizing = false;
        ensureChatContainerVisible();
    }
}

function appendMessage(sender, message, addToHistory = true) {
    ensureChatContainerVisible();

    const messageElement = document.createElement('div');
    messageElement.className = sender.toLowerCase();

    const iconSpan = document.createElement('span');
    iconSpan.className = 'sender-icon';
    iconSpan.textContent = sender === 'User' ? '👤' : '🤖';

    const textSpan = document.createElement('span');
    textSpan.className = 'message-content';

    if (message) {
        // Sanitize and parse message content
        let sanitizedContent = DOMPurify.sanitize(marked.parse(message));

        // Find timestamps and replace them with clickable links
        const timestampRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
        sanitizedContent = sanitizedContent.replace(timestampRegex, (match) => {
            return `<a href="#" class="timestamp-link" data-timestamp="${match}">${match}</a>`;
        });

        textSpan.innerHTML = sanitizedContent;
    }

    messageElement.appendChild(iconSpan);
    messageElement.appendChild(textSpan);
    MessagesContainer().appendChild(messageElement);
    MessagesContainer().scrollTop = MessagesContainer().scrollHeight;

    if (addToHistory) {
        const role = sender.toLowerCase() === 'assistant' ? 'assistant' : 'user';
        conversationHistory.push({ role, content: message });
    }

    // Add event listeners to timestamp links
    textSpan.querySelectorAll('.timestamp-link').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const timestamp = event.target.getAttribute('data-timestamp');
            seekToTimestamp(timestamp);
        });
    });
}

// New function to update assistant message content during streaming
function updateAssistantMessageContent(textSpan, message) {
    // Sanitize and parse message content
    let sanitizedContent = DOMPurify.sanitize(marked.parse(message));

    // Find timestamps and replace them with clickable links
    const timestampRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
    sanitizedContent = sanitizedContent.replace(timestampRegex, (match) => {
        return `<a href="#" class="timestamp-link" data-timestamp="${match}">${match}</a>`;
    });

    textSpan.innerHTML = sanitizedContent;

    // Re-attach event listeners to the new timestamp links
    textSpan.querySelectorAll('.timestamp-link').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const timestamp = event.target.getAttribute('data-timestamp');
            seekToTimestamp(timestamp);
        });
    });
}

async function fetchApiKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['openaiApiKey'], (result) => {
            resolve(result);
        });
    });
}

async function checkApiKey() {
    const { openaiApiKey } = await fetchApiKey();
    if (openaiApiKey) {
        StatusElement().textContent = 'API Key Loaded.';
        await startSummarization();
    } else {
        StatusElement().textContent = 'Please enter your OpenAI API Key.';
    }
}

function toggleLoading(show) {
    LoadingElement().style.display = show ? 'flex' : 'none';
}

function clearMessages() {
    MessagesContainer().innerHTML = '';
}

function ensureChatContainerVisible() {
    if (ChatContainer().style.display === 'none' || ChatContainer().style.display === '') {
        ChatContainer().style.display = 'flex';
    }
}

function initializeConversation(transcript, title, description) {
    const content = `
Generate a highly useful and user-friendly summary of the following YouTube video:
Title: ${title}
Description: ${description}
Transcript:
${transcript}`;

    conversationHistory = [
        {
            role: 'system',
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

3. **Content Focus**:
   - **Do not include a conclusion or closing remarks**.
   - **Avoid any section titled "Conclusion"**.
   - Highlight key points and important information that deliver the most value to the user.
   - **Focus on delivering answers and insights without requiring the user to watch the entire video**.
   - Use timestamps in the format **(hh:mm:ss)** to reference specific moments in the video.

4. **Timestamps**:
   - Include **accurate timestamps** next to each heading.
   - Ensure timestamps correspond to the relevant sections in the video.

5. **Style and Tone**:
   - Write in **clear, neutral language** using the **third person**.
   - Use **complete sentences** in descriptions.
   - **Do not include emojis**, symbols, or unnecessary characters.

6. **Formatting**:
   - Begin with the initial brief summary and the direct answer to the title's question, followed by the structured summary with headings.
   - **Do not include any introductory text or summary headline** before the brief summary.
   - Maintain consistent formatting throughout the summary.

Proceed to generate the summary based on the provided content, ensuring it is as informative and accessible as possible for users, and addresses the specified guidelines.`
                },
                {
                    role: 'user',
                    content: content
                }
    ];
}





function updateConversation(role, content) {
    conversationHistory.push({ role, content });
}

class OpenAIWrapper {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async generateStreamResponse(context) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: context,
                max_tokens: 3000,
                temperature: 0.1,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }

        return response.body.getReader();
    }
}

// Add this function to adjust the YouTube layout
function adjustYouTubeLayout(sidebarWidth) {
    const ytdApp = document.querySelector('ytd-app');
    if (ytdApp) {
        ytdApp.style.marginRight = `${sidebarWidth}px`;
    }

    const masthead = document.querySelector('ytd-masthead');
    if (masthead) {
        masthead.style.width = `calc(100% - ${sidebarWidth}px)`;
        masthead.style.position = 'fixed';
        masthead.style.zIndex = '2147483647';
    }

    // Adjust the guide (left menu) to ensure it stays visible
    const guide = document.querySelector('ytd-guide-section-renderer');
    if (guide) {
        guide.style.position = 'fixed';
        guide.style.zIndex = '2147483645';
    }
}

async function fetchVideoData() {
    const videoId = getVideoId();
    const YT_INITIAL_PLAYER_RESPONSE_RE = /ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)/;

    try {
        const response = await fetch('https://www.youtube.com/watch?v=' + videoId);
        const body = await response.text();
        const playerResponse = body.match(YT_INITIAL_PLAYER_RESPONSE_RE);

        if (!playerResponse) {
            console.warn('Unable to parse playerResponse');
            return null;
        }

        const player = JSON.parse(playerResponse[1]);
        return {
            title: player.videoDetails.title,
            description: player.videoDetails.shortDescription,
            transcript: await fetchTranscript(player)
        };
    } catch (error) {
        console.error('Error retrieving video data:', error);
        return null;
    }
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0')
    ].join(':');
}

async function fetchTranscript(player) {
    try {
        const tracks = player.captions.playerCaptionsTracklistRenderer.captionTracks;
        tracks.sort(compareTracks);

        const transcriptResponse = await fetch(tracks[0].baseUrl + '&fmt=json3');
        const transcript = await transcriptResponse.json();

        const lines = transcript.events
            .filter(event => event.segs)
            .map(event => {
                const startTimeMs = event.tStartMs || 0;
                const startTime = formatTime(startTimeMs);
                const text = event.segs
                    .map(seg => seg.utf8)
                    .join(' ')
                    .replace(/[\u200B-\u200D\uFEFF]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (text) {
                    return `${startTime} - ${text}`;
                } else {
                    return null;
                }
            })
            .filter(line => line !== null);

        return lines.join('\n');
    } catch (error) {
        console.error('Error retrieving transcript:', error);
        return 'Transcript not available.';
    }
}
