let isSummarizing = false;
let conversationHistory = [];

const LoadingElement = () => document.getElementById('loading');
const ChatContainer = () => document.getElementById('chatContainer');
const MessagesContainer = () => document.getElementById('messages');
const ChatInput = () => document.getElementById('chatInput');
const SendMessageButton = () => document.getElementById('sendMessage');
const StatusElement = () => document.getElementById('status');
const SaveApiKeyButton = () => document.getElementById('saveApiKey');
const ApiKeyInput = () => document.getElementById('apiKey');
const SummarizeButton = () => document.getElementById('summarize');
const ConfigIcon = () => document.getElementById('configIcon');

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

        const activeTab = await getActiveTab();
        const transcript = await fetchTranscript(activeTab.id);

        if (!transcript || transcript === 'Transcript not available.') {
            appendMessage('Assistant', 'Transcript not available.');
            return;
        }

        initializeConversation(transcript);

        const openAI = new OpenAIWrapper(openaiApiKey);
        const summary = await openAI.generateResponse(conversationHistory);

        if (summary) {
            updateConversation('assistant', summary);
            appendMessage('Assistant', summary, false);
        } else {
            appendMessage('Assistant', 'Summary could not be generated.', false);
        }
    } catch (error) {
        console.error(error);
        appendMessage('Assistant', 'Error fetching summary.', false);
    } finally {
        toggleLoading(false);
        isSummarizing = false;
    }
}

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
                                textSpan.innerHTML = DOMPurify.sanitize(marked.parse(assistantMessage));
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
        const sanitizedContent = DOMPurify.sanitize(marked.parse(message));
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
}

async function fetchApiKey() {
    const result = await chrome.storage.sync.get(['openaiApiKey']);
    return result;
}

async function checkApiKey() {
    const { openaiApiKey } = await fetchApiKey();
    if (openaiApiKey) {
        StatusElement().textContent = 'API Key Loaded.';
        startSummarization();
    } else {
        StatusElement().textContent = 'Please enter your OpenAI API Key.';
    }
}

document.addEventListener('DOMContentLoaded', checkApiKey);

SaveApiKeyButton().addEventListener('click', () => {
    const apiKey = ApiKeyInput().value.trim();
    if (apiKey) {
        chrome.storage.sync.set({ openaiApiKey: apiKey }, () => {
            StatusElement().textContent = 'API Key Saved.';
            SummarizeButton().disabled = false;
            ApiKeyInput().value = '';
        });
    } else {
        StatusElement().textContent = 'API Key cannot be empty.';
    }
});

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

ChatInput().addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        SendMessageButton().click();
    }
});

ConfigIcon().addEventListener('click', () => {
    const apiKeySection = document.getElementById('apiKeySection');
    apiKeySection.classList.toggle('visible');
});

// Helper Functions
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

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

async function fetchTranscript(tabId) {
    return chrome.tabs.sendMessage(tabId, { action: 'getTranscript' });
}

function initializeConversation(transcript) {
    conversationHistory = [
        {
            role: 'system',
            content: 'Provide a concise summary of the following YouTube video, focusing on the key points and highlights. Keep the summary brief and informative.'
        },
        {
            role: 'user',
            content: transcript
        }
    ];
}

function updateConversation(role, content) {
    conversationHistory.push({ role, content });
}