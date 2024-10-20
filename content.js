class TranscriptHandler {
    constructor() { }

    async getTranscript(sendResponse) {
        try {
            const transcript = await extractTranscriptFromPage();
            if (transcript) {
                console.log('Transcript extracted successfully.');
                sendResponse(transcript);
            } else {
                console.log('Transcript not available.');
                sendResponse('Transcript not available.');
            }
        } catch (error) {
            console.error('Error extracting transcript:', error);
            sendResponse('Transcript not available.');
        }
        return true;
    }

    async getTitle(sendResponse) {
        try {
            const title = await extractTitleFromPage();
            if (title) {
                console.log('Title extracted successfully.');
                sendResponse(title);
            } else {
                console.log('Title not available.');
                sendResponse('Title not available.');
            }
        } catch (error) {
            console.error('Error extracting title:', error);
            sendResponse('Title not available.');
        }
    }

    async getDescription(sendResponse) {
        try {
            const description = await extractDescriptionFromPage();
            if (description) {
                console.log('Description extracted successfully.');
                sendResponse(description);
            } else {
                console.log('Description not available.');
                sendResponse('Description not available.');
            }
        } catch (error) {
            console.error('Error extracting description:', error);
            sendResponse('Description not available.');
        }
    }

    seekToTimestamp(timestamp) {
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

    async getVideoId() {
        const url = new URL(window.location.href);
        return url.searchParams.get('v');
    }
}

const handler = new TranscriptHandler();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTranscript') {
        handler.getTranscript(sendResponse);
        return true;
    } else if (request.action === 'getTitle') {
        handler.getTitle(sendResponse);
        return true;
    } else if (request.action === 'getDescription') {
        handler.getDescription(sendResponse);
        return true;
    } else if (request.action === 'seekToTimestamp') {
        handler.seekToTimestamp(request.timestamp);
    } else if (request.action === 'toggleSidebar') {
        toggleSidebar();
    }
});

// Functions to extract data from YouTube's page

function extractPlayerResponseFromScripts() {
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
        if (script.textContent.includes('ytInitialPlayerResponse')) {
            const text = script.textContent;
            const jsonStr = text.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/s);
            if (jsonStr && jsonStr[1]) {
                try {
                    const playerResponse = JSON.parse(jsonStr[1]);
                    return playerResponse;
                } catch (error) {
                    console.error('Error parsing ytInitialPlayerResponse:', error);
                }
            }
            break;
        }
    }
    return null;
}

async function extractTranscriptFromPage() {
    const playerResponse = extractPlayerResponseFromScripts();
    if (playerResponse && playerResponse.captions && playerResponse.captions.playerCaptionsTracklistRenderer) {
        const captionTracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
        if (captionTracks && captionTracks.length > 0) {
            const captionTrack = captionTracks.find(track => track.languageCode === 'en') || captionTracks[0];
            const captionUrl = captionTrack.baseUrl;
            const transcript = await fetchTranscript(captionUrl);
            return transcript;
        }
    }
    return null;
}

async function fetchTranscript(captionUrl) {
    const response = await fetch(captionUrl);
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const texts = xml.getElementsByTagName('text');
    const transcript = Array.from(texts).map(node => {
        const time = parseFloat(node.getAttribute('start'));
        const text = node.textContent.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        const timestamp = formatTimestamp(time);
        return `${timestamp} ${text}`;
    }).join('\n');
    return transcript;
}

function formatTimestamp(time) {
    const hrs = Math.floor(time / 3600);
    const mins = Math.floor((time % 3600) / 60);
    const secs = Math.floor(time % 60);
    if (hrs > 0) {
        return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }
}

async function extractTitleFromPage() {
    const playerResponse = extractPlayerResponseFromScripts();
    if (playerResponse && playerResponse.videoDetails && playerResponse.videoDetails.title) {
        return playerResponse.videoDetails.title;
    }
    return null;
}

async function extractDescriptionFromPage() {
    const playerResponse = extractPlayerResponseFromScripts();
    if (playerResponse && playerResponse.videoDetails && playerResponse.videoDetails.shortDescription) {
        return playerResponse.videoDetails.shortDescription;
    }
    return null;
}

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
    // Define variables and functions AFTER the sidebar has been injected
    const LoadingElement = () => document.getElementById('yt-sidebar-loading');
    const ChatContainer = () => document.getElementById('yt-sidebar-chatContainer');
    const MessagesContainer = () => document.getElementById('yt-sidebar-messages');
    const ChatInput = () => document.getElementById('yt-sidebar-chatInput');
    const SendMessageButton = () => document.getElementById('yt-sidebar-sendMessage');
    const StatusElement = () => document.getElementById('yt-sidebar-status');
    const SaveApiKeyButton = () => document.getElementById('yt-sidebar-saveApiKey');
    const ApiKeyInput = () => document.getElementById('yt-sidebar-apiKey');
    const ConfigIcon = () => document.getElementById('yt-sidebar-configIcon');
    const ToggleButton = () => document.getElementById('yt-sidebar-toggleButton');
    const ApiKeySection = () => document.getElementById('yt-sidebar-apiKeySection');

    // Ensure that the elements are available before adding event listeners
    if (!StatusElement()) {
        console.error('StatusElement not found.');
        return;
    }

    // Variables for state management
    let isSummarizing = false;
    let conversationHistory = [];

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
            const fullContext = [...conversationHistory, { role: 'user', content: message }];

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

    // Function definitions

    async function startSummarization() {
        if (isSummarizing) return;
        isSummarizing = true;
    
        toggleLoading(true);
        clearMessages();
        ChatContainer().style.display = 'none';
    
        try {
            const { openaiApiKey } = await fetchApiKey();
            if (!openaiApiKey) {
                throw new Error('API Key not found.');
            }
    
            const videoId = await handler.getVideoId();
            const transcript = await new Promise((resolve) => {
                handler.getTranscript((result) => {
                    resolve(result);
                });
            });
            const title = await new Promise((resolve) => {
                handler.getTitle((result) => {
                    resolve(result);
                });
            });
            const description = await new Promise((resolve) => {
                handler.getDescription((result) => {
                    resolve(result);
                });
            });

            if (!transcript || transcript === 'Transcript not available.') {
                appendMessage('Assistant', 'Transcript not available.');
                return;
            }

            const contentHash = await generateContentHash(videoId, transcript, title, description);
            const cachedData = await getCachedSummary(videoId);

            if (cachedData && cachedData.contentHash === contentHash) {
                appendMessage('Assistant', cachedData.summary, false);
                conversationHistory = [
                    { role: 'assistant', content: cachedData.summary }
                ];
                return;
            }

            initializeConversation(transcript, title, description);
    
            const openAI = new OpenAIWrapper(openaiApiKey);
            const reader = await openAI.generateStreamResponse(conversationHistory);
    
            // Initialize assistant message
            let assistantMessage = '';
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
                            await cacheSummary(videoId, assistantMessage, contentHash);
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
            appendMessage('Assistant', 'Error fetching summary.', false);
        } finally {
            toggleLoading(false);
            isSummarizing = false;
            ensureChatContainerVisible();
        }
    }

    async function generateContentHash(videoId, transcript, title, description) {
        const content = `${videoId}|${title}|${description}|${transcript}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
                handler.seekToTimestamp(timestamp);
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
                handler.seekToTimestamp(timestamp);
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
        const content = `Title: ${title}\nDescription: ${description}\nTranscript:\n${transcript}`;
        conversationHistory = [
            {
                role: 'system',
                content: 'Provide a concise summary of the following YouTube video, referencing specific timestamps (in the format mm:ss) when appropriate. The summary should focus on the key points and highlights. Keep the summary brief and informative.'
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

        async generateResponse(messages) {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    max_tokens: 3000,
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        }
    }

    const toggleButton = document.getElementById('yt-sidebar-toggleButton');
    const sidebar = document.getElementById('yt-transcript-sidebar');

    if (toggleButton && sidebar) {
        toggleButton.addEventListener('click', () => {
            sidebar.classList.toggle('hidden');
            console.log('Toggle button clicked'); // Add this line for debugging
        });
    } else {
        console.error('Toggle button or sidebar not found');
    }

    async function getCachedSummary(videoId) {
        return new Promise((resolve) => {
            chrome.storage.local.get([videoId], (result) => {
                resolve(result[videoId] || null);
            });
        });
    }

    async function cacheSummary(videoId, summary, contentHash) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [videoId]: { summary, contentHash } }, resolve);
        });
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
