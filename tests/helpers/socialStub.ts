/**
 * Port/URL of the social-feed stubs the e2e board (S2 YouTube, S3 Instagram)
 * fetches. The single spelling of the derivation: dev servers live in
 * 3100..4099 (worktree slots, capped at 999), so the offsets never collide
 * with another worktree's dev server or with each other; CI stays on 4000
 * (YouTube) and 5000 (Instagram). Shared by playwright.config.ts (webServer +
 * env) and the frontend spec (state switches) so the two cannot drift apart.
 */
export const youtubeStubUrlFor = (baseURL: string): string => {
  const port = new URL(baseURL).port || (baseURL.startsWith('https:') ? '443' : '80')
  return `http://localhost:${Number(port) + 1000}`
}

export const instagramStubUrlFor = (baseURL: string): string => {
  const port = new URL(baseURL).port || (baseURL.startsWith('https:') ? '443' : '80')
  return `http://localhost:${Number(port) + 2000}`
}
