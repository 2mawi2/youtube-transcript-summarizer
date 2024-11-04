export type CacheData = {
  contentHash: string;
  summary: string;
};

export async function getCachedSummary(videoId: string): Promise<CacheData> {
  const result = await chrome.storage.local.get([videoId]);
  return result[videoId] || null;
}

export async function cacheSummary(videoId: string, summary: string, contentHash: string): Promise<void> {
  await chrome.storage.local.set({ [videoId]: { summary, contentHash } });
}
