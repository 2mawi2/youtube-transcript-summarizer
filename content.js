class TranscriptHandler {
    constructor() {}

    openDescription() {
        const showMoreButton = document.querySelector('tp-yt-paper-button[aria-label="Show more"]');
        if (showMoreButton && showMoreButton.offsetParent !== null) {
            console.log('Found "Show more" button. Clicking to expand description.');
            showMoreButton.click();
            return true;
        }
        console.log('"Show more" button not found or already expanded.');
        return false;
    }

    openTranscript() {
      const transcriptSection = document.querySelector('ytd-video-description-transcript-section-renderer');
      if (transcriptSection) {
          const transcriptButton = transcriptSection.querySelector('ytd-button-renderer button');
          if (transcriptButton) {
              console.log('Found "Show Transcript" button. Clicking to open transcript.');
              transcriptButton.click();
              return true;
          } else {
              console.log('"Show Transcript" button not found within transcript section.');
          }
      } else {
          console.log('"Transcript section" not found in the description.');
      }
      return false;
  }
  

    extractTranscript() {
        const transcriptRenderer = document.querySelector('ytd-transcript-renderer');
        if (transcriptRenderer) {
            console.log('Transcript renderer found. Extracting transcript.');
            const segments = transcriptRenderer.querySelectorAll('ytd-transcript-segment-renderer');
            const transcript = Array.from(segments).map(segment => {
                const timestampElement = segment.querySelector('.segment-timestamp');
                const textElement = segment.querySelector('.segment-text');
                const timestamp = timestampElement ? timestampElement.textContent.trim() : '';
                const text = textElement ? textElement.textContent.trim() : '';
                return timestamp && text ? `${timestamp} ${text}` : null;
            }).filter(entry => entry !== null).join('\n');
            return transcript;
        }
        console.log('Transcript renderer not found.');
        return null;
    }

    async getTranscript(sendResponse) {
      const transcript = this.extractTranscript();
      if (transcript) {
          console.log('Transcript extracted successfully.');
          sendResponse(transcript);
      } else {
          console.log('Transcript not found. Attempting to open transcript.');
          const transcriptOpened = this.openTranscript();
          if (transcriptOpened) {
              console.log('Transcript opened successfully. Waiting for transcript to load.');
              const observer = new MutationObserver((mutations, obs) => {
                  const newTranscript = this.extractTranscript();
                  if (newTranscript) {
                      console.log('Transcript loaded after opening transcript.');
                      sendResponse(newTranscript);
                      obs.disconnect();
                  }
              });
  
              observer.observe(document.body, { childList: true, subtree: true });
  
              setTimeout(() => {
                  if (!this.extractTranscript()) {
                      console.log('Transcript loading timed out.');
                      sendResponse('Transcript not available.');
                      observer.disconnect();
                  }
              }, 10000);
  
          } else {
              console.log('Failed to open transcript.');
              sendResponse('Transcript not available.');
          }
      }
      return true;
  }
  
}

const handler = new TranscriptHandler();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTranscript') {
        handler.getTranscript(sendResponse);
        return true; 
    }
});
