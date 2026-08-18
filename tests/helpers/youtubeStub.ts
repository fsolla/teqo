/**
 * Port/URL of the YouTube Data API stub the e2e board (S2) fetches. The single
 * spelling of the derivation: dev servers live in 3100..4099 (worktree slots,
 * capped at 999), so +1000 never collides with another worktree's dev server;
 * CI stays on 4000. Shared by playwright.config.ts (webServer + env) and the
 * frontend spec (state switches) so the two cannot drift apart.
 */
export const youtubeStubUrlFor = (baseURL: string): string => {
  const port = new URL(baseURL).port || (baseURL.startsWith('https:') ? '443' : '80')
  return `http://localhost:${Number(port) + 1000}`
}
