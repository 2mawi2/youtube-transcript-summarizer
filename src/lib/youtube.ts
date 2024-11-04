export async function fetchVideoData() {
  const videoId = getVideoId();
  const YT_INITIAL_PLAYER_RESPONSE_RE =
    /ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)/;

  try {
    const response = await fetch("https://www.youtube.com/watch?v=" + videoId);
    const body = await response.text();
    const playerResponse = body.match(YT_INITIAL_PLAYER_RESPONSE_RE);

    if (!playerResponse) {
      console.warn("Unable to parse playerResponse");
      return null;
    }

    const player = JSON.parse(playerResponse[1]);
    return {
      title: player.videoDetails.title,
      description: player.videoDetails.shortDescription,
      transcript: await fetchTranscript(player),
    };
  } catch (error) {
    console.error("Error retrieving video data:", error);
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

export async function fetchTranscript(player: any) {
  try {
    const tracks = player.captions.playerCaptionsTracklistRenderer.captionTracks;

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
    console.error("Error retrieving transcript:", error);
    return "Transcript not available.";
  }
}

export function getVideoId(): string {
  const url = new URL(globalThis.location.href);
  const videoId = url.searchParams.get("v");
  if (!videoId) {
    throw new Error("VideoId not found in url");
  }
  return videoId;
}

export function seekToTimestamp(timestamp: string): void {
  const timeParts = timestamp.split(":").map(Number);
  let seconds = 0;
  if (timeParts.length === 3) {
    seconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
  } else if (timeParts.length === 2) {
    seconds = timeParts[0] * 60 + timeParts[1];
  } else {
    seconds = timeParts[0];
  }
  const video = document.querySelector("video");
  if (video) {
    video.currentTime = seconds;
    video.play();
  }
}

export function compareTracks(track1: any, track2: any) {
  const langCode1 = track1.languageCode;
  const langCode2 = track2.languageCode;

  if (langCode1 === "en" && langCode2 !== "en") {
    return -1; // English comes first
  } else if (langCode1 !== "en" && langCode2 === "en") {
    return 1; // English comes first
  } else if (track1.kind !== "asr" && track2.kind === "asr") {
    return -1; // Non-ASR comes first
  } else if (track1.kind === "asr" && track2.kind !== "asr") {
    return 1; // Non-ASR comes first
  }

  return 0; // Preserve order if both have the same priority
}

export function adjustYouTubeLayout(sidebarWidth: number) {
  const ytdApp = document.querySelector("ytd-app") as HTMLElement;
  if (ytdApp) {
    ytdApp.style.marginRight = `${sidebarWidth}px`;
  }

  const masthead = document.querySelector("ytd-masthead") as HTMLElement;
  if (masthead) {
    masthead.style.width = `calc(100% - ${sidebarWidth}px)`;
    masthead.style.position = "fixed";
    masthead.style.zIndex = "2147483647";
  }

  // Adjust the guide (left menu) to ensure it stays visible
  const guide = document.querySelector("ytd-guide-section-renderer") as HTMLElement;
  if (guide) {
    guide.style.position = "fixed";
    guide.style.zIndex = "2147483645";
  }
}
