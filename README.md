# YouTube Transcript Summarizer

A Chrome extension that fetches and summarizes YouTube video transcripts using OpenAI's language models.

## Features

- **Automatic Transcript Retrieval:** Extracts transcripts from YouTube videos.
- **Concise Summaries:** Generates brief and informative summaries highlighting key points.
- **Streamed Responses:** Provides real-time updates as summaries are generated.
- **Secure API Key Management:** Allows users to securely store and manage their OpenAI API keys.

## Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-username/youtube-transcript-summarizer.git
   ```
2. **Navigate to the Extension Directory:**
   ```bash
   cd youtube-transcript-summarizer
   ```
3. **Build the extension**
   - Make sure [Deno](https://deno.land/) is installed
   - Run `deno run build` (or `deno run dev` to watch for changes)
4. **Load the Extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer mode** using the toggle in the top right corner.
   - Click on **Load unpacked** and select the cloned repository folder.
5. **Obtain an OpenAI API Key:**
   - Sign up at [OpenAI](https://openai.com/) and generate an API key.
   - Open the extension popup and enter your API key when prompted.

## Usage

1. **Navigate to a YouTube Video:**

   - Open any YouTube video that has a transcript available.

2. **Activate the Extension:**

   - Click on the extension icon in the Chrome toolbar.
   - The extension will automatically fetch the transcript and generate a summary.

3. **Interact with the Chat Interface:**
   - Use the chat interface to ask questions or request further summaries based on the transcript.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the [MIT License](LICENSE).
