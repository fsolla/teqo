/**
 * Browser-side memory for the biometric-enrollment prompt (B40). Sibling of
 * `recentVisits.ts` / `campaignGeolocation.ts`: no Payload, no Next, just
 * `localStorage` behind failure-tolerant reads.
 *
 * Two flags, and the split is the whole point: the server knows HOW MANY
 * passkeys an account has, never WHICH device it is being read on. So "already
 * enrolled here" and "stop offering" can only be answered locally, and they are
 * kept in `localStorage` rather than `sessionStorage` — a decision about this
 * phone should outlive the tab (the PWA install toast, which is a suggestion
 * rather than an answer, deliberately uses `sessionStorage` instead).
 */

const CAMPAIGN_BIOMETRICS_ENROLLED_KEY = 'teqo:campaign:biometrics-enrolled'
/** Exported because the e2e spec pre-sets it instead of hardcoding the string. */
export const CAMPAIGN_BIOMETRICS_PROMPT_DISMISSED_KEY = 'teqo:campaign:biometrics-prompt-dismissed'

const read = (key: string): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    // localStorage throws in private mode / with storage disabled.
    return false
  }
}

const write = (key: string): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Ignore quota / private-mode failures: the prompt reappearing is a far
    // smaller problem than a thrown error inside a toast callback.
  }
}

const clear = (key: string): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Same tolerance as above.
  }
}

export const wasCampaignBiometricsEnrolledHere = (): boolean =>
  read(CAMPAIGN_BIOMETRICS_ENROLLED_KEY)

export const markCampaignBiometricsEnrolledHere = (): void =>
  write(CAMPAIGN_BIOMETRICS_ENROLLED_KEY)

/**
 * Called when the account has no passkeys at all: whatever this browser
 * believed about "enrolled here" is stale, and a person who revoked every
 * device should be offered enrollment again.
 */
export const forgetCampaignBiometricsEnrollment = (): void =>
  clear(CAMPAIGN_BIOMETRICS_ENROLLED_KEY)

export const wasCampaignBiometricsPromptDismissed = (): boolean =>
  read(CAMPAIGN_BIOMETRICS_PROMPT_DISMISSED_KEY)

export const dismissCampaignBiometricsPrompt = (): void =>
  write(CAMPAIGN_BIOMETRICS_PROMPT_DISMISSED_KEY)
